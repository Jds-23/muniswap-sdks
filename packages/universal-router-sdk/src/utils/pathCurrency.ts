import type { TPool } from '@muniswap/router-sdk'
import type { Currency, Token } from '@muniswap/sdk-core'
import { Pool as V4Pool } from '@muniswap/v4-sdk'

export function getPathCurrency(currency: Currency, pool: TPool): Currency {
  // return currency if the currency matches a currency of the pool
  if (pool.involvesToken(currency as Token)) {
    return currency

    // return if currency.wrapped if pool involves wrapped currency
  }
  if (pool.involvesToken(currency.wrapped as Token)) {
    return currency.wrapped

    // return native currency if pool involves native version of wrapped currency (only applies to V4)
  }
  if (pool instanceof V4Pool && pool.token0.wrapped.equals(currency)) {
    return pool.token0
  }
  if (pool instanceof V4Pool && pool.token1.wrapped.equals(currency)) {
    return pool.token1
  }
  throw new Error(`Expected currency ${currency.symbol} to be either ${pool.token0.symbol} or ${pool.token1.symbol}`)
}
