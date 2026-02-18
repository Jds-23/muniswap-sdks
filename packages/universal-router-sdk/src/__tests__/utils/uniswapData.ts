import { type MixedRouteSDK, MixedRouteTrade, Trade as RouterTrade } from '@muniswap/router-sdk'
import { type Currency, CurrencyAmount, Ether, Percent, Token, type TradeType } from '@muniswap/sdk-core'
import { Pair, type Route as RouteV2, Trade as V2Trade } from '@muniswap/v2-sdk'
import {
  FeeAmount,
  MAX_TICK,
  MIN_TICK,
  Pool,
  type Route as RouteV3,
  TICK_SPACINGS,
  Trade as V3Trade,
  encodeSqrtRatioX96,
  nearestUsableTick,
} from '@muniswap/v3-sdk'
import { type Route as RouteV4, Trade as V4Trade } from '@muniswap/v4-sdk'
import type { SwapOptions } from '../../index'
import { TEST_RECIPIENT_ADDRESS } from './addresses'

export const ETHER = Ether.onChain(1)
export const WETH = new Token(1, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18, 'WETH', 'Wrapped Ether')
export const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'dai')
export const USDC = new Token(1, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 6, 'USDC', 'USD Coin')
export const FEE_AMOUNT = FeeAmount.MEDIUM

// Mock V2 Pairs with realistic reserves
export const WETH_USDC_V2 = new Pair(
  CurrencyAmount.fromRawAmount(USDC, '250000000000000'),
  CurrencyAmount.fromRawAmount(WETH, '100000000000000000000000')
)
export const USDC_DAI_V2 = new Pair(
  CurrencyAmount.fromRawAmount(DAI, '250000000000000000000000000'),
  CurrencyAmount.fromRawAmount(USDC, '250000000000000')
)

// Mock V3 Pools
const V3_LIQUIDITY = 1000000n * 10n ** 18n

function makeV3Ticks(feeAmount: FeeAmount) {
  return [
    {
      index: nearestUsableTick(MIN_TICK, TICK_SPACINGS[feeAmount]!),
      liquidityNet: V3_LIQUIDITY,
      liquidityGross: V3_LIQUIDITY,
    },
    {
      index: nearestUsableTick(MAX_TICK, TICK_SPACINGS[feeAmount]!),
      liquidityNet: -V3_LIQUIDITY,
      liquidityGross: V3_LIQUIDITY,
    },
  ]
}

export const WETH_USDC_V3 = new Pool(
  WETH,
  USDC,
  FeeAmount.MEDIUM,
  encodeSqrtRatioX96(1, 1),
  V3_LIQUIDITY,
  0,
  makeV3Ticks(FeeAmount.MEDIUM)
)

export const WETH_USDC_V3_LOW_FEE = new Pool(
  WETH,
  USDC,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  V3_LIQUIDITY,
  0,
  makeV3Ticks(FeeAmount.LOW)
)

export const USDC_DAI_V3 = new Pool(
  USDC,
  DAI,
  FeeAmount.LOW,
  encodeSqrtRatioX96(1, 1),
  V3_LIQUIDITY,
  0,
  makeV3Ticks(FeeAmount.LOW)
)

// use some sane defaults
export function swapOptions(options: Partial<SwapOptions>): SwapOptions {
  // If theres a fee this counts as "slippage" for the amount out, so take it into account
  let slippageTolerance = new Percent(5, 100)
  if (options.fee) slippageTolerance = slippageTolerance.add(options.fee.fee)
  return Object.assign(
    {
      slippageTolerance,
      recipient: TEST_RECIPIENT_ADDRESS,
    },
    options
  )
}

// alternative constructor to create from protocol-specific sdks
export function buildTrade(
  trades: (
    | V2Trade<Currency, Currency, TradeType>
    | V3Trade<Currency, Currency, TradeType>
    | V4Trade<Currency, Currency, TradeType>
    | MixedRouteTrade<Currency, Currency, TradeType>
  )[]
): RouterTrade<Currency, Currency, TradeType> {
  return new RouterTrade({
    v2Routes: trades
      .filter((trade) => trade instanceof V2Trade)
      .map((trade) => ({
        routev2: trade.route as RouteV2<Currency, Currency>,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    v3Routes: trades
      .filter((trade) => trade instanceof V3Trade)
      .map((trade) => ({
        routev3: trade.route as RouteV3<Currency, Currency>,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    v4Routes: trades
      .filter((trade) => trade instanceof V4Trade)
      .map((trade) => ({
        routev4: trade.route as RouteV4<Currency, Currency>,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    mixedRoutes: trades
      .filter((trade) => trade instanceof MixedRouteTrade)
      .map((trade) => ({
        mixedRoute: trade.route as MixedRouteSDK<Currency, Currency>,
        inputAmount: trade.inputAmount,
        outputAmount: trade.outputAmount,
      })),
    tradeType: trades[0]!.tradeType,
  })
}
