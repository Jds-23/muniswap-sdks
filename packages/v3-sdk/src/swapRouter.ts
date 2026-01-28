import { type Currency, CurrencyAmount, type Percent, TradeType, validateAndParseAddress } from '@muniswap/sdk-core'
import ISwapRouter from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json' with { type: 'json' }
import { AbiFunction, type Address, type Hex } from 'ox'
import invariant from 'tiny-invariant'
import { ADDRESS_ZERO } from './constants'
import type { Trade } from './entities'
import { encodeMulticall } from './multicall'
import { encodeRefundETH, encodeSweepToken, encodeUnwrapWETH9 } from './payments'
import { type PermitOptions, encodeSelfPermit } from './selfPermit'
import { type MethodParameters, encodeRouteToPath, toHex } from './utils'

const swapRouterAbi = ISwapRouter.abi as readonly {
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

// Extract function ABIs
const exactInputSingleAbi = swapRouterAbi.find((item) => item.name === 'exactInputSingle')!
const exactInputAbi = swapRouterAbi.find((item) => item.name === 'exactInput')!
const exactOutputSingleAbi = swapRouterAbi.find((item) => item.name === 'exactOutputSingle')!
const exactOutputAbi = swapRouterAbi.find((item) => item.name === 'exactOutput')!

/**
 * Options for producing the calldata to execute a trade.
 */
export interface SwapOptions {
  /**
   * How much the execution price is allowed to move unfavorably from the trade execution price.
   */
  slippageTolerance: Percent

  /**
   * The account that should receive the output.
   */
  recipient: string

  /**
   * When the transaction expires, in epoch seconds.
   */
  deadline: bigint

  /**
   * The optional permit for the input token (EIP-2612).
   */
  inputTokenPermit?: PermitOptions

  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: bigint

  /**
   * Optional fee bips to take on the output.
   */
  fee?: {
    fee: Percent
    recipient: string
  }
}

/**
 * Produces the calldata for executing a trade on the router.
 *
 * @param trades - The trade(s) to execute
 * @param options - Options for the call parameters
 * @returns The method parameters
 */
export function swapCallParameters<TInput extends Currency, TOutput extends Currency>(
  trades: Trade<TInput, TOutput, TradeType> | Trade<TInput, TOutput, TradeType>[],
  options: SwapOptions
): MethodParameters {
  if (!Array.isArray(trades)) {
    trades = [trades]
  }

  const sampleTrade = trades[0]!
  const tokenIn = sampleTrade.inputAmount.currency.wrapped
  const tokenOut = sampleTrade.outputAmount.currency.wrapped

  // Verify all trades have the same tokens and type
  invariant(
    trades.every((trade) => trade.inputAmount.currency.wrapped.equals(tokenIn)),
    'TOKEN_IN_DIFF'
  )
  invariant(
    trades.every((trade) => trade.outputAmount.currency.wrapped.equals(tokenOut)),
    'TOKEN_OUT_DIFF'
  )
  invariant(
    trades.every((trade) => trade.tradeType === sampleTrade.tradeType),
    'TRADE_TYPE_DIFF'
  )

  const calldatas: Hex.Hex[] = []

  // Encode permit if provided
  const ZERO_IN = CurrencyAmount.fromRawAmount(trades[0]!.inputAmount.currency, 0)
  const inputIsNative = sampleTrade.inputAmount.currency.isNative
  const outputIsNative = sampleTrade.outputAmount.currency.isNative

  // Add permit calldata if necessary
  if (options.inputTokenPermit && !inputIsNative) {
    const owner = validateAndParseAddress(options.recipient) // In most cases recipient == owner
    calldatas.push(encodeSelfPermit(tokenIn, owner, options.inputTokenPermit))
  }

  const recipient = validateAndParseAddress(options.recipient)
  const deadline = options.deadline

  for (const trade of trades) {
    for (const { route, inputAmount, outputAmount } of trade.swaps) {
      const amountIn: bigint =
        trade.tradeType === TradeType.EXACT_INPUT
          ? inputAmount.quotient
          : trade.maximumAmountIn(options.slippageTolerance).quotient
      const amountOut: bigint =
        trade.tradeType === TradeType.EXACT_OUTPUT
          ? outputAmount.quotient
          : trade.minimumAmountOut(options.slippageTolerance).quotient

      // Determine if we need to use the router as intermediate recipient
      const routerMustCustody = outputIsNative || !!options.fee
      const performRefinement = routerMustCustody

      // Single hop
      if (route.pools.length === 1) {
        if (trade.tradeType === TradeType.EXACT_INPUT) {
          const params = {
            tokenIn: route.tokenPath[0]!.address as Address.Address,
            tokenOut: route.tokenPath[1]!.address as Address.Address,
            fee: route.pools[0]!.fee,
            recipient: performRefinement ? ADDRESS_ZERO : (recipient as Address.Address),
            deadline,
            amountIn,
            amountOutMinimum: amountOut,
            sqrtPriceLimitX96: options.sqrtPriceLimitX96 ?? 0n,
          }
          calldatas.push(
            AbiFunction.encodeData(exactInputSingleAbi as Parameters<typeof AbiFunction.encodeData>[0], [
              params,
            ]) as Hex.Hex
          )
        } else {
          const params = {
            tokenIn: route.tokenPath[0]!.address as Address.Address,
            tokenOut: route.tokenPath[1]!.address as Address.Address,
            fee: route.pools[0]!.fee,
            recipient: performRefinement ? ADDRESS_ZERO : (recipient as Address.Address),
            deadline,
            amountOut,
            amountInMaximum: amountIn,
            sqrtPriceLimitX96: options.sqrtPriceLimitX96 ?? 0n,
          }
          calldatas.push(
            AbiFunction.encodeData(exactOutputSingleAbi as Parameters<typeof AbiFunction.encodeData>[0], [
              params,
            ]) as Hex.Hex
          )
        }
      } else {
        // Multi hop
        invariant(options.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')
        const path = encodeRouteToPath(route, trade.tradeType === TradeType.EXACT_OUTPUT)

        if (trade.tradeType === TradeType.EXACT_INPUT) {
          const params = {
            path,
            recipient: performRefinement ? ADDRESS_ZERO : (recipient as Address.Address),
            deadline,
            amountIn,
            amountOutMinimum: amountOut,
          }
          calldatas.push(
            AbiFunction.encodeData(exactInputAbi as Parameters<typeof AbiFunction.encodeData>[0], [params]) as Hex.Hex
          )
        } else {
          const params = {
            path,
            recipient: performRefinement ? ADDRESS_ZERO : (recipient as Address.Address),
            deadline,
            amountOut,
            amountInMaximum: amountIn,
          }
          calldatas.push(
            AbiFunction.encodeData(exactOutputAbi as Parameters<typeof AbiFunction.encodeData>[0], [params]) as Hex.Hex
          )
        }
      }
    }
  }

  // Create unwrap/sweep calldatas if needed
  const totalAmountOut = trades.reduce(
    (acc, trade) => acc.add(trade.minimumAmountOut(options.slippageTolerance)),
    CurrencyAmount.fromRawAmount(sampleTrade.outputAmount.currency, 0)
  )

  if (outputIsNative) {
    const unwrapOptions = options.fee
      ? {
          amountMinimum: totalAmountOut.quotient,
          recipient: ADDRESS_ZERO as string,
          feeOptions: {
            fee: options.fee.fee,
            recipient: options.fee.recipient,
          },
        }
      : {
          amountMinimum: totalAmountOut.quotient,
          recipient,
        }
    calldatas.push(encodeUnwrapWETH9(unwrapOptions))
  } else if (options.fee) {
    calldatas.push(
      encodeSweepToken({
        token: tokenOut,
        amountMinimum: totalAmountOut.quotient,
        recipient,
        feeOptions: {
          fee: options.fee.fee,
          recipient: options.fee.recipient,
        },
      })
    )
  }

  // If exact output and paying with native token, refund leftover
  if (inputIsNative && sampleTrade.tradeType === TradeType.EXACT_OUTPUT) {
    calldatas.push(encodeRefundETH())
  }

  // Calculate value to send
  const totalAmountIn = trades.reduce(
    (acc, trade) => acc.add(trade.maximumAmountIn(options.slippageTolerance)),
    ZERO_IN
  )

  const value = inputIsNative ? toHex(totalAmountIn.quotient) : toHex(0)

  return {
    calldata: encodeMulticall(calldatas),
    value,
  }
}
