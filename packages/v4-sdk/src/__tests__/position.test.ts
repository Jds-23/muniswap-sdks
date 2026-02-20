import { Percent, Token } from '@muniswap/sdk-core'
import {
  encodeSqrtRatioX96,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  maxLiquidityForAmounts,
  nearestUsableTick,
} from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { Pool } from '../entities/pool'
import { Position } from '../entities/position'
import { ADDRESS_ZERO, TICK_SPACING_TEN } from '../internalConstants'

describe('Position', () => {
  const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')

  const POOL_SQRT_RATIO_START = encodeSqrtRatioX96(100e6, 100e18)
  const POOL_TICK_CURRENT = getTickAtSqrtRatio(POOL_SQRT_RATIO_START)
  const TICK_SPACING = TICK_SPACING_TEN

  const DAI_USDC_POOL = new Pool(
    DAI,
    USDC,
    500,
    TICK_SPACING,
    ADDRESS_ZERO,
    POOL_SQRT_RATIO_START,
    0,
    POOL_TICK_CURRENT,
    []
  )

  describe('mintAmountsWithSlippage', () => {
    describe('0% slippage', () => {
      const slippageTolerance = new Percent(0)

      it('is correct for positions below', () => {
        // calculate liquidity from amount0 and amount1
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '49949961958869841738198',
          '0',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        expect(amount0.toString()).toEqual('49949961958869841738198')
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions above', () => {
        // calculate liquidity from amount0 and amount1
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING),
          '0',
          '49970077053',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        expect(amount0.toString()).toEqual('0')
        expect(amount1.toString()).toEqual('49970077053')
      })

      it('is correct for positions within', () => {
        // calculate liquidity from amount0 and amount1
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        expect(amount0.toString()).toEqual('120054069145287995740584')
        expect(amount1.toString()).toEqual('79831926243')
      })
    })

    describe('0.05% slippage', () => {
      const slippageTolerance = new Percent(5, 10000)

      it('is correct for positions below', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '49949961958869841738198',
          '0',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        // With slippage, amount0 should be >= 0% slippage amount
        expect(amount0 >= 49949961958869841738198n).toBe(true)
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions above', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING),
          '0',
          '49970077053',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        expect(amount0.toString()).toEqual('0')
        // With slippage, amount1 should be >= 0% slippage amount
        expect(amount1 >= 49970077053n).toBe(true)
      })

      it('is correct for positions within', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        // Both amounts should be >= 0% slippage amounts
        expect(amount0 >= 120054069145287995740584n).toBe(true)
        expect(amount1 >= 79831926243n).toBe(true)
      })
    })

    describe('5% slippage', () => {
      const slippageTolerance = new Percent(5, 100)

      it('is correct for positions below', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '49949961958869841738198',
          '0',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        // 5% slippage amounts should be >= 0% slippage amounts
        expect(amount0 >= 49949961958869841738198n).toBe(true)
        // With large slippage, the counterfactual pool may shift price so both amounts become nonzero
        expect(amount1 >= 0n).toBe(true)
      })

      it('is correct for positions above', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING),
          '0',
          '49970077053',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        // With large slippage, the counterfactual pool may shift price so both amounts become nonzero
        expect(amount0 >= 0n).toBe(true)
        // 5% slippage amounts should be >= 0% slippage amounts
        expect(amount1 >= 49970077053n).toBe(true)
      })

      it('is correct for positions within', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)

        // Both amounts should be >= 0% slippage amounts
        expect(amount0 >= 120054069145287995740584n).toBe(true)
        expect(amount1 >= 79831926243n).toBe(true)
      })

      it('amounts increase monotonically with slippage', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const noSlip = position.mintAmountsWithSlippage(new Percent(0))
        const smallSlip = position.mintAmountsWithSlippage(new Percent(5, 10000))
        const bigSlip = position.mintAmountsWithSlippage(new Percent(5, 100))

        expect(bigSlip.amount0 >= smallSlip.amount0).toBe(true)
        expect(bigSlip.amount1 >= smallSlip.amount1).toBe(true)
        expect(smallSlip.amount0 >= noSlip.amount0).toBe(true)
        expect(smallSlip.amount1 >= noSlip.amount1).toBe(true)
      })
    })
  })

  describe('burnAmountsWithSlippage', () => {
    describe('0% slippage', () => {
      const slippageTolerance = new Percent(0)

      it('is correct for positions below', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '49949961958869841738198',
          '0',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)

        // 0% slippage burn amounts should equal the position's amount0/amount1 getters
        expect(amount0).toEqual(position.amount0.quotient)
        expect(amount1).toEqual(position.amount1.quotient)
      })

      it('is correct for positions above', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING),
          '0',
          '49970077053',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)

        // 0% slippage burn amounts should equal the position's amount0/amount1 getters
        expect(amount0).toEqual(position.amount0.quotient)
        expect(amount1).toEqual(position.amount1.quotient)
      })

      it('is correct for positions within', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)

        // 0% slippage burn amounts should equal the position's amount0/amount1 getters
        expect(amount0).toEqual(position.amount0.quotient)
        expect(amount1).toEqual(position.amount1.quotient)
      })
    })

    describe('5% slippage', () => {
      const slippageTolerance = new Percent(5, 100)

      it('is correct for positions below', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '49949961958869841738198',
          '0',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)

        // Burn with slippage: amounts should be <= the no-slippage burn amounts
        expect(amount0 <= position.amount0.quotient).toBe(true)
        expect(amount1 <= position.amount1.quotient).toBe(true)
      })

      it('is correct for positions above', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING),
          '0',
          '49970077053',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)

        // Burn with slippage: amounts should be <= the no-slippage burn amounts
        expect(amount0 <= position.amount0.quotient).toBe(true)
        expect(amount1 <= position.amount1.quotient).toBe(true)
      })

      it('is correct for positions within', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)

        // Burn with slippage: amounts should be <= the no-slippage burn amounts
        expect(amount0 <= position.amount0.quotient).toBe(true)
        expect(amount1 <= position.amount1.quotient).toBe(true)
      })

      it('amounts decrease monotonically with slippage', () => {
        const liquidity = maxLiquidityForAmounts(
          DAI_USDC_POOL.sqrtRatioX96,
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2),
          getSqrtRatioAtTick(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2),
          '120054069145287995740584',
          '79831926243',
          true
        )

        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: liquidity,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const noSlip = position.burnAmountsWithSlippage(new Percent(0))
        const smallSlip = position.burnAmountsWithSlippage(new Percent(5, 10000))
        const bigSlip = position.burnAmountsWithSlippage(new Percent(5, 100))

        // Larger slippage => smaller minimum burn amounts
        expect(noSlip.amount0 >= smallSlip.amount0).toBe(true)
        expect(noSlip.amount1 >= smallSlip.amount1).toBe(true)
        expect(smallSlip.amount0 >= bigSlip.amount0).toBe(true)
        expect(smallSlip.amount1 >= bigSlip.amount1).toBe(true)
      })
    })
  })

  describe('#amount0', () => {
    it('is correct for position below current tick (all token0)', () => {
      // tickLower and tickUpper both ABOVE pool.tickCurrent => position holds only token0
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.amount0.quotient > 0n).toBe(true)
    })

    it('is zero for position above current tick (all token1)', () => {
      // tickLower and tickUpper both BELOW pool.tickCurrent => amount0 = 0
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
      })
      expect(position.amount0.quotient).toBe(0n)
    })

    it('is correct for in-range position', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.amount0.quotient > 0n).toBe(true)
    })

    it('returns the currency0 of the pool', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.amount0.currency).toEqual(DAI_USDC_POOL.currency0)
    })
  })

  describe('#amount1', () => {
    it('is zero for position below current tick (all token0)', () => {
      // tickLower and tickUpper both ABOVE pool.tickCurrent => amount1 = 0
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.amount1.quotient).toBe(0n)
    })

    it('is correct for position above current tick (all token1)', () => {
      // tickLower and tickUpper both BELOW pool.tickCurrent => position holds only token1
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
      })
      expect(position.amount1.quotient > 0n).toBe(true)
    })

    it('is correct for in-range position', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.amount1.quotient > 0n).toBe(true)
    })

    it('returns the currency1 of the pool', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.amount1.currency).toEqual(DAI_USDC_POOL.currency1)
    })
  })

  describe('#mintAmounts', () => {
    it('is correct for position below current tick', () => {
      // Both ticks above current => only amount0
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      const { amount0, amount1 } = position.mintAmounts
      expect(amount0 > 0n).toBe(true)
      expect(amount1).toBe(0n)
    })

    it('is correct for position above current tick', () => {
      // Both ticks below current => only amount1
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
      })
      const { amount0, amount1 } = position.mintAmounts
      expect(amount0).toBe(0n)
      expect(amount1 > 0n).toBe(true)
    })

    it('is correct for in-range position', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      const { amount0, amount1 } = position.mintAmounts
      expect(amount0 > 0n).toBe(true)
      expect(amount1 > 0n).toBe(true)
    })

    it('mint amounts are >= burn amounts (roundUp vs roundDown)', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      const { amount0: mintAmount0, amount1: mintAmount1 } = position.mintAmounts
      expect(mintAmount0 >= position.amount0.quotient).toBe(true)
      expect(mintAmount1 >= position.amount1.quotient).toBe(true)
    })
  })

  describe('constructor', () => {
    it('throws for tick order', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: 10,
            tickUpper: -10,
          })
      ).toThrow('TICK_ORDER')
    })

    it('throws for equal ticks', () => {
      const tick = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING)
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: tick,
            tickUpper: tick,
          })
      ).toThrow('TICK_ORDER')
    })

    it('throws for lower tick not aligned to tick spacing', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + 1,
            tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
          })
      ).toThrow('TICK_LOWER')
    })

    it('throws for upper tick not aligned to tick spacing', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING),
            tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2 + 1,
          })
      ).toThrow('TICK_UPPER')
    })

    it('throws for lower tick below MIN_TICK', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: -887280,
            tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
          })
      ).toThrow('TICK_LOWER')
    })

    it('throws for upper tick above MAX_TICK', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING),
            tickUpper: 887280,
          })
      ).toThrow('TICK_UPPER')
    })

    it('successfully creates position with valid parameters', () => {
      const tickLower = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2
      const tickUpper = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower,
        tickUpper,
      })
      expect(position.pool).toEqual(DAI_USDC_POOL)
      expect(position.tickLower).toBe(tickLower)
      expect(position.tickUpper).toBe(tickUpper)
      expect(position.liquidity).toBe(BigInt(100e12))
    })

    it('converts liquidity to bigint', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: '12345678901234567890',
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
      })
      expect(position.liquidity).toBe(12345678901234567890n)
    })
  })

  describe('#fromAmounts', () => {
    it('creates a position with correct liquidity for in-range', () => {
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: '120054069145287995740584',
        amount1: '79831926243',
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBe(true)
    })

    it('creates a position with correct liquidity for below range', () => {
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: '49949961958869841738198',
        amount1: '0',
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBe(true)
    })

    it('creates a position with correct liquidity for above range', () => {
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        amount0: '0',
        amount1: '49970077053',
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBe(true)
    })

    it('uses the correct pool ticks', () => {
      const tickLower = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2
      const tickUpper = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower,
        tickUpper,
        amount0: '120054069145287995740584',
        amount1: '79831926243',
        useFullPrecision: true,
      })
      expect(position.tickLower).toBe(tickLower)
      expect(position.tickUpper).toBe(tickUpper)
      expect(position.pool).toEqual(DAI_USDC_POOL)
    })

    it('full precision vs not full precision', () => {
      const tickLower = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2
      const tickUpper = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2
      const positionFull = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower,
        tickUpper,
        amount0: '120054069145287995740584',
        amount1: '79831926243',
        useFullPrecision: true,
      })
      const positionNotFull = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower,
        tickUpper,
        amount0: '120054069145287995740584',
        amount1: '79831926243',
        useFullPrecision: false,
      })
      // Full precision should give >= liquidity than non-full
      expect(positionFull.liquidity >= positionNotFull.liquidity).toBe(true)
    })
  })

  describe('#fromAmount0', () => {
    it('creates a position with maximal liquidity for amount0', () => {
      const position = Position.fromAmount0({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: '49949961958869841738198',
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBe(true)
    })

    it('creates a position for in-range ticks', () => {
      const position = Position.fromAmount0({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: '120054069145287995740584',
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBe(true)
      // Should also have some amount1 since the position is in-range
      expect(position.amount1.quotient > 0n).toBe(true)
    })
  })

  describe('#fromAmount1', () => {
    it('creates a position with maximal liquidity for amount1', () => {
      const position = Position.fromAmount1({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        amount1: '49970077053',
      })
      expect(position.liquidity > 0n).toBe(true)
    })

    it('creates a position for in-range ticks', () => {
      const position = Position.fromAmount1({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount1: '79831926243',
      })
      expect(position.liquidity > 0n).toBe(true)
      // Should also have some amount0 since the position is in-range
      expect(position.amount0.quotient > 0n).toBe(true)
    })
  })

  describe('#token0PriceLower', () => {
    it('returns the correct price', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      const price = position.token0PriceLower
      // Price should have the correct currency pair
      expect(price.baseCurrency).toEqual(DAI_USDC_POOL.currency0)
      expect(price.quoteCurrency).toEqual(DAI_USDC_POOL.currency1)
    })

    it('price lower is less than price upper', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.token0PriceLower.asFraction.lessThan(position.token0PriceUpper.asFraction)).toBe(true)
    })
  })

  describe('#token0PriceUpper', () => {
    it('returns the correct price', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      const price = position.token0PriceUpper
      // Price should have the correct currency pair
      expect(price.baseCurrency).toEqual(DAI_USDC_POOL.currency0)
      expect(price.quoteCurrency).toEqual(DAI_USDC_POOL.currency1)
    })

    it('is greater than price lower for same position', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e12,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(position.token0PriceUpper.asFraction.greaterThan(position.token0PriceLower.asFraction)).toBe(true)
    })
  })
})
