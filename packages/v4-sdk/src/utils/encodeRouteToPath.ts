import type { Currency } from '@muniswap/sdk-core'
import type { Route } from '../entities/route'
import { ADDRESS_ZERO } from '../internalConstants'

/**
 * PathKey represents a single hop in a V4 swap path
 */
export type PathKey = {
  /** The currency address for this path segment (0x0 for native) */
  intermediateCurrency: string
  /** The fee tier of the pool (in hundredths of a bip) */
  fee: number
  /** The tick spacing of the pool */
  tickSpacing: number
  /** The hook address for this pool */
  hooks: string
  /** Optional hook data for this hop (default: 0x) */
  hookData: string
}

/**
 * Encodes a route to an array of PathKey structs for V4 Router calls.
 * Each PathKey represents a hop in the multi-pool swap.
 *
 * @param route The route to encode
 * @param exactOutput Whether this is an exact output swap (reverses the path)
 * @returns Array of PathKey structs
 */
export function encodeRouteToPath(route: Route<Currency, Currency>, exactOutput?: boolean): PathKey[] {
  // Create a deep copy of pools so that we don't tamper with pool array on route
  let pools = route.pools.map((p) => p)
  if (exactOutput) pools = pools.reverse()
  let startingCurrency = exactOutput ? route.pathOutput : route.pathInput
  const pathKeys: PathKey[] = []

  for (const pool of pools) {
    const nextCurrency = startingCurrency.equals(pool.currency0) ? pool.currency1 : pool.currency0

    pathKeys.push({
      intermediateCurrency: nextCurrency.isNative ? ADDRESS_ZERO : nextCurrency.address,
      fee: pool.fee,
      tickSpacing: pool.tickSpacing,
      hooks: pool.hooks,
      hookData: '0x',
    })

    startingCurrency = nextCurrency
  }

  return exactOutput ? pathKeys.reverse() : pathKeys
}
