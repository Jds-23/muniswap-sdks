import { Ether, Token, WETH9 } from '@muniswap/sdk-core'
import { encodeSqrtRatioX96, getTickAtSqrtRatio } from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { Pool } from '../entities/pool'
import { Route } from '../entities/route'
import { ADDRESS_ZERO, FEE_AMOUNT_MEDIUM, TICK_SPACING_TEN } from '../internalConstants'

describe('Route', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2')
  const token3 = new Token(1, '0xD000000000000000000000000000000000000000', 18, 't3')
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
  const pool_0_eth = new Pool(
    token0,
    ETHER,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )
  const pool_1_eth = new Pool(
    token1,
    ETHER,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )
  const pool_0_weth = new Pool(
    token0,
    weth,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )
  const pool_eth_weth = new Pool(
    ETHER,
    weth,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  describe('path', () => {
    it('constructs a path from the currencies', () => {
      const route = new Route([pool_0_1], token0, token1)
      expect(route.pools).toEqual([pool_0_1])
      expect(route.currencyPath).toEqual([token0, token1])
      expect(route.input).toEqual(token0)
      expect(route.output).toEqual(token1)
      expect(route.chainId).toEqual(1)
    })

    it('should fail if the input is not in the first pool', () => {
      expect(() => new Route([pool_0_1], ETHER, token1)).toThrow('Expected currency ETH to be either t0 or t1')
    })

    it('should fail if output is not in the last pool', () => {
      expect(() => new Route([pool_0_1], token0, ETHER)).toThrow('Expected currency ETH to be either t0 or t1')
    })
  })

  it('can have a currency as both input and output', () => {
    const route = new Route([pool_0_eth, pool_0_1, pool_1_eth], ETHER, ETHER)
    expect(route.pools).toEqual([pool_0_eth, pool_0_1, pool_1_eth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(ETHER)
  })

  it('supports ether input', () => {
    const route = new Route([pool_0_eth], ETHER, token0)
    expect(route.pools).toEqual([pool_0_eth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(token0)
  })

  it('supports ether input with eth-weth first pool, eth second pool', () => {
    const route = new Route([pool_eth_weth, pool_0_eth], ETHER, token0)
    expect(route.pools).toEqual([pool_eth_weth, pool_0_eth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(token0)
  })

  it('supports weth input with eth-weth first pool, weth second pool', () => {
    const route = new Route([pool_eth_weth, pool_0_weth], weth, token0)
    expect(route.pools).toEqual([pool_eth_weth, pool_0_weth])
    expect(route.input).toEqual(weth)
    expect(route.output).toEqual(token0)
  })

  it('supports ether input with eth-weth first pool, weth second pool', () => {
    const route = new Route([pool_eth_weth, pool_0_weth], ETHER, token0)
    expect(route.pools).toEqual([pool_eth_weth, pool_0_weth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(token0)
  })

  it('supports weth input with eth-weth first pool, eth second pool', () => {
    const route = new Route([pool_eth_weth, pool_0_eth], weth, token0)
    expect(route.pools).toEqual([pool_eth_weth, pool_0_eth])
    expect(route.input).toEqual(weth)
    expect(route.output).toEqual(token0)
  })

  it('eth-weth, eth input', () => {
    const route = new Route([pool_eth_weth], ETHER, weth)
    expect(route.pools).toEqual([pool_eth_weth])
    expect(route.input).toEqual(ETHER)
    expect(route.output).toEqual(weth)
  })

  it('eth-weth, weth input', () => {
    const route = new Route([pool_eth_weth], weth, ETHER)
    expect(route.pools).toEqual([pool_eth_weth])
    expect(route.input).toEqual(weth)
    expect(route.output).toEqual(ETHER)
  })

  it('supports ether output', () => {
    const route = new Route([pool_0_eth], token0, ETHER)
    expect(route.pools).toEqual([pool_0_eth])
    expect(route.input).toEqual(token0)
    expect(route.output).toEqual(ETHER)
  })

  it('does not support WETH -> ETH conversion without trading through an ETH->WETH pool', () => {
    expect(() => new Route([pool_0_weth, pool_1_eth], token0, token1)).toThrow('PATH')
  })

  it('does not support ETH -> WETH conversion without trading through an ETH->WETH pool', () => {
    expect(() => new Route([pool_1_eth, pool_0_weth], token1, token0)).toThrow('PATH')
  })

  it('supports trading through ETH/WETH pools', () => {
    const route = new Route([pool_0_weth, pool_eth_weth, pool_1_eth], token0, token1)
    expect(route.pools).toEqual([pool_0_weth, pool_eth_weth, pool_1_eth])
    expect(route.input).toEqual(token0)
    expect(route.output).toEqual(token1)
  })

  describe('#midPrice', () => {
    const pool_0_1_priced = new Pool(
      token0,
      token1,
      FEE_AMOUNT_MEDIUM,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      encodeSqrtRatioX96(1, 5),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(1, 5)),
      []
    )
    const pool_1_2_priced = new Pool(
      token1,
      token2,
      FEE_AMOUNT_MEDIUM,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      encodeSqrtRatioX96(15, 30),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(15, 30)),
      []
    )
    const pool_0_eth_priced = new Pool(
      token0,
      ETHER,
      FEE_AMOUNT_MEDIUM,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      encodeSqrtRatioX96(3, 1),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(3, 1)),
      []
    )
    const pool_1_eth_priced = new Pool(
      token1,
      ETHER,
      FEE_AMOUNT_MEDIUM,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      encodeSqrtRatioX96(1, 7),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(1, 7)),
      []
    )
    const pool_3_weth_priced = new Pool(
      weth,
      token3,
      FEE_AMOUNT_MEDIUM,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      encodeSqrtRatioX96(1, 5),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(1, 5)),
      []
    )
    const pool_0_3_priced = new Pool(
      token0,
      token3,
      FEE_AMOUNT_MEDIUM,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      encodeSqrtRatioX96(1, 5),
      0,
      getTickAtSqrtRatio(encodeSqrtRatioX96(1, 5)),
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
      const price = new Route([pool_0_eth_priced], ETHER, token0).midPrice
      expect(price.toFixed(4)).toEqual('3.0000')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(token0)).toEqual(true)
    })

    it('correct for 1 -> eth', () => {
      const price = new Route([pool_1_eth_priced], token1, ETHER).midPrice
      expect(price.toFixed(4)).toEqual('7.0000')
      expect(price.baseCurrency.equals(token1)).toEqual(true)
      expect(price.quoteCurrency.equals(ETHER)).toEqual(true)
    })

    it('correct for ether -> 0 -> 1 -> eth', () => {
      const price = new Route([pool_0_eth_priced, pool_0_1_priced, pool_1_eth_priced], ETHER, ETHER).midPrice
      expect(price.toSignificant(4)).toEqual('4.2')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(ETHER)).toEqual(true)
    })

    it('correct for eth -> 0 -> 1 -> ether', () => {
      const price = new Route([pool_0_eth_priced, pool_0_1_priced, pool_1_eth_priced], ETHER, ETHER).midPrice
      expect(price.toSignificant(4)).toEqual('4.2')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(ETHER)).toEqual(true)
    })

    it('correct for eth as input and weth as path input', () => {
      const price = new Route([pool_3_weth_priced], ETHER, token3).midPrice
      expect(price.toSignificant(4)).toEqual('0.2')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(token3)).toEqual(true)
    })

    it('correct for eth as input and weth as path input with multiple pools', () => {
      const price = new Route([pool_3_weth_priced, pool_0_3_priced], ETHER, token0).midPrice
      expect(price.toSignificant(4)).toEqual('1')
      expect(price.baseCurrency.equals(ETHER)).toEqual(true)
      expect(price.quoteCurrency.equals(token0)).toEqual(true)
    })

    it('can be constructed with ETHER as input on a WETH Pool', () => {
      const route = new Route([pool_0_weth], ETHER, token0)
      expect(route.input).toEqual(ETHER)
      expect(route.pathInput).toEqual(weth)
      expect(route.output).toEqual(token0)
      expect(route.pathOutput).toEqual(token0)
    })

    it('can be constructed with WETH as input on a ETH Pool', () => {
      const route = new Route([pool_0_eth], weth, token0)
      expect(route.input).toEqual(weth)
      expect(route.pathInput).toEqual(ETHER)
      expect(route.output).toEqual(token0)
      expect(route.pathOutput).toEqual(token0)
    })

    it('can be constructed with ETHER as output on a WETH Pool', () => {
      const route = new Route([pool_0_weth], token0, ETHER)
      expect(route.input).toEqual(token0)
      expect(route.pathInput).toEqual(token0)
      expect(route.output).toEqual(ETHER)
      expect(route.pathOutput).toEqual(weth)
    })

    it('can be constructed with WETH as output on a ETH Pool', () => {
      const route = new Route([pool_0_eth], token0, weth)
      expect(route.input).toEqual(token0)
      expect(route.pathInput).toEqual(token0)
      expect(route.output).toEqual(weth)
      expect(route.pathOutput).toEqual(ETHER)
    })
  })
})
