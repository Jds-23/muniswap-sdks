import { TypedData } from 'ox'
import type { Hex } from 'ox'
import invariant from 'tiny-invariant'
import { MaxSigDeadline, MaxSignatureTransferAmount, MaxUnorderedNonce } from './constants'
import { permit2Domain } from './domain'

export interface Witness {
  witness: Record<string, unknown>
  witnessTypeName: string
  witnessType: Record<string, readonly TypedData.Parameter[]>
}

export interface TokenPermissions {
  token: string
  amount: bigint
}

export interface PermitTransferFrom {
  permitted: TokenPermissions
  spender: string
  nonce: bigint
  deadline: bigint
}

export interface PermitBatchTransferFrom {
  permitted: TokenPermissions[]
  spender: string
  nonce: bigint
  deadline: bigint
}

export type PermitTransferFromData = {
  domain: TypedData.Domain
  types: Record<string, readonly TypedData.Parameter[]>
  values: PermitTransferFrom
}

export type PermitBatchTransferFromData = {
  domain: TypedData.Domain
  types: Record<string, readonly TypedData.Parameter[]>
  values: PermitBatchTransferFrom
}

const TOKEN_PERMISSIONS = [
  { name: 'token', type: 'address' },
  { name: 'amount', type: 'uint256' },
]

const PERMIT_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: TOKEN_PERMISSIONS,
}

const PERMIT_BATCH_TRANSFER_FROM_TYPES = {
  PermitBatchTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions[]' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: TOKEN_PERMISSIONS,
}

function permitTransferFromWithWitnessType(witness: Witness): Record<string, readonly TypedData.Parameter[]> {
  return {
    PermitWitnessTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'witness', type: witness.witnessTypeName },
    ],
    TokenPermissions: TOKEN_PERMISSIONS,
    ...witness.witnessType,
  }
}

function permitBatchTransferFromWithWitnessType(witness: Witness): Record<string, readonly TypedData.Parameter[]> {
  return {
    PermitBatchWitnessTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions[]' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'witness', type: witness.witnessTypeName },
    ],
    TokenPermissions: TOKEN_PERMISSIONS,
    ...witness.witnessType,
  }
}

function isPermitTransferFrom(permit: PermitTransferFrom | PermitBatchTransferFrom): permit is PermitTransferFrom {
  return !Array.isArray(permit.permitted)
}

export abstract class SignatureTransfer {
  private constructor() {}

  public static getPermitData(
    permit: PermitTransferFrom | PermitBatchTransferFrom,
    permit2Address: string,
    chainId: number,
    witness?: Witness
  ): PermitTransferFromData | PermitBatchTransferFromData {
    invariant(MaxSigDeadline >= permit.deadline, 'SIG_DEADLINE_OUT_OF_RANGE')
    invariant(MaxUnorderedNonce >= permit.nonce, 'NONCE_OUT_OF_RANGE')

    const domain = permit2Domain(permit2Address, chainId)
    if (isPermitTransferFrom(permit)) {
      validateTokenPermissions(permit.permitted)
      const types = witness ? permitTransferFromWithWitnessType(witness) : PERMIT_TRANSFER_FROM_TYPES
      const values = witness ? { ...permit, witness: witness.witness } : permit
      return {
        domain,
        types,
        values,
      } as PermitTransferFromData
    }
    permit.permitted.forEach(validateTokenPermissions)
    const types = witness ? permitBatchTransferFromWithWitnessType(witness) : PERMIT_BATCH_TRANSFER_FROM_TYPES
    const values = witness ? { ...permit, witness: witness.witness } : permit
    return {
      domain,
      types,
      values,
    } as PermitBatchTransferFromData
  }

  public static hash(
    permit: PermitTransferFrom | PermitBatchTransferFrom,
    permit2Address: string,
    chainId: number,
    witness?: Witness
  ): Hex.Hex {
    const { domain, types, values } = SignatureTransfer.getPermitData(permit, permit2Address, chainId, witness)
    const isBatch = !isPermitTransferFrom(permit)
    const primaryType = isBatch
      ? witness
        ? 'PermitBatchWitnessTransferFrom'
        : 'PermitBatchTransferFrom'
      : witness
        ? 'PermitWitnessTransferFrom'
        : 'PermitTransferFrom'
    return TypedData.getSignPayload({
      domain,
      types,
      primaryType,
      message: values as unknown as Record<string, unknown>,
    })
  }
}

function validateTokenPermissions(permissions: TokenPermissions) {
  invariant(MaxSignatureTransferAmount >= permissions.amount, 'AMOUNT_OUT_OF_RANGE')
}
