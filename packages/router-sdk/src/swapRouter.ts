import {
  type Currency,
  CurrencyAmount,
  Percent,
  TradeType,
  validateAndParseAddress,
  WETH9,
} from '@muniswap/sdk-core'
import { Trade as V2Trade } from '@muniswap/v2-sdk'
import {
  encodeRouteToPath,
  type MethodParameters,
  type PermitOptions,
  Pool as V3Pool,
  Position,
  encodeRefundETH,
  encodeSelfPermit,
  toHex,
  Trade as V3Trade,
} from '@muniswap/v3-sdk'
import { Pool as V4Pool } from '@muniswap/v4-sdk'
import ISwapRouter02 from '@uniswap/swap-router-contracts/artifacts/contracts/interfaces/ISwapRouter02.sol/ISwapRouter02.json' with {
  type: 'json',
}
import { AbiFunction, type Address, type Hex } from 'ox'
import invariant from 'tiny-invariant'
import { ADDRESS_THIS, MSG_SENDER } from './constants'
import {
  encodeApprove,
  type ApprovalTypes,
  type CondensedAddLiquidityOptions,
  encodeAddLiquidity,
} from './approveAndCall'
import { Trade } from './entities/trade'
import { Protocol } from './entities/protocol'
import { MixedRoute, type RouteV2, type RouteV3 } from './entities/route'
import { encodeMulticallExtended, type Validation } from './multicallExtended'
import {
  encodeUnwrapWETH9Extended,
  encodeSweepTokenExtended,
  encodePull,
  encodeWrapETH,
  type FeeOptions,
} from './paymentsExtended'
import { MixedRouteTrade } from './entities/mixedRoute/trade'
import { encodeMixedRouteToPath } from './utils/encodeMixedRouteToPath'
import { MixedRouteSDK } from './entities/mixedRoute/route'
import { partitionMixedRouteByProtocol, getOutputOfPools } from './utils'

const swapRouter02Abi = ISwapRouter02.abi as readonly {
  inputs: readonly {
    internalType: string
    name: string
    type: string
    components?: readonly { internalType: string; name: string; type: string }[]
  }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// V2 function ABIs
const swapExactTokensForTokensAbi = swapRouter02Abi.find((item) => item.name === 'swapExactTokensForTokens')!
const swapTokensForExactTokensAbi = swapRouter02Abi.find((item) => item.name === 'swapTokensForExactTokens')!

// V3 function ABIs
const exactInputSingleAbi = swapRouter02Abi.find((item) => item.name === 'exactInputSingle')!
const exactOutputSingleAbi = swapRouter02Abi.find((item) => item.name === 'exactOutputSingle')!
const exactInputAbi = swapRouter02Abi.find((item) => item.name === 'exactInput')!
const exactOutputAbi = swapRouter02Abi.find((item) => item.name === 'exactOutput')!

const ZERO = 0n
const REFUND_ETH_PRICE_IMPACT_THRESHOLD = new Percent(50n, 100n)

/**
 * Options for producing the arguments to send calls to the router.
 */
export interface SwapOptions {
  slippageTolerance: Percent
  recipient?: string
  deadlineOrPreviousBlockhash?: Validation
  inputTokenPermit?: PermitOptions
  fee?: FeeOptions
}

export interface SwapAndAddOptions extends SwapOptions {
  outputTokenPermit?: PermitOptions
}

type AnyTradeType =
  | Trade<Currency, Currency, TradeType>
  | V2Trade<Currency, Currency, TradeType>
  | V3Trade<Currency, Currency, TradeType>
  | MixedRouteTrade<Currency, Currency, TradeType>
  | (
      | V2Trade<Currency, Currency, TradeType>
      | V3Trade<Currency, Currency, TradeType>
      | MixedRouteTrade<Currency, Currency, TradeType>
    )[]

function encodeV2Swap(
  trade: V2Trade<Currency, Currency, TradeType>,
  options: SwapOptions,
  routerMustCustody: boolean,
  performAggregatedSlippageCheck: boolean
): Hex.Hex {
  const amountIn: bigint = trade.maximumAmountIn(options.slippageTolerance).quotient
  const amountOut: bigint = trade.minimumAmountOut(options.slippageTolerance).quotient

  const path = trade.route.path.map((token) => token.address as Address.Address)
  const recipient = routerMustCustody
    ? ADDRESS_THIS
    : typeof options.recipient === 'undefined'
      ? MSG_SENDER
      : validateAndParseAddress(options.recipient)

  if (trade.tradeType === TradeType.EXACT_INPUT) {
    return AbiFunction.encodeData(swapExactTokensForTokensAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      amountIn,
      performAggregatedSlippageCheck ? 0n : amountOut,
      path,
      recipient as Address.Address,
    ]) as Hex.Hex
  } else {
    return AbiFunction.encodeData(swapTokensForExactTokensAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      amountOut,
      amountIn,
      path,
      recipient as Address.Address,
    ]) as Hex.Hex
  }
}

function encodeV3Swap(
  trade: V3Trade<Currency, Currency, TradeType>,
  options: SwapOptions,
  routerMustCustody: boolean,
  performAggregatedSlippageCheck: boolean
): Hex.Hex[] {
  const calldatas: Hex.Hex[] = []

  for (const { route, inputAmount, outputAmount } of trade.swaps) {
    const amountIn = trade.maximumAmountIn(options.slippageTolerance, inputAmount).quotient
    const amountOut = trade.minimumAmountOut(options.slippageTolerance, outputAmount).quotient

    const singleHop = route.pools.length === 1

    const recipient = routerMustCustody
      ? ADDRESS_THIS
      : typeof options.recipient === 'undefined'
        ? MSG_SENDER
        : validateAndParseAddress(options.recipient)

    if (singleHop) {
      if (trade.tradeType === TradeType.EXACT_INPUT) {
        const exactInputSingleParams = {
          tokenIn: route.tokenPath[0]!.address as Address.Address,
          tokenOut: route.tokenPath[1]!.address as Address.Address,
          fee: route.pools[0]!.fee,
          recipient: recipient as Address.Address,
          amountIn,
          amountOutMinimum: performAggregatedSlippageCheck ? 0n : amountOut,
          sqrtPriceLimitX96: 0n,
        }

        calldatas.push(
          AbiFunction.encodeData(exactInputSingleAbi as Parameters<typeof AbiFunction.encodeData>[0], [
            exactInputSingleParams,
          ]) as Hex.Hex
        )
      } else {
        const exactOutputSingleParams = {
          tokenIn: route.tokenPath[0]!.address as Address.Address,
          tokenOut: route.tokenPath[1]!.address as Address.Address,
          fee: route.pools[0]!.fee,
          recipient: recipient as Address.Address,
          amountOut,
          amountInMaximum: amountIn,
          sqrtPriceLimitX96: 0n,
        }

        calldatas.push(
          AbiFunction.encodeData(exactOutputSingleAbi as Parameters<typeof AbiFunction.encodeData>[0], [
            exactOutputSingleParams,
          ]) as Hex.Hex
        )
      }
    } else {
      const path: Hex.Hex = encodeRouteToPath(route, trade.tradeType === TradeType.EXACT_OUTPUT)

      if (trade.tradeType === TradeType.EXACT_INPUT) {
        const exactInputParams = {
          path,
          recipient: recipient as Address.Address,
          amountIn,
          amountOutMinimum: performAggregatedSlippageCheck ? 0n : amountOut,
        }

        calldatas.push(
          AbiFunction.encodeData(exactInputAbi as Parameters<typeof AbiFunction.encodeData>[0], [
            exactInputParams,
          ]) as Hex.Hex
        )
      } else {
        const exactOutputParams = {
          path,
          recipient: recipient as Address.Address,
          amountOut,
          amountInMaximum: amountIn,
        }

        calldatas.push(
          AbiFunction.encodeData(exactOutputAbi as Parameters<typeof AbiFunction.encodeData>[0], [
            exactOutputParams,
          ]) as Hex.Hex
        )
      }
    }
  }

  return calldatas
}

function encodeMixedRouteSwap(
  trade: MixedRouteTrade<Currency, Currency, TradeType>,
  options: SwapOptions,
  routerMustCustody: boolean,
  performAggregatedSlippageCheck: boolean
): Hex.Hex[] {
  const calldatas: Hex.Hex[] = []

  invariant(trade.tradeType === TradeType.EXACT_INPUT, 'TRADE_TYPE')

  for (const { route, inputAmount, outputAmount } of trade.swaps) {
    if (route.pools.some((pool) => pool instanceof V4Pool))
      throw new Error('Encoding mixed routes with V4 not supported')
    const amountIn: bigint = trade.maximumAmountIn(options.slippageTolerance, inputAmount).quotient
    const amountOut: bigint = trade.minimumAmountOut(options.slippageTolerance, outputAmount).quotient

    const singleHop = route.pools.length === 1

    const recipient = routerMustCustody
      ? ADDRESS_THIS
      : typeof options.recipient === 'undefined'
        ? MSG_SENDER
        : validateAndParseAddress(options.recipient)

    const mixedRouteIsAllV3 = (route: MixedRouteSDK<Currency, Currency>) => {
      return route.pools.every((pool) => pool instanceof V3Pool)
    }

    if (singleHop) {
      if (mixedRouteIsAllV3(route)) {
        const exactInputSingleParams = {
          tokenIn: route.path[0]!.wrapped.address as Address.Address,
          tokenOut: route.path[1]!.wrapped.address as Address.Address,
          fee: (route.pools as V3Pool[])[0]!.fee,
          recipient: recipient as Address.Address,
          amountIn,
          amountOutMinimum: performAggregatedSlippageCheck ? 0n : amountOut,
          sqrtPriceLimitX96: 0n,
        }

        calldatas.push(
          AbiFunction.encodeData(exactInputSingleAbi as Parameters<typeof AbiFunction.encodeData>[0], [
            exactInputSingleParams,
          ]) as Hex.Hex
        )
      } else {
        const path = route.path.map((token) => token.wrapped.address as Address.Address)

        calldatas.push(
          AbiFunction.encodeData(swapExactTokensForTokensAbi as Parameters<typeof AbiFunction.encodeData>[0], [
            amountIn,
            performAggregatedSlippageCheck ? 0n : amountOut,
            path,
            recipient as Address.Address,
          ]) as Hex.Hex
        )
      }
    } else {
      const sections = partitionMixedRouteByProtocol(route)

      const isLastSectionInRoute = (i: number) => {
        return i === sections.length - 1
      }

      let outputToken
      let inputToken = route.input.wrapped

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i]!
        outputToken = getOutputOfPools(section, inputToken)

        const newRouteOriginal = new MixedRouteSDK(
          [...section],
          section[0]!.token0.equals(inputToken) ? section[0]!.token0 : section[0]!.token1,
          outputToken
        )
        const newRoute = new MixedRoute(newRouteOriginal)

        inputToken = outputToken.wrapped

        if (mixedRouteIsAllV3(newRoute)) {
          const path: Hex.Hex = encodeMixedRouteToPath(newRoute)
          const exactInputParams = {
            path,
            recipient: (isLastSectionInRoute(i) ? recipient : ADDRESS_THIS) as Address.Address,
            amountIn: i === 0 ? amountIn : 0n,
            amountOutMinimum: !isLastSectionInRoute(i) ? 0n : amountOut,
          }

          calldatas.push(
            AbiFunction.encodeData(exactInputAbi as Parameters<typeof AbiFunction.encodeData>[0], [
              exactInputParams,
            ]) as Hex.Hex
          )
        } else {
          calldatas.push(
            AbiFunction.encodeData(swapExactTokensForTokensAbi as Parameters<typeof AbiFunction.encodeData>[0], [
              i === 0 ? amountIn : 0n,
              !isLastSectionInRoute(i) ? 0n : amountOut,
              newRoute.path.map((token) => token.wrapped.address as Address.Address),
              (isLastSectionInRoute(i) ? recipient : ADDRESS_THIS) as Address.Address,
            ]) as Hex.Hex
          )
        }
      }
    }
  }

  return calldatas
}

function encodeSwaps(
  trades: AnyTradeType,
  options: SwapOptions,
  isSwapAndAdd?: boolean
): {
  calldatas: Hex.Hex[]
  sampleTrade:
    | V2Trade<Currency, Currency, TradeType>
    | V3Trade<Currency, Currency, TradeType>
    | MixedRouteTrade<Currency, Currency, TradeType>
  routerMustCustody: boolean
  inputIsNative: boolean
  outputIsNative: boolean
  totalAmountIn: CurrencyAmount<Currency>
  minimumAmountOut: CurrencyAmount<Currency>
  quoteAmountOut: CurrencyAmount<Currency>
} {
  if (trades instanceof Trade) {
    invariant(
      trades.swaps.every(
        (swap) =>
          swap.route.protocol === Protocol.V3 ||
          swap.route.protocol === Protocol.V2 ||
          swap.route.protocol === Protocol.MIXED
      ),
      'UNSUPPORTED_PROTOCOL (encoding routes with v4 not supported)'
    )

    const individualTrades: (
      | V2Trade<Currency, Currency, TradeType>
      | V3Trade<Currency, Currency, TradeType>
      | MixedRouteTrade<Currency, Currency, TradeType>
    )[] = []

    for (const { route, inputAmount, outputAmount } of trades.swaps) {
      if (route.protocol === Protocol.V2) {
        individualTrades.push(
          new V2Trade(
            route as RouteV2<Currency, Currency>,
            trades.tradeType === TradeType.EXACT_INPUT ? inputAmount : outputAmount,
            trades.tradeType
          )
        )
      } else if (route.protocol === Protocol.V3) {
        individualTrades.push(
          V3Trade.createUncheckedTrade({
            route: route as RouteV3<Currency, Currency>,
            inputAmount,
            outputAmount,
            tradeType: trades.tradeType,
          })
        )
      } else if (route.protocol === Protocol.MIXED) {
        individualTrades.push(
          MixedRouteTrade.createUncheckedTrade({
            route: route as MixedRoute<Currency, Currency>,
            inputAmount,
            outputAmount,
            tradeType: trades.tradeType,
          })
        )
      } else {
        throw new Error('UNSUPPORTED_TRADE_PROTOCOL')
      }
    }
    trades = individualTrades
  }

  if (!Array.isArray(trades)) {
    trades = [trades]
  }

  const numberOfTrades = trades.reduce(
    (numberOfTrades, trade) =>
      numberOfTrades + (trade instanceof V3Trade || trade instanceof MixedRouteTrade ? trade.swaps.length : 1),
    0
  )

  const sampleTrade = trades[0]!

  invariant(
    trades.every((trade) => trade.inputAmount.currency.equals(sampleTrade.inputAmount.currency)),
    'TOKEN_IN_DIFF'
  )
  invariant(
    trades.every((trade) => trade.outputAmount.currency.equals(sampleTrade.outputAmount.currency)),
    'TOKEN_OUT_DIFF'
  )
  invariant(
    trades.every((trade) => trade.tradeType === sampleTrade.tradeType),
    'TRADE_TYPE_DIFF'
  )

  const calldatas: Hex.Hex[] = []

  const inputIsNative = sampleTrade.inputAmount.currency.isNative
  const outputIsNative = sampleTrade.outputAmount.currency.isNative

  const performAggregatedSlippageCheck = sampleTrade.tradeType === TradeType.EXACT_INPUT && numberOfTrades > 2
  const routerMustCustody = outputIsNative || !!options.fee || !!isSwapAndAdd || performAggregatedSlippageCheck

  if (options.inputTokenPermit) {
    invariant(sampleTrade.inputAmount.currency.isToken, 'NON_TOKEN_PERMIT')
    const recipient = typeof options.recipient === 'undefined' ? MSG_SENDER : validateAndParseAddress(options.recipient)
    calldatas.push(encodeSelfPermit(sampleTrade.inputAmount.currency.wrapped, recipient, options.inputTokenPermit))
  }

  for (const trade of trades) {
    if (trade instanceof V2Trade) {
      calldatas.push(encodeV2Swap(trade, options, routerMustCustody, performAggregatedSlippageCheck))
    } else if (trade instanceof V3Trade) {
      for (const calldata of encodeV3Swap(trade, options, routerMustCustody, performAggregatedSlippageCheck)) {
        calldatas.push(calldata)
      }
    } else if (trade instanceof MixedRouteTrade) {
      for (const calldata of encodeMixedRouteSwap(
        trade,
        options,
        routerMustCustody,
        performAggregatedSlippageCheck
      )) {
        calldatas.push(calldata)
      }
    } else {
      throw new Error('Unsupported trade object')
    }
  }

  const ZERO_IN: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(sampleTrade.inputAmount.currency, 0)
  const ZERO_OUT: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(sampleTrade.outputAmount.currency, 0)

  const minimumAmountOut: CurrencyAmount<Currency> = trades.reduce(
    (sum, trade) => sum.add(trade.minimumAmountOut(options.slippageTolerance)),
    ZERO_OUT
  )

  const quoteAmountOut: CurrencyAmount<Currency> = trades.reduce(
    (sum, trade) => sum.add(trade.outputAmount),
    ZERO_OUT
  )

  const totalAmountIn: CurrencyAmount<Currency> = trades.reduce(
    (sum, trade) => sum.add(trade.maximumAmountIn(options.slippageTolerance)),
    ZERO_IN
  )

  return {
    calldatas,
    sampleTrade,
    routerMustCustody,
    inputIsNative,
    outputIsNative,
    totalAmountIn,
    minimumAmountOut,
    quoteAmountOut,
  }
}

function riskOfPartialFill(trades: AnyTradeType): boolean {
  if (Array.isArray(trades)) {
    return trades.some((trade) => {
      return v3TradeWithHighPriceImpact(trade)
    })
  } else {
    return v3TradeWithHighPriceImpact(trades)
  }
}

function v3TradeWithHighPriceImpact(
  trade:
    | Trade<Currency, Currency, TradeType>
    | V2Trade<Currency, Currency, TradeType>
    | V3Trade<Currency, Currency, TradeType>
    | MixedRouteTrade<Currency, Currency, TradeType>
): boolean {
  return !(trade instanceof V2Trade) && trade.priceImpact.greaterThan(REFUND_ETH_PRICE_IMPACT_THRESHOLD)
}

function getPositionAmounts(
  position: Position,
  zeroForOne: boolean
): {
  positionAmountIn: CurrencyAmount<Currency>
  positionAmountOut: CurrencyAmount<Currency>
} {
  const { amount0, amount1 } = position.mintAmounts
  const currencyAmount0 = CurrencyAmount.fromRawAmount(position.pool.token0, amount0)
  const currencyAmount1 = CurrencyAmount.fromRawAmount(position.pool.token1, amount1)

  const [positionAmountIn, positionAmountOut] = zeroForOne
    ? [currencyAmount0, currencyAmount1]
    : [currencyAmount1, currencyAmount0]
  return { positionAmountIn: positionAmountIn!, positionAmountOut: positionAmountOut! }
}

export { type FeeOptions } from './paymentsExtended'

export function swapCallParameters(
  trades:
    | Trade<Currency, Currency, TradeType>
    | V2Trade<Currency, Currency, TradeType>
    | V3Trade<Currency, Currency, TradeType>
    | MixedRouteTrade<Currency, Currency, TradeType>
    | (
        | V2Trade<Currency, Currency, TradeType>
        | V3Trade<Currency, Currency, TradeType>
        | MixedRouteTrade<Currency, Currency, TradeType>
      )[],
  options: SwapOptions
): MethodParameters {
  const {
    calldatas,
    sampleTrade,
    routerMustCustody,
    inputIsNative,
    outputIsNative,
    totalAmountIn,
    minimumAmountOut,
  } = encodeSwaps(trades, options)

  if (routerMustCustody) {
    if (outputIsNative) {
      calldatas.push(encodeUnwrapWETH9Extended(minimumAmountOut.quotient, options.recipient, options.fee))
    } else {
      calldatas.push(
        encodeSweepTokenExtended(
          sampleTrade.outputAmount.currency.wrapped,
          minimumAmountOut.quotient,
          options.recipient,
          options.fee
        )
      )
    }
  }

  if (inputIsNative && (sampleTrade.tradeType === TradeType.EXACT_OUTPUT || riskOfPartialFill(trades))) {
    calldatas.push(encodeRefundETH())
  }

  return {
    calldata: encodeMulticallExtended(calldatas, options.deadlineOrPreviousBlockhash),
    value: toHex(inputIsNative ? totalAmountIn.quotient : ZERO),
  }
}

export function swapAndAddCallParameters(
  trades: AnyTradeType,
  options: SwapAndAddOptions,
  position: Position,
  addLiquidityOptions: CondensedAddLiquidityOptions,
  tokenInApprovalType: ApprovalTypes,
  tokenOutApprovalType: ApprovalTypes
): MethodParameters {
  const {
    calldatas,
    inputIsNative,
    outputIsNative,
    sampleTrade,
    totalAmountIn: totalAmountSwapped,
    quoteAmountOut,
    minimumAmountOut,
  } = encodeSwaps(trades, options, true)

  if (options.outputTokenPermit) {
    invariant(quoteAmountOut.currency.isToken, 'NON_TOKEN_PERMIT_OUTPUT')
    const recipient = typeof options.recipient === 'undefined' ? MSG_SENDER : validateAndParseAddress(options.recipient)
    calldatas.push(encodeSelfPermit(quoteAmountOut.currency, recipient, options.outputTokenPermit))
  }

  const chainId = sampleTrade.route.chainId
  const zeroForOne = position.pool.token0.wrapped.address === totalAmountSwapped.currency.wrapped.address
  const { positionAmountIn, positionAmountOut } = getPositionAmounts(position, zeroForOne)

  const tokenIn = inputIsNative ? WETH9[chainId]! : positionAmountIn.currency.wrapped
  const tokenOut = outputIsNative ? WETH9[chainId]! : positionAmountOut.currency.wrapped

  const amountOutRemaining = positionAmountOut.subtract(quoteAmountOut.wrapped)
  if (amountOutRemaining.greaterThan(CurrencyAmount.fromRawAmount(positionAmountOut.currency, 0))) {
    outputIsNative
      ? calldatas.push(encodeWrapETH(amountOutRemaining.quotient))
      : calldatas.push(encodePull(tokenOut, amountOutRemaining.quotient))
  }

  inputIsNative
    ? calldatas.push(encodeWrapETH(positionAmountIn.quotient))
    : calldatas.push(encodePull(tokenIn, positionAmountIn.quotient))

  if (tokenInApprovalType !== 0) calldatas.push(encodeApprove(tokenIn, tokenInApprovalType))
  if (tokenOutApprovalType !== 0) calldatas.push(encodeApprove(tokenOut, tokenOutApprovalType))

  const minimalPosition = Position.fromAmounts({
    pool: position.pool,
    tickLower: position.tickLower,
    tickUpper: position.tickUpper,
    amount0: zeroForOne ? position.amount0.quotient.toString() : minimumAmountOut.quotient.toString(),
    amount1: zeroForOne ? minimumAmountOut.quotient.toString() : position.amount1.quotient.toString(),
    useFullPrecision: false,
  })

  calldatas.push(encodeAddLiquidity(position, minimalPosition, addLiquidityOptions, options.slippageTolerance))

  inputIsNative
    ? calldatas.push(encodeUnwrapWETH9Extended(ZERO))
    : calldatas.push(encodeSweepTokenExtended(tokenIn, ZERO))
  outputIsNative
    ? calldatas.push(encodeUnwrapWETH9Extended(ZERO))
    : calldatas.push(encodeSweepTokenExtended(tokenOut, ZERO))

  let value: bigint
  if (inputIsNative) {
    value = totalAmountSwapped.wrapped.add(positionAmountIn.wrapped).quotient
  } else if (outputIsNative) {
    value = amountOutRemaining.quotient
  } else {
    value = ZERO
  }

  return {
    calldata: encodeMulticallExtended(calldatas, options.deadlineOrPreviousBlockhash),
    value: toHex(value),
  }
}
