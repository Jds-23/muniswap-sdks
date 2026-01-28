import { type BigintIsh, type Percent, type Token, validateAndParseAddress } from '@muniswap/sdk-core'
import IPeripheryPaymentsWithFee from '@uniswap/v3-periphery/artifacts/contracts/interfaces/IPeripheryPaymentsWithFee.sol/IPeripheryPaymentsWithFee.json' with {
  type: 'json',
}
import { AbiFunction, type Address, type Hex } from 'ox'

const paymentsAbi = IPeripheryPaymentsWithFee.abi as readonly {
  inputs: readonly { internalType: string; name: string; type: string }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// Extract function ABIs
const unwrapWETH9Abi = paymentsAbi.find((item) => item.name === 'unwrapWETH9' && item.inputs?.length === 2)!
const unwrapWETH9WithFeeAbi = paymentsAbi.find(
  (item) => item.name === 'unwrapWETH9WithFee' && item.inputs?.length === 4
)!
const sweepTokenAbi = paymentsAbi.find((item) => item.name === 'sweepToken' && item.inputs?.length === 3)!
const sweepTokenWithFeeAbi = paymentsAbi.find((item) => item.name === 'sweepTokenWithFee' && item.inputs?.length === 5)!
const refundETHAbi = paymentsAbi.find((item) => item.name === 'refundETH')!

/**
 * Options for producing the calldata to unwrap WETH9.
 */
export interface UnwrapWETH9Options {
  /**
   * The minimum amount of WETH9 to unwrap.
   */
  amountMinimum: BigintIsh
  /**
   * The recipient of the native currency.
   */
  recipient: string
  /**
   * Optional fee bips to take.
   */
  feeOptions?: {
    fee: Percent
    recipient: string
  }
}

/**
 * Options for producing the calldata to sweep a token.
 */
export interface SweepTokenOptions {
  /**
   * The token to sweep.
   */
  token: Token
  /**
   * The minimum amount of the token to sweep.
   */
  amountMinimum: BigintIsh
  /**
   * The recipient of the token.
   */
  recipient: string
  /**
   * Optional fee bips to take.
   */
  feeOptions?: {
    fee: Percent
    recipient: string
  }
}

function encodeFeeBips(fee: Percent): bigint {
  return fee.multiply(10_000).quotient
}

/**
 * Encodes the calldata to unwrap WETH9 to native currency.
 */
export function encodeUnwrapWETH9(options: UnwrapWETH9Options): Hex.Hex {
  const recipient = validateAndParseAddress(options.recipient)

  if (options.feeOptions) {
    const feeRecipient = validateAndParseAddress(options.feeOptions.recipient)
    const feeBips = encodeFeeBips(options.feeOptions.fee)

    return AbiFunction.encodeData(unwrapWETH9WithFeeAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      BigInt(options.amountMinimum),
      recipient as Address.Address,
      feeBips,
      feeRecipient as Address.Address,
    ]) as Hex.Hex
  }
  return AbiFunction.encodeData(unwrapWETH9Abi as Parameters<typeof AbiFunction.encodeData>[0], [
    BigInt(options.amountMinimum),
    recipient as Address.Address,
  ]) as Hex.Hex
}

/**
 * Encodes the calldata to sweep a token to a recipient.
 */
export function encodeSweepToken(options: SweepTokenOptions): Hex.Hex {
  const recipient = validateAndParseAddress(options.recipient)
  const tokenAddress = options.token.address as Address.Address

  if (options.feeOptions) {
    const feeRecipient = validateAndParseAddress(options.feeOptions.recipient)
    const feeBips = encodeFeeBips(options.feeOptions.fee)

    return AbiFunction.encodeData(sweepTokenWithFeeAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      tokenAddress,
      BigInt(options.amountMinimum),
      recipient as Address.Address,
      feeBips,
      feeRecipient as Address.Address,
    ]) as Hex.Hex
  }
  return AbiFunction.encodeData(sweepTokenAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    tokenAddress,
    BigInt(options.amountMinimum),
    recipient as Address.Address,
  ]) as Hex.Hex
}

/**
 * Encodes the calldata to refund any excess ETH.
 */
export function encodeRefundETH(): Hex.Hex {
  return AbiFunction.encodeData(refundETHAbi as Parameters<typeof AbiFunction.encodeData>[0], []) as Hex.Hex
}
