import { NEGATIVE_ONE, ZERO } from '../internalConstants'

/**
 * Adds a signed liquidity delta to a liquidity amount.
 * Handles the sign conversion appropriately.
 *
 * @param x - The liquidity amount
 * @param y - The delta to add (can be positive or negative)
 * @returns The resulting liquidity
 */
export function addDelta(x: bigint, y: bigint): bigint {
  if (y < ZERO) {
    return x - y * NEGATIVE_ONE
  } else {
    return x + y
  }
}
