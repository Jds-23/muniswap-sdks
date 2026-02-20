import { Ether, Token, WETH9 } from '@muniswap/sdk-core'
import { encodeSqrtRatioX96 } from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { Pool } from '../entities/pool'
import { Route } from '../entities/route'
import { ADDRESS_ZERO, FEE_AMOUNT_MEDIUM, TICK_SPACING_TEN } from '../internalConstants'
import { encodeRouteToPath } from './encodeRouteToPath'

describe('encodeRouteToPath', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 'T0', 'Token0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 'T1', 'Token1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 'T2', 'Token2')
  const weth = WETH9[1]!

  const pool_0_1 = new Pool(
    token0,
    token1,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  const pool_1_2 = new Pool(
    token1,
    token2,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  const pool_eth_0 = new Pool(
    ETHER,
    token0,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  it('encodes correct route for exactIn (single pool)', () => {
    const route = new Route([pool_0_1], token0, token1)
    const path = encodeRouteToPath(route)

    expect(path).toHaveLength(1)
    expect(path[0]).toEqual({
      intermediateCurrency: token1.address,
      fee: FEE_AMOUNT_MEDIUM,
      tickSpacing: TICK_SPACING_TEN,
      hooks: ADDRESS_ZERO,
      hookData: '0x',
    })
  })

  it('encodes correct route for exactIn (multi hop)', () => {
    const route = new Route([pool_0_1, pool_1_2], token0, token2)
    const path = encodeRouteToPath(route)

    expect(path).toHaveLength(2)
    expect(path[0]).toEqual({
      intermediateCurrency: token1.address,
      fee: FEE_AMOUNT_MEDIUM,
      tickSpacing: TICK_SPACING_TEN,
      hooks: ADDRESS_ZERO,
      hookData: '0x',
    })
    expect(path[1]).toEqual({
      intermediateCurrency: token2.address,
      fee: FEE_AMOUNT_MEDIUM,
      tickSpacing: TICK_SPACING_TEN,
      hooks: ADDRESS_ZERO,
      hookData: '0x',
    })
  })

  it('encodes correct route for exactOut (single pool)', () => {
    const route = new Route([pool_0_1], token0, token1)
    const path = encodeRouteToPath(route, true)

    expect(path).toHaveLength(1)
    expect(path[0]).toEqual({
      intermediateCurrency: token0.address,
      fee: FEE_AMOUNT_MEDIUM,
      tickSpacing: TICK_SPACING_TEN,
      hooks: ADDRESS_ZERO,
      hookData: '0x',
    })
  })

  it('encodes correct route for exactOut (multi hop)', () => {
    const route = new Route([pool_0_1, pool_1_2], token0, token2)
    const path = encodeRouteToPath(route, true)

    expect(path).toHaveLength(2)
    // For exactOut, pools are reversed then iterated, and pathKeys are reversed again at the end.
    // Reversed pools: [pool_1_2, pool_0_1], starting from pathOutput (token2):
    //   pool_1_2: next = token1 -> pathKey {token1}
    //   pool_0_1: next = token0 -> pathKey {token0}
    // pathKeys = [{token1}, {token0}], reversed = [{token0}, {token1}]
    expect(path[0]).toEqual({
      intermediateCurrency: token0.address,
      fee: FEE_AMOUNT_MEDIUM,
      tickSpacing: TICK_SPACING_TEN,
      hooks: ADDRESS_ZERO,
      hookData: '0x',
    })
    expect(path[1]).toEqual({
      intermediateCurrency: token1.address,
      fee: FEE_AMOUNT_MEDIUM,
      tickSpacing: TICK_SPACING_TEN,
      hooks: ADDRESS_ZERO,
      hookData: '0x',
    })
  })

  it('encodes correct path when route.output !== route.pathOutput (native output)', () => {
    // Route with WETH as output, but pool uses native ETH
    // route.output = weth, route.pathOutput = ETH (native)
    const route = new Route([pool_eth_0], token0, weth)

    // For exactIn: start from pathInput (token0), next currency in pool is ETHER (native)
    const path = encodeRouteToPath(route)

    expect(path).toHaveLength(1)
    expect(path[0]!.intermediateCurrency).toEqual(ADDRESS_ZERO)
  })

  it('encodes correct path when route.input !== route.pathInput (native input)', () => {
    // Route with WETH as input, but pool uses native ETH
    // route.input = weth, route.pathInput = ETH (native)
    const route = new Route([pool_eth_0], weth, token0)

    const path = encodeRouteToPath(route)

    expect(path).toHaveLength(1)
    expect(path[0]!.intermediateCurrency).toEqual(token0.address)
  })
})
