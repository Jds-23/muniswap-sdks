import { type BigintIsh, type Currency, CurrencyAmount, type Percent, type Price } from '@uniswap/sdk-core-next'
import {
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
  getAmount0Delta,
  getAmount1Delta,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  maxLiquidityForAmounts,
} from '@uniswap/v3-sdk-next'

// Max uint256 value
const MaxUint256 = 2n ** 256n - 1n
import invariant from 'tiny-invariant'
import type { AllowanceTransferPermitBatch } from '../PositionManager'
import { ZERO } from '../internalConstants'
import { tickToPrice } from '../utils/priceTickConversions'
import { Pool } from './pool'

interface PositionConstructorArgs {
  pool: Pool
  liquidity: BigintIsh
  tickLower: number
  tickUpper: number
}

// Tick bounds from V3
const MIN_TICK = -887272
const MAX_TICK = 887272

/**
 * Represents a position on a Uniswap V4 Pool
 * Similar to the V3 implementation but uses Currency instead of Token
 * and supports V4-specific features like hooks
 */
export class Position {
  public readonly pool: Pool
  public readonly tickLower: number
  public readonly tickUpper: number
  public readonly liquidity: bigint

  // Cached results for the getters
  private _token0Amount: CurrencyAmount<Currency> | null = null
  private _token1Amount: CurrencyAmount<Currency> | null = null
  private _mintAmounts: Readonly<{ amount0: bigint; amount1: bigint }> | null = null

  /**
   * Constructs a position for a given pool with the given liquidity
   * @param pool The pool for which the liquidity is assigned
   * @param liquidity The amount of liquidity that is in the position
   * @param tickLower The lower tick of the position
   * @param tickUpper The upper tick of the position
   */
  public constructor({ pool, liquidity, tickLower, tickUpper }: PositionConstructorArgs) {
    invariant(tickLower < tickUpper, 'TICK_ORDER')
    invariant(tickLower >= MIN_TICK && tickLower % pool.tickSpacing === 0, 'TICK_LOWER')
    invariant(tickUpper <= MAX_TICK && tickUpper % pool.tickSpacing === 0, 'TICK_UPPER')

    this.pool = pool
    this.tickLower = tickLower
    this.tickUpper = tickUpper
    this.liquidity = BigInt(liquidity)
  }

  /**
   * Returns the price of token0 at the lower tick
   */
  public get token0PriceLower(): Price<Currency, Currency> {
    return tickToPrice(this.pool.currency0, this.pool.currency1, this.tickLower)
  }

  /**
   * Returns the price of token0 at the upper tick
   */
  public get token0PriceUpper(): Price<Currency, Currency> {
    return tickToPrice(this.pool.currency0, this.pool.currency1, this.tickUpper)
  }

  /**
   * Returns the amount of token0 that this position's liquidity could be burned for at the current pool price
   */
  public get amount0(): CurrencyAmount<Currency> {
    if (!this._token0Amount) {
      if (this.pool.tickCurrent < this.tickLower) {
        this._token0Amount = CurrencyAmount.fromRawAmount(
          this.pool.currency0,
          getAmount0Delta(getSqrtRatioAtTick(this.tickLower), getSqrtRatioAtTick(this.tickUpper), this.liquidity, false)
        )
      } else if (this.pool.tickCurrent < this.tickUpper) {
        this._token0Amount = CurrencyAmount.fromRawAmount(
          this.pool.currency0,
          getAmount0Delta(this.pool.sqrtRatioX96, getSqrtRatioAtTick(this.tickUpper), this.liquidity, false)
        )
      } else {
        this._token0Amount = CurrencyAmount.fromRawAmount(this.pool.currency0, ZERO)
      }
    }
    return this._token0Amount
  }

  /**
   * Returns the amount of token1 that this position's liquidity could be burned for at the current pool price
   */
  public get amount1(): CurrencyAmount<Currency> {
    if (!this._token1Amount) {
      if (this.pool.tickCurrent < this.tickLower) {
        this._token1Amount = CurrencyAmount.fromRawAmount(this.pool.currency1, ZERO)
      } else if (this.pool.tickCurrent < this.tickUpper) {
        this._token1Amount = CurrencyAmount.fromRawAmount(
          this.pool.currency1,
          getAmount1Delta(getSqrtRatioAtTick(this.tickLower), this.pool.sqrtRatioX96, this.liquidity, false)
        )
      } else {
        this._token1Amount = CurrencyAmount.fromRawAmount(
          this.pool.currency1,
          getAmount1Delta(getSqrtRatioAtTick(this.tickLower), getSqrtRatioAtTick(this.tickUpper), this.liquidity, false)
        )
      }
    }
    return this._token1Amount
  }

  /**
   * Returns the lower and upper sqrt ratios if the price 'slips' up to slippage tolerance percentage
   * @param slippageTolerance The amount by which the price can 'slip'
   * @returns The sqrt ratios after slippage
   */
  private ratiosAfterSlippage(slippageTolerance: Percent): { sqrtRatioX96Lower: bigint; sqrtRatioX96Upper: bigint } {
    const priceLower = this.pool.token0Price.asFraction.multiply(slippageTolerance.subtract(1).multiply(-1n))
    const priceUpper = this.pool.token0Price.asFraction.multiply(slippageTolerance.add(1))

    let sqrtRatioX96Lower = encodeSqrtRatioX96(priceLower.numerator, priceLower.denominator)
    if (sqrtRatioX96Lower <= MIN_SQRT_RATIO) {
      sqrtRatioX96Lower = MIN_SQRT_RATIO + 1n
    }

    let sqrtRatioX96Upper = encodeSqrtRatioX96(priceUpper.numerator, priceUpper.denominator)
    if (sqrtRatioX96Upper >= MAX_SQRT_RATIO) {
      sqrtRatioX96Upper = MAX_SQRT_RATIO - 1n
    }

    return {
      sqrtRatioX96Lower,
      sqrtRatioX96Upper,
    }
  }

  /**
   * Returns the maximum amounts of token0 and token1 that must be sent in order to safely mint
   * the amount of liquidity held by the position with the given slippage tolerance.
   *
   * In V4, minting and increasing is protected by maximum amounts of token0 and token1.
   *
   * @param slippageTolerance Tolerance of unfavorable slippage from the current price
   * @returns The amounts, with slippage
   */
  public mintAmountsWithSlippage(slippageTolerance: Percent): Readonly<{ amount0: bigint; amount1: bigint }> {
    const { sqrtRatioX96Upper, sqrtRatioX96Lower } = this.ratiosAfterSlippage(slippageTolerance)

    // Construct counterfactual pools from the lower and upper bounded prices
    const poolLower = new Pool(
      this.pool.token0,
      this.pool.token1,
      this.pool.fee,
      this.pool.tickSpacing,
      this.pool.hooks,
      sqrtRatioX96Lower,
      0, // liquidity doesn't matter
      getTickAtSqrtRatio(sqrtRatioX96Lower)
    )
    const poolUpper = new Pool(
      this.pool.token0,
      this.pool.token1,
      this.pool.fee,
      this.pool.tickSpacing,
      this.pool.hooks,
      sqrtRatioX96Upper,
      0, // liquidity doesn't matter
      getTickAtSqrtRatio(sqrtRatioX96Upper)
    )

    // In V4, slippage is bounded by MAXIMUM amounts
    // The largest amount of token1 happens when price slips up, so use poolUpper
    // The largest amount of token0 happens when price slips down, so use poolLower
    const { amount1 } = new Position({
      pool: poolUpper,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).mintAmounts

    const { amount0 } = new Position({
      pool: poolLower,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).mintAmounts

    return { amount0, amount1 }
  }

  /**
   * Returns the minimum amounts that should be requested in order to safely burn the amount of
   * liquidity held by the position with the given slippage tolerance.
   *
   * @param slippageTolerance Tolerance of unfavorable slippage from the current price
   * @returns The amounts, with slippage
   */
  public burnAmountsWithSlippage(slippageTolerance: Percent): Readonly<{ amount0: bigint; amount1: bigint }> {
    const { sqrtRatioX96Upper, sqrtRatioX96Lower } = this.ratiosAfterSlippage(slippageTolerance)

    // Construct counterfactual pools
    const poolLower = new Pool(
      this.pool.currency0,
      this.pool.currency1,
      this.pool.fee,
      this.pool.tickSpacing,
      this.pool.hooks,
      sqrtRatioX96Lower,
      0, // liquidity doesn't matter
      getTickAtSqrtRatio(sqrtRatioX96Lower)
    )
    const poolUpper = new Pool(
      this.pool.currency0,
      this.pool.currency1,
      this.pool.fee,
      this.pool.tickSpacing,
      this.pool.hooks,
      sqrtRatioX96Upper,
      0, // liquidity doesn't matter
      getTickAtSqrtRatio(sqrtRatioX96Upper)
    )

    // We want the smaller amounts...
    // ...which occurs at the upper price for amount0...
    const amount0 = new Position({
      pool: poolUpper,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).amount0

    // ...and the lower for amount1
    const amount1 = new Position({
      pool: poolLower,
      liquidity: this.liquidity,
      tickLower: this.tickLower,
      tickUpper: this.tickUpper,
    }).amount1

    return { amount0: amount0.quotient, amount1: amount1.quotient }
  }

  /**
   * Returns the minimum amounts that must be sent in order to mint the amount of liquidity
   * held by the position at the current price for the pool.
   */
  public get mintAmounts(): Readonly<{ amount0: bigint; amount1: bigint }> {
    if (this._mintAmounts === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        return {
          amount0: getAmount0Delta(
            getSqrtRatioAtTick(this.tickLower),
            getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            true
          ),
          amount1: ZERO,
        }
      }
      if (this.pool.tickCurrent < this.tickUpper) {
        return {
          amount0: getAmount0Delta(this.pool.sqrtRatioX96, getSqrtRatioAtTick(this.tickUpper), this.liquidity, true),
          amount1: getAmount1Delta(getSqrtRatioAtTick(this.tickLower), this.pool.sqrtRatioX96, this.liquidity, true),
        }
      }
      return {
        amount0: ZERO,
        amount1: getAmount1Delta(
          getSqrtRatioAtTick(this.tickLower),
          getSqrtRatioAtTick(this.tickUpper),
          this.liquidity,
          true
        ),
      }
    }
    return this._mintAmounts
  }

  /**
   * Returns the AllowanceTransferPermitBatch for adding liquidity to a position
   * @param slippageTolerance The amount by which the price can 'slip'
   * @param spender The spender of the permit (should usually be the PositionManager)
   * @param nonce A valid permit2 nonce
   * @param deadline The deadline for the permit
   */
  public permitBatchData(
    slippageTolerance: Percent,
    spender: string,
    nonce: BigintIsh,
    deadline: BigintIsh
  ): AllowanceTransferPermitBatch {
    const { amount0, amount1 } = this.mintAmountsWithSlippage(slippageTolerance)
    return {
      details: [
        {
          token: this.pool.currency0.wrapped.address,
          amount: amount0,
          expiration: deadline,
          nonce: nonce,
        },
        {
          token: this.pool.currency1.wrapped.address,
          amount: amount1,
          expiration: deadline,
          nonce: nonce,
        },
      ],
      spender,
      sigDeadline: deadline,
    }
  }

  /**
   * Computes the maximum amount of liquidity received for a given amount of token0, token1,
   * and the prices at the tick boundaries.
   *
   * @param pool The pool for which the position should be created
   * @param tickLower The lower tick of the position
   * @param tickUpper The upper tick of the position
   * @param amount0 token0 amount
   * @param amount1 token1 amount
   * @param useFullPrecision If false, liquidity will be maximized according to what the router can calculate
   * @returns The position
   */
  public static fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0,
    amount1,
    useFullPrecision,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount0: BigintIsh
    amount1: BigintIsh
    useFullPrecision: boolean
  }): Position {
    const sqrtRatioAX96 = getSqrtRatioAtTick(tickLower)
    const sqrtRatioBX96 = getSqrtRatioAtTick(tickUpper)
    return new Position({
      pool,
      tickLower,
      tickUpper,
      liquidity: maxLiquidityForAmounts(
        pool.sqrtRatioX96,
        sqrtRatioAX96,
        sqrtRatioBX96,
        amount0,
        amount1,
        useFullPrecision
      ),
    })
  }

  /**
   * Computes a position with the maximum amount of liquidity received for a given amount of token0,
   * assuming an unlimited amount of token1.
   *
   * @param pool The pool for which the position is created
   * @param tickLower The lower tick
   * @param tickUpper The upper tick
   * @param amount0 The desired amount of token0
   * @param useFullPrecision If true, liquidity will be maximized according to what the router can calculate
   * @returns The position
   */
  public static fromAmount0({
    pool,
    tickLower,
    tickUpper,
    amount0,
    useFullPrecision,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount0: BigintIsh
    useFullPrecision: boolean
  }): Position {
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0, amount1: MaxUint256, useFullPrecision })
  }

  /**
   * Computes a position with the maximum amount of liquidity received for a given amount of token1,
   * assuming an unlimited amount of token0.
   *
   * @param pool The pool for which the position is created
   * @param tickLower The lower tick
   * @param tickUpper The upper tick
   * @param amount1 The desired amount of token1
   * @returns The position
   */
  public static fromAmount1({
    pool,
    tickLower,
    tickUpper,
    amount1,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount1: BigintIsh
  }): Position {
    // This function always uses full precision
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0: MaxUint256, amount1, useFullPrecision: true })
  }
}
