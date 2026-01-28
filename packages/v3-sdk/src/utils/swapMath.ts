import { NEGATIVE_ONE, ZERO } from '../internalConstants'
import { mulDivRoundingUp } from './fullMath'
import {
  getAmount0Delta,
  getAmount1Delta,
  getNextSqrtPriceFromInput,
  getNextSqrtPriceFromOutput,
} from './sqrtPriceMath'

const MAX_FEE = 10n ** 6n // 1,000,000 - represents 100%

export interface SwapStepResult {
  sqrtRatioNextX96: bigint
  amountIn: bigint
  amountOut: bigint
  feeAmount: bigint
}

/**
 * Computes the result of swapping some amount in, or amount out, given the parameters of the swap.
 * The fee, plus the amount in, will never exceed the amount remaining if the swap's `amountSpecified` is positive.
 *
 * @param sqrtRatioCurrentX96 - The current sqrt price of the pool
 * @param sqrtRatioTargetX96 - The price that cannot be exceeded, from which the direction of the swap is inferred
 * @param liquidity - The usable liquidity
 * @param amountRemaining - How much input or output amount is remaining to be swapped in/out
 * @param feePips - The fee taken from the input amount, expressed in hundredths of a bip (1e-6)
 * @returns The result of the swap step
 */
export function computeSwapStep(
  sqrtRatioCurrentX96: bigint,
  sqrtRatioTargetX96: bigint,
  liquidity: bigint,
  amountRemaining: bigint,
  feePips: bigint | number
): SwapStepResult {
  const feePipsBigInt = BigInt(feePips)

  const zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96
  const exactIn = amountRemaining >= ZERO

  let sqrtRatioNextX96: bigint
  let amountIn: bigint
  let amountOut: bigint
  let feeAmount: bigint

  if (exactIn) {
    // Exact input - we know how much we're putting in
    const amountRemainingLessFee = (amountRemaining * (MAX_FEE - feePipsBigInt)) / MAX_FEE

    // Calculate max amount in to reach target price
    amountIn = zeroForOne
      ? getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
      : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true)

    if (amountRemainingLessFee >= amountIn) {
      // We can reach the target price
      sqrtRatioNextX96 = sqrtRatioTargetX96
    } else {
      // We can't reach the target, calculate how far we can get
      sqrtRatioNextX96 = getNextSqrtPriceFromInput(sqrtRatioCurrentX96, liquidity, amountRemainingLessFee, zeroForOne)
    }
  } else {
    // Exact output - we know how much we want out
    // Calculate max amount out to reach target price
    amountOut = zeroForOne
      ? getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
      : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false)

    if (amountRemaining * NEGATIVE_ONE >= amountOut) {
      // We can reach the target price
      sqrtRatioNextX96 = sqrtRatioTargetX96
    } else {
      // We can't reach the target, calculate how far we can get
      sqrtRatioNextX96 = getNextSqrtPriceFromOutput(
        sqrtRatioCurrentX96,
        liquidity,
        amountRemaining * NEGATIVE_ONE,
        zeroForOne
      )
    }
  }

  const max = sqrtRatioTargetX96 === sqrtRatioNextX96

  // Calculate final amounts based on whether we reached the target
  if (zeroForOne) {
    amountIn = max && exactIn ? amountIn! : getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true)
    amountOut = max && !exactIn ? amountOut! : getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false)
  } else {
    amountIn = max && exactIn ? amountIn! : getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true)
    amountOut = max && !exactIn ? amountOut! : getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false)
  }

  // Cap the output amount to not exceed the remaining amount for exact output swaps
  if (!exactIn && amountOut > amountRemaining * NEGATIVE_ONE) {
    amountOut = amountRemaining * NEGATIVE_ONE
  }

  // Calculate fee
  if (exactIn && sqrtRatioNextX96 !== sqrtRatioTargetX96) {
    // We didn't reach the target, so take the remainder of the maximum input as fee
    feeAmount = amountRemaining - amountIn
  } else {
    feeAmount = mulDivRoundingUp(amountIn, feePipsBigInt, MAX_FEE - feePipsBigInt)
  }

  return {
    sqrtRatioNextX96,
    amountIn,
    amountOut,
    feeAmount,
  }
}
