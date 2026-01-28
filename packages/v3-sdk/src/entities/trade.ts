import {
  type Currency,
  CurrencyAmount,
  Percent,
  Price,
  type Token,
  TradeType,
  sortedInsert,
} from '@muniswap/sdk-core'
import invariant from 'tiny-invariant'
import { ONE, ZERO } from '../internalConstants'
import type { Pool } from './pool'
import { Route } from './route'

/**
 * Options for best trade calculation.
 */
export interface BestTradeOptions {
  maxNumResults?: number
  maxHops?: number
}

/**
 * Represents a trade executed against a set of routes where some percentage of the input is
 * split across each route.
 */
export class Trade<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType> {
  /**
   * The swaps for this trade.
   */
  public readonly swaps: {
    route: Route<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
  }[]

  /**
   * The type of trade (exact input or exact output).
   */
  public readonly tradeType: TTradeType

  // Cached values
  private _inputAmount: CurrencyAmount<TInput> | undefined
  private _outputAmount: CurrencyAmount<TOutput> | undefined
  private _executionPrice: Price<TInput, TOutput> | undefined
  private _priceImpact: Percent | undefined

  /**
   * @param swaps - The swaps for this trade
   * @param tradeType - The type of trade
   */
  private constructor(
    swaps: {
      route: Route<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[],
    tradeType: TTradeType
  ) {
    this.swaps = swaps
    this.tradeType = tradeType
  }

  /**
   * Constructs a trade from a route.
   *
   * @param route - The route of the trade
   * @param amount - The amount being passed in or expected out
   * @param tradeType - The type of trade
   * @returns The trade
   */
  public static async fromRoute<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    route: Route<TInput, TOutput>,
    amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    const amounts: CurrencyAmount<Token>[] = new Array(route.tokenPath.length)

    if (tradeType === TradeType.EXACT_INPUT) {
      invariant(amount.currency.equals(route.input), 'INPUT')
      amounts[0] = amount.wrapped
      for (let i = 0; i < route.pools.length; i++) {
        const pool = route.pools[i]!
        const [outputAmount] = await pool.getOutputAmount(amounts[i]!)
        amounts[i + 1] = outputAmount
      }

      const inputAmount = CurrencyAmount.fromFractionalAmount(route.input, amount.numerator, amount.denominator)
      const outputAmount = CurrencyAmount.fromFractionalAmount(
        route.output,
        amounts[amounts.length - 1]!.numerator,
        amounts[amounts.length - 1]!.denominator
      )
      return new Trade([{ route, inputAmount, outputAmount }], tradeType as TTradeType)
    } else {
      invariant(amount.currency.equals(route.output), 'OUTPUT')
      amounts[amounts.length - 1] = amount.wrapped
      for (let i = route.pools.length - 1; i >= 0; i--) {
        const pool = route.pools[i]!
        const [inputAmount] = await pool.getInputAmount(amounts[i + 1]!)
        amounts[i] = inputAmount
      }

      const inputAmount = CurrencyAmount.fromFractionalAmount(
        route.input,
        amounts[0]!.numerator,
        amounts[0]!.denominator
      )
      const outputAmount = CurrencyAmount.fromFractionalAmount(route.output, amount.numerator, amount.denominator)
      return new Trade([{ route, inputAmount, outputAmount }], tradeType as TTradeType)
    }
  }

  /**
   * Constructs a trade from routes.
   *
   * @param routes - The routes to trade
   * @param tradeType - The type of trade
   * @returns The trade
   */
  public static async fromRoutes<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    routes: {
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
      route: Route<TInput, TOutput>
    }[],
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    const populatedRoutes: {
      route: Route<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    for (const { route, amount } of routes) {
      const amounts: CurrencyAmount<Token>[] = new Array(route.tokenPath.length)

      if (tradeType === TradeType.EXACT_INPUT) {
        invariant(amount.currency.equals(route.input), 'INPUT')
        amounts[0] = CurrencyAmount.fromFractionalAmount(route.input.wrapped, amount.numerator, amount.denominator)
        for (let i = 0; i < route.pools.length; i++) {
          const pool = route.pools[i]!
          const [outputAmount] = await pool.getOutputAmount(amounts[i]!)
          amounts[i + 1] = outputAmount
        }

        const inputAmount = CurrencyAmount.fromFractionalAmount(route.input, amount.numerator, amount.denominator)
        const outputAmount = CurrencyAmount.fromFractionalAmount(
          route.output,
          amounts[amounts.length - 1]!.numerator,
          amounts[amounts.length - 1]!.denominator
        )
        populatedRoutes.push({ route, inputAmount, outputAmount })
      } else {
        invariant(amount.currency.equals(route.output), 'OUTPUT')
        amounts[amounts.length - 1] = CurrencyAmount.fromFractionalAmount(
          route.output.wrapped,
          amount.numerator,
          amount.denominator
        )
        for (let i = route.pools.length - 1; i >= 0; i--) {
          const pool = route.pools[i]!
          const [inputAmount] = await pool.getInputAmount(amounts[i + 1]!)
          amounts[i] = inputAmount
        }

        const inputAmount = CurrencyAmount.fromFractionalAmount(
          route.input,
          amounts[0]!.numerator,
          amounts[0]!.denominator
        )
        const outputAmount = CurrencyAmount.fromFractionalAmount(route.output, amount.numerator, amount.denominator)
        populatedRoutes.push({ route, inputAmount, outputAmount })
      }
    }

    return new Trade(populatedRoutes, tradeType as TTradeType)
  }

  /**
   * Creates a trade without computing the amounts.
   */
  public static createUncheckedTrade<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType,
  >(args: {
    route: Route<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
    tradeType: TTradeType
  }): Trade<TInput, TOutput, TTradeType> {
    return new Trade(
      [
        {
          route: args.route,
          inputAmount: args.inputAmount,
          outputAmount: args.outputAmount,
        },
      ],
      args.tradeType
    )
  }

  /**
   * Creates a trade without computing the amounts with multiple routes.
   */
  public static createUncheckedTradeWithMultipleRoutes<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType,
  >(args: {
    routes: {
      route: Route<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }): Trade<TInput, TOutput, TTradeType> {
    return new Trade(args.routes, args.tradeType)
  }

  /**
   * The routes for this trade.
   */
  public get route(): Route<TInput, TOutput> {
    invariant(this.swaps.length === 1, 'MULTIPLE_ROUTES')
    return this.swaps[0]!.route
  }

  /**
   * The input amount for the trade.
   */
  public get inputAmount(): CurrencyAmount<TInput> {
    if (this._inputAmount) return this._inputAmount

    const inputCurrency = this.swaps[0]!.inputAmount.currency
    const totalInputFromRoutes = this.swaps.reduce(
      (total, { inputAmount }) => total.add(inputAmount),
      CurrencyAmount.fromRawAmount(inputCurrency, 0)
    )
    this._inputAmount = totalInputFromRoutes
    return this._inputAmount
  }

  /**
   * The output amount for the trade.
   */
  public get outputAmount(): CurrencyAmount<TOutput> {
    if (this._outputAmount) return this._outputAmount

    const outputCurrency = this.swaps[0]!.outputAmount.currency
    const totalOutputFromRoutes = this.swaps.reduce(
      (total, { outputAmount }) => total.add(outputAmount),
      CurrencyAmount.fromRawAmount(outputCurrency, 0)
    )
    this._outputAmount = totalOutputFromRoutes
    return this._outputAmount
  }

  /**
   * The price expressed in terms of output amount/input amount.
   */
  public get executionPrice(): Price<TInput, TOutput> {
    return (
      this._executionPrice ??
      (this._executionPrice = new Price(
        this.inputAmount.currency,
        this.outputAmount.currency,
        this.inputAmount.quotient,
        this.outputAmount.quotient
      ))
    )
  }

  /**
   * Returns the percent difference between the route's mid price and the price impact.
   */
  public get priceImpact(): Percent {
    if (this._priceImpact) return this._priceImpact

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
   * Get the minimum amount that must be received for this trade, given a slippage tolerance.
   *
   * @param slippageTolerance - The slippage tolerance
   * @returns The minimum output amount
   */
  public minimumAmountOut(slippageTolerance: Percent): CurrencyAmount<TOutput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_OUTPUT) {
      return this.outputAmount
    } else {
      const slippageAdjustedAmountOut =
        (this.outputAmount.quotient * ONE) / (ONE + (slippageTolerance.numerator * ONE) / slippageTolerance.denominator)
      return CurrencyAmount.fromRawAmount(this.outputAmount.currency, slippageAdjustedAmountOut)
    }
  }

  /**
   * Get the maximum amount that should be spent for this trade, given a slippage tolerance.
   *
   * @param slippageTolerance - The slippage tolerance
   * @returns The maximum input amount
   */
  public maximumAmountIn(slippageTolerance: Percent): CurrencyAmount<TInput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_INPUT) {
      return this.inputAmount
    } else {
      const slippageAdjustedAmountIn =
        (this.inputAmount.quotient * (ONE + (slippageTolerance.numerator * ONE) / slippageTolerance.denominator)) / ONE
      return CurrencyAmount.fromRawAmount(this.inputAmount.currency, slippageAdjustedAmountIn)
    }
  }

  /**
   * Returns the sell tax for the input currency.
   */
  public get inputTax(): Percent {
    const inputCurrency = this.inputAmount.currency.wrapped
    if (inputCurrency.sellFeeBps !== undefined && inputCurrency.sellFeeBps > 0n) {
      return new Percent(inputCurrency.sellFeeBps, 10000n)
    }
    return new Percent(ZERO, 1n)
  }

  /**
   * Returns the buy tax for the output currency.
   */
  public get outputTax(): Percent {
    const outputCurrency = this.outputAmount.currency.wrapped
    if (outputCurrency.buyFeeBps !== undefined && outputCurrency.buyFeeBps > 0n) {
      return new Percent(outputCurrency.buyFeeBps, 10000n)
    }
    return new Percent(ZERO, 1n)
  }

  /**
   * Return the execution price after accounting for slippage tolerance.
   *
   * @param slippageTolerance - The slippage tolerance
   * @returns The worst case execution price
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
   * Given a list of pools, and a fixed amount in, returns the top `maxNumResults` trades that go from an input token
   * amount to an output token, making at most `maxHops` hops.
   *
   * Note this does not consider aggregation, as routes are linear. It's possible a better route exists by splitting
   * the amount in among multiple routes.
   *
   * @param pools - The pools to consider in finding the best trade
   * @param currencyAmountIn - The exact amount of input currency to spend
   * @param currencyOut - The desired currency out
   * @param maxNumResults - Maximum number of results to return
   * @param maxHops - Maximum number of hops a returned trade can make
   * @param currentPools - Used in recursion; the current list of pools
   * @param nextAmountIn - Used in recursion; the exact amount of input currency to spend
   * @param bestTrades - Used in recursion; the current list of best trades
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

    const amountIn = nextAmountIn.wrapped
    const tokenOut = currencyOut.wrapped

    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]!
      // Pool irrelevant
      if (!pool.token0.equals(amountIn.currency) && !pool.token1.equals(amountIn.currency)) continue

      let amountOut: CurrencyAmount<Token>
      try {
        ;[amountOut] = await pool.getOutputAmount(amountIn)
      } catch {
        // Not enough liquidity in this pool
        continue
      }

      // We have arrived at the output token
      if (amountOut.currency.equals(tokenOut)) {
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

        // Otherwise, consider all the other paths that lead from this token as long as we have not exceeded maxHops
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
   * Similar to bestTradeExactIn but targets a fixed output amount.
   * Given a list of pools, and a fixed amount out, returns the top `maxNumResults` trades that go from an input token
   * to an output token amount, making at most `maxHops` hops.
   *
   * @param pools - The pools to consider in finding the best trade
   * @param currencyIn - The currency to spend
   * @param currencyAmountOut - The desired currency amount out
   * @param maxNumResults - Maximum number of results to return
   * @param maxHops - Maximum number of hops a returned trade can make
   * @param currentPools - Used in recursion; the current list of pools
   * @param nextAmountOut - Used in recursion; the exact amount of currency out
   * @param bestTrades - Used in recursion; the current list of best trades
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

    const amountOut = nextAmountOut.wrapped
    const tokenIn = currencyIn.wrapped

    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]!
      // Pool irrelevant
      if (!pool.token0.equals(amountOut.currency) && !pool.token1.equals(amountOut.currency)) continue

      let amountIn: CurrencyAmount<Token>
      try {
        ;[amountIn] = await pool.getInputAmount(amountOut)
      } catch {
        // Not enough liquidity in this pool
        continue
      }

      // We have arrived at the input token
      if (amountIn.currency.equals(tokenIn)) {
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

        // Otherwise, consider all the other paths that arrive at this token as long as we have not exceeded maxHops
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

/**
 * Compares two trades by their outputs (or inputs for exact output trades).
 */
function tradeComparator<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
  a: Trade<TInput, TOutput, TTradeType>,
  b: Trade<TInput, TOutput, TTradeType>
): number {
  // Compare output amounts if exact input, input amounts if exact output
  if (a.tradeType === TradeType.EXACT_INPUT) {
    // Prioritize larger output
    if (a.outputAmount.greaterThan(b.outputAmount)) return -1
    if (b.outputAmount.greaterThan(a.outputAmount)) return 1
  } else {
    // Prioritize smaller input
    if (a.inputAmount.lessThan(b.inputAmount)) return -1
    if (b.inputAmount.lessThan(a.inputAmount)) return 1
  }

  // At this point, trades are equivalent in terms of input/output
  // Prefer fewer hops as tie-breaker
  return (
    a.swaps.reduce((total, swap) => total + swap.route.pools.length, 0) -
    b.swaps.reduce((total, swap) => total + swap.route.pools.length, 0)
  )
}
