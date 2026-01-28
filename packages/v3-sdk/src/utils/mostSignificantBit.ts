import invariant from 'tiny-invariant'
import { MaxUint256, ZERO } from '../internalConstants'

// Pre-computed powers of 2 for binary search
const POWERS_OF_2 = [128n, 64n, 32n, 16n, 8n, 4n, 2n, 1n] as const

/**
 * Returns the index of the most significant bit of the number.
 * Uses binary search with pre-computed powers of 2 for efficiency.
 *
 * @param x - The number to find the MSB of (must be > 0 and <= MaxUint256)
 * @returns The index of the most significant bit (0-255)
 * @throws If x is not greater than 0 or exceeds MaxUint256
 */
export function mostSignificantBit(x: bigint): number {
  invariant(x > ZERO, 'ZERO')
  invariant(x <= MaxUint256, 'MAX')

  let msb = 0

  for (const power of POWERS_OF_2) {
    const min = 1n << power
    if (x >= min) {
      x = x >> power
      msb += Number(power)
    }
  }

  return msb
}
