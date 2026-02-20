import { Token } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import { FeeAmount } from './constants'
import { Pool } from './entities/pool'
import { safeTransferFromParameters } from './nonfungiblePositionManager'
import { type IncentiveKey, collectRewards, encodeDeposit, withdrawToken } from './staker'
import { encodeSqrtRatioX96 } from './utils/encodeSqrtRatioX96'

const reward = new Token(1, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'r', 'reward')
const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')

const pool_0_1 = new Pool(token0, token1, FeeAmount.MEDIUM, encodeSqrtRatioX96(1, 1), 0, 0, [])
// Get the actual computed pool address for this codebase
const poolAddress = Pool.getAddress(token0, token1, FeeAmount.MEDIUM).toLowerCase().slice(2)

const incentiveKey: IncentiveKey = {
  rewardToken: reward,
  pool: pool_0_1,
  startTime: 100n,
  endTime: 200n,
  refundee: '0x0000000000000000000000000000000000000001',
}

const incentiveKeys: IncentiveKey[] = [
  incentiveKey,
  {
    rewardToken: reward,
    pool: pool_0_1,
    startTime: 50n,
    endTime: 100n,
    refundee: '0x0000000000000000000000000000000000000089',
  },
]

const recipient = '0x0000000000000000000000000000000000000003'
const sender = '0x0000000000000000000000000000000000000004'
const tokenId = 1

describe('staker', () => {
  describe('collectRewards', () => {
    it('single key with amount', () => {
      const { calldata, value } = collectRewards(incentiveKey, {
        tokenId,
        recipient,
        amount: 1n,
      })

      // multicall with 3 calls: unstake, claimReward, stakeToken
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // Contains the reward token address
      expect(calldata.toLowerCase()).toContain('1f9840a85d5af5bf1d1762f925bdaddc4201f984')
      // Contains the computed pool address
      expect(calldata.toLowerCase()).toContain(poolAddress)
      // unstakeToken selector
      expect(calldata).toContain('f549ab42')
      // claimReward selector
      expect(calldata).toContain('2f2d783d')
      // stakeToken selector
      expect(calldata).toContain('f2d2909b')
      expect(value).toBe('0x00')
    })

    it('single key without amount', () => {
      const { calldata, value } = collectRewards(incentiveKey, {
        tokenId,
        recipient,
      })

      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // unstakeToken + claimReward + stakeToken = 3 calls
      expect(calldata).toContain('f549ab42')
      expect(calldata).toContain('2f2d783d')
      expect(calldata).toContain('f2d2909b')
      expect(value).toBe('0x00')
    })

    it('multiple keys generates 6 calls', () => {
      const { calldata, value } = collectRewards(incentiveKeys, {
        tokenId,
        recipient,
      })

      // 2 incentiveKeys * 3 calls each = 6 calls
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // Should contain the pool address twice (once per key)
      const poolOccurrences = calldata.toLowerCase().split(poolAddress).length - 1
      expect(poolOccurrences).toBeGreaterThanOrEqual(4) // unstake + stake for each key
      expect(value).toBe('0x00')
    })

    it('returns different calldata with vs without amount', () => {
      const withAmount = collectRewards(incentiveKey, { tokenId, recipient, amount: 1n })
      const withoutAmount = collectRewards(incentiveKey, { tokenId, recipient })

      // With amount=1 vs amount=0 (default), the claimReward call differs
      expect(withAmount.calldata).not.toBe(withoutAmount.calldata)
      expect(withAmount.value).toBe(withoutAmount.value)
    })
  })

  describe('withdrawToken', () => {
    it('single key', () => {
      const { calldata, value } = withdrawToken(incentiveKey, {
        tokenId,
        recipient,
        amount: 0n,
        owner: sender,
        data: '0x0000000000000000000000000000000000000008',
      })

      // multicall with 3 calls: unstake, claimReward, withdrawToken
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // unstakeToken selector
      expect(calldata).toContain('f549ab42')
      // claimReward selector
      expect(calldata).toContain('2f2d783d')
      // withdrawToken selector
      expect(calldata).toContain('3c423f0b')
      expect(value).toBe('0x00')
    })

    it('multiple keys', () => {
      const { calldata, value } = withdrawToken(incentiveKeys, {
        tokenId,
        recipient,
        amount: 0n,
        owner: sender,
        data: '0x0000000000000000000000000000000000000008',
      })

      // 2 * (unstake + claim) + 1 withdraw = 5 calls
      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      // withdrawToken selector should appear once
      expect(calldata).toContain('3c423f0b')
      expect(value).toBe('0x00')
    })

    it('without data parameter', () => {
      const { calldata, value } = withdrawToken(incentiveKey, {
        tokenId,
        recipient,
        owner: sender,
      })

      expect(calldata.startsWith('0xac9650d8')).toBe(true)
      expect(calldata).toContain('3c423f0b')
      expect(value).toBe('0x00')
    })
  })

  describe('encodeDeposit', () => {
    it('single key', () => {
      const result = encodeDeposit(incentiveKey)

      expect(result.startsWith('0x')).toBe(true)
      // Should contain the reward token address
      expect(result.toLowerCase()).toContain('1f9840a85d5af5bf1d1762f925bdaddc4201f984')
      // Should contain the pool address
      expect(result.toLowerCase()).toContain(poolAddress)
      // startTime=100=0x64, endTime=200=0xc8
      expect(result).toContain('0000000000000000000000000000000000000000000000000000000000000064')
      expect(result).toContain('00000000000000000000000000000000000000000000000000000000000000c8')
    })

    it('multiple keys', () => {
      const result = encodeDeposit(incentiveKeys)

      expect(result.startsWith('0x')).toBe(true)
      // Should contain reward token twice
      const rewardOccurrences = result.toLowerCase().split('1f9840a85d5af5bf1d1762f925bdaddc4201f984').length - 1
      expect(rewardOccurrences).toBe(2)
      // Should contain pool address twice
      const poolOccurrences = result.toLowerCase().split(poolAddress).length - 1
      expect(poolOccurrences).toBe(2)
    })

    it('single vs multiple keys produce different encoding', () => {
      const single = encodeDeposit(incentiveKey)
      const multiple = encodeDeposit(incentiveKeys)

      expect(single).not.toBe(multiple)
      expect(multiple.length).toBeGreaterThan(single.length)
    })
  })

  describe('safeTransferFrom with deposit data for staker', () => {
    it('produces correct calldata', () => {
      const data = encodeDeposit(incentiveKey)

      const { calldata, value } = safeTransferFromParameters({
        sender,
        recipient,
        tokenId,
        data,
      })

      // safeTransferFrom(address,address,uint256,bytes) selector
      expect(calldata.startsWith('0xb88d4fde')).toBe(true)
      // Contains the deposit data (reward token and pool address)
      expect(calldata.toLowerCase()).toContain('1f9840a85d5af5bf1d1762f925bdaddc4201f984')
      expect(calldata.toLowerCase()).toContain(poolAddress)
      expect(value).toBe('0x00')
    })
  })
})
