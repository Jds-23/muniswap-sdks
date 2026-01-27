import type { BigintIsh } from '@uniswap/sdk-core-next'
import type { Hex } from 'ox'

/**
 * Generated method parameters for executing a call.
 */
export interface MethodParameters {
  /**
   * The hex encoded calldata to perform the given operation
   */
  calldata: Hex.Hex
  /**
   * The amount of ether (wei) to send in hex.
   */
  value: Hex.Hex
}

/**
 * Converts a bigint-like value to a hex string.
 *
 * @param bigintIsh - The value to convert
 * @returns The hex encoded value
 */
export function toHex(bigintIsh: BigintIsh): Hex.Hex {
  const bigInt = BigInt(bigintIsh)
  let hex = bigInt.toString(16)
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`
  }
  return `0x${hex}` as Hex.Hex
}
