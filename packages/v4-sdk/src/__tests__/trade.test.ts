import { type Currency, CurrencyAmount, Ether, Percent, Price, Token, TradeType, WETH9 } from '@muniswap/sdk-core'
import { MAX_TICK, MIN_TICK, encodeSqrtRatioX96, getTickAtSqrtRatio, nearestUsableTick } from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { Pool } from '../entities/pool'
import { Route } from '../entities/route'
import { Trade } from '../entities/trade'
import { ADDRESS_ZERO, FEE_AMOUNT_MEDIUM, TICK_SPACING_TEN } from '../internalConstants'

describe('Trade', () => {
  const ETHER = Ether.onChain(1)
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1')
  const token2 = new Token(1, '0x0000000000000000000000000000000000000003', 18, 't2')
  const token3 = new Token(1, '0x0000000000000000000000000000000000000004', 18, 't3')
  const weth = WETH9[1]!

  function v2StylePool(
    reserve0: CurrencyAmount<Currency>,
    reserve1: CurrencyAmount<Currency>,
    feeAmount: number = FEE_AMOUNT_MEDIUM
  ) {
    const sqrtRatioX96 = encodeSqrtRatioX96(reserve1.quotient, reserve0.quotient)
    return new Pool(
      reserve0.currency,
      reserve1.currency,
      feeAmount,
      TICK_SPACING_TEN,
      ADDRESS_ZERO,
      sqrtRatioX96,
      BigInt(reserve0.quotient) * BigInt(reserve1.quotient),
      getTickAtSqrtRatio(sqrtRatioX96),
      [
        {
          index: nearestUsableTick(MIN_TICK, TICK_SPACING_TEN),
          liquidityNet: BigInt(reserve0.quotient) * BigInt(reserve1.quotient),
          liquidityGross: BigInt(reserve0.quotient) * BigInt(reserve1.quotient),
        },
        {
          index: nearestUsableTick(MAX_TICK, TICK_SPACING_TEN),
          liquidityNet: -(BigInt(reserve0.quotient) * BigInt(reserve1.quotient)),
          liquidityGross: BigInt(reserve0.quotient) * BigInt(reserve1.quotient),
        },
      ]
    )
  }

  const pool_0_1 = v2StylePool(
    CurrencyAmount.fromRawAmount(token0, 100000n),
    CurrencyAmount.fromRawAmount(token1, 100000n)
  )
  const pool_0_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(token0, 100000n),
    CurrencyAmount.fromRawAmount(token2, 110000n)
  )
  const pool_0_3 = v2StylePool(
    CurrencyAmount.fromRawAmount(token0, 100000n),
    CurrencyAmount.fromRawAmount(token3, 90000n)
  )
  const pool_1_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(token1, 120000n),
    CurrencyAmount.fromRawAmount(token2, 100000n)
  )
  const pool_1_3 = v2StylePool(
    CurrencyAmount.fromRawAmount(token1, 120000n),
    CurrencyAmount.fromRawAmount(token3, 130000n)
  )

  const pool_weth_1 = v2StylePool(
    CurrencyAmount.fromRawAmount(weth, 100000n),
    CurrencyAmount.fromRawAmount(token1, 100000n)
  )
  const pool_weth_2 = v2StylePool(
    CurrencyAmount.fromRawAmount(weth, 100000n),
    CurrencyAmount.fromRawAmount(token2, 100000n)
  )

  const pool_eth_0 = v2StylePool(
    CurrencyAmount.fromRawAmount(ETHER, 100000n),
    CurrencyAmount.fromRawAmount(token0, 100000n)
  )
  describe('#fromRoute', () => {
    it('can be constructed with ETHER as input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_eth_0], ETHER, token0),
        CurrencyAmount.fromRawAmount(ETHER, 10000n),
        TradeType.EXACT_INPUT
      )
      expect(trade.inputAmount.currency).toEqual(ETHER)
      expect(trade.outputAmount.currency).toEqual(token0)
    })

    it('can be constructed with ETHER as input for exact output', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_eth_0], ETHER, token0),
        CurrencyAmount.fromRawAmount(token0, 10000n),
        TradeType.EXACT_OUTPUT
      )
      expect(trade.inputAmount.currency).toEqual(ETHER)
      expect(trade.outputAmount.currency).toEqual(token0)
    })

    it('can be constructed with ETHER as output', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_eth_0], token0, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, 10000n),
        TradeType.EXACT_OUTPUT
      )
      expect(trade.inputAmount.currency).toEqual(token0)
      expect(trade.outputAmount.currency).toEqual(ETHER)
    })

    it('can be constructed with ETHER as output for exact input', async () => {
      const trade = await Trade.fromRoute(
        new Route([pool_eth_0], token0, ETHER),
        CurrencyAmount.fromRawAmount(token0, 10000n),
        TradeType.EXACT_INPUT
      )
      expect(trade.inputAmount.currency).toEqual(token0)
      expect(trade.outputAmount.currency).toEqual(ETHER)
    })
  })

  describe('#fromRoutes', () => {
    it('can be constructed with ETHER as input with multiple routes', async () => {
      const trade = await Trade.fromRoutes<Ether, Token, TradeType.EXACT_INPUT>(
        [
          {
            amount: CurrencyAmount.fromRawAmount(ETHER, 10000n),
            route: new Route([pool_eth_0], ETHER, token0),
          },
        ],
        TradeType.EXACT_INPUT
      )
      expect(trade.inputAmount.currency).toEqual(ETHER)
      expect(trade.outputAmount.currency).toEqual(token0)
    })

    it('can be constructed with ETHER as input for exact output with multiple routes', async () => {
      const trade = await Trade.fromRoutes<Ether, Token, TradeType.EXACT_OUTPUT>(
        [
          {
            amount: CurrencyAmount.fromRawAmount(token0, 3000n),
            route: new Route([pool_eth_0], ETHER, token0),
          },
          {
            amount: CurrencyAmount.fromRawAmount(token0, 7000n),
            route: new Route([pool_weth_1, pool_0_1], ETHER, token0),
          },
        ],
        TradeType.EXACT_OUTPUT
      )
      expect(trade.inputAmount.currency).toEqual(ETHER)
      expect(trade.outputAmount.currency).toEqual(token0)
    })

    it('can be constructed with ETHER as output with multiple routes', async () => {
      const trade = await Trade.fromRoutes<Token, Ether, TradeType.EXACT_OUTPUT>(
        [
          {
            amount: CurrencyAmount.fromRawAmount(ETHER, 4000n),
            route: new Route([pool_eth_0], token0, ETHER),
          },
          {
            amount: CurrencyAmount.fromRawAmount(ETHER, 6000n),
            route: new Route([pool_0_2, pool_weth_2], token0, ETHER),
          },
        ],
        TradeType.EXACT_OUTPUT
      )
      expect(trade.inputAmount.currency).toEqual(token0)
      expect(trade.outputAmount.currency).toEqual(ETHER)
    })

    it('throws if pools are duplicated across routes', async () => {
      await expect(
        Trade.fromRoutes<Token, Token, TradeType.EXACT_INPUT>(
          [
            {
              amount: CurrencyAmount.fromRawAmount(token0, 5000n),
              route: new Route([pool_0_2], token0, token2),
            },
            {
              amount: CurrencyAmount.fromRawAmount(token0, 5000n),
              route: new Route([pool_0_2], token0, token2),
            },
          ],
          TradeType.EXACT_INPUT
        )
      ).rejects.toThrow('POOLS_DUPLICATED')
    })
  })

  describe('#createUncheckedTrade', () => {
    it('throws if input currency does not match route', () => {
      expect(() =>
        Trade.createUncheckedTrade({
          route: new Route([pool_0_1], token0, token1),
          inputAmount: CurrencyAmount.fromRawAmount(token2, 10000n),
          outputAmount: CurrencyAmount.fromRawAmount(token1, 10000n),
          tradeType: TradeType.EXACT_INPUT,
        })
      ).toThrow('INPUT_CURRENCY_MATCH')
    })

    it('throws if output currency does not match route', () => {
      expect(() =>
        Trade.createUncheckedTrade({
          route: new Route([pool_0_1], token0, token1),
          inputAmount: CurrencyAmount.fromRawAmount(token0, 10000n),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 10000n),
          tradeType: TradeType.EXACT_INPUT,
        })
      ).toThrow('OUTPUT_CURRENCY_MATCH')
    })

    it('can create an exact input trade without simulating', () => {
      const trade = Trade.createUncheckedTrade({
        route: new Route([pool_0_1], token0, token1),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 10000n),
        outputAmount: CurrencyAmount.fromRawAmount(token1, 100000n),
        tradeType: TradeType.EXACT_INPUT,
      })
      expect(trade.route).toBeDefined()
      expect(trade.tradeType).toBe(TradeType.EXACT_INPUT)
      expect(trade.inputAmount.quotient).toBe(10000n)
      expect(trade.outputAmount.quotient).toBe(100000n)
    })

    it('can create an exact output trade without simulating', () => {
      const trade = Trade.createUncheckedTrade({
        route: new Route([pool_0_1], token0, token1),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 10000n),
        outputAmount: CurrencyAmount.fromRawAmount(token1, 100000n),
        tradeType: TradeType.EXACT_OUTPUT,
      })
      expect(trade.tradeType).toBe(TradeType.EXACT_OUTPUT)
      expect(trade.inputAmount.quotient).toBe(10000n)
      expect(trade.outputAmount.quotient).toBe(100000n)
    })
  })

  describe('#createUncheckedTradeWithMultipleRoutes', () => {
    it('throws if input currency does not match route with multiple routes', () => {
      expect(() =>
        Trade.createUncheckedTradeWithMultipleRoutes({
          routes: [
            {
              route: new Route([pool_0_1], token0, token1),
              inputAmount: CurrencyAmount.fromRawAmount(token2, 5000n),
              outputAmount: CurrencyAmount.fromRawAmount(token1, 50000n),
            },
          ],
          tradeType: TradeType.EXACT_INPUT,
        })
      ).toThrow('INPUT_CURRENCY_MATCH')
    })

    it('throws if output currency does not match route with multiple routes', () => {
      expect(() =>
        Trade.createUncheckedTradeWithMultipleRoutes({
          routes: [
            {
              route: new Route([pool_0_1], token0, token1),
              inputAmount: CurrencyAmount.fromRawAmount(token0, 5000n),
              outputAmount: CurrencyAmount.fromRawAmount(token2, 50000n),
            },
          ],
          tradeType: TradeType.EXACT_INPUT,
        })
      ).toThrow('OUTPUT_CURRENCY_MATCH')
    })

    it('can create an exact input trade without simulating', () => {
      const trade = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: new Route([pool_0_1], token0, token1),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 5000n),
            outputAmount: CurrencyAmount.fromRawAmount(token1, 50000n),
          },
          {
            route: new Route([pool_0_2, pool_1_2], token0, token1),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 5000n),
            outputAmount: CurrencyAmount.fromRawAmount(token1, 50000n),
          },
        ],
        tradeType: TradeType.EXACT_INPUT,
      })
      expect(trade.inputAmount.quotient).toBe(10000n)
      expect(trade.outputAmount.quotient).toBe(100000n)
      expect(trade.tradeType).toBe(TradeType.EXACT_INPUT)
    })

    it('can create an exact output trade without simulating', () => {
      const trade = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: new Route([pool_0_1], token0, token1),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 5001n),
            outputAmount: CurrencyAmount.fromRawAmount(token1, 50000n),
          },
          {
            route: new Route([pool_0_2, pool_1_2], token0, token1),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 4999n),
            outputAmount: CurrencyAmount.fromRawAmount(token1, 50000n),
          },
        ],
        tradeType: TradeType.EXACT_OUTPUT,
      })
      expect(trade.tradeType).toBe(TradeType.EXACT_OUTPUT)
      expect(trade.inputAmount.quotient).toBe(10000n)
      expect(trade.outputAmount.quotient).toBe(100000n)
    })
  })

  describe('#route and #swaps', () => {
    const singleRoute = Trade.createUncheckedTrade({
      route: new Route([pool_0_1, pool_1_2], token0, token2),
      inputAmount: CurrencyAmount.fromRawAmount(token0, 100n),
      outputAmount: CurrencyAmount.fromRawAmount(token2, 69n),
      tradeType: TradeType.EXACT_INPUT,
    })
    const multiRoute = Trade.createUncheckedTradeWithMultipleRoutes({
      routes: [
        {
          route: new Route([pool_0_1, pool_1_2], token0, token2),
          inputAmount: CurrencyAmount.fromRawAmount(token0, 50n),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 35n),
        },
        {
          route: new Route([pool_0_2], token0, token2),
          inputAmount: CurrencyAmount.fromRawAmount(token0, 50n),
          outputAmount: CurrencyAmount.fromRawAmount(token2, 34n),
        },
      ],
      tradeType: TradeType.EXACT_INPUT,
    })

    it('can access route for single route trade', () => {
      expect(singleRoute.route).toBeDefined()
    })

    it('can access swaps for single route trade', () => {
      expect(singleRoute.swaps).toBeDefined()
      expect(singleRoute.swaps).toHaveLength(1)
    })

    it('throws if accessing route with multiple routes', () => {
      expect(() => multiRoute.route).toThrow('MULTIPLE_ROUTES')
    })

    it('can access swaps for multi route trade', () => {
      expect(multiRoute.swaps).toBeDefined()
      expect(multiRoute.swaps).toHaveLength(2)
    })
  })

  describe('#worstExecutionPrice', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = Trade.createUncheckedTrade({
        route: new Route([pool_0_1, pool_1_2], token0, token2),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 100n),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 69n),
        tradeType: TradeType.EXACT_INPUT,
      })
      const exactInMultiRoute = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50n),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 35n),
          },
          {
            route: new Route([pool_0_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 50n),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 34n),
          },
        ],
        tradeType: TradeType.EXACT_INPUT,
      })

      it('throws if less than 0', () => {
        expect(() => exactIn.worstExecutionPrice(new Percent(-1, 100))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', () => {
        expect(exactIn.worstExecutionPrice(new Percent(0, 100))).toEqual(exactIn.executionPrice)
      })

      it('returns correct price if nonzero', () => {
        expect(exactIn.worstExecutionPrice(new Percent(0, 100))).toEqual(new Price(token0, token2, 100, 69))
        expect(exactIn.worstExecutionPrice(new Percent(5, 100))).toEqual(new Price(token0, token2, 100, 65))
        expect(exactIn.worstExecutionPrice(new Percent(200, 100))).toEqual(new Price(token0, token2, 100, 23))
      })

      it('returns correct price if nonzero with multiple routes', () => {
        expect(exactInMultiRoute.worstExecutionPrice(new Percent(0, 100))).toEqual(new Price(token0, token2, 100, 69))
        expect(exactInMultiRoute.worstExecutionPrice(new Percent(5, 100))).toEqual(new Price(token0, token2, 100, 65))
        expect(exactInMultiRoute.worstExecutionPrice(new Percent(200, 100))).toEqual(new Price(token0, token2, 100, 23))
      })
    })

    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = Trade.createUncheckedTrade({
        route: new Route([pool_0_1, pool_1_2], token0, token2),
        inputAmount: CurrencyAmount.fromRawAmount(token0, 156n),
        outputAmount: CurrencyAmount.fromRawAmount(token2, 100n),
        tradeType: TradeType.EXACT_OUTPUT,
      })
      const exactOutMultiRoute = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 78n),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 50n),
          },
          {
            route: new Route([pool_0_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 78n),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 50n),
          },
        ],
        tradeType: TradeType.EXACT_OUTPUT,
      })

      it('throws if less than 0', () => {
        expect(() => exactOut.worstExecutionPrice(new Percent(-1, 100))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', () => {
        expect(exactOut.worstExecutionPrice(new Percent(0, 100))).toEqual(exactOut.executionPrice)
      })

      it('returns slippage amount if nonzero', () => {
        expect(
          exactOut.worstExecutionPrice(new Percent(0, 100)).equalTo(new Price(token0, token2, 156, 100))
        ).toBeTruthy()
        expect(
          exactOut.worstExecutionPrice(new Percent(5, 100)).equalTo(new Price(token0, token2, 163, 100))
        ).toBeTruthy()
        expect(
          exactOut.worstExecutionPrice(new Percent(200, 100)).equalTo(new Price(token0, token2, 468, 100))
        ).toBeTruthy()
      })

      it('returns slippage amount if nonzero with multiple routes', () => {
        expect(
          exactOutMultiRoute.worstExecutionPrice(new Percent(0, 100)).equalTo(new Price(token0, token2, 156, 100))
        ).toBeTruthy()
        expect(
          exactOutMultiRoute.worstExecutionPrice(new Percent(5, 100)).equalTo(new Price(token0, token2, 163, 100))
        ).toBeTruthy()
        expect(
          exactOutMultiRoute.worstExecutionPrice(new Percent(200, 100)).equalTo(new Price(token0, token2, 468, 100))
        ).toBeTruthy()
      })
    })
  })

  describe('#priceImpact', () => {
    describe('tradeType = EXACT_INPUT', () => {
      const exactIn = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 100n),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 69n),
          },
        ],
        tradeType: TradeType.EXACT_INPUT,
      })

      it('is cached', () => {
        const first = exactIn.priceImpact
        const second = exactIn.priceImpact
        expect(first).toBe(second)
      })

      it('is correct', () => {
        expect(exactIn.priceImpact.toSignificant(3)).toEqual('17.2')
      })
    })

    describe('tradeType = EXACT_OUTPUT', () => {
      const exactOut = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: new Route([pool_0_1, pool_1_2], token0, token2),
            inputAmount: CurrencyAmount.fromRawAmount(token0, 156n),
            outputAmount: CurrencyAmount.fromRawAmount(token2, 100n),
          },
        ],
        tradeType: TradeType.EXACT_OUTPUT,
      })

      it('is cached', () => {
        const first = exactOut.priceImpact
        const second = exactOut.priceImpact
        expect(first).toBe(second)
      })

      it('is correct', () => {
        expect(exactOut.priceImpact.toSignificant(3)).toEqual('23.1')
      })
    })
  })

  describe('#bestTradeExactIn', () => {
    it('throws with empty pools', async () => {
      await expect(Trade.bestTradeExactIn([], CurrencyAmount.fromRawAmount(token0, 10000n), token2)).rejects.toThrow(
        'POOLS'
      )
    })

    it('throws with max hops of 0', async () => {
      await expect(
        Trade.bestTradeExactIn([pool_0_2], CurrencyAmount.fromRawAmount(token0, 10000n), token2, {
          maxHops: 0,
        })
      ).rejects.toThrow('MAX_HOPS')
    })

    it('provides best route', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, 10000n),
        token2
      )
      expect(result).toHaveLength(2)
      // The best route should be the direct 0 -> 2 route (pool_0_2 has a 10:11 ratio)
      expect(result[0]!.swaps[0]!.route.pools).toHaveLength(1)
      expect(result[0]!.swaps[0]!.route.currencyPath).toEqual([token0, token2])
      expect(result[0]!.inputAmount.equalTo(CurrencyAmount.fromRawAmount(token0, 10000n))).toBeTruthy()
      // The second route should be 2-hop: 0 -> 1 -> 2
      expect(result[1]!.swaps[0]!.route.pools).toHaveLength(2)
      expect(result[1]!.swaps[0]!.route.currencyPath).toEqual([token0, token1, token2])
      expect(result[1]!.inputAmount.equalTo(CurrencyAmount.fromRawAmount(token0, 10000n))).toBeTruthy()
    })

    it('respects maxHops', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, 10n),
        token2,
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.swaps[0]!.route.pools).toHaveLength(1)
      expect(result[0]!.swaps[0]!.route.currencyPath).toEqual([token0, token2])
    })

    it('respects n', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_2, pool_1_2],
        CurrencyAmount.fromRawAmount(token0, 10n),
        token2,
        { maxNumResults: 1 }
      )
      expect(result).toHaveLength(1)
    })

    it('no path', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.fromRawAmount(token0, 10n),
        token2
      )
      expect(result).toHaveLength(0)
    })

    it('works with ETHER input', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_eth_0, pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.fromRawAmount(ETHER, 100n),
        token3
      )
      expect(result).toHaveLength(2)
      expect(result[0]!.inputAmount.currency).toEqual(ETHER)
      expect(result[0]!.outputAmount.currency).toEqual(token3)
    })

    it('works with ETHER output', async () => {
      const result = await Trade.bestTradeExactIn(
        [pool_eth_0, pool_0_1, pool_0_3, pool_1_3],
        CurrencyAmount.fromRawAmount(token3, 100n),
        ETHER
      )
      expect(result).toHaveLength(2)
      expect(result[0]!.inputAmount.currency).toEqual(token3)
      expect(result[0]!.outputAmount.currency).toEqual(ETHER)
    })
  })

  describe('#maximumAmountIn', () => {
    describe('tradeType = EXACT_INPUT', () => {
      it('throws if less than 0', async () => {
        const exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, 100n),
          TradeType.EXACT_INPUT
        )
        expect(() => exactIn.maximumAmountIn(new Percent(-1n, 100n))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', async () => {
        const exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, 100n),
          TradeType.EXACT_INPUT
        )
        expect(exactIn.maximumAmountIn(new Percent(0n, 100n))).toEqual(exactIn.inputAmount)
      })

      it('returns exact if nonzero', async () => {
        const exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, 100n),
          TradeType.EXACT_INPUT
        )
        expect(
          exactIn.maximumAmountIn(new Percent(0n, 100n)).equalTo(CurrencyAmount.fromRawAmount(token0, 100n))
        ).toBeTruthy()
        expect(
          exactIn.maximumAmountIn(new Percent(5n, 100n)).equalTo(CurrencyAmount.fromRawAmount(token0, 100n))
        ).toBeTruthy()
        expect(
          exactIn.maximumAmountIn(new Percent(200n, 100n)).equalTo(CurrencyAmount.fromRawAmount(token0, 100n))
        ).toBeTruthy()
      })
    })

    describe('tradeType = EXACT_OUTPUT', () => {
      it('throws if less than 0', async () => {
        const exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 10000n),
          TradeType.EXACT_OUTPUT
        )
        expect(() => exactOut.maximumAmountIn(new Percent(-1n, 10000n))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', async () => {
        const exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 10000n),
          TradeType.EXACT_OUTPUT
        )
        expect(exactOut.maximumAmountIn(new Percent(0n, 10000n))).toEqual(exactOut.inputAmount)
      })

      it('returns slippage amount if nonzero', async () => {
        const exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 10000n),
          TradeType.EXACT_OUTPUT
        )
        // For exact output, maximumAmountIn applies slippage to the input
        expect(exactOut.maximumAmountIn(new Percent(0n, 100n))).toEqual(exactOut.inputAmount)
        // With 5% slippage, max input should be larger than the computed input
        const maxIn5 = exactOut.maximumAmountIn(new Percent(5n, 100n))
        expect(maxIn5.greaterThan(exactOut.inputAmount) || maxIn5.equalTo(exactOut.inputAmount)).toBeTruthy()
      })
    })
  })

  describe('#minimumAmountOut', () => {
    describe('tradeType = EXACT_INPUT', () => {
      it('throws if less than 0', async () => {
        const exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, 10000n),
          TradeType.EXACT_INPUT
        )
        expect(() => exactIn.minimumAmountOut(new Percent(-1n, 100n))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', async () => {
        const exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, 10000n),
          TradeType.EXACT_INPUT
        )
        expect(exactIn.minimumAmountOut(new Percent(0n, 10000n))).toEqual(exactIn.outputAmount)
      })

      it('returns slippage amount if nonzero', async () => {
        const exactIn = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token0, 10000n),
          TradeType.EXACT_INPUT
        )
        // With 0% slippage, minimum out equals the output
        expect(exactIn.minimumAmountOut(new Percent(0n, 100n))).toEqual(exactIn.outputAmount)
        // With slippage > 0, minimum out should be less than output
        const minOut5 = exactIn.minimumAmountOut(new Percent(5n, 100n))
        expect(minOut5.lessThan(exactIn.outputAmount) || minOut5.equalTo(exactIn.outputAmount)).toBeTruthy()
        const minOut200 = exactIn.minimumAmountOut(new Percent(200n, 100n))
        expect(minOut200.lessThan(minOut5) || minOut200.equalTo(minOut5)).toBeTruthy()
      })
    })

    describe('tradeType = EXACT_OUTPUT', () => {
      it('throws if less than 0', async () => {
        const exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 100n),
          TradeType.EXACT_OUTPUT
        )
        expect(() => exactOut.minimumAmountOut(new Percent(-1n, 100n))).toThrow('SLIPPAGE_TOLERANCE')
      })

      it('returns exact if 0', async () => {
        const exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 100n),
          TradeType.EXACT_OUTPUT
        )
        expect(exactOut.minimumAmountOut(new Percent(0n, 100n))).toEqual(exactOut.outputAmount)
      })

      it('returns exact if nonzero', async () => {
        const exactOut = await Trade.fromRoute(
          new Route([pool_0_1, pool_1_2], token0, token2),
          CurrencyAmount.fromRawAmount(token2, 100n),
          TradeType.EXACT_OUTPUT
        )
        expect(
          exactOut.minimumAmountOut(new Percent(0n, 100n)).equalTo(CurrencyAmount.fromRawAmount(token2, 100n))
        ).toBeTruthy()
        expect(
          exactOut.minimumAmountOut(new Percent(5n, 100n)).equalTo(CurrencyAmount.fromRawAmount(token2, 100n))
        ).toBeTruthy()
        expect(
          exactOut.minimumAmountOut(new Percent(200n, 100n)).equalTo(CurrencyAmount.fromRawAmount(token2, 100n))
        ).toBeTruthy()
      })
    })
  })

  describe('#bestTradeExactOut', () => {
    it('throws with empty pools', async () => {
      await expect(Trade.bestTradeExactOut([], token0, CurrencyAmount.fromRawAmount(token2, 100n))).rejects.toThrow(
        'POOLS'
      )
    })

    it('throws with max hops of 0', async () => {
      await expect(
        Trade.bestTradeExactOut([pool_0_2], token0, CurrencyAmount.fromRawAmount(token2, 100n), {
          maxHops: 0,
        })
      ).rejects.toThrow('MAX_HOPS')
    })

    it('provides best route', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, 10000n)
      )
      expect(result).toHaveLength(2)
      // The best route should be the direct 0 -> 2 route
      expect(result[0]!.swaps[0]!.route.pools).toHaveLength(1)
      expect(result[0]!.swaps[0]!.route.currencyPath).toEqual([token0, token2])
      expect(result[0]!.outputAmount.equalTo(CurrencyAmount.fromRawAmount(token2, 10000n))).toBeTruthy()
      // The second route should be 2-hop: 0 -> 1 -> 2
      expect(result[1]!.swaps[0]!.route.pools).toHaveLength(2)
      expect(result[1]!.swaps[0]!.route.currencyPath).toEqual([token0, token1, token2])
      expect(result[1]!.outputAmount.equalTo(CurrencyAmount.fromRawAmount(token2, 10000n))).toBeTruthy()
    })

    it('respects maxHops', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, 10n),
        { maxHops: 1 }
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.swaps[0]!.route.pools).toHaveLength(1)
      expect(result[0]!.swaps[0]!.route.currencyPath).toEqual([token0, token2])
    })

    it('respects n', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_2, pool_1_2],
        token0,
        CurrencyAmount.fromRawAmount(token2, 10n),
        { maxNumResults: 1 }
      )
      expect(result).toHaveLength(1)
    })

    it('no path', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_0_1, pool_0_3, pool_1_3],
        token0,
        CurrencyAmount.fromRawAmount(token2, 10n)
      )
      expect(result).toHaveLength(0)
    })

    it('works with ETHER input', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_eth_0, pool_0_1, pool_0_3, pool_1_3],
        ETHER,
        CurrencyAmount.fromRawAmount(token3, 10000n)
      )
      expect(result).toHaveLength(2)
      expect(result[0]!.inputAmount.currency).toEqual(ETHER)
      expect(result[0]!.outputAmount.currency).toEqual(token3)
    })

    it('works with ETHER output', async () => {
      const result = await Trade.bestTradeExactOut(
        [pool_eth_0, pool_0_1, pool_0_3, pool_1_3],
        token3,
        CurrencyAmount.fromRawAmount(ETHER, 100n)
      )
      expect(result).toHaveLength(2)
      expect(result[0]!.inputAmount.currency).toEqual(token3)
      expect(result[0]!.outputAmount.currency).toEqual(ETHER)
    })
  })
})
