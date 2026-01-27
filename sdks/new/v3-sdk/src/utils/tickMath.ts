import invariant from 'tiny-invariant'
import { MaxUint256, ONE, ZERO } from '../internalConstants'
import { mostSignificantBit } from './mostSignificantBit'

/**
 * The minimum tick that can be used on any pool.
 */
export const MIN_TICK = -887272

/**
 * The maximum tick that can be used on any pool.
 */
export const MAX_TICK = 887272

/**
 * The sqrt ratio corresponding to the minimum tick that could be used on any pool.
 */
export const MIN_SQRT_RATIO = 4295128739n

/**
 * The sqrt ratio corresponding to the maximum tick that could be used on any pool.
 */
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n

// Magic numbers for getSqrtRatioAtTick - these are pre-computed constants
// for the Taylor series expansion of 1.0001^(tick/2)
const Q32 = 1n << 32n

// Multiplication shift helper - used in tick-to-price conversion
function mulShift(val: bigint, mulBy: bigint): bigint {
  return (val * mulBy) >> 128n
}

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given tick.
 * The sqrt ratio is computed as sqrt(1.0001^tick) * 2^96.
 *
 * @param tick - The tick for which to compute the sqrt ratio
 * @returns The sqrt ratio as a Q64.96 value
 * @throws If the tick is outside MIN_TICK to MAX_TICK
 */
export function getSqrtRatioAtTick(tick: number): bigint {
  invariant(tick >= MIN_TICK && tick <= MAX_TICK && Number.isInteger(tick), 'TICK')

  const absTick = tick < 0 ? -tick : tick

  // Start with the base value for the Taylor series
  let ratio: bigint = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n

  // Apply multipliers for each bit of the tick
  // These are pre-computed values of 1.0001^(-2^i) * 2^128
  if ((absTick & 0x2) !== 0) ratio = mulShift(ratio, 0xfff97272373d413259a46990580e213an)
  if ((absTick & 0x4) !== 0) ratio = mulShift(ratio, 0xfff2e50f5f656932ef12357cf3c7fdccn)
  if ((absTick & 0x8) !== 0) ratio = mulShift(ratio, 0xffe5caca7e10e4e61c3624eaa0941cd0n)
  if ((absTick & 0x10) !== 0) ratio = mulShift(ratio, 0xffcb9843d60f6159c9db58835c926644n)
  if ((absTick & 0x20) !== 0) ratio = mulShift(ratio, 0xff973b41fa98c081472e6896dfb254c0n)
  if ((absTick & 0x40) !== 0) ratio = mulShift(ratio, 0xff2ea16466c96a3843ec78b326b52861n)
  if ((absTick & 0x80) !== 0) ratio = mulShift(ratio, 0xfe5dee046a99a2a811c461f1969c3053n)
  if ((absTick & 0x100) !== 0) ratio = mulShift(ratio, 0xfcbe86c7900a88aedcffc83b479aa3a4n)
  if ((absTick & 0x200) !== 0) ratio = mulShift(ratio, 0xf987a7253ac413176f2b074cf7815e54n)
  if ((absTick & 0x400) !== 0) ratio = mulShift(ratio, 0xf3392b0822b70005940c7a398e4b70f3n)
  if ((absTick & 0x800) !== 0) ratio = mulShift(ratio, 0xe7159475a2c29b7443b29c7fa6e889d9n)
  if ((absTick & 0x1000) !== 0) ratio = mulShift(ratio, 0xd097f3bdfd2022b8845ad8f792aa5825n)
  if ((absTick & 0x2000) !== 0) ratio = mulShift(ratio, 0xa9f746462d870fdf8a65dc1f90e061e5n)
  if ((absTick & 0x4000) !== 0) ratio = mulShift(ratio, 0x70d869a156d2a1b890bb3df62baf32f7n)
  if ((absTick & 0x8000) !== 0) ratio = mulShift(ratio, 0x31be135f97d08fd981231505542fcfa6n)
  if ((absTick & 0x10000) !== 0) ratio = mulShift(ratio, 0x9aa508b5b7a84e1c677de54f3e99bc9n)
  if ((absTick & 0x20000) !== 0) ratio = mulShift(ratio, 0x5d6af8dedb81196699c329225ee604n)
  if ((absTick & 0x40000) !== 0) ratio = mulShift(ratio, 0x2216e584f5fa1ea926041bedfe98n)
  if ((absTick & 0x80000) !== 0) ratio = mulShift(ratio, 0x48a170391f7dc42444e8fa2n)

  // For positive ticks, we computed 1/ratio, so invert
  if (tick > 0) ratio = MaxUint256 / ratio

  // Shift down to Q64.96 format and round up if necessary
  return (ratio >> 32n) + (ratio % Q32 > ZERO ? ONE : ZERO)
}

/**
 * Returns the tick corresponding to a given sqrt ratio.
 * The tick is the greatest tick for which the ratio is greater than or equal to the sqrt ratio.
 *
 * @param sqrtRatioX96 - The sqrt ratio as a Q64.96 value
 * @returns The tick corresponding to the given sqrt ratio
 * @throws If the sqrt ratio is outside the valid range
 */
export function getTickAtSqrtRatio(sqrtRatioX96: bigint): number {
  invariant(sqrtRatioX96 >= MIN_SQRT_RATIO && sqrtRatioX96 < MAX_SQRT_RATIO, 'SQRT_RATIO')

  // Shift to get better precision
  const sqrtRatioX128 = sqrtRatioX96 << 32n

  // Get the MSB position
  const msb = mostSignificantBit(sqrtRatioX128)

  // Normalize to get the most significant 128 bits
  let r: bigint
  if (msb >= 128) {
    r = sqrtRatioX128 >> BigInt(msb - 127)
  } else {
    r = sqrtRatioX128 << BigInt(127 - msb)
  }

  // Calculate log2 using binary search
  let log_2 = (BigInt(msb) - 128n) << 64n

  // Iteratively refine log_2
  for (let i = 0; i < 14; i++) {
    r = (r * r) >> 127n
    const f = r >> 128n
    log_2 = log_2 | (f << BigInt(63 - i))
    r = r >> f
  }

  // Convert from log base 2 to log base sqrt(1.0001)
  // log_sqrt10001 = log_2 * log(2) / log(sqrt(1.0001))
  const log_sqrt10001 = log_2 * 255738958999603826347141n

  // Calculate lower and upper tick bounds
  const tickLow = Number((log_sqrt10001 - 3402992956809132418596140100660247210n) >> 128n)
  const tickHigh = Number((log_sqrt10001 + 291339464771989622907027621153398088495n) >> 128n)

  // Return the appropriate tick
  if (tickLow === tickHigh) {
    return tickLow
  }
  return getSqrtRatioAtTick(tickHigh) <= sqrtRatioX96 ? tickHigh : tickLow
}
