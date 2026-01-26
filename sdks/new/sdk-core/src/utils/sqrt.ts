import invariant from 'tiny-invariant'

export const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER)

/**
 * Computes floor(sqrt(value))
 * @param value the value for which to compute the square root, rounded down
 */
export function sqrt(value: bigint): bigint {
  invariant(value >= 0n, 'NEGATIVE')

  // Rely on built-in sqrt if possible
  if (value < MAX_SAFE_INTEGER) {
    return BigInt(Math.floor(Math.sqrt(Number(value))))
  }

  // Newton's method for large values
  let z = value
  let x = value / 2n + 1n
  while (x < z) {
    z = x
    x = (value / x + x) / 2n
  }
  return z
}
