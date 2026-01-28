/**
 * Represents values that can be converted to bigint
 */
export type BigintIsh = bigint | string | number

/**
 * Trade type enum
 */
export enum TradeType {
  EXACT_INPUT = 0,
  EXACT_OUTPUT = 1,
}

/**
 * Rounding mode for decimal operations
 */
export enum Rounding {
  ROUND_DOWN = 0,
  ROUND_HALF_UP = 1,
  ROUND_UP = 2,
}

/**
 * Maximum value for uint256
 */
export const MaxUint256 = 2n ** 256n - 1n

/**
 * Safely converts a BigintIsh value to bigint
 * @param value The value to convert
 * @returns The value as a bigint
 * @throws If the value is a non-integer number
 */
export function toBigInt(value: BigintIsh): bigint {
  if (typeof value === 'bigint') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`Cannot convert non-integer ${value} to bigint`)
    }
    return BigInt(value)
  }
  // String - handles both decimal and hex formats
  return BigInt(value)
}
