import { type Currency, Price } from '@muniswap/sdk-core'
import { encodeSqrtRatioX96, getSqrtRatioAtTick, getTickAtSqrtRatio } from '@muniswap/v3-sdk'
import { Q192 } from '../internalConstants'
import { sortsBefore } from './sortsBefore'

/**
 * Returns a price object corresponding to the input tick and the base/quote currency.
 * Uses currency order to interpret the price represented by the tick.
 *
 * @param baseCurrency The base currency of the price
 * @param quoteCurrency The quote currency of the price
 * @param tick The tick for which to return the price
 * @returns The price at the given tick
 */
export function tickToPrice(baseCurrency: Currency, quoteCurrency: Currency, tick: number): Price<Currency, Currency> {
  const sqrtRatioX96 = getSqrtRatioAtTick(tick)
  const ratioX192 = sqrtRatioX96 * sqrtRatioX96

  return sortsBefore(baseCurrency, quoteCurrency)
    ? new Price(baseCurrency, quoteCurrency, Q192, ratioX192)
    : new Price(baseCurrency, quoteCurrency, ratioX192, Q192)
}

/**
 * Returns the first tick for which the given price is greater than or equal to the tick price.
 * I.e., the price of the returned tick is less than or equal to the input price.
 *
 * @param price The price for which to return the closest tick
 * @returns The closest tick below or equal to the given price
 */
export function priceToClosestTick(price: Price<Currency, Currency>): number {
  const sorted = sortsBefore(price.baseCurrency, price.quoteCurrency)

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
