import {
  type Currency,
  CurrencyAmount,
  Ether,
  Fraction,
  Percent,
  Price,
  TradeType,
} from '@muniswap/sdk-core'
import { Pair, Route as V2RouteSDK, Trade as V2TradeSDK } from '@muniswap/v2-sdk'
import { Pool as V3Pool, Route as V3RouteSDK, Trade as V3TradeSDK } from '@muniswap/v3-sdk'
import { Pool as V4Pool, Route as V4RouteSDK, Trade as V4TradeSDK } from '@muniswap/v4-sdk'
import invariant from 'tiny-invariant'
import { ONE, ONE_HUNDRED_PERCENT, ZERO, ZERO_PERCENT } from '../constants'
import { MixedRouteSDK } from './mixedRoute/route'
import { MixedRouteTrade as MixedRouteTradeSDK } from './mixedRoute/trade'
import type { IRoute } from './route'
import { MixedRoute, RouteV2, RouteV3, RouteV4 } from './route'

export class Trade<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType> {
  public readonly routes: IRoute<TInput, TOutput, Pair | V3Pool | V4Pool>[]
  public readonly tradeType: TTradeType
  private _outputAmount: CurrencyAmount<TOutput> | undefined
  private _inputAmount: CurrencyAmount<TInput> | undefined
  private _nativeInputRoutes: IRoute<TInput, TOutput, Pair | V3Pool | V4Pool>[] | undefined
  private _wethInputRoutes: IRoute<TInput, TOutput, Pair | V3Pool | V4Pool>[] | undefined

  public readonly swaps: {
    route: IRoute<TInput, TOutput, Pair | V3Pool | V4Pool>
    inputAmount: CurrencyAmount<TInput>
    outputAmount: CurrencyAmount<TOutput>
  }[]

  public constructor({
    v2Routes = [],
    v3Routes = [],
    v4Routes = [],
    mixedRoutes = [],
    tradeType,
  }: {
    v2Routes?: {
      routev2: V2RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    v3Routes?: {
      routev3: V3RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    v4Routes?: {
      routev4: V4RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    mixedRoutes?: {
      mixedRoute: MixedRouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[]
    tradeType: TTradeType
  }) {
    this.swaps = []
    this.routes = []
    for (const { routev2, inputAmount, outputAmount } of v2Routes) {
      const route = new RouteV2(routev2)
      this.routes.push(route)
      this.swaps.push({ route, inputAmount, outputAmount })
    }
    for (const { routev3, inputAmount, outputAmount } of v3Routes) {
      const route = new RouteV3(routev3)
      this.routes.push(route)
      this.swaps.push({ route, inputAmount, outputAmount })
    }
    for (const { routev4, inputAmount, outputAmount } of v4Routes) {
      const route = new RouteV4(routev4)
      this.routes.push(route)
      this.swaps.push({ route, inputAmount, outputAmount })
    }
    for (const { mixedRoute, inputAmount, outputAmount } of mixedRoutes) {
      const route = new MixedRoute(mixedRoute)
      this.routes.push(route)
      this.swaps.push({ route, inputAmount, outputAmount })
    }

    if (this.swaps.length === 0) {
      throw new Error('No routes provided when calling Trade constructor')
    }

    this.tradeType = tradeType

    const inputCurrency = this.swaps[0]!.inputAmount.currency
    const outputCurrency = this.swaps[0]!.outputAmount.currency
    invariant(
      this.swaps.every(({ route }) => inputCurrency.wrapped.equals(route.input.wrapped)),
      'INPUT_CURRENCY_MATCH'
    )
    invariant(
      this.swaps.every(({ route }) => outputCurrency.wrapped.equals(route.output.wrapped)),
      'OUTPUT_CURRENCY_MATCH'
    )

    const numPools = this.swaps.map(({ route }) => route.pools.length).reduce((total, cur) => total + cur, 0)
    const poolIdentifierSet = new Set<string>()
    for (const { route } of this.swaps) {
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
  }

  public get inputAmount(): CurrencyAmount<TInput> {
    if (this._inputAmount) {
      return this._inputAmount
    }

    const inputAmountCurrency = this.swaps[0]!.inputAmount.currency
    const totalInputFromRoutes = this.swaps
      .map(({ inputAmount: routeInputAmount }) => routeInputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(inputAmountCurrency, 0))

    this._inputAmount = totalInputFromRoutes
    return this._inputAmount
  }

  public get outputAmount(): CurrencyAmount<TOutput> {
    if (this._outputAmount) {
      return this._outputAmount
    }

    const outputCurrency = this.swaps[0]!.outputAmount.currency
    const totalOutputFromRoutes = this.swaps
      .map(({ outputAmount: routeOutputAmount }) => routeOutputAmount)
      .reduce((total, cur) => total.add(cur), CurrencyAmount.fromRawAmount(outputCurrency, 0))

    this._outputAmount = totalOutputFromRoutes
    return this._outputAmount
  }

  public get amounts(): {
    inputAmount: CurrencyAmount<TInput>
    inputAmountNative: CurrencyAmount<TInput> | undefined
    outputAmount: CurrencyAmount<TOutput>
    outputAmountNative: CurrencyAmount<TOutput> | undefined
  } {
    const inputNativeCurrency = this.swaps.find(({ inputAmount }) => inputAmount.currency.isNative)?.inputAmount
      .currency
    const outputNativeCurrency = this.swaps.find(({ outputAmount }) => outputAmount.currency.isNative)?.outputAmount
      .currency

    return {
      inputAmount: this.inputAmount,
      inputAmountNative: inputNativeCurrency
        ? this.swaps.reduce((total, swap) => {
            return swap.route.pathInput.isNative ? total.add(swap.inputAmount) : total
          }, CurrencyAmount.fromRawAmount(inputNativeCurrency, 0))
        : undefined,
      outputAmount: this.outputAmount,
      outputAmountNative: outputNativeCurrency
        ? this.swaps.reduce((total, swap) => {
            return swap.route.pathOutput.isNative ? total.add(swap.outputAmount) : total
          }, CurrencyAmount.fromRawAmount(outputNativeCurrency, 0))
        : undefined,
    }
  }

  public get numberOfInputWraps(): number {
    if (this.inputAmount.currency.isNative) {
      return this.wethInputRoutes.length
    } else return 0
  }

  public get numberOfInputUnwraps(): number {
    if (this.isWrappedNative(this.inputAmount.currency)) {
      return this.nativeInputRoutes.length
    } else return 0
  }

  public get nativeInputRoutes(): IRoute<TInput, TOutput, Pair | V3Pool | V4Pool>[] {
    if (this._nativeInputRoutes) {
      return this._nativeInputRoutes
    }

    this._nativeInputRoutes = this.routes.filter((route) => route.pathInput.isNative)
    return this._nativeInputRoutes
  }

  public get wethInputRoutes(): IRoute<TInput, TOutput, Pair | V3Pool | V4Pool>[] {
    if (this._wethInputRoutes) {
      return this._wethInputRoutes
    }

    this._wethInputRoutes = this.routes.filter((route) => this.isWrappedNative(route.pathInput))
    return this._wethInputRoutes
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

  public get inputTax(): Percent {
    const inputCurrency = this.inputAmount.currency
    if (inputCurrency.isNative || !inputCurrency.wrapped.sellFeeBps) return ZERO_PERCENT

    return new Percent(Number(inputCurrency.wrapped.sellFeeBps), 10000)
  }

  public get outputTax(): Percent {
    const outputCurrency = this.outputAmount.currency
    if (outputCurrency.isNative || !outputCurrency.wrapped.buyFeeBps) return ZERO_PERCENT

    return new Percent(Number(outputCurrency.wrapped.buyFeeBps), 10000)
  }

  private isWrappedNative(currency: Currency): boolean {
    const chainId = currency.chainId
    return currency.equals(Ether.onChain(chainId).wrapped)
  }

  private _priceImpact: Percent | undefined

  public get priceImpact(): Percent {
    if (this._priceImpact) {
      return this._priceImpact
    }

    if (this.outputTax.equalTo(ONE_HUNDRED_PERCENT)) return ZERO_PERCENT

    let spotOutputAmount = CurrencyAmount.fromRawAmount(this.outputAmount.currency, 0)
    for (const { route, inputAmount } of this.swaps) {
      const midPrice = route.midPrice
      const postTaxInputAmount = inputAmount.multiply(new Fraction(ONE).subtract(this.inputTax))
      spotOutputAmount = spotOutputAmount.add(midPrice.quote(postTaxInputAmount))
    }

    if (spotOutputAmount.equalTo(ZERO)) return ZERO_PERCENT

    const preTaxOutputAmount = this.outputAmount.divide(new Fraction(ONE).subtract(this.outputTax))
    const priceImpact = spotOutputAmount.subtract(preTaxOutputAmount).divide(spotOutputAmount)
    this._priceImpact = new Percent(priceImpact.numerator, priceImpact.denominator)

    return this._priceImpact
  }

  public minimumAmountOut(slippageTolerance: Percent, amountOut = this.outputAmount): CurrencyAmount<TOutput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_OUTPUT) {
      return amountOut
    } else {
      const slippageAdjustedAmountOut = new Fraction(ONE)
        .add(slippageTolerance)
        .invert()
        .multiply(amountOut.quotient).quotient
      return CurrencyAmount.fromRawAmount(amountOut.currency, slippageAdjustedAmountOut)
    }
  }

  public maximumAmountIn(slippageTolerance: Percent, amountIn = this.inputAmount): CurrencyAmount<TInput> {
    invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
    if (this.tradeType === TradeType.EXACT_INPUT) {
      return amountIn
    } else {
      const slippageAdjustedAmountIn = new Fraction(ONE).add(slippageTolerance).multiply(amountIn.quotient).quotient
      return CurrencyAmount.fromRawAmount(amountIn.currency, slippageAdjustedAmountIn)
    }
  }

  public worstExecutionPrice(slippageTolerance: Percent): Price<TInput, TOutput> {
    return new Price(
      this.inputAmount.currency,
      this.outputAmount.currency,
      this.maximumAmountIn(slippageTolerance).quotient,
      this.minimumAmountOut(slippageTolerance).quotient
    )
  }

  public static async fromRoutes<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    v2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
    }[],
    v3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
    }[],
    tradeType: TTradeType,
    mixedRoutes?: {
      mixedRoute: MixedRouteSDK<TInput, TOutput>
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
    }[],
    v4Routes?: {
      routev4: V4RouteSDK<TInput, TOutput>
      amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>
    }[]
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    const populatedV2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    const populatedV3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    const populatedV4Routes: {
      routev4: V4RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    const populatedMixedRoutes: {
      mixedRoute: MixedRouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    for (const { routev2, amount } of v2Routes) {
      const v2Trade = new V2TradeSDK(routev2, amount, tradeType)
      const { inputAmount, outputAmount } = v2Trade
      populatedV2Routes.push({ routev2, inputAmount, outputAmount })
    }

    for (const { routev3, amount } of v3Routes) {
      const v3Trade = await V3TradeSDK.fromRoute(routev3, amount, tradeType)
      const { inputAmount, outputAmount } = v3Trade
      populatedV3Routes.push({ routev3, inputAmount, outputAmount })
    }

    if (v4Routes) {
      for (const { routev4, amount } of v4Routes) {
        const v4Trade = await V4TradeSDK.fromRoute(routev4, amount, tradeType)
        const { inputAmount, outputAmount } = v4Trade
        populatedV4Routes.push({ routev4, inputAmount, outputAmount })
      }
    }

    if (mixedRoutes) {
      for (const { mixedRoute, amount } of mixedRoutes) {
        const mixedRouteTrade = await MixedRouteTradeSDK.fromRoute(mixedRoute, amount, tradeType)
        const { inputAmount, outputAmount } = mixedRouteTrade
        populatedMixedRoutes.push({ mixedRoute, inputAmount, outputAmount })
      }
    }

    return new Trade({
      v2Routes: populatedV2Routes,
      v3Routes: populatedV3Routes,
      v4Routes: populatedV4Routes,
      mixedRoutes: populatedMixedRoutes,
      tradeType,
    })
  }

  public static async fromRoute<TInput extends Currency, TOutput extends Currency, TTradeType extends TradeType>(
    route:
      | V2RouteSDK<TInput, TOutput>
      | V3RouteSDK<TInput, TOutput>
      | V4RouteSDK<TInput, TOutput>
      | MixedRouteSDK<TInput, TOutput>,
    amount: TTradeType extends TradeType.EXACT_INPUT ? CurrencyAmount<TInput> : CurrencyAmount<TOutput>,
    tradeType: TTradeType
  ): Promise<Trade<TInput, TOutput, TTradeType>> {
    let v2Routes: {
      routev2: V2RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    let v3Routes: {
      routev3: V3RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    let v4Routes: {
      routev4: V4RouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    let mixedRoutes: {
      mixedRoute: MixedRouteSDK<TInput, TOutput>
      inputAmount: CurrencyAmount<TInput>
      outputAmount: CurrencyAmount<TOutput>
    }[] = []

    if (route instanceof V2RouteSDK) {
      const v2Trade = new V2TradeSDK(route, amount, tradeType)
      const { inputAmount, outputAmount } = v2Trade
      v2Routes = [{ routev2: route, inputAmount, outputAmount }]
    } else if (route instanceof V3RouteSDK) {
      const v3Trade = await V3TradeSDK.fromRoute(route, amount, tradeType)
      const { inputAmount, outputAmount } = v3Trade
      v3Routes = [{ routev3: route, inputAmount, outputAmount }]
    } else if (route instanceof V4RouteSDK) {
      const v4Trade = await V4TradeSDK.fromRoute(route, amount, tradeType)
      const { inputAmount, outputAmount } = v4Trade
      v4Routes = [{ routev4: route, inputAmount, outputAmount }]
    } else if (route instanceof MixedRouteSDK) {
      const mixedRouteTrade = await MixedRouteTradeSDK.fromRoute(route, amount, tradeType)
      const { inputAmount, outputAmount } = mixedRouteTrade
      mixedRoutes = [{ mixedRoute: route, inputAmount, outputAmount }]
    } else {
      throw new Error('Invalid route type')
    }

    return new Trade({
      v2Routes,
      v3Routes,
      v4Routes,
      mixedRoutes,
      tradeType,
    })
  }
}
