import { Ether, Token, WETH9 } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import { FeeAmount } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { getTickAtSqrtRatio } from '../utils/tickMath'
import { Pool } from './pool'
import { Route } from './route'

describe('Route', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2')
  const weth = WETH9[1]!

  const pool_0_1 = new Pool(token0, token1, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
  const pool_0_weth = new Pool(token0, weth, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
  const pool_1_weth = new Pool(token1, weth, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])

  describe('path', () => {
    it('constructs a path from the tokens', () => {
      const route = new Route([pool_0_1], token0, token1)
      expect(route.pools).toEqual([pool_0_1])
      expect(route.tokenPath).toEqual([token0, token1])
      expect(route.input).toEqual(token0)
      expect(route.output).toEqual(token1)
      expect(route.chainId).toEqual(1)
    })

    it('should fail if the input is not in the first pool', () => {
      expect(() => new Route([pool_0_1], weth, token1)).toThrow('INPUT')
    })

    it('should fail if output is not in the last pool', () => {
      expect(() => new Route([pool_0_1], token0, weth)).toThrow('OUTPUT')
    })

    it('should fail if pools is empty', () => {
      expect(() => new Route([], token0, token1)).toThrow('POOLS')
    })
  })

  it('can have a token as both input and output', () => {
    const route = new Route([pool_0_weth, pool_0_1, pool_1_weth], weth, weth)
    expect(route.pools).toEqual([pool_0_weth, pool_0_1, pool_1_weth])
    expect(route.input).toEqual(weth)
    expect(route.output).toEqual(weth)
  })

  it('supports ether input', () => {
    const route = new Route([pool_0_weth], ETHER, token0)
    expect(route.pools).toEqual([pool_0_weth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(token0)
  })

  it('supports ether output', () => {
    const route = new Route([pool_0_weth], token0, ETHER)
    expect(route.pools).toEqual([pool_0_weth])
    expect(route.input).toEqual(token0)
    expect(route.output).toEqual(ETHER)
  })

  describe('#midPrice', () => {
    const pool_0_1_priced = new Pool(
      token0,
      token1,
      FeeAmount.MEDIUM,
      encodeSqrtRatioX96(1, 5),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(1, 5)),
      []
    )
    const pool_1_2_priced = new Pool(
      token1,
      token2,
      FeeAmount.MEDIUM,
      encodeSqrtRatioX96(15, 30),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(15, 30)),
      []
    )
    const pool_0_weth_priced = new Pool(
      token0,
      weth,
      FeeAmount.MEDIUM,
      encodeSqrtRatioX96(3, 1),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(3, 1)),
      []
    )
    const pool_1_weth_priced = new Pool(
      token1,
      weth,
      FeeAmount.MEDIUM,
      encodeSqrtRatioX96(1, 7),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(1, 7)),
      []
    )

    it('correct for 0 -> 1', () => {
      const price = new Route([pool_0_1_priced], token0, token1).midPrice
      expect(price.toFixed(4)).toEqual('0.2000')
      expect(price.baseCurrency.equals(token0)).toEqual(true)
      expect(price.quoteCurrency.equals(token1)).toEqual(true)
    })

    it('is cached', () => {
      const route = new Route([pool_0_1_priced], token0, token1)
      expect(route.midPrice).toStrictEqual(route.midPrice)
    })

    it('correct for 1 -> 0', () => {
      const price = new Route([pool_0_1_priced], token1, token0).midPrice
      expect(price.toFixed(4)).toEqual('5.0000')
      expect(price.baseCurrency.equals(token1)).toEqual(true)
      expect(price.quoteCurrency.equals(token0)).toEqual(true)
    })

    it('correct for 0 -> 1 -> 2', () => {
      const price = new Route([pool_0_1_priced, pool_1_2_priced], token0, token2).midPrice
      expect(price.toFixed(4)).toEqual('0.1000')
      expect(price.baseCurrency.equals(token0)).toEqual(true)
      expect(price.quoteCurrency.equals(token2)).toEqual(true)
    })

    it('correct for 2 -> 1 -> 0', () => {
      const price = new Route([pool_1_2_priced, pool_0_1_priced], token2, token0).midPrice
      expect(price.toFixed(4)).toEqual('10.0000')
      expect(price.baseCurrency.equals(token2)).toEqual(true)
      expect(price.quoteCurrency.equals(token0)).toEqual(true)
    })

    it('correct for ether -> 0', () => {
      const price = new Route([pool_0_weth_priced], ETHER, token0).midPrice
      expect(price.toFixed(4)).toEqual('0.3333')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(token0)).toEqual(true)
    })

    it('correct for 1 -> weth', () => {
      const price = new Route([pool_1_weth_priced], token1, weth).midPrice
      expect(price.toFixed(4)).toEqual('0.1429')
      expect(price.baseCurrency.equals(token1)).toEqual(true)
      expect(price.quoteCurrency.equals(weth)).toEqual(true)
    })

    it('correct for ether -> 0 -> 1 -> weth', () => {
      const price = new Route([pool_0_weth_priced, pool_0_1_priced, pool_1_weth_priced], ETHER, weth).midPrice
      expect(price.toSignificant(4)).toEqual('0.009524')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(weth)).toEqual(true)
    })

    it('correct for weth -> 0 -> 1 -> ether', () => {
      const price = new Route([pool_0_weth_priced, pool_0_1_priced, pool_1_weth_priced], weth, ETHER).midPrice
      expect(price.toSignificant(4)).toEqual('0.009524')
      expect(price.baseCurrency.equals(weth)).toEqual(true)
      expect(price.quoteCurrency.equals(ETHER)).toEqual(true)
    })
  })
})
