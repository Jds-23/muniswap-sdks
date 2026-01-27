import {
  type Currency,
  CurrencyAmount,
  Fraction,
  Percent,
  Price,
  type Token,
  TradeType,
  sortedInsert,
} from '@uniswap/sdk-core-next'
import invariant from 'tiny-invariant'
import { ONE, ZERO } from '../internalConstants'
import { amountWithPathCurrency } from '../utils/pathCurrency'
import { Pool } from './pool'
import { Route } from './route'

/**
 * Trades comparator - compares trades by output amount, then input amount, then number of hops
 * @param a First trade
 * @param b Second trade
 * @returns Comparison result for sorting
 */
export function tradeComparator<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
  a: Trade<TInput, TOutput, TTradeType>,
  b: Trade<TInput, TOutput, TTradeType>
): number {
  // Must have same input and output currency for comparison
  invariant(a.inputAmount.currency.equals(b.inputAmount.currency), 'INPUT_CURRENCY')
  invariant(a.outputAmount.currency.equals(b.outputAmount.currency), 'OUTPUT_CURRENCY')

  if (a.outputAmount.equalTo(b.outputAmount)) {
    if (a.inputAmount.equalTo(b.inputAmount)) {
      // Consider the number of hops since each hop costs gas
      const aHops = a.swaps.reduce((total, cur) => total + cur.route.currencyPath.length, 0)
      const bHops = b.swaps.reduce((total, cur) => total + cur.route.currencyPath.length, 0)
      return aHops - bHops
    }
    // Trade A requires less input than trade B, so A should come first
    if (a.inputAmount.lessThan(b.inputAmount)) {
      return -1
    }
    return 1
  }
  // Trade A has less output than trade B, so should come second
  if (a.outputAmount.lessThan(b.outputAmount)) {
    return 1
  }
  return -1
}

export interface BestTradeOptions {
  /** Maximum number of results to return */
  maxNumResults?: number
  /** Maximum number of hops a trade should contain */
  maxHops?: number
}

/**
 * Represents a trade executed against a set of routes where some percentage of the input is
 * split across each route.
 *
 * Each route has its own set of pools. Pools cannot be re-used across routes.
 *
 * Does not account for slippage, i.e., changes in price environment that can occur between
 * the time the trade is submitted and when it is executed.
 *
 * @template TInput The input currency
 * @template TOutput The output currency
 * @template TTradeType The trade type (exact input or exact output)
 */
export class Trade<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType> {
  /**
   * @deprecated Use 'swaps' property instead. If the trade consists of multiple routes, this will throw.
   */
  public get route(): Route<TInput, TOutput> {
    invariant(this.swaps.length === 1, 'MULTIPLE_ROUTES')
    return this.swaps[0]!.route
  }

  /**
   * The swaps of the trade, i.e. which routes and how much is swapped in each
   */
  public readonly swaps: {
    route: Route<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
  }[]

  /**
   * The type of the trade, either exact in or exact out
   */
  public readonly tradeType: TTradeType

  private _inputAmount: CurrencyAmount<TInput> | undefined
  private _outputAmount: CurrencyAmount<TOutput> | undefined
  private _executionPrice: Price<TInput, TOutput> | undefined
  private _priceImpact: Percent | undefined

  /**
   * The input amount for the trade assuming no slippage
   */
  public get inputAmount(): CurrencyAmount<TInput> {
    if (this._inputAmount) {
      return this._inputAmount
    }

    const inputCurrency = this.swaps[0]!.inputAmount.currency
    const totalInputFromRoutes = this.swaps
      .map(({ inputAmount }) => inputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(inputCurrency, 0))

    this._inputAmount = totalInputFromRoutes
    return this._inputAmount
  }

  /**
   * The output amount for the trade assuming no slippage
   */
  public get outputAmount(): CurrencyAmount<TOutput> {
    if (this._outputAmount) {
      return this._outputAmount
    }

    const outputCurrency = this.swaps[0]!.outputAmount.currency
    const totalOutputFromRoutes = this.swaps
      .map(({ outputAmount }) => outputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(outputCurrency, 0))

    this._outputAmount = totalOutputFromRoutes
    return this._outputAmount
  }

  /**
   * The price expressed in terms of output amount/input amount
   */
  public get executionPrice(): Price<TInput, TOutput> {
    if (this._executionPrice === undefined) {
      this._executionPrice = new Price(
        this.inputAmount.currency,
        this.outputAmount.currency,
        this.inputAmount.quotient,
        this.outputAmount.quotient
      )
    }
    return this._executionPrice
  }

  /**
   * Returns the percent difference between the route's mid price and the execution price
   */
  public get priceImpact(): Percent {
    if (this._priceImpact) {
      return this._priceImpact
    }

    let spotOutputAmount = CurrencyAmount.fromRawAmount(this.outputAmount.currency, 0)
    for (const { route, inputAmount } of this.swaps) {
      const midPrice = route.midPrice
      spotOutputAmount = spotOutputAmount.add(midPrice.quote(inputAmount))
    }

    const priceImpact = spotOutputAmount.subtract(this.outputAmount).divide(spotOutputAmount)
    this._priceImpact = new Percent(priceImpact.numerator, priceImpact.denominator)

    return this._priceImpact
  }

  /**
   * Constructs an exact in trade with the given amount in and route
   * @param route The route of the exact in trade
   * @param amountIn The amount being passed in
   * @returns The exact in trade
   */
  public static async exactIn<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amountIn: CurrencyAmount<TInput>
  ): Promise<Trade<TInput, TOutput, TradeType.EXACT_INPUT>> {
    return Trade.fromRoute(route, amountIn, TradeType.EXACT_INPUT)
  }

  /**
   * Constructs an exact out trade with the given amount out and route
   * @param route The route of the exact out trade
   * @param amountOut The amount returned by the trade
   * @returns The exact out trade
   */
  public static async exactOut<TInput extends Currency, TOutput extends Currency>(
    route: Route<TInput, TOutput>,
    amountOut: CurrencyAmount<TOutput>
  ): Promise<Trade<TInput, TOutput, TradeType.EXACT_OUTPUT>> {
    return Trade.fromRoute(route, amountOut, TradeType.EXACT_OUTPUT)
  }

  /**
   * Constructs a trade by simulating swaps through the given route
   * @param route Route to swap through
   * @param amount The amount specified, either input or output, depending on tradeType
   * @param tradeType Whether the trade is an exact input or exact output swap
   * @returns The trade
   */
  public static async fromRoute<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    route: Route<TInput, TOutput>,
    amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    let inputAmount: CurrencyAmount<TInput>
    let outputAmount: CurrencyAmount<TOutput>

    if (tradeType === TradeType.EXACT_INPUT) {
      invariant(amount.currency.equals(route.input), 'INPUT')
      // Account for trades that wrap/unwrap as a first step
      let tokenAmount: CurrencyAmount<Currency> = amountWithPathCurrency(amount, route.pools[0]!)
      for (let i = 0; i < route.pools.length; i++) {
        const pool = route.pools[i]!
        ;[tokenAmount] = await pool.getOutputAmount(tokenAmount)
      }
      inputAmount = CurrencyAmount.fromFractionalAmount(route.input, amount.numerator, amount.denominator)
      outputAmount = CurrencyAmount.fromFractionalAmount(route.output, tokenAmount.numerator, tokenAmount.denominator)
    } else {
      invariant(amount.currency.equals(route.output), 'OUTPUT')
      // Account for trades that wrap/unwrap as a last step
      let tokenAmount: CurrencyAmount<Currency> = amountWithPathCurrency(amount, route.pools[route.pools.length - 1]!)
      for (let i = route.pools.length - 1; i >= 0; i--) {
        const pool = route.pools[i]!
        ;[tokenAmount] = await pool.getInputAmount(tokenAmount)

        // Special case: if this is the last pool (first in backward iteration) and it's an ETH-WETH pool
        if (i === route.pools.length - 1) {
          const isEthWethPool = pool.currency1.equals(pool.currency0.wrapped)

          if (isEthWethPool) {
            if (route.output.isNative && route.pools[i - 1]?.currency0.isNative) {
              tokenAmount = CurrencyAmount.fromFractionalAmount(
                pool.currency0,
                tokenAmount.numerator,
                tokenAmount.denominator
              )
            } else if (
              route.output.equals(pool.currency1) &&
              route.pools[i - 1] &&
              !route.pools[i - 1]!.currency0.isNative
            ) {
              tokenAmount = CurrencyAmount.fromFractionalAmount(
                pool.currency1,
                tokenAmount.numerator,
                tokenAmount.denominator
              )
            }
          }
        }
      }
      inputAmount = CurrencyAmount.fromFractionalAmount(route.input, tokenAmount.numerator, tokenAmount.denominator)
      outputAmount = CurrencyAmount.fromFractionalAmount(route.output, amount.numerator, amount.denominator)
    }

    return new Trade({
      routes: [{ inputAmount, outputAmount, route }],
      tradeType,
    })
  }

  /**
   * Constructs a trade from routes by simulating swaps
   * @param routes The routes to swap through and how much of the amount should be routed through each
   * @param tradeType Whether the trade is an exact input or exact output swap
   * @returns The trade
   */
  public static async fromRoutes<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    routes: {
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
      route: Route<TInput, TOutput>
    }[],
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    const swaps: {
      route: Route<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = await Promise.all(
      routes.map(async ({ amount, route }) => {
        const trade = await Trade.fromRoute(route, amount, tradeType)
        return trade.swaps[0]!
      })
    )

    return new Trade({
      routes: swaps,
      tradeType,
    })
  }

  /**
   * Creates a trade without computing the result of swapping through the route
   * Useful when you have simulated the trade elsewhere and do not have any tick data
   * @param constructorArguments The arguments passed to the trade constructor
   * @returns The unchecked trade
   */
  public static createUncheckedTrade<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType,
  >(constructorArguments: {
    route: Route<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
    tradeType: TTradeType
  }): Trade<TInput, TOutput, TTradeType> {
    return new Trade({
      ...constructorArguments,
      routes: [
        {
          inputAmount: constructorArguments.inputAmount,
          outputAmount: constructorArguments.outputAmount,
          route: constructorArguments.route,
        },
      ],
    })
  }

  /**
   * Creates a trade without computing the result of swapping through the routes
   * Useful when you have simulated the trade elsewhere and do not have any tick data
   * @param constructorArguments The arguments passed to the trade constructor
   * @returns The unchecked trade
   */
  public static createUncheckedTradeWithMultipleRoutes<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType,
  >(constructorArguments: {
    routes: {
      route: Route<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }): Trade<TInput, TOutput, TTradeType> {
    return new Trade(constructorArguments)
  }

  /**
   * Construct a trade by passing in the pre-computed property values
   */
  private constructor({
    routes,
    tradeType,
  }: {
    routes: {
      route: Route<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }) {
    const inputCurrency = routes[0]!.inputAmount.currency
    const outputCurrency = routes[0]!.outputAmount.currency

    invariant(
      routes.every(({ route }) => inputCurrency.equals(route.input)),
      'INPUT_CURRENCY_MATCH'
    )
    invariant(
      routes.every(({ route }) => outputCurrency.equals(route.output)),
      'OUTPUT_CURRENCY_MATCH'
    )

    const numPools = routes.map(({ route }) => route.pools.length).reduce((total, cur) => total + cur, 0)
    const poolIDSet = new Set<string>()
    for (const { route } of routes) {
      for (const pool of route.pools) {
        poolIDSet.add(Pool.getPoolId(pool.currency0, pool.currency1, pool.fee, pool.tickSpacing, pool.hooks))
      }
    }

    invariant(numPools === poolIDSet.size, 'POOLS_DUPLICATED')

    this.swaps = routes
    this.tradeType = tradeType
  }

  /**
   * Get the minimum amount that must be received from this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price
   * @param amountOut Optional amount out to use instead of the trade's output amount
   * @returns The minimum amount out
   */
  public minimumAmountOut(slippageTolerance: Percent, amountOut = this.outputAmount): CurrencyAmount<TOutput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_OUTPUT) {
      return amountOut
    }
    const slippageAdjustedAmountOut = new Fraction(ONE)
      .add(slippageTolerance)
      .invert()
      .multiply(amountOut.quotient).quotient
    return CurrencyAmount.fromRawAmount(amountOut.currency, slippageAdjustedAmountOut)
  }

  /**
   * Get the maximum amount in that can be spent via this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price
   * @param amountIn Optional amount in to use instead of the trade's input amount
   * @returns The maximum amount in
   */
  public maximumAmountIn(slippageTolerance: Percent, amountIn = this.inputAmount): CurrencyAmount<TInput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_INPUT) {
      return amountIn
    }
    const slippageAdjustedAmountIn = new Fraction(ONE).add(slippageTolerance).multiply(amountIn.quotient).quotient
    return CurrencyAmount.fromRawAmount(amountIn.currency, slippageAdjustedAmountIn)
  }

  /**
   * Return the execution price after accounting for slippage tolerance
   * @param slippageTolerance The allowed tolerated slippage
   * @returns The worst execution price
   */
  public worstExecutionPrice(slippageTolerance: Percent): Price<TInput, TOutput> {
    return new Price(
      this.inputAmount.currency,
      this.outputAmount.currency,
      this.maximumAmountIn(slippageTolerance).quotient,
      this.minimumAmountOut(slippageTolerance).quotient
    )
  }

  /**
   * Given a list of pools, and a fixed amount in, returns the top `maxNumResults` trades that go from
   * an input currency amount to an output currency, making at most `maxHops` hops.
   *
   * Note this does not consider aggregation, as routes are linear.
   *
   * @param pools The pools to consider
   * @param currencyAmountIn Exact amount of input currency to spend
   * @param currencyOut The desired currency out
   * @param options Best trade options
   * @param currentPools Used in recursion
   * @param nextAmountIn Used in recursion
   * @param bestTrades Used in recursion
   * @returns The best trades
   */
  public static async bestTradeExactIn<TInput extends Currency, TOutput extends Currency>(
    pools: Pool[],
    currencyAmountIn: CurrencyAmount<TInput>,
    currencyOut: TOutput,
    { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
    currentPools: Pool[] = [],
    nextAmountIn: CurrencyAmount<Currency> = currencyAmountIn,
    bestTrades: Trade<TInput, TOutput, TradeType.EXACT_INPUT>[] = []
  ): Promise<Trade<TInput, TOutput, TradeType.EXACT_INPUT>[]> {
    invariant(pools.length > 0, 'POOLS')
    invariant(maxHops > 0, 'MAX_HOPS')
    invariant(currencyAmountIn === nextAmountIn || currentPools.length > 0, 'INVALID_RECURSION')

    const amountIn = nextAmountIn
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]!
      // Pool irrelevant
      if (!pool.currency0.equals(amountIn.currency) && !pool.currency1.equals(amountIn.currency)) continue

      let amountOut: CurrencyAmount<Token | Currency>
      try {
        ;[amountOut] = await pool.getOutputAmount(amountIn)
      } catch (error) {
        // Input too low
        if ((error as { isInsufficientInputAmountError?: boolean }).isInsufficientInputAmountError) {
          continue
        }
        throw error
      }

      // We have arrived at the output currency, so this is the final trade of one of the paths
      if (amountOut.currency.equals(currencyOut)) {
        sortedInsert(
          bestTrades,
          await Trade.fromRoute(
            new Route([...currentPools, pool], currencyAmountIn.currency, currencyOut),
            currencyAmountIn,
            TradeType.EXACT_INPUT
          ),
          maxNumResults,
          tradeComparator
        )
      } else if (maxHops > 1 && pools.length > 1) {
        const poolsExcludingThisPool = pools.slice(0, i).concat(pools.slice(i + 1, pools.length))

        // Otherwise, consider all the other paths that lead from this currency
        await Trade.bestTradeExactIn(
          poolsExcludingThisPool,
          currencyAmountIn,
          currencyOut,
          {
            maxNumResults,
            maxHops: maxHops - 1,
          },
          [...currentPools, pool],
          amountOut,
          bestTrades
        )
      }
    }
    return bestTrades
  }

  /**
   * Similar to the above method but targets a fixed output amount.
   * Given a list of pools, and a fixed amount out, returns the top `maxNumResults` trades that go from
   * an input currency to an output currency amount, making at most `maxHops` hops.
   *
   * Note this does not consider aggregation, as routes are linear.
   *
   * @param pools The pools to consider
   * @param currencyIn The currency to spend
   * @param currencyAmountOut The desired currency amount out
   * @param options Best trade options
   * @param currentPools Used in recursion
   * @param nextAmountOut Used in recursion
   * @param bestTrades Used in recursion
   * @returns The best trades
   */
  public static async bestTradeExactOut<TInput extends Currency, TOutput extends Currency>(
    pools: Pool[],
    currencyIn: TInput,
    currencyAmountOut: CurrencyAmount<TOutput>,
    { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
    currentPools: Pool[] = [],
    nextAmountOut: CurrencyAmount<Currency> = currencyAmountOut,
    bestTrades: Trade<TInput, TOutput, TradeType.EXACT_OUTPUT>[] = []
  ): Promise<Trade<TInput, TOutput, TradeType.EXACT_OUTPUT>[]> {
    invariant(pools.length > 0, 'POOLS')
    invariant(maxHops > 0, 'MAX_HOPS')
    invariant(currencyAmountOut === nextAmountOut || currentPools.length > 0, 'INVALID_RECURSION')

    const amountOut = nextAmountOut
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]!
      // Pool irrelevant
      if (!pool.currency0.equals(amountOut.currency) && !pool.currency1.equals(amountOut.currency)) continue

      let amountIn: CurrencyAmount<Token | Currency>
      try {
        ;[amountIn] = await pool.getInputAmount(amountOut)
      } catch (error) {
        // Not enough liquidity in this pool
        if ((error as { isInsufficientReservesError?: boolean }).isInsufficientReservesError) {
          continue
        }
        throw error
      }

      // We have arrived at the input currency, so this is the first trade of one of the paths
      if (amountIn.currency.equals(currencyIn)) {
        sortedInsert(
          bestTrades,
          await Trade.fromRoute(
            new Route([pool, ...currentPools], currencyIn, currencyAmountOut.currency),
            currencyAmountOut,
            TradeType.EXACT_OUTPUT
          ),
          maxNumResults,
          tradeComparator
        )
      } else if (maxHops > 1 && pools.length > 1) {
        const poolsExcludingThisPool = pools.slice(0, i).concat(pools.slice(i + 1, pools.length))

        // Otherwise, consider all the other paths that arrive at this currency
        await Trade.bestTradeExactOut(
          poolsExcludingThisPool,
          currencyIn,
          currencyAmountOut,
          {
            maxNumResults,
            maxHops: maxHops - 1,
          },
          [pool, ...currentPools],
          amountIn,
          bestTrades
        )
      }
    }

    return bestTrades
  }
}
