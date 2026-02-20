import { Ether, Percent, Token } from '@muniswap/sdk-core'
import { encodeSqrtRatioX96, getTickAtSqrtRatio, nearestUsableTick } from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import type { AddLiquidityOptions, CollectOptions, RemoveLiquidityOptions } from './PositionManager'
import { V4PositionManager } from './PositionManager'
import { Pool } from './entities'
import { Position } from './entities'
import { ADDRESS_ZERO, FEE_AMOUNT_MEDIUM, TICK_SPACING_TEN } from './internalConstants'
import { Multicall } from './multicall'

const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
const ETHER = Ether.onChain(1)

const POOL_SQRT_RATIO_START = encodeSqrtRatioX96(100e6, 100e18)
const POOL_TICK_CURRENT = getTickAtSqrtRatio(POOL_SQRT_RATIO_START)

const DAI_USDC_POOL = new Pool(
  DAI,
  USDC,
  500,
  TICK_SPACING_TEN,
  ADDRESS_ZERO,
  POOL_SQRT_RATIO_START,
  0,
  POOL_TICK_CURRENT,
  []
)

const ETH_USDC_POOL = new Pool(
  ETHER,
  USDC,
  FEE_AMOUNT_MEDIUM,
  TICK_SPACING_TEN,
  ADDRESS_ZERO,
  encodeSqrtRatioX96(1, 1),
  0,
  0,
  []
)

// Position for testing
const tickLower = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING_TEN) - TICK_SPACING_TEN * 2
const tickUpper = nearestUsableTick(POOL_TICK_CURRENT, TICK_SPACING_TEN) + TICK_SPACING_TEN * 2

const position = new Position({
  pool: DAI_USDC_POOL,
  liquidity: 100e12,
  tickLower,
  tickUpper,
})

const ethPosition = new Position({
  pool: ETH_USDC_POOL,
  liquidity: 100e12,
  tickLower: -60,
  tickUpper: 60,
})

const recipient = '0x0000000000000000000000000000000000000003'
const deadline = 123

describe('V4PositionManager', () => {
  describe('#createCallParameters', () => {
    it('succeeds', () => {
      const result = V4PositionManager.createCallParameters(DAI_USDC_POOL.poolKey, POOL_SQRT_RATIO_START)
      expect(result.calldata).toBeDefined()
      expect(typeof result.calldata).toBe('string')
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.calldata.length).toBeGreaterThan(10)
      expect(result.value).toBe('0x00')
    })

    it('succeeds with nonzero hook', () => {
      // Use an address with no hook permissions (low bits all zero) to avoid dynamic fee invariant
      const hookAddress = '0x1000000000000000000000000000000000000000'
      const poolWithHook = new Pool(
        DAI,
        USDC,
        500,
        TICK_SPACING_TEN,
        hookAddress,
        POOL_SQRT_RATIO_START,
        0,
        POOL_TICK_CURRENT,
        []
      )
      const result = V4PositionManager.createCallParameters(poolWithHook.poolKey, POOL_SQRT_RATIO_START)
      expect(result.calldata).toBeDefined()
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.calldata.length).toBeGreaterThan(10)
      expect(result.value).toBe('0x00')
    })
  })

  describe('#addCallParameters', () => {
    it('throws if liquidity is 0', () => {
      const zeroLiquidityPosition = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 0,
        tickLower,
        tickUpper,
      })
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
      }
      expect(() => V4PositionManager.addCallParameters(zeroLiquidityPosition, options)).toThrow('ZERO_LIQUIDITY')
    })

    it('throws if pool involves ether but useNative is not set', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
      }
      expect(() => V4PositionManager.addCallParameters(ethPosition, options)).toThrow('NATIVE_NOT_SET')
    })

    it('throws if pool does not involve ether but useNative is set', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        useNative: ETHER,
      }
      expect(() => V4PositionManager.addCallParameters(position, options)).toThrow('NATIVE_NOT_SET')
    })

    it('throws if createPool is true but no sqrtPriceX96', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        createPool: true,
      }
      expect(() => V4PositionManager.addCallParameters(position, options)).toThrow('NO_SQRT_PRICE')
    })

    it('succeeds for mint', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
      }
      const result = V4PositionManager.addCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.value).toBe('0x00')
    })

    it('succeeds for increase', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
      }
      const result = V4PositionManager.addCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
    })

    it('succeeds when createPool is true', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        createPool: true,
        sqrtPriceX96: POOL_SQRT_RATIO_START,
      }
      const result = V4PositionManager.addCallParameters(position, options)
      expect(result.calldata).toBeTruthy()

      // Should be a multicall containing initializePool + modifyLiquidities
      const decoded = Multicall.decodeMulticall(result.calldata)
      expect(decoded).toHaveLength(2)
    })

    it('succeeds when useNative is set', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        useNative: ETHER,
      }
      const result = V4PositionManager.addCallParameters(ethPosition, options)
      expect(result.calldata).toBeTruthy()
      // value should be non-zero hex for native currency
      expect(result.value).toBeDefined()
      expect(result.value).not.toBe('0x00')
      expect(result.value.startsWith('0x')).toBe(true)
    })

    it('succeeds when migrate is true', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        migrate: true,
      }
      const result = V4PositionManager.addCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
    })

    it('succeeds when migrate is true with useNative', () => {
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        migrate: true,
        useNative: ETHER,
      }
      const result = V4PositionManager.addCallParameters(ethPosition, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
      // migrate with useNative does not set msg.value (uses unwrap instead)
      expect(result.value).toBe('0x00')
    })

    it('succeeds for batchPermit', () => {
      const permitBatch = position.permitBatchData(
        new Percent(5, 100),
        '0x0000000000000000000000000000000000000004',
        0,
        deadline
      )
      const options: AddLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        recipient,
        batchPermit: {
          owner: '0x0000000000000000000000000000000000000005',
          permitBatch,
          signature: '0x00',
        },
      }
      const result = V4PositionManager.addCallParameters(position, options)
      expect(result.calldata).toBeTruthy()

      // Should be a multicall with 2 entries: permitBatch + modifyLiquidities
      const decoded = Multicall.decodeMulticall(result.calldata)
      expect(decoded).toHaveLength(2)
    })
  })

  describe('#removeCallParameters', () => {
    it('throws for 0 liquidity', () => {
      const zeroLiquidityPosition = new Position({
        pool: DAI_USDC_POOL,
        liquidity: 0,
        tickLower,
        tickUpper,
      })
      const options: RemoveLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
        liquidityPercentage: new Percent(50, 100),
      }
      expect(() => V4PositionManager.removeCallParameters(zeroLiquidityPosition, options)).toThrow('ZERO_LIQUIDITY')
    })

    it('throws when burn is true but liquidityPercentage is not 100%', () => {
      const options: RemoveLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
        liquidityPercentage: new Percent(50, 100),
        burnToken: true,
      }
      expect(() => V4PositionManager.removeCallParameters(position, options)).toThrow('CANNOT_BURN')
    })

    it('succeeds for burn', () => {
      const options: RemoveLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
        liquidityPercentage: new Percent(100, 100),
        burnToken: true,
      }
      const result = V4PositionManager.removeCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.value).toBe('0x00')
    })

    it('burn without permit is not a multicall', () => {
      const options: RemoveLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
        liquidityPercentage: new Percent(100, 100),
        burnToken: true,
      }
      const result = V4PositionManager.removeCallParameters(position, options)
      // Without permit, calldataList has only 1 entry so encodeMulticall returns it directly (no multicall wrapper)
      expect(() => Multicall.decodeMulticall(result.calldata)).toThrow()
    })

    it('succeeds for remove partial liquidity', () => {
      const options: RemoveLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
        liquidityPercentage: new Percent(50, 100),
      }
      const result = V4PositionManager.removeCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.value).toBe('0x00')
    })

    it('succeeds for burn with permit', () => {
      const options: RemoveLiquidityOptions = {
        slippageTolerance: new Percent(5, 100),
        deadline,
        tokenId: 1,
        liquidityPercentage: new Percent(100, 100),
        burnToken: true,
        permit: {
          spender: '0x0000000000000000000000000000000000000004',
          tokenId: 1,
          deadline: 100,
          nonce: 0,
          signature: '0x00',
        },
      }
      const result = V4PositionManager.removeCallParameters(position, options)
      expect(result.calldata).toBeTruthy()

      // Should be a multicall with 2 entries: ERC721Permit + modifyLiquidities
      const decoded = Multicall.decodeMulticall(result.calldata)
      expect(decoded).toHaveLength(2)
    })
  })

  describe('#collectCallParameters', () => {
    it('succeeds', () => {
      const options: CollectOptions = {
        tokenId: 1,
        recipient,
        slippageTolerance: new Percent(5, 100),
        deadline,
      }
      const result = V4PositionManager.collectCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.value).toBe('0x00')
    })

    it('succeeds with hookData', () => {
      const options: CollectOptions = {
        tokenId: 1,
        recipient,
        slippageTolerance: new Percent(5, 100),
        deadline,
        hookData: '0xdeadbeef',
      }
      const result = V4PositionManager.collectCallParameters(position, options)
      expect(result.calldata).toBeTruthy()
      expect(result.calldata.startsWith('0x')).toBe(true)
      expect(result.value).toBe('0x00')
    })
  })

  describe('#encodeModifyLiquidities', () => {
    it('returns valid calldata', () => {
      const result = V4PositionManager.encodeModifyLiquidities('0x', deadline)
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.startsWith('0x')).toBe(true)
    })
  })

  describe('#encodePermitBatch', () => {
    it('returns valid calldata', () => {
      const permitBatch = position.permitBatchData(
        new Percent(5, 100),
        '0x0000000000000000000000000000000000000004',
        0,
        deadline
      )
      const result = V4PositionManager.encodePermitBatch(
        '0x0000000000000000000000000000000000000005',
        permitBatch,
        '0x00'
      )
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.startsWith('0x')).toBe(true)
    })
  })

  describe('#encodeERC721Permit', () => {
    it('returns valid calldata', () => {
      const result = V4PositionManager.encodeERC721Permit(
        '0x0000000000000000000000000000000000000004',
        1,
        100,
        0,
        '0x00'
      )
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.startsWith('0x')).toBe(true)
    })
  })

  describe('#getPermitData', () => {
    it('returns correct domain and types', () => {
      const positionManagerAddress = '0x0000000000000000000000000000000000000004'
      const result = V4PositionManager.getPermitData(
        {
          spender: recipient,
          tokenId: 1,
          deadline: 100,
          nonce: 0,
        },
        positionManagerAddress,
        1
      )

      // Check domain
      expect(result.domain.name).toBe('Uniswap V4 Positions NFT')
      expect(result.domain.chainId).toBe(1)
      expect(result.domain.verifyingContract).toBe(positionManagerAddress)

      // Check types
      expect(result.types).toHaveProperty('Permit')
      expect(result.types.Permit).toHaveLength(4)
      expect(result.types.Permit[0]!.name).toBe('spender')
      expect(result.types.Permit[1]!.name).toBe('tokenId')
      expect(result.types.Permit[2]!.name).toBe('nonce')
      expect(result.types.Permit[3]!.name).toBe('deadline')

      // Check values
      expect(result.values.spender).toBe(recipient)
      expect(result.values.tokenId).toBe(1)
      expect(result.values.deadline).toBe(100)
      expect(result.values.nonce).toBe(0)
    })
  })
})
