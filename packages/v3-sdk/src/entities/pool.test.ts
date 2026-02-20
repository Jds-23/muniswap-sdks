import { CurrencyAmount, Token, WETH9 } from '@muniswap/sdk-core'
import { beforeEach, describe, expect, it } from 'vitest'
import { FeeAmount, TICK_SPACINGS } from '../constants'
import { encodeSqrtRatioX96 } from '../utils/encodeSqrtRatioX96'
import { nearestUsableTick } from '../utils/nearestUsableTick'
import { MAX_TICK, MIN_TICK, getTickAtSqrtRatio } from '../utils/tickMath'
import { Pool } from './pool'

const ONE_ETHER = 10n ** 18n

describe('Pool', () => {
  const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1')
  const weth = WETH9[1]!

  describe('constructor', () => {
    it('cannot be used for tokens on different chains', () => {
      expect(() => {
        new Pool(USDC, WETH9[3]!, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
      }).toThrow('CHAIN_IDS')
    })

    it('fee must be integer', () => {
      expect(() => {
        new Pool(USDC, weth, FeeAmount.MEDIUM + 0.5, encodeSqrtRatioX96(1, 1), 0, 0, [])
      }).toThrow('FEE')
    })

    it('fee cannot be more than 1e6', () => {
      expect(() => {
        new Pool(USDC, weth, 1e6 as FeeAmount, encodeSqrtRatioX96(1, 1), 0, 0, [])
      }).toThrow('FEE')
    })

    it('cannot be given two of the same token', () => {
      expect(() => {
        new Pool(USDC, USDC, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
      }).toThrow('ADDRESSES')
    })

    it('price must be within tick price bounds', () => {
      expect(() => {
        new Pool(USDC, weth, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 1, [])
      }).toThrow('PRICE_BOUNDS')
      expect(() => {
        new Pool(USDC, weth, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1) + 1n, 0, -1, [])
      }).toThrow('PRICE_BOUNDS')
    })

    it('works with valid arguments for empty pool medium fee', () => {
      const pool = new Pool(USDC, weth, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool).toBeDefined()
    })

    it('works with valid arguments for empty pool low fee', () => {
      const pool = new Pool(USDC, weth, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool).toBeDefined()
    })

    it('works with valid arguments for empty pool lowest fee', () => {
      const pool = new Pool(USDC, weth, FeeAmount.LOWEST, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool).toBeDefined()
    })

    it('works with valid arguments for empty pool high fee', () => {
      const pool = new Pool(USDC, weth, FeeAmount.HIGH, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool).toBeDefined()
    })

    it('works with tick data as array', () => {
      const pool = new Pool(token0, token1, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), ONE_ETHER, 0, [
        {
          index: nearestUsableTick(MIN_TICK, TICK_SPACINGS[FeeAmount.MEDIUM]),
          liquidityNet: ONE_ETHER,
          liquidityGross: ONE_ETHER,
        },
        {
          index: nearestUsableTick(MAX_TICK, TICK_SPACINGS[FeeAmount.MEDIUM]),
          liquidityNet: -ONE_ETHER,
          liquidityGross: ONE_ETHER,
        },
      ])
      expect(pool).toBeDefined()
    })
  })

  describe('#getAddress', () => {
    it('matches an example', () => {
      const result = Pool.getAddress(USDC, DAI, FeeAmount.LOW)
      expect(result).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })

    it('returns an address regardless of token order', () => {
      const result1 = Pool.getAddress(USDC, DAI, FeeAmount.LOW)
      const result2 = Pool.getAddress(DAI, USDC, FeeAmount.LOW)
      expect(result1).toEqual(result2)
    })
  })

  describe('#token0', () => {
    it('always is the token that sorts before', () => {
      let pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.token0).toEqual(DAI)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.token0).toEqual(DAI)
    })
  })

  describe('#token1', () => {
    it('always is the token that sorts after', () => {
      let pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.token1).toEqual(USDC)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.token1).toEqual(USDC)
    })
  })

  describe('#token0Price', () => {
    it('returns price of token0 in terms of token1', () => {
      expect(
        new Pool(
          USDC,
          DAI,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          []
        ).token0Price.toSignificant(5)
      ).toEqual('1.01')
      expect(
        new Pool(
          DAI,
          USDC,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          []
        ).token0Price.toSignificant(5)
      ).toEqual('1.01')
    })
  })

  describe('#token1Price', () => {
    it('returns price of token1 in terms of token0', () => {
      expect(
        new Pool(
          USDC,
          DAI,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          []
        ).token1Price.toSignificant(5)
      ).toEqual('0.9901')
      expect(
        new Pool(
          DAI,
          USDC,
          FeeAmount.LOW,
          encodeSqrtRatioX96(101e6, 100e18),
          0,
          getTickAtSqrtRatio(encodeSqrtRatioX96(101e6, 100e18)),
          []
        ).token1Price.toSignificant(5)
      ).toEqual('0.9901')
    })
  })

  describe('#priceOf', () => {
    const pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])

    it('returns price of token in terms of other token', () => {
      expect(pool.priceOf(DAI)).toEqual(pool.token0Price)
      expect(pool.priceOf(USDC)).toEqual(pool.token1Price)
    })

    it('throws if invalid token', () => {
      expect(() => pool.priceOf(weth)).toThrow('TOKEN')
    })
  })

  describe('#chainId', () => {
    it('returns the token0 chainId', () => {
      let pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.chainId).toEqual(1)
      pool = new Pool(DAI, USDC, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.chainId).toEqual(1)
    })
  })

  describe('#involvesToken', () => {
    const pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])

    it('returns true for token0', () => {
      expect(pool.involvesToken(USDC)).toEqual(true)
    })

    it('returns true for token1', () => {
      expect(pool.involvesToken(DAI)).toEqual(true)
    })

    it('returns false for unrelated token', () => {
      expect(pool.involvesToken(weth)).toEqual(false)
    })
  })

  describe('#tickSpacing', () => {
    it('returns correct tick spacing for medium fee', () => {
      const pool = new Pool(USDC, DAI, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.tickSpacing).toEqual(TICK_SPACINGS[FeeAmount.MEDIUM])
    })

    it('returns correct tick spacing for low fee', () => {
      const pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), 0, 0, [])
      expect(pool.tickSpacing).toEqual(TICK_SPACINGS[FeeAmount.LOW])
    })
  })

  describe('swaps', () => {
    let pool: Pool

    beforeEach(() => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(1, 1), ONE_ETHER, 0, [
        {
          index: nearestUsableTick(MIN_TICK, TICK_SPACINGS[FeeAmount.LOW]),
          liquidityNet: ONE_ETHER,
          liquidityGross: ONE_ETHER,
        },
        {
          index: nearestUsableTick(MAX_TICK, TICK_SPACINGS[FeeAmount.LOW]),
          liquidityNet: -ONE_ETHER,
          liquidityGross: ONE_ETHER,
        },
      ])
    })

    describe('#getOutputAmount', () => {
      it('USDC -> DAI', async () => {
        const inputAmount = CurrencyAmount.fromRawAmount(USDC, 100)
        const [outputAmount] = await pool.getOutputAmount(inputAmount)
        expect(outputAmount.currency.equals(DAI)).toBe(true)
        expect(outputAmount.quotient).toEqual(98n)
      })

      it('DAI -> USDC', async () => {
        const inputAmount = CurrencyAmount.fromRawAmount(DAI, 100)
        const [outputAmount] = await pool.getOutputAmount(inputAmount)
        expect(outputAmount.currency.equals(USDC)).toBe(true)
        expect(outputAmount.quotient).toEqual(98n)
      })

      it('returns updated pool', async () => {
        const inputAmount = CurrencyAmount.fromRawAmount(USDC, 100)
        const [, updatedPool] = await pool.getOutputAmount(inputAmount)
        expect(updatedPool).toBeInstanceOf(Pool)
        expect(updatedPool.fee).toEqual(pool.fee)
      })
    })

    describe('#getInputAmount', () => {
      it('USDC -> DAI', async () => {
        const outputAmount = CurrencyAmount.fromRawAmount(DAI, 98)
        const [inputAmount] = await pool.getInputAmount(outputAmount)
        expect(inputAmount.currency.equals(USDC)).toBe(true)
        expect(inputAmount.quotient).toEqual(100n)
      })

      it('DAI -> USDC', async () => {
        const outputAmount = CurrencyAmount.fromRawAmount(USDC, 98)
        const [inputAmount] = await pool.getInputAmount(outputAmount)
        expect(inputAmount.currency.equals(DAI)).toBe(true)
        expect(inputAmount.quotient).toEqual(100n)
      })

      it('returns updated pool', async () => {
        const outputAmount = CurrencyAmount.fromRawAmount(DAI, 98)
        const [, updatedPool] = await pool.getInputAmount(outputAmount)
        expect(updatedPool).toBeInstanceOf(Pool)
        expect(updatedPool.fee).toEqual(pool.fee)
      })
    })
  })

  describe('#bigNums', () => {
    let pool: Pool
    const bigNum1 = BigInt(Number.MAX_SAFE_INTEGER) + 1n
    const bigNum2 = BigInt(Number.MAX_SAFE_INTEGER) + 1n

    beforeEach(() => {
      pool = new Pool(USDC, DAI, FeeAmount.LOW, encodeSqrtRatioX96(bigNum1, bigNum2), ONE_ETHER, 0, [
        {
          index: nearestUsableTick(MIN_TICK, TICK_SPACINGS[FeeAmount.LOW]),
          liquidityNet: ONE_ETHER,
          liquidityGross: ONE_ETHER,
        },
        {
          index: nearestUsableTick(MAX_TICK, TICK_SPACINGS[FeeAmount.LOW]),
          liquidityNet: -ONE_ETHER,
          liquidityGross: ONE_ETHER,
        },
      ])
    })

    it('correctly compares two BigInts', () => {
      expect(bigNum1).toEqual(bigNum2)
    })

    it('correctly handles two BigInts in swaps', async () => {
      const inputAmount = CurrencyAmount.fromRawAmount(USDC, 100)
      const [outputAmount] = await pool.getOutputAmount(inputAmount)
      pool.getInputAmount(outputAmount)
      expect(outputAmount.currency.equals(DAI)).toBe(true)
    })
  })
})
