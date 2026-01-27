import { type BigintIsh, sqrt } from '@uniswap/sdk-core-next'

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given ratio of amount1 and amount0.
 * sqrt(amount1/amount0) * Q96 = sqrt(amount1 * Q192 / amount0)
 *
 * @param amount1 - The numerator amount i.e., the amount of token1
 * @param amount0 - The denominator amount i.e., the amount of token0
 * @returns The sqrt ratio as a Q64.96 value
 */
export function encodeSqrtRatioX96(amount1: BigintIsh, amount0: BigintIsh): bigint {
  const numerator = BigInt(amount1) << 192n
  const denominator = BigInt(amount0)
  const ratioX192 = numerator / denominator
  return sqrt(ratioX192)
}
