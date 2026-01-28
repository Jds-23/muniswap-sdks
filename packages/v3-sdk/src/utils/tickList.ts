import invariant from 'tiny-invariant'
import type { Tick } from '../entities/tick'
import { ZERO } from '../internalConstants'
import { isSorted } from './isSorted'

function tickComparator(a: Tick, b: Tick): number {
  return a.index - b.index
}

/**
 * Validates that a tick list is valid for the given tick spacing.
 * - All ticks must be on a valid tick spacing boundary
 * - The sum of liquidityNet must be zero
 * - The list must be sorted in ascending order
 *
 * @param ticks - The tick list to validate
 * @param tickSpacing - The tick spacing of the pool
 * @throws If any validation fails
 */
export function validateTickList(ticks: Tick[], tickSpacing: number): void {
  invariant(tickSpacing > 0, 'TICK_SPACING_NONZERO')

  // Ensure ticks are spaced appropriately
  invariant(
    ticks.every(({ index }) => index % tickSpacing === 0),
    'TICK_SPACING'
  )

  // Ensure tick liquidity deltas sum to 0
  const netSum = ticks.reduce((accumulator, { liquidityNet }) => accumulator + liquidityNet, ZERO)
  invariant(netSum === ZERO, 'ZERO_NET')

  // Ensure ticks are sorted
  invariant(isSorted(ticks, tickComparator), 'SORTED')
}

/**
 * Returns true if the given tick is below the smallest tick in the list.
 */
export function isBelowSmallest(ticks: readonly Tick[], tick: number): boolean {
  invariant(ticks.length > 0, 'LENGTH')
  return tick < ticks[0]!.index
}

/**
 * Returns true if the given tick is at or above the largest tick in the list.
 */
export function isAtOrAboveLargest(ticks: readonly Tick[], tick: number): boolean {
  invariant(ticks.length > 0, 'LENGTH')
  return tick >= ticks[ticks.length - 1]!.index
}

/**
 * Returns the tick from the list at the given index.
 *
 * @param ticks - The tick list
 * @param index - The tick index to get
 * @returns The tick at the given index
 * @throws If the tick is not found in the list
 */
export function getTick(ticks: readonly Tick[], index: number): Tick {
  const tick = ticks[binarySearch(ticks, index)]
  invariant(tick!.index === index, 'NOT_CONTAINED')
  return tick!
}

/**
 * Finds the largest tick in the list of ticks that is less than or equal to tick.
 */
function binarySearch(ticks: readonly Tick[], tick: number): number {
  invariant(!isBelowSmallest(ticks, tick), 'BELOW_SMALLEST')

  let l = 0
  let r = ticks.length - 1
  let i: number

  while (true) {
    i = Math.floor((l + r) / 2)

    if (ticks[i]!.index <= tick && (i === ticks.length - 1 || ticks[i + 1]!.index > tick)) {
      return i
    }

    if (ticks[i]!.index < tick) {
      l = i + 1
    } else {
      r = i - 1
    }
  }
}

/**
 * Returns the next initialized tick in the tick list.
 *
 * @param ticks - The tick list
 * @param tick - The starting tick
 * @param lte - Whether to search for a tick less than or equal to (true) or greater than (false)
 * @returns The next initialized tick
 */
export function nextInitializedTick(ticks: readonly Tick[], tick: number, lte: boolean): Tick {
  if (lte) {
    invariant(!isBelowSmallest(ticks, tick), 'BELOW_SMALLEST')
    if (isAtOrAboveLargest(ticks, tick)) {
      return ticks[ticks.length - 1]!
    }
    const index = binarySearch(ticks, tick)
    return ticks[index]!
  } else {
    invariant(!isAtOrAboveLargest(ticks, tick), 'AT_OR_ABOVE_LARGEST')
    if (isBelowSmallest(ticks, tick)) {
      return ticks[0]!
    }
    const index = binarySearch(ticks, tick)
    return ticks[index + 1]!
  }
}

/**
 * Returns the next initialized tick within one word (256 bits / tickSpacing ticks).
 *
 * @param ticks - The tick list
 * @param tick - The starting tick
 * @param lte - Whether to search left (true) or right (false)
 * @param tickSpacing - The tick spacing of the pool
 * @returns A tuple of [nextTick, initialized] where initialized is true if the tick is initialized
 */
export function nextInitializedTickWithinOneWord(
  ticks: readonly Tick[],
  tick: number,
  lte: boolean,
  tickSpacing: number
): [number, boolean] {
  const compressed = Math.floor(tick / tickSpacing) // matches rounding in the code

  if (lte) {
    const wordPos = compressed >> 8
    const minimum = (wordPos << 8) * tickSpacing

    if (isBelowSmallest(ticks, tick)) {
      return [minimum, false]
    }

    const index = nextInitializedTick(ticks, tick, lte).index
    const nextInitializedTickIndex = Math.max(minimum, index)
    return [nextInitializedTickIndex, nextInitializedTickIndex === index]
  } else {
    const wordPos = (compressed + 1) >> 8
    const maximum = (((wordPos + 1) << 8) - 1) * tickSpacing

    if (isAtOrAboveLargest(ticks, tick)) {
      return [maximum, false]
    }

    const index = nextInitializedTick(ticks, tick, lte).index
    const nextInitializedTickIndex = Math.min(maximum, index)
    return [nextInitializedTickIndex, nextInitializedTickIndex === index]
  }
}
