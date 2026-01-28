import type { BigintIsh } from '@muniswap/sdk-core'

/**
 * Generated method parameters for executing a call.
 */
export interface MethodParameters {
  /**
   * The hex encoded calldata to perform the given operation
   */
  calldata: string
  /**
   * The amount of ether (wei) to send in hex.
   */
  value: string
}

/**
 * Converts a bigint-ish value to a hex string
 * @param bigintIsh The value to convert
 * @returns The hex encoded string
 */
export function toHex(bigintIsh: BigintIsh): string {
  const bigInt = BigInt(bigintIsh)
  let hex = bigInt.toString(16)
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`
  }
  return `0x${hex}`
}
