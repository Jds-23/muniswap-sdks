import { CurrencyAmount, Ether, Percent, Token, WETH9 } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import { FeeAmount, TICK_SPACINGS } from './constants'
import { Pool, Position } from './entities'
import {
  addCallParameters,
  collectCallParameters,
  createCallParameters,
  removeCallParameters,
  safeTransferFromParameters,
} from './nonfungiblePositionManager'
import { encodeSqrtRatioX96 } from './utils/encodeSqrtRatioX96'

const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')

const fee = FeeAmount.MEDIUM
const WETH = WETH9[1]!

const pool_0_1 = new Pool(token0, token1, fee, encodeSqrtRatioX96(1, 1), 0, 0, [])
const pool_1_weth = new Pool(token1, WETH, fee, encodeSqrtRatioX96(1, 1), 0, 0, [])

const recipient = '0x0000000000000000000000000000000000000003'
const sender = '0x0000000000000000000000000000000000000004'
const tokenId = 1
const slippageTolerance = new Percent(1, 100)
const deadline = 123n

describe('nonfungiblePositionManager', () => {
  describe('createCallParameters', () => {
    it('produces correct calldata', () => {
      const { calldata, value } = createCallParameters(pool_0_1)

      // createAndInitializePoolIfNecessary selector
      expect(calldata).toContain('13ead562')
      // Contains token0 and token1 addresses
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000000001')
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000000002')
      expect(value).toBe('0x00')
    })
  })

  describe('addCallParameters', () => {
    it('throws if liquidity is 0', () => {
      expect(() =>
        addCallParameters(
          new Position({
            pool: pool_0_1,
            tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
            tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
            liquidity: 0,
          }),
          { recipient, slippageTolerance, deadline }
        )
      ).toThrow('ZERO_LIQUIDITY')
    })

    it('succeeds for mint', () => {
      const { calldata, value } = addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { recipient, slippageTolerance, deadline }
      )

      // mint function selector
      expect(calldata.startsWith('0x88316456')).toBe(true)
      // Contains token addresses
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000000001')
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000000002')
      // Contains recipient
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000000003')
      expect(value).toBe('0x00')
    })

    it('succeeds for increase liquidity', () => {
      const { calldata, value } = addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { tokenId, slippageTolerance, deadline }
      )

      // increaseLiquidity function selector
      expect(calldata.startsWith('0x219f5d17')).toBe(true)
      // tokenId = 1
      expect(calldata).toContain('0000000000000000000000000000000000000000000000000000000000000001')
      expect(value).toBe('0x00')
    })

    it('createPool option includes createAndInitializePoolIfNecessary', () => {
      const { calldata, value } = addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { recipient, slippageTolerance, deadline, createPool: true }
      )

      // Should be multicall with createAndInitializePoolIfNecessary + mint
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // createAndInitializePoolIfNecessary selector
      expect(calldata).toContain('13ead562')
      // mint selector
      expect(calldata).toContain('88316456')
      expect(value).toBe('0x00')
    })

    it('mint without useNative returns single mint calldata', () => {
      const { calldata, value } = addCallParameters(
        new Position({
          pool: pool_1_weth,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { recipient, slippageTolerance, deadline }
      )

      // mint function selector (no multicall wrapping when no native currency)
      expect(calldata.startsWith('0x88316456')).toBe(true)
      // Contains WETH address
      expect(calldata.toLowerCase()).toContain('c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
      expect(value).toBe('0x00')
    })

    it('larger liquidity position produces valid calldata', () => {
      const { calldata, value } = addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1000000,
        }),
        { recipient, slippageTolerance, deadline }
      )

      expect(calldata.startsWith('0x88316456')).toBe(true)
      expect(value).toBe('0x00')
    })
  })

  describe('collectCallParameters', () => {
    it('works for token pair', () => {
      const { calldata, value } = collectCallParameters({
        tokenId,
        expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
        expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
        recipient,
      })

      // collect function selector
      expect(calldata.startsWith('0xfc6f7865')).toBe(true)
      // Contains tokenId = 1, recipient, and uint128 max values
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000000003')
      expect(calldata).toContain('00000000000000000000000000000000ffffffffffffffffffffffffffffffff')
      expect(value).toBe('0x00')
    })

    it('works with ETH', () => {
      const { calldata, value } = collectCallParameters({
        tokenId,
        expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token1, 0),
        expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(Ether.onChain(1), 0),
        recipient,
      })

      // multicall wrapping (collect + unwrapWETH9 + sweepToken)
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // collect selector
      expect(calldata).toContain('fc6f7865')
      // unwrapWETH9 selector
      expect(calldata).toContain('49404b7c')
      // sweepToken selector
      expect(calldata).toContain('df2ab5bb')
      expect(value).toBe('0x00')
    })
  })

  describe('removeCallParameters', () => {
    it('throws for 0 liquidity', () => {
      expect(() =>
        removeCallParameters(
          new Position({
            pool: pool_0_1,
            tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
            tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
            liquidity: 0,
          }),
          {
            tokenId,
            liquidityPercentage: new Percent(1),
            slippageTolerance,
            deadline,
            collectOptions: {
              tokenId,
              expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
              expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
              recipient,
            },
          }
        )
      ).toThrow('ZERO_LIQUIDITY')
    })

    it('works for full removal', () => {
      const { calldata, value } = removeCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 100,
        }),
        {
          tokenId,
          liquidityPercentage: new Percent(1),
          slippageTolerance,
          deadline,
          collectOptions: {
            tokenId,
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
            recipient,
          },
        }
      )

      // multicall with decreaseLiquidity + collect
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // decreaseLiquidity selector
      expect(calldata).toContain('0c49ccbe')
      // collect selector
      expect(calldata).toContain('fc6f7865')
      // liquidity=100=0x64
      expect(calldata).toContain('0000000000000000000000000000000000000000000000000000000000000064')
      expect(value).toBe('0x00')
    })

    it('works for partial removal', () => {
      const { calldata, value } = removeCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 100,
        }),
        {
          tokenId,
          liquidityPercentage: new Percent(1, 2),
          slippageTolerance,
          deadline,
          collectOptions: {
            tokenId,
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
            recipient,
          },
        }
      )

      // multicall with decreaseLiquidity + collect
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // decreaseLiquidity selector
      expect(calldata).toContain('0c49ccbe')
      // liquidity=50=0x32 (half of 100)
      expect(calldata).toContain('0000000000000000000000000000000000000000000000000000000000000032')
      expect(value).toBe('0x00')
    })

    it('works with ETH', () => {
      const ethAmount = CurrencyAmount.fromRawAmount(Ether.onChain(1), 0)
      const tokenAmount = CurrencyAmount.fromRawAmount(token1, 0)

      const { calldata, value } = removeCallParameters(
        new Position({
          pool: pool_1_weth,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 100,
        }),
        {
          tokenId,
          liquidityPercentage: new Percent(1),
          slippageTolerance,
          deadline,
          collectOptions: {
            tokenId,
            expectedCurrencyOwed0: pool_1_weth.token0.equals(token1) ? tokenAmount : ethAmount,
            expectedCurrencyOwed1: pool_1_weth.token0.equals(token1) ? ethAmount : tokenAmount,
            recipient,
          },
        }
      )

      // multicall with decreaseLiquidity + collect + unwrapWETH9 + sweepToken
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // decreaseLiquidity selector
      expect(calldata).toContain('0c49ccbe')
      // collect selector
      expect(calldata).toContain('fc6f7865')
      // unwrapWETH9 selector
      expect(calldata).toContain('49404b7c')
      // sweepToken selector
      expect(calldata).toContain('df2ab5bb')
      expect(value).toBe('0x00')
    })

    it('works for partial with ETH', () => {
      const ethAmount = CurrencyAmount.fromRawAmount(Ether.onChain(1), 0)
      const tokenAmount = CurrencyAmount.fromRawAmount(token1, 0)

      const { calldata, value } = removeCallParameters(
        new Position({
          pool: pool_1_weth,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 100,
        }),
        {
          tokenId,
          liquidityPercentage: new Percent(1, 2),
          slippageTolerance,
          deadline,
          collectOptions: {
            tokenId,
            expectedCurrencyOwed0: pool_1_weth.token0.equals(token1) ? tokenAmount : ethAmount,
            expectedCurrencyOwed1: pool_1_weth.token0.equals(token1) ? ethAmount : tokenAmount,
            recipient,
          },
        }
      )

      // multicall wrapping
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // decreaseLiquidity with partial liquidity
      expect(calldata).toContain('0c49ccbe')
      // liquidity=50=0x32 (half of 100)
      expect(calldata).toContain('0000000000000000000000000000000000000000000000000000000000000032')
      expect(value).toBe('0x00')
    })

    it('includes burn when burnToken is true and full removal', () => {
      const { calldata, value } = removeCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 100,
        }),
        {
          tokenId,
          liquidityPercentage: new Percent(1),
          slippageTolerance,
          deadline,
          burnToken: true,
          collectOptions: {
            tokenId,
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
            recipient,
          },
        }
      )

      // multicall wrapping
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // burn selector (42966c68)
      expect(calldata).toContain('42966c68')
      expect(value).toBe('0x00')
    })
  })

  describe('safeTransferFromParameters', () => {
    it('succeeds without data', () => {
      const { calldata, value } = safeTransferFromParameters({
        sender,
        recipient,
        tokenId,
      })

      // safeTransferFrom(address,address,uint256,bytes)
      expect(calldata.startsWith('0xb88d4fde')).toBe(true)
      expect(value).toBe('0x00')
    })

    it('succeeds with data', () => {
      const data = '0x0000000000000000000000000000000000009004' as `0x${string}`
      const { calldata, value } = safeTransferFromParameters({
        sender,
        recipient,
        tokenId,
        data,
      })

      // safeTransferFrom(address,address,uint256,bytes)
      expect(calldata.startsWith('0xb88d4fde')).toBe(true)
      // Contains the data
      expect(calldata.toLowerCase()).toContain('0000000000000000000000000000000000009004')
      expect(value).toBe('0x00')
    })
  })
})
