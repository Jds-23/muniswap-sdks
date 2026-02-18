import type { PermitSingle } from '@muniswap/permit2-sdk'
import { validateAndParseAddress } from '@muniswap/sdk-core'
import type { BigintIsh } from '@muniswap/sdk-core'
import { AbiFunction, Bytes, type Hex, Signature } from 'ox'
import invariant from 'tiny-invariant'

export interface NFTPermitOptions {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  deadline: BigintIsh
  spender: string
}
import { ROUTER_AS_RECIPIENT } from './constants'
import { CommandType, type RoutePlanner } from './routerCommands'

export interface Permit2Permit extends PermitSingle {
  signature: string
}

export type ApproveProtocol = {
  token: string
  protocol: string
}

export type Permit2TransferFrom = {
  token: string
  amount: string
  recipient?: string
}

export type InputTokenOptions = {
  permit2Permit?: Permit2Permit | undefined
  permit2TransferFrom?: Permit2TransferFrom | undefined
}

const SIGNATURE_LENGTH = 65
const EIP_2098_SIGNATURE_LENGTH = 64

const v3PermitAbi = AbiFunction.from(
  'function permit(address spender, uint256 tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s)'
)

export function encodePermit(planner: RoutePlanner, permit2: Permit2Permit): void {
  let signature = permit2.signature

  const length = Bytes.fromHex(permit2.signature as Hex.Hex).length
  // signature data provided for EIP-1271 may have length different from ECDSA signature
  if (length === SIGNATURE_LENGTH || length === EIP_2098_SIGNATURE_LENGTH) {
    // sanitizes signature to cover edge cases of malformed EIP-2098 sigs and v used as recovery id
    const sig = Signature.from(permit2.signature as Hex.Hex)
    signature = Signature.toHex(sig)
  }

  planner.addCommand(CommandType.PERMIT2_PERMIT, [permit2, signature])
}

export function encodeV3PositionPermit(planner: RoutePlanner, permit: NFTPermitOptions, tokenId: BigintIsh): void {
  const calldata = AbiFunction.encodeData(v3PermitAbi, [
    validateAndParseAddress(permit.spender),
    BigInt(tokenId.toString()),
    BigInt(permit.deadline.toString()),
    permit.v,
    permit.r as Hex.Hex,
    permit.s as Hex.Hex,
  ])

  planner.addCommand(CommandType.V3_POSITION_MANAGER_PERMIT, [calldata])
}

// Handles the encoding of commands needed to gather input tokens for a trade
// Approval: The router approving another address to take tokens.
//   note: Only seaport and sudoswap support this action. Approvals are left open.
// Permit: A Permit2 signature-based Permit to allow the router to access a user's tokens
// Transfer: A Permit2 TransferFrom of tokens from a user to either the router or another address
export function encodeInputTokenOptions(planner: RoutePlanner, options: InputTokenOptions) {
  // first ensure that all tokens provided for encoding are the same
  if (options.permit2TransferFrom && options.permit2Permit)
    invariant(options.permit2TransferFrom.token === options.permit2Permit.details.token, 'inconsistent token')

  // if this order has a options.permit2Permit, encode it
  if (options.permit2Permit) {
    encodePermit(planner, options.permit2Permit)
  }

  if (options.permit2TransferFrom) {
    planner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
      options.permit2TransferFrom.token,
      options.permit2TransferFrom.recipient ? options.permit2TransferFrom.recipient : ROUTER_AS_RECIPIENT,
      options.permit2TransferFrom.amount,
    ])
  }
}
