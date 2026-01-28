import { Q128 } from '../internalConstants'
import { subIn256 } from './tickLibrary'

/**
 * Computes the tokens owed to a position based on fee growth.
 * Replicates the portions of Position#update required to compute unaccounted fees.
 *
 * @param feeGrowthInside0LastX128 - The last recorded fee growth inside for token0
 * @param feeGrowthInside1LastX128 - The last recorded fee growth inside for token1
 * @param liquidity - The position's liquidity
 * @param feeGrowthInside0X128 - The current fee growth inside for token0
 * @param feeGrowthInside1X128 - The current fee growth inside for token1
 * @returns A tuple of [tokensOwed0, tokensOwed1]
 */
export function getTokensOwed(
  feeGrowthInside0LastX128: bigint,
  feeGrowthInside1LastX128: bigint,
  liquidity: bigint,
  feeGrowthInside0X128: bigint,
  feeGrowthInside1X128: bigint
): [bigint, bigint] {
  const tokensOwed0 = (subIn256(feeGrowthInside0X128, feeGrowthInside0LastX128) * liquidity) / Q128

  const tokensOwed1 = (subIn256(feeGrowthInside1X128, feeGrowthInside1LastX128) * liquidity) / Q128

  return [tokensOwed0, tokensOwed1]
}
