import type { TypedData } from 'ox'

const PERMIT2_DOMAIN_NAME = 'Permit2'

export function permit2Domain(permit2Address: string, chainId: number): TypedData.Domain {
  return {
    name: PERMIT2_DOMAIN_NAME,
    chainId,
    verifyingContract: permit2Address as `0x${string}`,
  }
}

export type PermitData = {
  domain: TypedData.Domain
  types: Record<string, readonly TypedData.Parameter[]>
  values: Record<string, unknown>
}
