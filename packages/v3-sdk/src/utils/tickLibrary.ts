import { Q256, ZERO } from '../internalConstants'

export interface FeeGrowthOutside {
  feeGrowthOutside0X128: bigint
  feeGrowthOutside1X128: bigint
}

/**
 * Subtracts in 256-bit space with underflow wrapping.
 * When x < y, returns Q256 + (x - y) to simulate Solidity's unchecked subtraction.
 *
 * @param x - The minuend
 * @param y - The subtrahend
 * @returns The difference, wrapping on underflow
 */
export function subIn256(x: bigint, y: bigint): bigint {
  const difference = x - y

  if (difference < ZERO) {
    return Q256 + difference
  } else {
    return difference
  }
}

/**
 * Returns the fee growth inside a tick range.
 * Used to calculate uncollected fees for a position.
 *
 * @param feeGrowthOutsideLower - Fee growth outside data for the lower tick
 * @param feeGrowthOutsideUpper - Fee growth outside data for the upper tick
 * @param tickLower - The lower tick of the range
 * @param tickUpper - The upper tick of the range
 * @param tickCurrent - The current tick of the pool
 * @param feeGrowthGlobal0X128 - The global fee growth for token0
 * @param feeGrowthGlobal1X128 - The global fee growth for token1
 * @returns A tuple of [feeGrowthInside0X128, feeGrowthInside1X128]
 */
export function getFeeGrowthInside(
  feeGrowthOutsideLower: FeeGrowthOutside,
  feeGrowthOutsideUpper: FeeGrowthOutside,
  tickLower: number,
  tickUpper: number,
  tickCurrent: number,
  feeGrowthGlobal0X128: bigint,
  feeGrowthGlobal1X128: bigint
): [bigint, bigint] {
  // Calculate fee growth below the lower tick
  let feeGrowthBelow0X128: bigint
  let feeGrowthBelow1X128: bigint
  if (tickCurrent >= tickLower) {
    feeGrowthBelow0X128 = feeGrowthOutsideLower.feeGrowthOutside0X128
    feeGrowthBelow1X128 = feeGrowthOutsideLower.feeGrowthOutside1X128
  } else {
    feeGrowthBelow0X128 = subIn256(feeGrowthGlobal0X128, feeGrowthOutsideLower.feeGrowthOutside0X128)
    feeGrowthBelow1X128 = subIn256(feeGrowthGlobal1X128, feeGrowthOutsideLower.feeGrowthOutside1X128)
  }

  // Calculate fee growth above the upper tick
  let feeGrowthAbove0X128: bigint
  let feeGrowthAbove1X128: bigint
  if (tickCurrent < tickUpper) {
    feeGrowthAbove0X128 = feeGrowthOutsideUpper.feeGrowthOutside0X128
    feeGrowthAbove1X128 = feeGrowthOutsideUpper.feeGrowthOutside1X128
  } else {
    feeGrowthAbove0X128 = subIn256(feeGrowthGlobal0X128, feeGrowthOutsideUpper.feeGrowthOutside0X128)
    feeGrowthAbove1X128 = subIn256(feeGrowthGlobal1X128, feeGrowthOutsideUpper.feeGrowthOutside1X128)
  }

  // Fee growth inside = global - below - above
  return [
    subIn256(subIn256(feeGrowthGlobal0X128, feeGrowthBelow0X128), feeGrowthAbove0X128),
    subIn256(subIn256(feeGrowthGlobal1X128, feeGrowthBelow1X128), feeGrowthAbove1X128),
  ]
}
