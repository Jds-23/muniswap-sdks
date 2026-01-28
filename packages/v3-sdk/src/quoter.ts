import { type BigintIsh, type Currency, type CurrencyAmount, TradeType } from '@muniswap/sdk-core'
import IQuoterV2 from '@uniswap/swap-router-contracts/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json' with {
  type: 'json',
}
import IQuoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json' with { type: 'json' }
import { AbiFunction, type Hex } from 'ox'
import invariant from 'tiny-invariant'
import type { FeeAmount } from './constants'
import type { Route } from './entities'
import { type MethodParameters, encodeRouteToPath, toHex } from './utils'

const quoterV1Abi = IQuoter.abi as readonly {
  inputs: readonly { internalType: string; name: string; type: string }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

const quoterV2Abi = IQuoterV2.abi as readonly {
  inputs: readonly {
    internalType: string
    name: string
    type: string | undefined
    components?: readonly { internalType: string; name: string; type: string }[]
  }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

/**
 * Optional arguments to send to the quoter.
 */
export interface QuoteOptions {
  /**
   * The optional price limit for the trade.
   */
  sqrtPriceLimitX96?: BigintIsh

  /**
   * Whether to use the QuoterV2 interface.
   */
  useQuoterV2?: boolean
}

/**
 * Produces the on-chain method name and parameters for quoting.
 *
 * @param route - The swap route
 * @param amount - The amount of the quote
 * @param tradeType - The trade type (exact input or exact output)
 * @param options - The quote options
 * @returns The method parameters
 */
export function quoteCallParameters<TInput extends Currency, TOutput extends Currency>(
  route: Route<TInput, TOutput>,
  amount: CurrencyAmount<TInput | TOutput>,
  tradeType: TradeType,
  options: QuoteOptions = {}
): MethodParameters {
  const singleHop = route.pools.length === 1

  let calldata: Hex.Hex

  if (singleHop) {
    const tokenIn = route.tokenPath[0]!.address as `0x${string}`
    const tokenOut = route.tokenPath[1]!.address as `0x${string}`
    const fee = route.pools[0]!.fee as FeeAmount
    const sqrtPriceLimitX96 = options?.sqrtPriceLimitX96 ? BigInt(options.sqrtPriceLimitX96) : 0n

    if (options.useQuoterV2) {
      // V2 uses struct params
      const functionName = tradeType === TradeType.EXACT_INPUT ? 'quoteExactInputSingle' : 'quoteExactOutputSingle'
      const functionAbi = quoterV2Abi.find((item) => item.name === functionName)!

      if (tradeType === TradeType.EXACT_INPUT) {
        calldata = AbiFunction.encodeData(functionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
          { tokenIn, tokenOut, fee, amountIn: BigInt(amount.quotient), sqrtPriceLimitX96 },
        ]) as Hex.Hex
      } else {
        calldata = AbiFunction.encodeData(functionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
          { tokenIn, tokenOut, fee, amount: BigInt(amount.quotient), sqrtPriceLimitX96 },
        ]) as Hex.Hex
      }
    } else {
      // V1 uses positional params
      const functionName = tradeType === TradeType.EXACT_INPUT ? 'quoteExactInputSingle' : 'quoteExactOutputSingle'
      const functionAbi = quoterV1Abi.find((item) => item.name === functionName)!

      calldata = AbiFunction.encodeData(functionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
        tokenIn,
        tokenOut,
        fee,
        BigInt(amount.quotient),
        sqrtPriceLimitX96,
      ]) as Hex.Hex
    }
  } else {
    invariant(options?.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')
    const path: Hex.Hex = encodeRouteToPath(route, tradeType === TradeType.EXACT_OUTPUT)
    const functionName = tradeType === TradeType.EXACT_INPUT ? 'quoteExactInput' : 'quoteExactOutput'

    const abi = options.useQuoterV2 ? quoterV2Abi : quoterV1Abi
    const functionAbi = abi.find((item) => item.name === functionName)!

    calldata = AbiFunction.encodeData(functionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      path,
      BigInt(amount.quotient),
    ]) as Hex.Hex
  }

  return {
    calldata,
    value: toHex(0),
  }
}
