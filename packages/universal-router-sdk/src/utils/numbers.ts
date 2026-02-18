import type { Percent } from '@muniswap/sdk-core'

export function expandTo18DecimalsBN(n: number): bigint {
  return BigInt(Math.round(n * 1e18))
}

export function expandTo18Decimals(n: number): bigint {
  return BigInt(n) * 10n ** 18n
}

export function encodeFeeBips(fee: Percent): string {
  return `0x${fee.multiply(10_000).quotient.toString(16)}`
}
