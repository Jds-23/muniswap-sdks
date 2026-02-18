import { AllowanceTransfer, type PermitSingle } from '@muniswap/permit2-sdk'
import { type Hex, Secp256k1, Signature, TypedData } from 'ox'
import { MAX_UINT160, UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from '../../utils/constants'
import type { Permit2Permit } from '../../utils/inputTokens'
import { PERMIT2_ADDRESS } from './addresses'

const TEST_DEADLINE = '3000000000000'

/// returns signature bytes
export function generatePermitSignature(
  permit: PermitSingle,
  privateKey: Hex.Hex,
  chainId: number,
  permitAddress: string = PERMIT2_ADDRESS
): string {
  const { domain, types, values } = AllowanceTransfer.getPermitData(permit, permitAddress, chainId)
  const payload = TypedData.getSignPayload({
    // biome-ignore lint/suspicious/noExplicitAny: permit2-sdk domain types don't match ox exactly
    domain: domain as any,
    // biome-ignore lint/suspicious/noExplicitAny: permit2-sdk types don't match ox exactly
    types: types as any,
    primaryType: 'PermitSingle',
    // biome-ignore lint/suspicious/noExplicitAny: permit2-sdk values don't match ox exactly
    message: values as any,
  })
  const sig = Secp256k1.sign({ payload, privateKey })
  return Signature.toHex(sig)
}

export function generateEip2098PermitSignature(
  permit: PermitSingle,
  privateKey: Hex.Hex,
  chainId: number,
  permitAddress: string = PERMIT2_ADDRESS
): string {
  const fullSig = generatePermitSignature(permit, privateKey, chainId, permitAddress)
  const parsed = Signature.from(fullSig as Hex.Hex)
  // EIP-2098 compact: r (32 bytes) + vs (32 bytes, yParity encoded in high bit of s)
  const rHex = parsed.r.toString(16).padStart(64, '0')
  let vs = parsed.s
  if (parsed.yParity === 1) {
    vs = vs | (1n << 255n)
  }
  const vsHex = vs.toString(16).padStart(64, '0')
  return `0x${rHex}${vsHex}`
}

export function toInputPermit(signature: string, permit: PermitSingle): Permit2Permit {
  return {
    ...permit,
    signature,
  }
}

export function makePermit(
  token: string,
  amount: string = MAX_UINT160.toString(),
  nonce = '0',
  routerAddress: string = UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1)
): PermitSingle {
  return {
    details: {
      token,
      amount: BigInt(amount),
      expiration: BigInt(TEST_DEADLINE),
      nonce: BigInt(nonce),
    },
    spender: routerAddress,
    sigDeadline: BigInt(TEST_DEADLINE),
  }
}
