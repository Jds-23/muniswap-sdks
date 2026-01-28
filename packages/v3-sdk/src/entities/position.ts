import { type BigintIsh, CurrencyAmount, type Percent, type Token } from '@muniswap/sdk-core'
import invariant from 'tiny-invariant'
import { ZERO } from '../internalConstants'
import { maxLiquidityForAmounts } from '../utils/maxLiquidityForAmounts'
import { getAmount0Delta, getAmount1Delta } from '../utils/sqrtPriceMath'
import { getSqrtRatioAtTick } from '../utils/tickMath'
import type { Pool } from './pool'

/**
 * Options for creating a position.
 */
interface PositionConstructorArgs {
  pool: Pool
  liquidity: BigintIsh
  tickLower: number
  tickUpper: number
}

/**
 * Represents a position on a Uniswap V3 Pool.
 */
export class Position {
  public readonly pool: Pool
  public readonly tickLower: number
  public readonly tickUpper: number
  public readonly liquidity: bigint

  // Cached values
  private _token0Amount: CurrencyAmount<Token> | null = null
  private _token1Amount: CurrencyAmount<Token> | null = null
  private _mintAmounts: { amount0: bigint; amount1: bigint } | null = null

  /**
   * Constructs a position.
   *
   * @param pool - The pool for which to create the position
   * @param liquidity - The liquidity of the position
   * @param tickLower - The lower tick of the position
   * @param tickUpper - The upper tick of the position
   */
  public constructor({ pool, liquidity, tickLower, tickUpper }: PositionConstructorArgs) {
    invariant(tickLower < tickUpper, 'TICK_ORDER')
    invariant(tickLower >= -887272 && tickLower % pool.tickSpacing === 0, 'TICK_LOWER')
    invariant(tickUpper <= 887272 && tickUpper % pool.tickSpacing === 0, 'TICK_UPPER')

    this.pool = pool
    this.tickLower = tickLower
    this.tickUpper = tickUpper
    this.liquidity = BigInt(liquidity)
  }

  /**
   * Returns the price of token0 at the lower tick.
   */
  public get token0PriceLower(): bigint {
    return getSqrtRatioAtTick(this.tickLower)
  }

  /**
   * Returns the price of token0 at the upper tick.
   */
  public get token0PriceUpper(): bigint {
    return getSqrtRatioAtTick(this.tickUpper)
  }

  /**
   * Returns the amount of token0 that this position's liquidity could be burned for at the current pool price.
   */
  public get amount0(): CurrencyAmount<Token> {
    if (this._token0Amount === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        // All liquidity is in token0
        this._token0Amount = CurrencyAmount.fromRawAmount(
          this.pool.token0,
          getAmount0Delta(getSqrtRatioAtTick(this.tickLower), getSqrtRatioAtTick(this.tickUpper), this.liquidity, false)
        )
      } else if (this.pool.tickCurrent < this.tickUpper) {
        // Liquidity is split between token0 and token1
        this._token0Amount = CurrencyAmount.fromRawAmount(
          this.pool.token0,
          getAmount0Delta(this.pool.sqrtRatioX96, getSqrtRatioAtTick(this.tickUpper), this.liquidity, false)
        )
      } else {
        // All liquidity is in token1
        this._token0Amount = CurrencyAmount.fromRawAmount(this.pool.token0, ZERO)
      }
    }
    return this._token0Amount
  }

  /**
   * Returns the amount of token1 that this position's liquidity could be burned for at the current pool price.
   */
  public get amount1(): CurrencyAmount<Token> {
    if (this._token1Amount === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        // All liquidity is in token0
        this._token1Amount = CurrencyAmount.fromRawAmount(this.pool.token1, ZERO)
      } else if (this.pool.tickCurrent < this.tickUpper) {
        // Liquidity is split between token0 and token1
        this._token1Amount = CurrencyAmount.fromRawAmount(
          this.pool.token1,
          getAmount1Delta(getSqrtRatioAtTick(this.tickLower), this.pool.sqrtRatioX96, this.liquidity, false)
        )
      } else {
        // All liquidity is in token1
        this._token1Amount = CurrencyAmount.fromRawAmount(
          this.pool.token1,
          getAmount1Delta(getSqrtRatioAtTick(this.tickLower), getSqrtRatioAtTick(this.tickUpper), this.liquidity, false)
        )
      }
    }
    return this._token1Amount
  }

  /**
   * Returns the minimum amounts that must be sent in order to mint the amount of liquidity held by the position.
   * These are rounded up since we need to ensure adequate liquidity is provided.
   */
  public get mintAmounts(): { amount0: bigint; amount1: bigint } {
    if (this._mintAmounts === null) {
      if (this.pool.tickCurrent < this.tickLower) {
        // All liquidity needed in token0
        this._mintAmounts = {
          amount0: getAmount0Delta(
            getSqrtRatioAtTick(this.tickLower),
            getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            true
          ),
          amount1: ZERO,
        }
      } else if (this.pool.tickCurrent < this.tickUpper) {
        // Liquidity needed in both tokens
        this._mintAmounts = {
          amount0: getAmount0Delta(this.pool.sqrtRatioX96, getSqrtRatioAtTick(this.tickUpper), this.liquidity, true),
          amount1: getAmount1Delta(getSqrtRatioAtTick(this.tickLower), this.pool.sqrtRatioX96, this.liquidity, true),
        }
      } else {
        // All liquidity needed in token1
        this._mintAmounts = {
          amount0: ZERO,
          amount1: getAmount1Delta(
            getSqrtRatioAtTick(this.tickLower),
            getSqrtRatioAtTick(this.tickUpper),
            this.liquidity,
            true
          ),
        }
      }
    }
    return this._mintAmounts
  }

  /**
   * Returns the minimum amounts that must be sent in order to safely mint the amount of liquidity
   * held by the position with the given slippage tolerance.
   *
   * @param slippageTolerance - The slippage tolerance
   * @returns The minimum amounts, accounting for slippage
   */
  public mintAmountsWithSlippage(slippageTolerance: Percent): { amount0: bigint; amount1: bigint } {
    const { amount0, amount1 } = this.mintAmounts

    const slippageMultiplier = slippageTolerance.add(1)

    return {
      amount0: (amount0 * slippageMultiplier.numerator) / slippageMultiplier.denominator,
      amount1: (amount1 * slippageMultiplier.numerator) / slippageMultiplier.denominator,
    }
  }

  /**
   * Returns the minimum amounts that should be requested in order to safely burn the amount of liquidity
   * held by the position with the given slippage tolerance.
   *
   * @param slippageTolerance - The slippage tolerance
   * @returns The minimum amounts, accounting for slippage
   */
  public burnAmountsWithSlippage(slippageTolerance: Percent): { amount0: bigint; amount1: bigint } {
    const amount0 = this.amount0.quotient
    const amount1 = this.amount1.quotient

    const slippageMultiplier = slippageTolerance.add(1)

    return {
      amount0: (amount0 * slippageMultiplier.denominator) / slippageMultiplier.numerator,
      amount1: (amount1 * slippageMultiplier.denominator) / slippageMultiplier.numerator,
    }
  }

  /**
   * Creates a position from the specified amounts.
   *
   * @param pool - The pool for which to create the position
   * @param tickLower - The lower tick
   * @param tickUpper - The upper tick
   * @param amount0 - The amount of token0
   * @param amount1 - The amount of token1
   * @param useFullPrecision - Whether to use full precision for liquidity calculation
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
    const liquidity = maxLiquidityForAmounts(
      pool.sqrtRatioX96,
      sqrtRatioAX96,
      sqrtRatioBX96,
      amount0,
      amount1,
      useFullPrecision
    )
    return new Position({ pool, tickLower, tickUpper, liquidity })
  }

  /**
   * Creates a position from the specified amount of token0.
   *
   * @param pool - The pool for which to create the position
   * @param tickLower - The lower tick
   * @param tickUpper - The upper tick
   * @param amount0 - The amount of token0
   * @param useFullPrecision - Whether to use full precision
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
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0, amount1: 0, useFullPrecision })
  }

  /**
   * Creates a position from the specified amount of token1.
   *
   * @param pool - The pool for which to create the position
   * @param tickLower - The lower tick
   * @param tickUpper - The upper tick
   * @param amount1 - The amount of token1
   * @param useFullPrecision - Whether to use full precision
   * @returns The position
   */
  public static fromAmount1({
    pool,
    tickLower,
    tickUpper,
    amount1,
    useFullPrecision,
  }: {
    pool: Pool
    tickLower: number
    tickUpper: number
    amount1: BigintIsh
    useFullPrecision: boolean
  }): Position {
    return Position.fromAmounts({ pool, tickLower, tickUpper, amount0: 0, amount1, useFullPrecision })
  }
}
