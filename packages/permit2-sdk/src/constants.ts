/** @deprecated please use permit2Address(chainId: number) */
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

export function permit2Address(chainId?: number): string {
  switch (chainId) {
    case 324:
      return '0x0000000000225e31D15943971F47aD3022F714Fa'
    default:
      return PERMIT2_ADDRESS
  }
}

export const MaxUint48 = 0xffffffffffffn
export const MaxUint160 = 0xffffffffffffffffffffffffffffffffffffffffn
export const MaxUint256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn

// alias max types for their usages
// allowance transfer types
export const MaxAllowanceTransferAmount = MaxUint160
export const MaxAllowanceExpiration = MaxUint48
export const MaxOrderedNonce = MaxUint48

// signature transfer types
export const MaxSignatureTransferAmount = MaxUint256
export const MaxUnorderedNonce = MaxUint256
export const MaxSigDeadline = MaxUint256

export const InstantExpiration = 0n
