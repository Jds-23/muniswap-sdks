import type { Currency, Token } from '@muniswap/sdk-core'
import { AbiParameters, type Address, type Hex } from 'ox'
import type { Route } from '../entities/route'

/**
 * Converts a route to a hex encoded path for the V3 router.
 * The path is encoded as a packed sequence of (token, fee, token, fee, ..., token).
 *
 * @param route - The swap route
 * @param exactOutput - Whether the trade is exact output (reverses the path)
 * @returns The hex encoded path
 */
export function encodeRouteToPath<TInput extends Currency, TOutput extends Currency>(
  route: Route<TInput, TOutput>,
  exactOutput: boolean
): Hex.Hex {
  const firstInputToken: Token = route.input.wrapped

  const types: string[] = []
  const values: (Address.Address | number)[] = []

  // Build path based on direction
  if (exactOutput) {
    // For exact output, we traverse in reverse
    for (let i = route.pools.length - 1; i >= 0; i--) {
      const pool = route.pools[i]!
      const outputToken = route.tokenPath[i + 1]!

      if (i === route.pools.length - 1) {
        types.push('address')
        values.push(outputToken.address as Address.Address)
      }

      types.push('uint24', 'address')
      values.push(pool.fee, route.tokenPath[i]!.address as Address.Address)
    }
  } else {
    // For exact input, we traverse forward
    types.push('address')
    values.push(firstInputToken.address as Address.Address)

    for (let i = 0; i < route.pools.length; i++) {
      const pool = route.pools[i]!
      const outputToken = route.tokenPath[i + 1]!

      types.push('uint24', 'address')
      values.push(pool.fee, outputToken.address as Address.Address)
    }
  }

  return AbiParameters.encodePacked(types as ('address' | 'uint24')[], values) as Hex.Hex
}
