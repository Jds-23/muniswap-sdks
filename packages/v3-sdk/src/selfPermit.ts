import type { BigintIsh, Token } from '@muniswap/sdk-core'
import ISelfPermit from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISelfPermit.sol/ISelfPermit.json' with {
  type: 'json',
}
import { AbiFunction, type Address, type Hex } from 'ox'

const selfPermitAbi = ISelfPermit.abi as readonly {
  inputs: readonly { internalType: string; name: string; type: string }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// Extract function ABIs
const selfPermitFunctionAbi = selfPermitAbi.find((item) => item.name === 'selfPermit')!
const selfPermitIfNecessaryFunctionAbi = selfPermitAbi.find((item) => item.name === 'selfPermitIfNecessary')!
const selfPermitAllowedFunctionAbi = selfPermitAbi.find((item) => item.name === 'selfPermitAllowed')!
const selfPermitAllowedIfNecessaryFunctionAbi = selfPermitAbi.find(
  (item) => item.name === 'selfPermitAllowedIfNecessary'
)!

/**
 * Standard permit options (EIP-2612).
 */
export interface StandardPermitArguments {
  v: 0 | 1 | 27 | 28
  r: `0x${string}`
  s: `0x${string}`
  amount: BigintIsh
  deadline: BigintIsh
}

/**
 * Permit options using the "allowed" variant (DAI-style).
 */
export interface AllowedPermitArguments {
  v: 0 | 1 | 27 | 28
  r: `0x${string}`
  s: `0x${string}`
  nonce: BigintIsh
  expiry: BigintIsh
}

export type PermitOptions = StandardPermitArguments | AllowedPermitArguments

function isAllowedPermit(permitOptions: PermitOptions): permitOptions is AllowedPermitArguments {
  return 'nonce' in permitOptions
}

/**
 * Encodes the calldata to self-permit a token.
 *
 * @param token - The token to permit
 * @param _owner - The owner of the tokens (unused, kept for API compatibility)
 * @param permitOptions - The permit options
 * @returns The encoded calldata
 */
export function encodeSelfPermit(token: Token, _owner: string, permitOptions: PermitOptions): Hex.Hex {
  if (isAllowedPermit(permitOptions)) {
    return AbiFunction.encodeData(selfPermitAllowedFunctionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      token.address as Address.Address,
      BigInt(permitOptions.nonce),
      BigInt(permitOptions.expiry),
      permitOptions.v,
      permitOptions.r,
      permitOptions.s,
    ]) as Hex.Hex
  }
  return AbiFunction.encodeData(selfPermitFunctionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
    BigInt(permitOptions.amount),
    BigInt(permitOptions.deadline),
    permitOptions.v,
    permitOptions.r,
    permitOptions.s,
  ]) as Hex.Hex
}

/**
 * Encodes the calldata to self-permit a token if necessary.
 * This variant only executes the permit if the allowance is insufficient.
 *
 * @param token - The token to permit
 * @param _owner - The owner of the tokens (unused, kept for API compatibility)
 * @param permitOptions - The permit options
 * @returns The encoded calldata
 */
export function encodeSelfPermitIfNecessary(token: Token, _owner: string, permitOptions: PermitOptions): Hex.Hex {
  if (isAllowedPermit(permitOptions)) {
    return AbiFunction.encodeData(
      selfPermitAllowedIfNecessaryFunctionAbi as Parameters<typeof AbiFunction.encodeData>[0],
      [
        token.address as Address.Address,
        BigInt(permitOptions.nonce),
        BigInt(permitOptions.expiry),
        permitOptions.v,
        permitOptions.r,
        permitOptions.s,
      ]
    ) as Hex.Hex
  }
  return AbiFunction.encodeData(selfPermitIfNecessaryFunctionAbi as Parameters<typeof AbiFunction.encodeData>[0], [
    token.address as Address.Address,
    BigInt(permitOptions.amount),
    BigInt(permitOptions.deadline),
    permitOptions.v,
    permitOptions.r,
    permitOptions.s,
  ]) as Hex.Hex
}
