import type { Currency } from '@muniswap/sdk-core'
import { ADDRESS_ZERO } from '../internalConstants'

/**
 * Converts a Currency to its address representation for V4.
 * In V4, native currencies are represented by the zero address (0x0).
 *
 * @param currency The currency to convert
 * @returns The address string (0x0 for native, wrapped address for tokens)
 */
export function toAddress(currency: Currency): string {
  if (currency.isNative) return ADDRESS_ZERO
  return currency.wrapped.address
}
