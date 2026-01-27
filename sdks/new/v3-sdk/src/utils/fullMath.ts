import { ZERO } from '../internalConstants'

/**
 * Full precision math utilities that replicate Solidity's FullMath library.
 */

/**
 * Multiplies two numbers and divides by a third, rounding up.
 * Equivalent to ceil(a * b / denominator).
 *
 * @param a - First multiplicand
 * @param b - Second multiplicand
 * @param denominator - The divisor
 * @returns ceil(a * b / denominator)
 */
export function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
  const product = a * b
  const result = product / denominator
  // If there's a remainder, round up
  return product % denominator !== ZERO ? result + 1n : result
}
