import { type Currency, CurrencyAmount } from '@muniswap/sdk-core'
import type { Pool } from '../entities/pool'

/**
 * Converts an amount to use the path currency for a given pool.
 * This handles the case where we need to convert between native and wrapped currencies.
 *
 * @param amount The amount to convert
 * @param pool The pool that determines which currency to use
 * @returns The amount with the correct path currency
 */
export function amountWithPathCurrency(amount: CurrencyAmount<Currency>, pool: Pool): CurrencyAmount<Currency> {
  return CurrencyAmount.fromFractionalAmount(
    getPathCurrency(amount.currency, pool),
    amount.numerator,
    amount.denominator
  )
}

/**
 * Gets the matching currency from the pool for the given currency.
 * Handles native/wrapped currency conversions.
 *
 * @param currency The currency to find in the pool
 * @param pool The pool to search
 * @returns The matching currency from the pool
 * @throws If the currency is not found in the pool
 */
export function getPathCurrency(currency: Currency, pool: Pool): Currency {
  if (pool.involvesCurrency(currency)) {
    return currency
  }
  if (pool.involvesCurrency(currency.wrapped)) {
    return currency.wrapped
  }
  if (pool.currency0.wrapped.equals(currency)) {
    return pool.currency0
  }
  if (pool.currency1.wrapped.equals(currency)) {
    return pool.currency1
  }
  throw new Error(
    `Expected currency ${currency.symbol} to be either ${pool.currency0.symbol} or ${pool.currency1.symbol}`
  )
}
