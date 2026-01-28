import invariant from 'tiny-invariant'
import { MaxUint160, MaxUint256, ONE, Q96, ZERO } from '../internalConstants'
import { mulDivRoundingUp } from './fullMath'

/**
 * Multiply in 256-bit space with overflow wrapping.
 * Simulates Solidity's unchecked multiplication behavior.
 */
function multiplyIn256(x: bigint, y: bigint): bigint {
  const product = x * y
  return product & MaxUint256
}

/**
 * Add in 256-bit space with overflow wrapping.
 * Simulates Solidity's unchecked addition behavior.
 */
function addIn256(x: bigint, y: bigint): bigint {
  const sum = x + y
  return sum & MaxUint256
}

/**
 * Gets the next sqrt price from adding a token0 amount, rounding up.
 * Formula: sqrtPrice * liquidity / (liquidity + amount * sqrtPrice)
 */
function getNextSqrtPriceFromAmount0RoundingUp(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (amount === ZERO) return sqrtPX96

  const numerator1 = liquidity << 96n

  if (add) {
    const product = multiplyIn256(amount, sqrtPX96)
    if (product / amount === sqrtPX96) {
      const denominator = addIn256(numerator1, product)
      if (denominator >= numerator1) {
        return mulDivRoundingUp(numerator1, sqrtPX96, denominator)
      }
    }
    // Fallback for overflow case
    return mulDivRoundingUp(numerator1, ONE, numerator1 / sqrtPX96 + amount)
  } else {
    const product = multiplyIn256(amount, sqrtPX96)
    invariant(product / amount === sqrtPX96, 'OVERFLOW')
    invariant(numerator1 > product, 'UNDERFLOW')
    const denominator = numerator1 - product
    return mulDivRoundingUp(numerator1, sqrtPX96, denominator)
  }
}

/**
 * Gets the next sqrt price from adding a token1 amount, rounding down.
 * Formula: sqrtPrice + (amount / liquidity)
 */
function getNextSqrtPriceFromAmount1RoundingDown(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (add) {
    const quotient = amount <= MaxUint160 ? (amount << 96n) / liquidity : (amount * Q96) / liquidity
    return sqrtPX96 + quotient
  } else {
    const quotient = mulDivRoundingUp(amount, Q96, liquidity)
    invariant(sqrtPX96 > quotient, 'UNDERFLOW')
    return sqrtPX96 - quotient
  }
}

/**
 * Gets the next sqrt price given an input amount of token0 or token1.
 *
 * @param sqrtPX96 - The starting sqrt price
 * @param liquidity - The amount of usable liquidity
 * @param amountIn - How much of token0 or token1 is being swapped in
 * @param zeroForOne - Whether the amount in is token0 or token1
 * @returns The next sqrt price after swapping the given amount in
 */
export function getNextSqrtPriceFromInput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean
): bigint {
  invariant(sqrtPX96 > ZERO, 'SQRT_PRICE')
  invariant(liquidity > ZERO, 'LIQUIDITY')

  return zeroForOne
    ? getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
    : getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true)
}

/**
 * Gets the next sqrt price given an output amount of token0 or token1.
 *
 * @param sqrtPX96 - The starting sqrt price
 * @param liquidity - The amount of usable liquidity
 * @param amountOut - How much of token0 or token1 is being swapped out
 * @param zeroForOne - Whether the amount out is token1 or token0
 * @returns The next sqrt price after swapping the given amount out
 */
export function getNextSqrtPriceFromOutput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountOut: bigint,
  zeroForOne: boolean
): bigint {
  invariant(sqrtPX96 > ZERO, 'SQRT_PRICE')
  invariant(liquidity > ZERO, 'LIQUIDITY')

  return zeroForOne
    ? getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
    : getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false)
}

/**
 * Gets the amount of token0 delta between two sqrt prices.
 * amount0 = liquidity * (sqrtRatioB - sqrtRatioA) / (sqrtRatioA * sqrtRatioB)
 *
 * @param sqrtRatioAX96 - A sqrt ratio
 * @param sqrtRatioBX96 - Another sqrt ratio
 * @param liquidity - The liquidity amount
 * @param roundUp - Whether to round the result up or down
 * @returns The amount of token0 delta
 */
export function getAmount0Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  // Sort so that sqrtRatioAX96 <= sqrtRatioBX96
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const numerator1 = liquidity << 96n
  const numerator2 = sqrtRatioBX96 - sqrtRatioAX96

  return roundUp
    ? mulDivRoundingUp(mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96), ONE, sqrtRatioAX96)
    : (numerator1 * numerator2) / sqrtRatioBX96 / sqrtRatioAX96
}

/**
 * Gets the amount of token1 delta between two sqrt prices.
 * amount1 = liquidity * (sqrtRatioB - sqrtRatioA)
 *
 * @param sqrtRatioAX96 - A sqrt ratio
 * @param sqrtRatioBX96 - Another sqrt ratio
 * @param liquidity - The liquidity amount
 * @param roundUp - Whether to round the result up or down
 * @returns The amount of token1 delta
 */
export function getAmount1Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  // Sort so that sqrtRatioAX96 <= sqrtRatioBX96
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  return roundUp
    ? mulDivRoundingUp(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96)
    : (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96
}
