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
  })
})
