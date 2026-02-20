import { Percent, Token } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { nearestUsableTick } from '../utils/nearestUsableTick'
import { MAX_SQRT_RATIO, MAX_TICK, MIN_SQRT_RATIO, MIN_TICK, getTickAtSqrtRatio } from '../utils/tickMath'
import { Pool } from './pool'
import { Position } from './position'

describe('Position', () => {
  const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  const POOL_SQRT_RATIO_START = encodeSqrtRatioX96(100e6, 100e18)
  const POOL_TICK_CURRENT = getTickAtSqrtRatio(POOL_SQRT_RATIO_START)
  const TICK_SPACING = TICK_SPACINGS[FeeAmount.LOW]
  const DAI_USDC_POOL = new Pool(DAI, USDC, FeeAmount.LOW, POOL_SQRT_RATIO_START, 0, POOL_TICK_CURRENT, [])

  describe('constructor', () => {
    it('can be constructed around 0 tick', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 1,
        tickLower: -10,
        tickUpper: 10,
      })
      expect(position.liquidity).toEqual(1n)
    })

    it('can use min and max ticks', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 1,
        tickLower: nearestUsableTick(MIN_TICK, TICK_SPACING),
        tickUpper: nearestUsableTick(MAX_TICK, TICK_SPACING),
      })
      expect(position.liquidity).toEqual(1n)
    })

    it('tick lower must be less than tick upper', () => {
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

    it('tick lower cannot equal tick upper', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: -10,
            tickUpper: -10,
          })
      ).toThrow('TICK_ORDER')
    })

    it('tick lower must be multiple of tick spacing', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: -5,
            tickUpper: 10,
          })
      ).toThrow('TICK_LOWER')
    })

    it('tick lower must be greater than or equal to MIN_TICK', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: nearestUsableTick(MIN_TICK, TICK_SPACING) - TICK_SPACING,
            tickUpper: 10,
          })
      ).toThrow('TICK_LOWER')
    })

    it('tick upper must be multiple of tick spacing', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: -10,
            tickUpper: 15,
          })
      ).toThrow('TICK_UPPER')
    })

    it('tick upper must be less than or equal to MAX_TICK', () => {
      expect(
        () =>
          new Position({
            pool: DAI_USDC_POOL,
            liquidity: 1,
            tickLower: -10,
            tickUpper: nearestUsableTick(MAX_TICK, TICK_SPACING) + TICK_SPACING,
          })
      ).toThrow('TICK_UPPER')
    })
  })

  describe('#amount0', () => {
    it('is correct for price above', () => {
      expect(
        new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e12,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        }).amount0.quotient.toString()
      ).toEqual('49949961958869841')
    })

    it('is correct for price below', () => {
      expect(
        new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        }).amount0.quotient.toString()
      ).toEqual('0')
    })

    it('is correct for in-range position', () => {
      expect(
        new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        }).amount0.quotient.toString()
      ).toEqual('120054069145287995769396')
    })
  })

  describe('#amount1', () => {
    it('is correct for price above', () => {
      expect(
        new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        }).amount1.quotient.toString()
      ).toEqual('0')
    })

    it('is correct for price below', () => {
      expect(
        new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        }).amount1.quotient.toString()
      ).toEqual('49970077052')
    })

    it('is correct for in-range position', () => {
      expect(
        new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        }).amount1.quotient.toString()
      ).toEqual('79831926242')
    })
  })

  describe('#mintAmounts', () => {
    it('is correct for price above', () => {
      const { amount0, amount1 } = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e18,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      }).mintAmounts
      expect(amount0.toString()).toEqual('49949961958869841754182')
      expect(amount1.toString()).toEqual('0')
    })

    it('is correct for price below', () => {
      const { amount0, amount1 } = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e18,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
      }).mintAmounts
      expect(amount0.toString()).toEqual('0')
      expect(amount1.toString()).toEqual('49970077053')
    })

    it('is correct for in-range position', () => {
      const { amount0, amount1 } = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e18,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      }).mintAmounts
      // note these are rounded up
      expect(amount0.toString()).toEqual('120054069145287995769397')
      expect(amount1.toString()).toEqual('79831926243')
    })
  })

  describe('#mintAmountsWithSlippage', () => {
    describe('0 slippage', () => {
      const slippageTolerance = new Percent(0)

      it('is correct for positions below (price above range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        // With 0 slippage, multiplier is 1/1, so results = mintAmounts
        expect(amount0.toString()).toEqual(position.mintAmounts.amount0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions above (price below range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual('0')
        expect(amount1.toString()).toEqual(position.mintAmounts.amount1.toString())
      })

      it('is correct for positions within', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual(position.mintAmounts.amount0.toString())
        expect(amount1.toString()).toEqual(position.mintAmounts.amount1.toString())
      })
    })

    describe('0.05% slippage', () => {
      const slippageTolerance = new Percent(5, 10000)

      it('is correct for positions below (price above range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        // Multiplicative: mintAmount0 * 10005/10000
        const expected0 = (position.mintAmounts.amount0 * 10005n) / 10000n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions above (price below range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual('0')
        // Multiplicative: mintAmount1 * 10005/10000
        const expected1 = (position.mintAmounts.amount1 * 10005n) / 10000n
        expect(amount1.toString()).toEqual(expected1.toString())
      })

      it('is correct for positions within', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        // Multiplicative: mintAmount * 10005/10000
        const expected0 = (position.mintAmounts.amount0 * 10005n) / 10000n
        const expected1 = (position.mintAmounts.amount1 * 10005n) / 10000n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual(expected1.toString())
      })
    })

    describe('5% slippage', () => {
      const slippageTolerance = new Percent(5, 100)

      it('is correct for positions below (price above range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        // Multiplicative: mintAmount0 * 105/100
        const expected0 = (position.mintAmounts.amount0 * 105n) / 100n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions within', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        const expected0 = (position.mintAmounts.amount0 * 105n) / 100n
        const expected1 = (position.mintAmounts.amount1 * 105n) / 100n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual(expected1.toString())
      })

      it('is correct for pool at min price', () => {
        const position = new Position({
          pool: new Pool(DAI, USDC, FeeAmount.LOW, MIN_SQRT_RATIO, 0, MIN_TICK, []),
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        // Pool at min price: all liquidity in token0 for ticks above current
        const expected0 = (position.mintAmounts.amount0 * 105n) / 100n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for pool at max price', () => {
        const position = new Position({
          pool: new Pool(DAI, USDC, FeeAmount.LOW, MAX_SQRT_RATIO - 1n, 0, MAX_TICK - 1, []),
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.mintAmountsWithSlippage(slippageTolerance)
        // Pool at max price: all liquidity in token1 for ticks below current
        expect(amount0.toString()).toEqual('0')
        const expected1 = (position.mintAmounts.amount1 * 105n) / 100n
        expect(amount1.toString()).toEqual(expected1.toString())
      })
    })
  })

  describe('#burnAmountsWithSlippage', () => {
    describe('0 slippage', () => {
      const slippageTolerance = new Percent(0)

      it('is correct for positions below (price above range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        // With 0 slippage, multiplier is 1/1, so results = burn amounts (amount0, amount1)
        expect(amount0.toString()).toEqual(position.amount0.quotient.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions above (price below range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual('0')
        expect(amount1.toString()).toEqual(position.amount1.quotient.toString())
      })

      it('is correct for positions within', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual(position.amount0.quotient.toString())
        expect(amount1.toString()).toEqual(position.amount1.quotient.toString())
      })
    })

    describe('0.05% slippage', () => {
      const slippageTolerance = new Percent(5, 10000)

      it('is correct for positions below (price above range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        // Multiplicative: burnAmount0 * 10000/10005
        const expected0 = (position.amount0.quotient * 10000n) / 10005n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions above (price below range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual('0')
        const expected1 = (position.amount1.quotient * 10000n) / 10005n
        expect(amount1.toString()).toEqual(expected1.toString())
      })

      it('is correct for positions within', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        const expected0 = (position.amount0.quotient * 10000n) / 10005n
        const expected1 = (position.amount1.quotient * 10000n) / 10005n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual(expected1.toString())
      })
    })

    describe('5% slippage', () => {
      const slippageTolerance = new Percent(5, 100)

      it('is correct for positions below (price above range)', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        // Multiplicative: burnAmount0 * 100/105
        const expected0 = (position.amount0.quotient * 100n) / 105n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for positions within', () => {
        const position = new Position({
          pool: DAI_USDC_POOL,
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        const expected0 = (position.amount0.quotient * 100n) / 105n
        const expected1 = (position.amount1.quotient * 100n) / 105n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual(expected1.toString())
      })

      it('is correct for pool at min price', () => {
        const position = new Position({
          pool: new Pool(DAI, USDC, FeeAmount.LOW, MIN_SQRT_RATIO, 0, MIN_TICK, []),
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        const expected0 = (position.amount0.quotient * 100n) / 105n
        expect(amount0.toString()).toEqual(expected0.toString())
        expect(amount1.toString()).toEqual('0')
      })

      it('is correct for pool at max price', () => {
        const position = new Position({
          pool: new Pool(DAI, USDC, FeeAmount.LOW, MAX_SQRT_RATIO - 1n, 0, MAX_TICK - 1, []),
          liquidity: 100e18,
          tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
          tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        })

        const { amount0, amount1 } = position.burnAmountsWithSlippage(slippageTolerance)
        expect(amount0.toString()).toEqual('0')
        const expected1 = (position.amount1.quotient * 100n) / 105n
        expect(amount1.toString()).toEqual(expected1.toString())
      })
    })
  })

  describe('#fromAmounts', () => {
    it('creates position from both token amounts', () => {
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: 100e18,
        amount1: 100e6,
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBeTruthy()
      expect(position.tickLower).toEqual(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2)
      expect(position.tickUpper).toEqual(nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2)
    })

    it('creates position below current price', () => {
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        amount0: 0,
        amount1: 100e6,
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBeTruthy()
    })

    it('creates position above current price', () => {
      const position = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: 100e18,
        amount1: 0,
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBeTruthy()
    })

    it('useFullPrecision = false gives different result', () => {
      const positionFull = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: BigInt(100e18),
        amount1: 0,
        useFullPrecision: true,
      })
      const positionImprecise = Position.fromAmounts({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: BigInt(100e18),
        amount1: 0,
        useFullPrecision: false,
      })
      // Imprecise may give slightly different liquidity due to precision loss
      expect(positionFull.liquidity >= positionImprecise.liquidity).toBeTruthy()
    })
  })

  describe('#fromAmount0', () => {
    it('creates position from token0 amount only', () => {
      const position = Position.fromAmount0({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
        amount0: 100e18,
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBeTruthy()
    })

    it('creates position with specific amount0', () => {
      const tickLower = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING
      const tickUpper = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2
      const position = Position.fromAmount0({
        pool: DAI_USDC_POOL,
        tickLower,
        tickUpper,
        amount0: BigInt(1e18),
        useFullPrecision: true,
      })
      expect(position.tickLower).toEqual(tickLower)
      expect(position.tickUpper).toEqual(tickUpper)
      expect(position.pool).toEqual(DAI_USDC_POOL)
    })
  })

  describe('#fromAmount1', () => {
    it('creates position from token1 amount only', () => {
      const position = Position.fromAmount1({
        pool: DAI_USDC_POOL,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING,
        amount1: 100e6,
        useFullPrecision: true,
      })
      expect(position.liquidity > 0n).toBeTruthy()
    })

    it('creates position with specific amount1', () => {
      const tickLower = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2
      const tickUpper = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING
      const position = Position.fromAmount1({
        pool: DAI_USDC_POOL,
        tickLower,
        tickUpper,
        amount1: BigInt(1e6),
        useFullPrecision: true,
      })
      expect(position.tickLower).toEqual(tickLower)
      expect(position.tickUpper).toEqual(tickUpper)
      expect(position.pool).toEqual(DAI_USDC_POOL)
    })
  })

  describe('#token0PriceLower and #token0PriceUpper', () => {
    it('returns sqrt ratio at lower tick', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e18,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(typeof position.token0PriceLower).toEqual('bigint')
      expect(position.token0PriceLower > 0n).toBeTruthy()
    })

    it('returns sqrt ratio at upper tick', () => {
      const position = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 100e18,
        tickLower: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) - TICK_SPACING * 2,
        tickUpper: nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING) + TICK_SPACING * 2,
      })
      expect(typeof position.token0PriceUpper).toEqual('bigint')
      expect(position.token0PriceUpper > position.token0PriceLower).toBeTruthy()
    })
  })
})
