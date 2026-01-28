import { type BigintIsh, type Currency, CurrencyAmount, Price } from '@muniswap/sdk-core'
import {
  NoTickDataProvider,
  type Tick,
  type TickConstructorArgs,
  type TickDataProvider,
  TickListDataProvider,
  getSqrtRatioAtTick,
  v3Swap,
} from '@muniswap/v3-sdk'
import { AbiParameters, Hash } from 'ox'
import { Address } from 'ox'
import invariant from 'tiny-invariant'
import { ADDRESS_ZERO, DYNAMIC_FEE_FLAG, NEGATIVE_ONE, Q192 } from '../internalConstants'
import { Hook } from '../utils/hook'
import { sortsBefore } from '../utils/sortsBefore'

const NO_TICK_DATA_PROVIDER_DEFAULT = new NoTickDataProvider()

/**
 * Represents the key that uniquely identifies a V4 pool
 */
export type PoolKey = {
  currency0: string
  currency1: string
  fee: number
  tickSpacing: number
  hooks: string
}

/**
 * Represents a Uniswap V4 pool.
 * V4 pools support hooks and native currency (ETH without WETH wrapping).
 */
export class Pool {
  public readonly currency0: Currency
  public readonly currency1: Currency
  public readonly fee: number
  public readonly tickSpacing: number
  public readonly sqrtRatioX96: bigint
  public readonly hooks: string
  public readonly liquidity: bigint
  public readonly tickCurrent: number
  public readonly tickDataProvider: TickDataProvider
  public readonly poolKey: PoolKey
  public readonly poolId: string

  private _currency0Price?: Price<Currency, Currency>
  private _currency1Price?: Price<Currency, Currency>

  /**
   * Construct the pool key for a V4 pool
   * @param currencyA One of the currencies in the pool
   * @param currencyB The other currency in the pool
   * @param fee The fee in hundredths of bips
   * @param tickSpacing The tick spacing of the pool
   * @param hooks The hook address
   * @returns The pool key
   */
  public static getPoolKey(
    currencyA: Currency,
    currencyB: Currency,
    fee: number,
    tickSpacing: number,
    hooks: string
  ): PoolKey {
    invariant(Address.validate(hooks), 'Invalid hook address')

    const [currency0, currency1] = sortsBefore(currencyA, currencyB) ? [currencyA, currencyB] : [currencyB, currencyA]
    const currency0Addr = currency0.isNative ? ADDRESS_ZERO : currency0.wrapped.address
    const currency1Addr = currency1.isNative ? ADDRESS_ZERO : currency1.wrapped.address

    return {
      currency0: currency0Addr,
      currency1: currency1Addr,
      fee,
      tickSpacing,
      hooks,
    }
  }

  /**
   * Compute the pool ID (keccak256 hash of the pool key)
   * @param currencyA One of the currencies in the pool
   * @param currencyB The other currency in the pool
   * @param fee The fee in hundredths of bips
   * @param tickSpacing The tick spacing of the pool
   * @param hooks The hook address
   * @returns The pool ID as a hex string
   */
  public static getPoolId(
    currencyA: Currency,
    currencyB: Currency,
    fee: number,
    tickSpacing: number,
    hooks: string
  ): string {
    const [currency0, currency1] = sortsBefore(currencyA, currencyB) ? [currencyA, currencyB] : [currencyB, currencyA]
    const currency0Addr = currency0.isNative ? ADDRESS_ZERO : currency0.wrapped.address
    const currency1Addr = currency1.isNative ? ADDRESS_ZERO : currency1.wrapped.address

    const encoded = AbiParameters.encode(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }],
      [currency0Addr as `0x${string}`, currency1Addr as `0x${string}`, fee, tickSpacing, hooks as `0x${string}`]
    )

    return Hash.keccak256(encoded)
  }

  /**
   * Construct a V4 pool
   * @param currencyA One of the currencies in the pool
   * @param currencyB The other currency in the pool
   * @param fee The fee in hundredths of bips (or DYNAMIC_FEE_FLAG for dynamic fees)
   * @param tickSpacing The tick spacing of the pool
   * @param hooks The address of the hook contract
   * @param sqrtRatioX96 The sqrt of the current ratio of amounts of currency1 to currency0
   * @param liquidity The current value of in-range liquidity
   * @param tickCurrent The current tick of the pool
   * @param ticks Optional tick data provider or array of ticks
   */
  public constructor(
    currencyA: Currency,
    currencyB: Currency,
    fee: number,
    tickSpacing: number,
    hooks: string,
    sqrtRatioX96: BigintIsh,
    liquidity: BigintIsh,
    tickCurrent: number,
    ticks: TickDataProvider | (Tick | TickConstructorArgs)[] = NO_TICK_DATA_PROVIDER_DEFAULT
  ) {
    invariant(Address.validate(hooks), 'Invalid hook address')
    invariant(Number.isInteger(fee) && (fee === DYNAMIC_FEE_FLAG || fee < 1_000_000), 'FEE')

    if (fee === DYNAMIC_FEE_FLAG) {
      invariant(BigInt(hooks) > 0n, 'Dynamic fee pool requires a hook')
    }

    const sqrtRatioX96BigInt = BigInt(sqrtRatioX96)

    // Validate that the tick corresponds to the sqrt ratio
    const tickCurrentSqrtRatioX96 = getSqrtRatioAtTick(tickCurrent)
    const nextTickSqrtRatioX96 = getSqrtRatioAtTick(tickCurrent + 1)
    invariant(
      sqrtRatioX96BigInt >= tickCurrentSqrtRatioX96 && sqrtRatioX96BigInt <= nextTickSqrtRatioX96,
      'PRICE_BOUNDS'
    )

    // Sort currencies and assign
    ;[this.currency0, this.currency1] = sortsBefore(currencyA, currencyB)
      ? [currencyA, currencyB]
      : [currencyB, currencyA]

    this.fee = fee
    this.sqrtRatioX96 = sqrtRatioX96BigInt
    this.tickSpacing = tickSpacing
    this.hooks = hooks
    this.liquidity = BigInt(liquidity)
    this.tickCurrent = tickCurrent
    this.tickDataProvider = Array.isArray(ticks) ? new TickListDataProvider(ticks, tickSpacing) : ticks
    this.poolKey = Pool.getPoolKey(this.currency0, this.currency1, this.fee, this.tickSpacing, this.hooks)
    this.poolId = Pool.getPoolId(this.currency0, this.currency1, this.fee, this.tickSpacing, this.hooks)
  }

  /**
   * Backwards compatibility with V2/V3 SDKs
   */
  public get token0(): Currency {
    return this.currency0
  }

  /**
   * Backwards compatibility with V2/V3 SDKs
   */
  public get token1(): Currency {
    return this.currency1
  }

  /**
   * Returns true if the currency is either currency0 or currency1
   * @param currency The currency to check
   * @returns True if currency is in this pool
   */
  public involvesCurrency(currency: Currency): boolean {
    return currency.equals(this.currency0) || currency.equals(this.currency1)
  }

  /**
   * Backwards compatibility with V2/V3 SDKs
   */
  public involvesToken(currency: Currency): boolean {
    return this.involvesCurrency(currency)
  }

  /**
   * V4-only involvesToken convenience method, used for mixed route ETH <-> WETH connection
   * @param currency The currency to check
   * @returns True if currency or its wrapped version is in this pool
   */
  public v4InvolvesToken(currency: Currency): boolean {
    return (
      this.involvesCurrency(currency) ||
      currency.wrapped.equals(this.currency0) ||
      currency.wrapped.equals(this.currency1) ||
      currency.wrapped.equals(this.currency0.wrapped) ||
      currency.wrapped.equals(this.currency1.wrapped)
    )
  }

  /**
   * Returns the current mid price of the pool in terms of currency0
   * I.e., the ratio of currency1 over currency0
   */
  public get currency0Price(): Price<Currency, Currency> {
    if (this._currency0Price === undefined) {
      this._currency0Price = new Price(this.currency0, this.currency1, Q192, this.sqrtRatioX96 * this.sqrtRatioX96)
    }
    return this._currency0Price
  }

  /**
   * Backwards compatibility with V2/V3 SDKs
   */
  public get token0Price(): Price<Currency, Currency> {
    return this.currency0Price
  }

  /**
   * Returns the current mid price of the pool in terms of currency1
   * I.e., the ratio of currency0 over currency1
   */
  public get currency1Price(): Price<Currency, Currency> {
    if (this._currency1Price === undefined) {
      this._currency1Price = new Price(this.currency1, this.currency0, this.sqrtRatioX96 * this.sqrtRatioX96, Q192)
    }
    return this._currency1Price
  }

  /**
   * Backwards compatibility with V2/V3 SDKs
   */
  public get token1Price(): Price<Currency, Currency> {
    return this.currency1Price
  }

  /**
   * Return the price of the given currency in terms of the other currency in the pool
   * @param currency The currency to return price of
   * @returns The price of the given currency
   */
  public priceOf(currency: Currency): Price<Currency, Currency> {
    invariant(this.involvesCurrency(currency), 'CURRENCY')
    return currency.equals(this.currency0) ? this.currency0Price : this.currency1Price
  }

  /**
   * Returns the chain ID of the currencies in the pool
   */
  public get chainId(): number {
    return this.currency0.chainId
  }

  /**
   * Given an input amount of a currency, return the computed output amount and a pool with updated state.
   * Works only for vanilla hookless V3-style pools, otherwise throws an error.
   *
   * @param inputAmount The input amount for which to quote the output amount
   * @param sqrtPriceLimitX96 Optional Q64.96 sqrt price limit
   * @returns The output amount and the pool with updated state
   */
  public async getOutputAmount(
    inputAmount: CurrencyAmount<Currency>,
    sqrtPriceLimitX96?: bigint
  ): Promise<[CurrencyAmount<Currency>, Pool]> {
    invariant(this.involvesCurrency(inputAmount.currency), 'CURRENCY')

    const zeroForOne = inputAmount.currency.equals(this.currency0)

    const {
      amountCalculated: outputAmount,
      sqrtRatioX96,
      liquidity,
      tickCurrent,
    } = await this.swap(zeroForOne, inputAmount.quotient, sqrtPriceLimitX96)

    const outputCurrency = zeroForOne ? this.currency1 : this.currency0
    return [
      CurrencyAmount.fromRawAmount(outputCurrency, outputAmount * NEGATIVE_ONE),
      new Pool(
        this.currency0,
        this.currency1,
        this.fee,
        this.tickSpacing,
        this.hooks,
        sqrtRatioX96,
        liquidity,
        tickCurrent,
        this.tickDataProvider
      ),
    ]
  }

  /**
   * Given a desired output amount of a currency, return the computed input amount and a pool with updated state.
   * Works only for vanilla hookless V3-style pools, otherwise throws an error.
   *
   * @param outputAmount The output amount for which to quote the input amount
   * @param sqrtPriceLimitX96 Optional Q64.96 sqrt price limit
   * @returns The input amount and the pool with updated state
   */
  public async getInputAmount(
    outputAmount: CurrencyAmount<Currency>,
    sqrtPriceLimitX96?: bigint
  ): Promise<[CurrencyAmount<Currency>, Pool]> {
    invariant(this.involvesCurrency(outputAmount.currency), 'CURRENCY')

    const zeroForOne = outputAmount.currency.equals(this.currency1)

    const {
      amountCalculated: inputAmount,
      sqrtRatioX96,
      liquidity,
      tickCurrent,
    } = await this.swap(zeroForOne, outputAmount.quotient * NEGATIVE_ONE, sqrtPriceLimitX96)

    const inputCurrency = zeroForOne ? this.currency0 : this.currency1
    return [
      CurrencyAmount.fromRawAmount(inputCurrency, inputAmount),
      new Pool(
        this.currency0,
        this.currency1,
        this.fee,
        this.tickSpacing,
        this.hooks,
        sqrtRatioX96,
        liquidity,
        tickCurrent,
        this.tickDataProvider
      ),
    ]
  }

  /**
   * Executes a swap simulation
   * @param zeroForOne Whether the amount in is currency0 or currency1
   * @param amountSpecified The amount of the swap (positive = exact input, negative = exact output)
   * @param sqrtPriceLimitX96 Optional Q64.96 sqrt price limit
   * @returns The swap result
   */
  private async swap(
    zeroForOne: boolean,
    amountSpecified: bigint,
    sqrtPriceLimitX96?: bigint
  ): Promise<{ amountCalculated: bigint; sqrtRatioX96: bigint; liquidity: bigint; tickCurrent: number }> {
    if (!this.hookImpactsSwap()) {
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
    throw new Error('Unsupported hook')
  }

  /**
   * Check if the hook impacts swap calculations
   */
  private hookImpactsSwap(): boolean {
    return Hook.hasSwapPermissions(this.hooks)
  }
}
