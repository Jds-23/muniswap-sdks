import { Price, type Token } from '@uniswap/sdk-core-next'
import { Q192 } from '../internalConstants'
import { encodeSqrtRatioX96 } from './encodeSqrtRatioX96'
import { getSqrtRatioAtTick, getTickAtSqrtRatio } from './tickMath'

/**
 * Returns a price object corresponding to the input tick and the base/quote token.
 * Inputs must be tokens because the address order is used to interpret the price represented by the tick.
 *
 * @param baseToken - The base token of the price
 * @param quoteToken - The quote token of the price
 * @param tick - The tick for which to return the price
 * @returns The price at the given tick
 */
export function tickToPrice(baseToken: Token, quoteToken: Token, tick: number): Price<Token, Token> {
  const sqrtRatioX96 = getSqrtRatioAtTick(tick)

  const ratioX192 = sqrtRatioX96 * sqrtRatioX96

  return baseToken.sortsBefore(quoteToken)
    ? new Price(baseToken, quoteToken, Q192, ratioX192)
    : new Price(baseToken, quoteToken, ratioX192, Q192)
}

/**
 * Returns the first tick for which the given price is greater than or equal to the tick price.
 *
 * @param price - The price for which to return the closest tick that represents a price
 *   less than or equal to the input price
 * @returns The closest tick to the given price
 */
export function priceToClosestTick(price: Price<Token, Token>): number {
  const sorted = price.baseCurrency.sortsBefore(price.quoteCurrency)

  const sqrtRatioX96 = sorted
    ? encodeSqrtRatioX96(price.numerator, price.denominator)
    : encodeSqrtRatioX96(price.denominator, price.numerator)

  let tick = getTickAtSqrtRatio(sqrtRatioX96)
  const nextTickPrice = tickToPrice(price.baseCurrency, price.quoteCurrency, tick + 1)

  if (sorted) {
    if (!price.lessThan(nextTickPrice)) {
      tick++
    }
  } else {
    if (!price.greaterThan(nextTickPrice)) {
      tick++
    }
  }
  return tick
}
