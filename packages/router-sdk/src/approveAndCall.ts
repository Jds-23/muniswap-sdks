import type { BigintIsh, Currency, Percent, Token } from '@muniswap/sdk-core'
import { encodeMulticall, type Position, toHex } from '@muniswap/v3-sdk'
import IApproveAndCall from '@uniswap/swap-router-contracts/artifacts/contracts/interfaces/IApproveAndCall.sol/IApproveAndCall.json' with {
  type: 'json',
}
import { AbiFunction, type Address, type Hex } from 'ox'
import invariant from 'tiny-invariant'

const approveAndCallAbi = IApproveAndCall.abi as readonly {
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

const approveMaxAbi = approveAndCallAbi.find((item) => item.name === 'approveMax')!
const approveMaxMinusOneAbi = approveAndCallAbi.find((item) => item.name === 'approveMaxMinusOne')!
const approveZeroThenMaxAbi = approveAndCallAbi.find((item) => item.name === 'approveZeroThenMax')!
const approveZeroThenMaxMinusOneAbi = approveAndCallAbi.find((item) => item.name === 'approveZeroThenMaxMinusOne')!
const callPositionManagerAbi = approveAndCallAbi.find((item) => item.name === 'callPositionManager')!
const mintAbi = approveAndCallAbi.find((item) => item.name === 'mint')!
const increaseLiquidityAbi = approveAndCallAbi.find((item) => item.name === 'increaseLiquidity')!

// Condensed version of v3-sdk AddLiquidityOptions containing only necessary swap + add attributes
export type CondensedAddLiquidityOptions = { recipient: string } | { tokenId: BigintIsh }

export enum ApprovalTypes {
  NOT_REQUIRED = 0,
  MAX = 1,
  MAX_MINUS_ONE = 2,
  ZERO_THEN_MAX = 3,
  ZERO_THEN_MAX_MINUS_ONE = 4,
}

// type guard
export function isMint(options: CondensedAddLiquidityOptions): options is { recipient: string } {
  return Object.keys(options).some((k) => k === 'recipient')
}

export function encodeApproveMax(token: Token): Hex.Hex {
  return AbiFunction.encodeData(approveMaxAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
  ]) as Hex.Hex
}

export function encodeApproveMaxMinusOne(token: Token): Hex.Hex {
  return AbiFunction.encodeData(approveMaxMinusOneAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
  ]) as Hex.Hex
}

export function encodeApproveZeroThenMax(token: Token): Hex.Hex {
  return AbiFunction.encodeData(approveZeroThenMaxAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
  ]) as Hex.Hex
}

export function encodeApproveZeroThenMaxMinusOne(token: Token): Hex.Hex {
  return AbiFunction.encodeData(approveZeroThenMaxMinusOneAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
  ]) as Hex.Hex
}

export function encodeCallPositionManager(calldatas: Hex.Hex[]): Hex.Hex {
  invariant(calldatas.length > 0, 'NULL_CALLDATA')

  if (calldatas.length === 1) {
    return AbiFunction.encodeData(callPositionManagerAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      calldatas[0]!,
    ]) as Hex.Hex
  } else {
    const encodedMulticall = encodeMulticall(calldatas)
    return AbiFunction.encodeData(callPositionManagerAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      encodedMulticall,
    ]) as Hex.Hex
  }
}

export function encodeAddLiquidity(
  position: Position,
  minimalPosition: Position,
  addLiquidityOptions: CondensedAddLiquidityOptions,
  slippageTolerance: Percent
): Hex.Hex {
  let { amount0: amount0Min, amount1: amount1Min } = position.mintAmountsWithSlippage(slippageTolerance)

  if (minimalPosition.amount0.quotient < amount0Min) {
    amount0Min = minimalPosition.amount0.quotient
  }
  if (minimalPosition.amount1.quotient < amount1Min) {
    amount1Min = minimalPosition.amount1.quotient
  }

  if (isMint(addLiquidityOptions)) {
    return AbiFunction.encodeData(mintAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      {
        token0: position.pool.token0.address as Address.Address,
        token1: position.pool.token1.address as Address.Address,
        fee: position.pool.fee,
        tickLower: position.tickLower,
        tickUpper: position.tickUpper,
        amount0Min: BigInt(toHex(amount0Min)),
        amount1Min: BigInt(toHex(amount1Min)),
        recipient: addLiquidityOptions.recipient as Address.Address,
      },
    ]) as Hex.Hex
  } else {
    return AbiFunction.encodeData(increaseLiquidityAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      {
        token0: position.pool.token0.address as Address.Address,
        token1: position.pool.token1.address as Address.Address,
        amount0Min: BigInt(toHex(amount0Min)),
        amount1Min: BigInt(toHex(amount1Min)),
        tokenId: BigInt(addLiquidityOptions.tokenId),
      },
    ]) as Hex.Hex
  }
}

export function encodeApprove(token: Currency, approvalType: ApprovalTypes): Hex.Hex {
  switch (approvalType) {
    case ApprovalTypes.MAX:
      return encodeApproveMax(token.wrapped)
    case ApprovalTypes.MAX_MINUS_ONE:
      return encodeApproveMaxMinusOne(token.wrapped)
    case ApprovalTypes.ZERO_THEN_MAX:
      return encodeApproveZeroThenMax(token.wrapped)
    case ApprovalTypes.ZERO_THEN_MAX_MINUS_ONE:
      return encodeApproveZeroThenMaxMinusOne(token.wrapped)
    default:
      throw new Error('Error: invalid ApprovalType')
  }
}
