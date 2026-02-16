import type { Percent, Token } from '@muniswap/sdk-core'
import { validateAndParseAddress } from '@muniswap/sdk-core'
import {
  encodeUnwrapWETH9 as encodeUnwrapWETH9Base,
  encodeSweepToken as encodeSweepTokenBase,
} from '@muniswap/v3-sdk'
import IPeripheryPaymentsWithFeeExtended from '@uniswap/swap-router-contracts/artifacts/contracts/interfaces/IPeripheryPaymentsWithFeeExtended.sol/IPeripheryPaymentsWithFeeExtended.json' with {
  type: 'json',
}
import { AbiFunction, type Address, type Hex } from 'ox'

const paymentsExtendedAbi = IPeripheryPaymentsWithFeeExtended.abi as readonly {
  inputs: readonly { internalType: string; name: string; type: string }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// Extended unwrap: unwrapWETH9(uint256) — no recipient
const unwrapWETH9NoRecipientAbi = paymentsExtendedAbi.find(
  (item) => item.name === 'unwrapWETH9' && item.inputs?.length === 1
)!
// Extended unwrap with fee: unwrapWETH9WithFee(uint256,uint256,address) — no explicit recipient
const unwrapWETH9WithFeeNoRecipientAbi = paymentsExtendedAbi.find(
  (item) => item.name === 'unwrapWETH9WithFee' && item.inputs?.length === 3
)!
// Extended sweep: sweepToken(address,uint256) — no recipient
const sweepTokenNoRecipientAbi = paymentsExtendedAbi.find(
  (item) => item.name === 'sweepToken' && item.inputs?.length === 2
)!
// Extended sweep with fee: sweepTokenWithFee(address,uint256,uint256,address) — no explicit recipient
const sweepTokenWithFeeNoRecipientAbi = paymentsExtendedAbi.find(
  (item) => item.name === 'sweepTokenWithFee' && item.inputs?.length === 4
)!
const pullAbi = paymentsExtendedAbi.find((item) => item.name === 'pull')!
const wrapETHAbi = paymentsExtendedAbi.find((item) => item.name === 'wrapETH')!

export interface FeeOptions {
  fee: Percent
  recipient: string
}

function encodeFeeBips(fee: Percent): bigint {
  return fee.multiply(10_000).quotient
}

export function encodeUnwrapWETH9Extended(
  amountMinimum: bigint,
  recipient?: string,
  feeOptions?: FeeOptions
): Hex.Hex {
  // if there's a recipient, just pass it along to the base v3-sdk function
  if (typeof recipient === 'string') {
    return encodeUnwrapWETH9Base(
      feeOptions
        ? {
            amountMinimum,
            recipient,
            feeOptions: { fee: feeOptions.fee, recipient: feeOptions.recipient },
          }
        : { amountMinimum, recipient }
    )
  }

  if (feeOptions) {
    const feeBips = encodeFeeBips(feeOptions.fee)
    const feeRecipient = validateAndParseAddress(feeOptions.recipient)

    return AbiFunction.encodeData(
      unwrapWETH9WithFeeNoRecipientAbi as Parameters<typeof AbiFunction.encodeData>[0],
      [BigInt(amountMinimum), feeBips, feeRecipient as Address.Address]
    ) as Hex.Hex
  } else {
    return AbiFunction.encodeData(unwrapWETH9NoRecipientAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      BigInt(amountMinimum),
    ]) as Hex.Hex
  }
}

export function encodeSweepTokenExtended(
  token: Token,
  amountMinimum: bigint,
  recipient?: string,
  feeOptions?: FeeOptions
): Hex.Hex {
  // if there's a recipient, just pass it along to the base v3-sdk function
  if (typeof recipient === 'string') {
    return encodeSweepTokenBase(
      feeOptions
        ? {
            token,
            amountMinimum,
            recipient,
            feeOptions: { fee: feeOptions.fee, recipient: feeOptions.recipient },
          }
        : { token, amountMinimum, recipient }
    )
  }

  if (feeOptions) {
    const feeBips = encodeFeeBips(feeOptions.fee)
    const feeRecipient = validateAndParseAddress(feeOptions.recipient)

    return AbiFunction.encodeData(
      sweepTokenWithFeeNoRecipientAbi as Parameters<typeof AbiFunction.encodeData>[0],
      [token.address as Address.Address, BigInt(amountMinimum), feeBips, feeRecipient as Address.Address]
    ) as Hex.Hex
  } else {
    return AbiFunction.encodeData(sweepTokenNoRecipientAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      token.address as Address.Address,
      BigInt(amountMinimum),
    ]) as Hex.Hex
  }
}

export function encodePull(token: Token, amount: bigint): Hex.Hex {
  return AbiFunction.encodeData(pullAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
    BigInt(amount),
  ]) as Hex.Hex
}

export function encodeWrapETH(amount: bigint): Hex.Hex {
  return AbiFunction.encodeData(wrapETHAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    BigInt(amount),
  ]) as Hex.Hex
}
