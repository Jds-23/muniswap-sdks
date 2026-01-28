import type { BigintIsh } from '@muniswap/sdk-core'
import { Q96 } from '../internalConstants'

/**
 * Returns an imprecise maximum amount of liquidity received for a given amount of token0.
 * This function accommodates the V3 periphery's LiquidityAmounts#getLiquidityForAmount0,
 * which could be more precise by at least 32 bits.
 *
 * @param sqrtRatioAX96 - The price at the lower boundary
 * @param sqrtRatioBX96 - The price at the upper boundary
 * @param amount0 - The token0 amount
 * @returns Liquidity for amount0, imprecise
 */
function maxLiquidityForAmount0Imprecise(
  sqrtRatioAX96Input: bigint,
  sqrtRatioBX96Input: bigint,
  amount0: BigintIsh
): bigint {
  // Sort so sqrtRatioA <= sqrtRatioB
  const [sqrtRatioAX96, sqrtRatioBX96] =
    sqrtRatioAX96Input > sqrtRatioBX96Input
      ? [sqrtRatioBX96Input, sqrtRatioAX96Input]
      : [sqrtRatioAX96Input, sqrtRatioBX96Input]
  const intermediate = (sqrtRatioAX96 * sqrtRatioBX96) / Q96
  return (BigInt(amount0) * intermediate) / (sqrtRatioBX96 - sqrtRatioAX96)
}

/**
 * Returns a precise maximum amount of liquidity received for a given amount of token0.
 * Uses full precision by dividing by Q64 instead of Q96 in intermediate step.
 *
 * @param sqrtRatioAX96 - The price at the lower boundary
 * @param sqrtRatioBX96 - The price at the upper boundary
 * @param amount0 - The token0 amount
 * @returns Liquidity for amount0, precise
 */
function maxLiquidityForAmount0Precise(
  sqrtRatioAX96Input: bigint,
  sqrtRatioBX96Input: bigint,
  amount0: BigintIsh
): bigint {
  // Sort so sqrtRatioA <= sqrtRatioB
  const [sqrtRatioAX96, sqrtRatioBX96] =
    sqrtRatioAX96Input > sqrtRatioBX96Input
      ? [sqrtRatioBX96Input, sqrtRatioAX96Input]
      : [sqrtRatioAX96Input, sqrtRatioBX96Input]

  const numerator = BigInt(amount0) * sqrtRatioAX96 * sqrtRatioBX96
  const denominator = Q96 * (sqrtRatioBX96 - sqrtRatioAX96)

  return numerator / denominator
}

/**
 * Computes the maximum amount of liquidity received for a given amount of token1.
 *
 * @param sqrtRatioAX96 - The price at the lower tick boundary
 * @param sqrtRatioBX96 - The price at the upper tick boundary
 * @param amount1 - The token1 amount
 * @returns Liquidity for amount1
 */
function maxLiquidityForAmount1(sqrtRatioAX96Input: bigint, sqrtRatioBX96Input: bigint, amount1: BigintIsh): bigint {
  // Sort so sqrtRatioA <= sqrtRatioB
  const [sqrtRatioAX96, sqrtRatioBX96] =
    sqrtRatioAX96Input > sqrtRatioBX96Input
      ? [sqrtRatioBX96Input, sqrtRatioAX96Input]
      : [sqrtRatioAX96Input, sqrtRatioBX96Input]
  return (BigInt(amount1) * Q96) / (sqrtRatioBX96 - sqrtRatioAX96)
}

/**
 * Computes the maximum amount of liquidity received for a given amount of token0, token1,
 * and the prices at the tick boundaries.
 *
 * @param sqrtRatioCurrentX96 - The current price
 * @param sqrtRatioAX96 - Price at lower boundary
 * @param sqrtRatioBX96 - Price at upper boundary
 * @param amount0 - Token0 amount
 * @param amount1 - Token1 amount
 * @param useFullPrecision - If false, liquidity will be maximized according to what the router
 *   can calculate, not what core can theoretically support
 * @returns The maximum liquidity for the given amounts
 */
export function maxLiquidityForAmounts(
  sqrtRatioCurrentX96: bigint,
  sqrtRatioAX96Input: bigint,
  sqrtRatioBX96Input: bigint,
  amount0: BigintIsh,
  amount1: BigintIsh,
  useFullPrecision: boolean
): bigint {
  // Sort so sqrtRatioA <= sqrtRatioB
  const [sqrtRatioAX96, sqrtRatioBX96] =
    sqrtRatioAX96Input > sqrtRatioBX96Input
      ? [sqrtRatioBX96Input, sqrtRatioAX96Input]
      : [sqrtRatioAX96Input, sqrtRatioBX96Input]

  const maxLiquidityForAmount0 = useFullPrecision ? maxLiquidityForAmount0Precise : maxLiquidityForAmount0Imprecise

  if (sqrtRatioCurrentX96 <= sqrtRatioAX96) {
    // Current price below range - only token0 is needed
    return maxLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
  }
  if (sqrtRatioCurrentX96 < sqrtRatioBX96) {
    // Current price in range - both tokens needed, take the minimum liquidity
    const liquidity0 = maxLiquidityForAmount0(sqrtRatioCurrentX96, sqrtRatioBX96, amount0)
    const liquidity1 = maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioCurrentX96, amount1)
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1
  }
  // Current price above range - only token1 is needed
  return maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
}
