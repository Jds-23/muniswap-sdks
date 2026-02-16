import {
  type Currency,
  CurrencyAmount,
  Fraction,
  Percent,
  Price,
  type Token,
  TradeType,
  sortedInsert,
} from '@muniswap/sdk-core'
import { Pair } from '@muniswap/v2-sdk'
import type { BestTradeOptions } from '@muniswap/v3-sdk'
import { Pool as V3Pool } from '@muniswap/v3-sdk'
import { Pool as V4Pool } from '@muniswap/v4-sdk'
import invariant from 'tiny-invariant'
import { ONE, ZERO } from '../../constants'
import { MixedRouteSDK } from './route'
import { amountWithPathCurrency } from '../../utils/pathCurrency'
import type { TPool } from '../../utils/TPool'

export function tradeComparator<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
  a: MixedRouteTrade<TInput, TOutput, TTradeType>,
  b: MixedRouteTrade<TInput, TOutput, TTradeType>
) {
  invariant(a.inputAmount.currency.equals(b.inputAmount.currency), 'INPUT_CURRENCY')
  invariant(a.outputAmount.currency.equals(b.outputAmount.currency), 'OUTPUT_CURRENCY')
  if (a.outputAmount.equalTo(b.outputAmount)) {
    if (a.inputAmount.equalTo(b.inputAmount)) {
      const aHops = a.swaps.reduce((total, cur) => total + cur.route.path.length, 0)
      const bHops = b.swaps.reduce((total, cur) => total + cur.route.path.length, 0)
      return aHops - bHops
    }
    if (a.inputAmount.lessThan(b.inputAmount)) {
      return -1
    } else {
      return 1
    }
  } else {
    if (a.outputAmount.lessThan(b.outputAmount)) {
      return 1
    } else {
      return -1
    }
  }
}

export class MixedRouteTrade<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType> {
  public get route(): MixedRouteSDK<TInput, TOutput> {
    invariant(this.swaps.length === 1, 'MULTIPLE_ROUTES')
    return this.swaps[0]!.route
  }

  public readonly swaps: {
    route: MixedRouteSDK<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
  }[]

  public readonly tradeType: TTradeType

  private _inputAmount: CurrencyAmount<TInput> | undefined

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

  private _outputAmount: CurrencyAmount<TOutput> | undefined

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

  private _executionPrice: Price<TInput, TOutput> | undefined

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

  private _priceImpact: Percent | undefined

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

  public static async fromRoute<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    route: MixedRouteSDK<TInput, TOutput>,
    amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
    tradeType: TTradeType
  ): Promise<MixedRouteTrade<TInput, TOutput, TTradeType>> {
    const amounts: CurrencyAmount<Currency>[] = new Array(route.path.length)
    let inputAmount: CurrencyAmount<TInput>
    let outputAmount: CurrencyAmount<TOutput>

    invariant(tradeType === TradeType.EXACT_INPUT, 'TRADE_TYPE')
    invariant(amount.currency.equals(route.input), 'INPUT')

    amounts[0] = amountWithPathCurrency(amount, route.pools[0]!)
    for (let i = 0; i < route.path.length - 1; i++) {
      const pool = route.pools[i]!
      const [outputAmount] = await pool.getOutputAmount(
        amountWithPathCurrency(amounts[i]!, pool) as CurrencyAmount<Token>
      )
      amounts[i + 1] = outputAmount
    }

    inputAmount = CurrencyAmount.fromFractionalAmount(route.input, amount.numerator, amount.denominator)
    outputAmount = CurrencyAmount.fromFractionalAmount(
      route.output,
      amounts[amounts.length - 1]!.numerator,
      amounts[amounts.length - 1]!.denominator
    )

    return new MixedRouteTrade({
      routes: [{ inputAmount, outputAmount, route }],
      tradeType,
    })
  }

  public static async fromRoutes<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    routes: {
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
      route: MixedRouteSDK<TInput, TOutput>
    }[],
    tradeType: TTradeType
  ): Promise<MixedRouteTrade<TInput, TOutput, TTradeType>> {
    const populatedRoutes: {
      route: MixedRouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    invariant(tradeType === TradeType.EXACT_INPUT, 'TRADE_TYPE')

    for (const { route, amount } of routes) {
      const amounts: CurrencyAmount<Currency>[] = new Array(route.path.length)
      let inputAmount: CurrencyAmount<TInput>
      let outputAmount: CurrencyAmount<TOutput>

      invariant(amount.currency.equals(route.input), 'INPUT')
      inputAmount = CurrencyAmount.fromFractionalAmount(route.input, amount.numerator, amount.denominator)
      amounts[0] = CurrencyAmount.fromFractionalAmount(route.pathInput, amount.numerator, amount.denominator)

      for (let i = 0; i < route.path.length - 1; i++) {
        const pool = route.pools[i]!
        const [outputAmount] = await pool.getOutputAmount(
          amountWithPathCurrency(amounts[i]!, pool) as CurrencyAmount<Token>
        )
        amounts[i + 1] = outputAmount
      }

      outputAmount = CurrencyAmount.fromFractionalAmount(
        route.output,
        amounts[amounts.length - 1]!.numerator,
        amounts[amounts.length - 1]!.denominator
      )

      populatedRoutes.push({ route, inputAmount, outputAmount })
    }

    return new MixedRouteTrade({
      routes: populatedRoutes,
      tradeType,
    })
  }

  public static createUncheckedTrade<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType,
  >(constructorArguments: {
    route: MixedRouteSDK<TInput, TOutput>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
    tradeType: TTradeType
  }): MixedRouteTrade<TInput, TOutput, TTradeType> {
    return new MixedRouteTrade({
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

  public static createUncheckedTradeWithMultipleRoutes<
    TInput extends Currency,
    TOutput extends Currency,
    TTradeType extends TradeType,
  >(constructorArguments: {
    routes: {
      route: MixedRouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }): MixedRouteTrade<TInput, TOutput, TTradeType> {
    return new MixedRouteTrade(constructorArguments)
  }

  private constructor({
    routes,
    tradeType,
  }: {
    routes: {
      route: MixedRouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }) {
    const inputCurrency = routes[0]!.inputAmount.currency
    const outputCurrency = routes[0]!.outputAmount.currency
    invariant(
      routes.every(({ route }) => inputCurrency.wrapped.equals(route.input.wrapped)),
      'INPUT_CURRENCY_MATCH'
    )
    invariant(
      routes.every(({ route }) => outputCurrency.wrapped.equals(route.output.wrapped)),
      'OUTPUT_CURRENCY_MATCH'
    )

    const numPools = routes.map(({ route }) => route.pools.length).reduce((total, cur) => total + cur, 0)
    const poolIdentifierSet = new Set<string>()
    for (const { route } of routes) {
      for (const pool of route.pools) {
        if (pool instanceof V4Pool) {
          poolIdentifierSet.add(pool.poolId)
        } else if (pool instanceof V3Pool) {
          poolIdentifierSet.add(V3Pool.getAddress(pool.token0, pool.token1, pool.fee))
        } else if (pool instanceof Pair) {
          const pair = pool
          poolIdentifierSet.add(Pair.getAddress(pair.token0, pair.token1))
        } else {
          throw new Error('Unexpected pool type in route when constructing trade object')
        }
      }
    }

    invariant(numPools === poolIdentifierSet.size, 'POOLS_DUPLICATED')

    invariant(tradeType === TradeType.EXACT_INPUT, 'TRADE_TYPE')

    this.swaps = routes
    this.tradeType = tradeType
  }

  public minimumAmountOut(slippageTolerance: Percent, amountOut = this.outputAmount): CurrencyAmount<TOutput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    const slippageAdjustedAmountOut = new Fraction(ONE)
      .add(slippageTolerance)
      .invert()
      .multiply(amountOut.quotient).quotient
    return CurrencyAmount.fromRawAmount(amountOut.currency, slippageAdjustedAmountOut)
  }

  public maximumAmountIn(slippageTolerance: Percent, amountIn = this.inputAmount): CurrencyAmount<TInput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    return amountIn
  }

  public worstExecutionPrice(slippageTolerance: Percent): Price<TInput, TOutput> {
    return new Price(
      this.inputAmount.currency,
      this.outputAmount.currency,
      this.maximumAmountIn(slippageTolerance).quotient,
      this.minimumAmountOut(slippageTolerance).quotient
    )
  }

  public static async bestTradeExactIn<TInput extends Currency, TOutput extends Currency>(
    pools: TPool[],
    currencyAmountIn: CurrencyAmount<TInput>,
    currencyOut: TOutput,
    { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
    currentPools: TPool[] = [],
    nextAmountIn: CurrencyAmount<Currency> = currencyAmountIn,
    bestTrades: MixedRouteTrade<TInput, TOutput, TradeType.EXACT_INPUT>[] = []
  ): Promise<MixedRouteTrade<TInput, TOutput, TradeType.EXACT_INPUT>[]> {
    invariant(pools.length > 0, 'POOLS')
    invariant(maxHops > 0, 'MAX_HOPS')
    invariant(currencyAmountIn === nextAmountIn || currentPools.length > 0, 'INVALID_RECURSION')

    const amountIn = nextAmountIn
    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i]!
      const amountInAdjusted = pool instanceof V4Pool ? amountIn : amountIn.wrapped
      if (!pool.token0.equals(amountInAdjusted.currency) && !pool.token1.equals(amountInAdjusted.currency)) continue
      if (pool instanceof Pair) {
        if ((pool as Pair).reserve0.equalTo(ZERO) || (pool as Pair).reserve1.equalTo(ZERO)) continue
      }

      let amountOut: CurrencyAmount<Currency>
      try {
        ;[amountOut] =
          pool instanceof V4Pool
            ? await pool.getOutputAmount(amountInAdjusted)
            : await pool.getOutputAmount(amountInAdjusted.wrapped)
      } catch (error) {
        // @ts-ignore[2571] error is unknown
        if (error.isInsufficientInputAmountError) {
          continue
        }
        throw error
      }
      if (amountOut.currency.wrapped.equals(currencyOut.wrapped)) {
        sortedInsert(
          bestTrades,
          await MixedRouteTrade.fromRoute(
            new MixedRouteSDK([...currentPools, pool], currencyAmountIn.currency, currencyOut),
            currencyAmountIn,
            TradeType.EXACT_INPUT
          ),
          maxNumResults,
          tradeComparator
        )
      } else if (maxHops > 1 && pools.length > 1) {
        const poolsExcludingThisPool = pools.slice(0, i).concat(pools.slice(i + 1, pools.length))

        await MixedRouteTrade.bestTradeExactIn(
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
}
