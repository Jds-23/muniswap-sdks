import invariant from 'tiny-invariant'
import type { TickDataProvider } from '../entities/tickDataProvider'
import { NEGATIVE_ONE, ONE, ZERO } from '../internalConstants'
import { addDelta } from './liquidityMath'
import { computeSwapStep } from './swapMath'
import { MAX_SQRT_RATIO, MIN_SQRT_RATIO, getSqrtRatioAtTick } from './tickMath'

interface StepComputations {
  sqrtPriceStartX96: bigint
  tickNext: number
  initialized: boolean
  sqrtPriceNextX96: bigint
  amountIn: bigint
  amountOut: bigint
  feeAmount: bigint
}

export interface SwapResult {
  amountCalculated: bigint
  sqrtRatioX96: bigint
  liquidity: bigint
  tickCurrent: number
}

/**
 * Simulates a V3 swap off-chain by iterating through tick transitions.
 *
 * @param fee - The pool fee in hundredths of a bip
 * @param sqrtRatioX96 - The current sqrt price of the pool
 * @param tickCurrent - The current tick of the pool
 * @param liquidity - The current liquidity of the pool
 * @param tickSpacing - The tick spacing of the pool
 * @param tickDataProvider - A provider for fetching tick data
 * @param zeroForOne - Whether swapping token0 for token1 (true) or token1 for token0 (false)
 * @param amountSpecified - The amount being swapped (positive = exact input, negative = exact output)
 * @param sqrtPriceLimitX96 - The price limit for the swap
 * @returns The result of the swap simulation
 */
export async function v3Swap(
  fee: bigint,
  sqrtRatioX96: bigint,
  tickCurrent: number,
  liquidity: bigint,
  tickSpacing: number,
  tickDataProvider: TickDataProvider,
  zeroForOne: boolean,
  amountSpecified: bigint,
  sqrtPriceLimitX96?: bigint
): Promise<SwapResult> {
  // Set default price limit if not specified
  if (!sqrtPriceLimitX96) {
    sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_RATIO + ONE : MAX_SQRT_RATIO - ONE
  }

  // Validate price limit
  if (zeroForOne) {
    invariant(sqrtPriceLimitX96 > MIN_SQRT_RATIO, 'RATIO_MIN')
    invariant(sqrtPriceLimitX96 < sqrtRatioX96, 'RATIO_CURRENT')
  } else {
    invariant(sqrtPriceLimitX96 < MAX_SQRT_RATIO, 'RATIO_MAX')
    invariant(sqrtPriceLimitX96 > sqrtRatioX96, 'RATIO_CURRENT')
  }

  const exactInput = amountSpecified >= ZERO

  // Keep track of swap state
  const state = {
    amountSpecifiedRemaining: amountSpecified,
    amountCalculated: ZERO,
    sqrtPriceX96: sqrtRatioX96,
    tick: tickCurrent,
    liquidity: liquidity,
  }

  // Start swap while loop
  while (state.amountSpecifiedRemaining !== ZERO && state.sqrtPriceX96 !== sqrtPriceLimitX96) {
    const step: Partial<StepComputations> = {}
    step.sqrtPriceStartX96 = state.sqrtPriceX96

    // Find next initialized tick within one word
    ;[step.tickNext, step.initialized] = await tickDataProvider.nextInitializedTickWithinOneWord(
      state.tick,
      zeroForOne,
      tickSpacing
    )

    // Clamp tick to bounds
    if (step.tickNext < -887272) {
      step.tickNext = -887272
    } else if (step.tickNext > 887272) {
      step.tickNext = 887272
    }

    step.sqrtPriceNextX96 = getSqrtRatioAtTick(step.tickNext)

    // Compute swap step
    const targetSqrtPrice = zeroForOne
      ? step.sqrtPriceNextX96 < sqrtPriceLimitX96
        ? sqrtPriceLimitX96
        : step.sqrtPriceNextX96
      : step.sqrtPriceNextX96 > sqrtPriceLimitX96
        ? sqrtPriceLimitX96
        : step.sqrtPriceNextX96

    const swapResult = computeSwapStep(
      state.sqrtPriceX96,
      targetSqrtPrice,
      state.liquidity,
      state.amountSpecifiedRemaining,
      fee
    )

    state.sqrtPriceX96 = swapResult.sqrtRatioNextX96
    step.amountIn = swapResult.amountIn
    step.amountOut = swapResult.amountOut
    step.feeAmount = swapResult.feeAmount

    if (exactInput) {
      state.amountSpecifiedRemaining = state.amountSpecifiedRemaining - (step.amountIn + step.feeAmount)
      state.amountCalculated = state.amountCalculated - step.amountOut
    } else {
      state.amountSpecifiedRemaining = state.amountSpecifiedRemaining + step.amountOut
      state.amountCalculated = state.amountCalculated + step.amountIn + step.feeAmount
    }

    // If the tick is initialized, run the tick transition
    if (state.sqrtPriceX96 === step.sqrtPriceNextX96) {
      if (step.initialized) {
        let liquidityNet = BigInt((await tickDataProvider.getTick(step.tickNext)).liquidityNet)
        // If moving leftward, interpret liquidityNet as opposite sign
        if (zeroForOne) liquidityNet = liquidityNet * NEGATIVE_ONE

        state.liquidity = addDelta(state.liquidity, liquidityNet)
      }

      state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext
    } else if (state.sqrtPriceX96 !== step.sqrtPriceStartX96) {
      // Recompute tick if we haven't moved to next tick boundary
      const { getTickAtSqrtRatio } = await import('./tickMath')
      state.tick = getTickAtSqrtRatio(state.sqrtPriceX96)
    }
  }

  return {
    amountCalculated: state.amountCalculated,
    sqrtRatioX96: state.sqrtPriceX96,
    liquidity: state.liquidity,
    tickCurrent: state.tick,
  }
}
