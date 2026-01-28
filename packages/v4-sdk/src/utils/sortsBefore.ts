import type { Currency } from '@muniswap/sdk-core'

/**
 * Determines if currencyA sorts before currencyB in V4's currency ordering.
 * In V4, native currency (ETH) always comes first (address 0x0).
 *
 * @param currencyA First currency to compare
 * @param currencyB Second currency to compare
 * @returns True if currencyA sorts before currencyB
 */
export function sortsBefore(currencyA: Currency, currencyB: Currency): boolean {
  if (currencyA.isNative) return true
  if (currencyB.isNative) return false
  return currencyA.wrapped.sortsBefore(currencyB.wrapped)
}
