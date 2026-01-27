import { type BigintIsh, CurrencyAmount, Price, type Token } from '@uniswap/sdk-core-next'
import type { Address } from 'ox'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS, type FeeAmount, TICK_SPACINGS } from '../constants'
import { NEGATIVE_ONE, Q192 } from '../internalConstants'
import { computePoolAddress } from '../utils/computePoolAddress'
import { getSqrtRatioAtTick } from '../utils/tickMath'
import { v3Swap } from '../utils/v3swap'
import type { Tick, TickConstructorArgs } from './tick'
import { NoTickDataProvider, type TickDataProvider } from './tickDataProvider'
import { TickListDataProvider } from './tickListDataProvider'

/**
 * By default, pools will not allow operations that require ticks.
 */
const NO_TICK_DATA_PROVIDER_DEFAULT = new NoTickDataProvider()

/**
 * Represents a V3 pool with its current state.
 */
export class Pool {
  public readonly token0: Token
  public readonly token1: Token
  public readonly fee: FeeAmount
  public readonly sqrtRatioX96: bigint
  public readonly liquidity: bigint
  public readonly tickCurrent: number
  public readonly tickDataProvider: TickDataProvider

  private _token0Price?: Price<Token, Token>
  private _token1Price?: Price<Token, Token>

  /**
   * Computes the pool address for the given tokens and fee.
   *
   * @param tokenA - The first token
   * @param tokenB - The second token
   * @param fee - The fee tier
   * @param initCodeHashManualOverride - Override init code hash if needed
   * @param factoryAddressOverride - Override factory address if needed
   * @returns The pool address
   */
  public static getAddress(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    initCodeHashManualOverride?: `0x${string}`,
    factoryAddressOverride?: Address.Address
  ): Address.Address {
    return computePoolAddress({
      factoryAddress: factoryAddressOverride ?? FACTORY_ADDRESS,
      fee,
      tokenA,
      tokenB,
      ...(initCodeHashManualOverride !== undefined && { initCodeHashManualOverride }),
    })
  }

  /**
   * Construct a pool.
   *
   * @param tokenA - One of the tokens in the pool
   * @param tokenB - The other token in the pool
   * @param fee - The fee in hundredths of a bips of the input amount of every swap
   * @param sqrtRatioX96 - The sqrt of the current ratio of amounts of token1 to token0
   * @param liquidity - The current value of in range liquidity
   * @param tickCurrent - The current tick of the pool
   * @param ticks - The current state of the pool ticks or a data provider that can return tick data
   */
  public constructor(
    tokenA: Token,
    tokenB: Token,
    fee: FeeAmount,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    ticks: TickDataProvider | (Tick | TickConstructorArgs)[] = NO_TICK_DATA_PROVIDER_DEFAULT
  ) {
    invariant(Number.isInteger(fee) && fee < 1_000_000, 'FEE')

    const sqrtRatioX96BigInt = BigInt(sqrtRatioX96)

    // Validate that the tick corresponds to the sqrt ratio
    const tickCurrentSqrtRatioX96 = getSqrtRatioAtTick(tickCurrent)
    const nextTickSqrtRatioX96 = getSqrtRatioAtTick(tickCurrent + 1)
    invariant(
      sqrtRatioX96BigInt >= tickCurrentSqrtRatioX96 && sqrtRatioX96BigInt <= nextTickSqrtRatioX96,
      'PRICE_BOUNDS'
    )

    // Sort tokens and assign
    ;[this.token0, this.token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    this.fee = fee
    this.sqrtRatioX96 = sqrtRatioX96BigInt
    this.liquidity = BigInt(liquidity)
    this.tickCurrent = tickCurrent
    this.tickDataProvider = Array.isArray(ticks) ? new TickListDataProvider(ticks, TICK_SPACINGS[fee]) : ticks
  }

  /**
   * Returns true if the token is either token0 or token1.
   * @param token - The token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  /**
   * Returns the current mid price of the pool in terms of token0.
   * I.e., the ratio of token1 over token0.
   */
  public get token0Price(): Price<Token, Token> {
    if (this._token0Price) return this._token0Price
    this._token0Price = new Price(this.token0, this.token1, Q192, this.sqrtRatioX96 * this.sqrtRatioX96)
    return this._token0Price
  }

  /**
   * Returns the current mid price of the pool in terms of token1.
   * I.e., the ratio of token0 over token1.
   */
  public get token1Price(): Price<Token, Token> {
    if (this._token1Price) return this._token1Price
    this._token1Price = new Price(this.token1, this.token0, this.sqrtRatioX96 * this.sqrtRatioX96, Q192)
    return this._token1Price
  }

  /**
   * Return the price of the given token in terms of the other token in the pool.
   * @param token - The token to return price of
   */
  public priceOf(token: Token): Price<Token, Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.token0Price : this.token1Price
  }

  /**
   * Returns the chain ID of the tokens in the pool.
   */
  public get chainId(): number {
    return this.token0.chainId
  }

  /**
   * Returns the tick spacing for this pool's fee tier.
   */
  public get tickSpacing(): number {
    return TICK_SPACINGS[this.fee]
  }

  /**
   * Given an input amount of a token, return the computed output amount and a pool with updated state.
   *
   * @param inputAmount - The input amount for which to quote the output amount
   * @param sqrtPriceLimitX96 - The Q64.96 sqrt price limit
   * @returns The output amount and the pool with updated state
   */
  public async getOutputAmount(
    inputAmount: CurrencyAmount<Token>,
    sqrtPriceLimitX96?: bigint
  ): Promise<[CurrencyAmount<Token>, Pool]> {
    invariant(this.involvesToken(inputAmount.currency), 'TOKEN')

    const zeroForOne = inputAmount.currency.equals(this.token0)

    const {
      amountCalculated: outputAmount,
      sqrtRatioX96,
      liquidity,
      tickCurrent,
    } = await this.swap(zeroForOne, inputAmount.quotient, sqrtPriceLimitX96)

    const outputToken = zeroForOne ? this.token1 : this.token0
    return [
      CurrencyAmount.fromRawAmount(outputToken, outputAmount * NEGATIVE_ONE),
      new Pool(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider),
    ]
  }

  /**
   * Given a desired output amount of a token, return the computed input amount and a pool with updated state.
   *
   * @param outputAmount - The output amount for which to quote the input amount
   * @param sqrtPriceLimitX96 - The Q64.96 sqrt price limit
   * @returns The input amount and the pool with updated state
   */
  public async getInputAmount(
    outputAmount: CurrencyAmount<Token>,
    sqrtPriceLimitX96?: bigint
  ): Promise<[CurrencyAmount<Token>, Pool]> {
    invariant(outputAmount.currency.isToken && this.involvesToken(outputAmount.currency), 'TOKEN')

    const zeroForOne = outputAmount.currency.equals(this.token1)

    const {
      amountCalculated: inputAmount,
      sqrtRatioX96,
      liquidity,
      tickCurrent,
    } = await this.swap(zeroForOne, outputAmount.quotient * NEGATIVE_ONE, sqrtPriceLimitX96)

    const inputToken = zeroForOne ? this.token0 : this.token1
    return [
      CurrencyAmount.fromRawAmount(inputToken, inputAmount),
      new Pool(this.token0, this.token1, this.fee, sqrtRatioX96, liquidity, tickCurrent, this.tickDataProvider),
    ]
  }

  /**
   * Executes a swap.
   *
   * @param zeroForOne - Whether the amount in is token0 or token1
   * @param amountSpecified - The amount of the swap (positive = exact input, negative = exact output)
   * @param sqrtPriceLimitX96 - The Q64.96 sqrt price limit
   * @returns The swap result
   */
  private async swap(
    zeroForOne: boolean,
    amountSpecified: bigint,
    sqrtPriceLimitX96?: bigint
  ): Promise<{ amountCalculated: bigint; sqrtRatioX96: bigint; liquidity: bigint; tickCurrent: number }> {
    return v3Swap(
      BigInt(this.fee),
      this.sqrtRatioX96,
      this.tickCurrent,
      this.liquidity,
      this.tickSpacing,
      this.tickDataProvider,
      zeroForOne,
      amountSpecified,
      sqrtPriceLimitX96
    )
  }
}
