import { CurrencyAmount, Percent, Token, TradeType, WETH9 } from '@muniswap/sdk-core'
import { encodeSqrtRatioX96 } from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { Pool } from '../entities/pool'
import { Route } from '../entities/route'
import { Trade } from '../entities/trade'
import { ADDRESS_ZERO, FEE_AMOUNT_MEDIUM, TICK_SPACING_TEN } from '../internalConstants'
import { Actions, V4Planner } from './v4Planner'

describe('V4Planner', () => {
  const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  const WETH = WETH9[1]!

  const pool_DAI_USDC = new Pool(
    DAI,
    USDC,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  const pool_USDC_WETH = new Pool(
    USDC,
    WETH,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  const pool_DAI_WETH = new Pool(
    DAI,
    WETH,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  const recipient = '0x0000000000000000000000000000000000000003'

  describe('addAction', () => {
    it('encodes v4 swap exactInSingle', () => {
      const planner = new V4Planner()
      const poolKey = pool_DAI_USDC.poolKey

      planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
        {
          poolKey,
          zeroForOne: true,
          amountIn: 10000n,
          amountOutMinimum: 0n,
          hookData: '0x',
        },
      ])

      // Actions.SWAP_EXACT_IN_SINGLE = 0x06
      expect(planner.actions).toContain('06')
      expect(planner.params).toHaveLength(1)
    })
  })

  describe('addTrade', () => {
    it('encodes exactIn 2-hop swap', () => {
      const route = new Route([pool_DAI_USDC, pool_USDC_WETH], DAI, WETH)
      const trade = Trade.createUncheckedTrade({
        route,
        inputAmount: CurrencyAmount.fromRawAmount(DAI, 100n),
        outputAmount: CurrencyAmount.fromRawAmount(WETH, 90n),
        tradeType: TradeType.EXACT_INPUT,
      })

      const planner = new V4Planner()
      planner.addTrade(trade)

      // Actions.SWAP_EXACT_IN = 0x07
      expect(planner.actions).toContain('07')
      expect(planner.params).toHaveLength(1)
    })

    it('encodes exactOut 2-hop swap', () => {
      const route = new Route([pool_DAI_USDC, pool_USDC_WETH], DAI, WETH)
      const trade = Trade.createUncheckedTrade({
        route,
        inputAmount: CurrencyAmount.fromRawAmount(DAI, 110n),
        outputAmount: CurrencyAmount.fromRawAmount(WETH, 100n),
        tradeType: TradeType.EXACT_OUTPUT,
      })

      const planner = new V4Planner()
      planner.addTrade(trade, new Percent(5, 100))

      // Actions.SWAP_EXACT_OUT = 0x09
      expect(planner.actions).toContain('09')
      expect(planner.params).toHaveLength(1)
    })

    it('throws if adding exactOut trade without slippageTolerance', () => {
      const route = new Route([pool_DAI_USDC, pool_USDC_WETH], DAI, WETH)
      const trade = Trade.createUncheckedTrade({
        route,
        inputAmount: CurrencyAmount.fromRawAmount(DAI, 110n),
        outputAmount: CurrencyAmount.fromRawAmount(WETH, 100n),
        tradeType: TradeType.EXACT_OUTPUT,
      })

      const planner = new V4Planner()
      expect(() => planner.addTrade(trade)).toThrow('ExactOut requires slippageTolerance')
    })

    it('throws if trade has multiple routes', () => {
      const route1 = new Route([pool_DAI_USDC, pool_USDC_WETH], DAI, WETH)
      const route2 = new Route([pool_DAI_WETH], DAI, WETH)

      const trade = Trade.createUncheckedTradeWithMultipleRoutes({
        routes: [
          {
            route: route1,
            inputAmount: CurrencyAmount.fromRawAmount(DAI, 50n),
            outputAmount: CurrencyAmount.fromRawAmount(WETH, 40n),
          },
          {
            route: route2,
            inputAmount: CurrencyAmount.fromRawAmount(DAI, 50n),
            outputAmount: CurrencyAmount.fromRawAmount(WETH, 45n),
          },
        ],
        tradeType: TradeType.EXACT_INPUT,
      })

      const planner = new V4Planner()
      expect(() => planner.addTrade(trade)).toThrow('Only accepts Trades with 1 swap')
    })
  })

  describe('addSettle', () => {
    it('without amount uses OPEN_DELTA', () => {
      const planner = new V4Planner()
      planner.addSettle(DAI, true)

      // Actions.SETTLE = 0x0b
      expect(planner.actions).toContain('0b')
      expect(planner.params).toHaveLength(1)
    })

    it('with amount', () => {
      const planner = new V4Planner()
      planner.addSettle(DAI, true, 100n)

      expect(planner.actions).toContain('0b')
      expect(planner.params).toHaveLength(1)
    })

    it('payerIsUser false', () => {
      const planner = new V4Planner()
      planner.addSettle(DAI, false)

      expect(planner.actions).toContain('0b')
      expect(planner.params).toHaveLength(1)
    })
  })

  describe('addTake', () => {
    it('without amount uses OPEN_DELTA', () => {
      const planner = new V4Planner()
      planner.addTake(DAI, recipient)

      // Actions.TAKE = 0x0e
      expect(planner.actions).toContain('0e')
      expect(planner.params).toHaveLength(1)
    })

    it('with amount', () => {
      const planner = new V4Planner()
      planner.addTake(DAI, recipient, 100n)

      expect(planner.actions).toContain('0e')
      expect(planner.params).toHaveLength(1)
    })
  })
})
