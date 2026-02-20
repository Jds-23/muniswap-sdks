import { Percent, Token } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import { encodeRefundETH, encodeSweepToken, encodeUnwrapWETH9 } from './payments'

const token = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
const recipient = '0x0000000000000000000000000000000000000003'
const amount = 123n

const feeOptions = {
  fee: new Percent(1, 1000),
  recipient: '0x0000000000000000000000000000000000000009',
}

describe('payments', () => {
  describe('encodeUnwrapWETH9', () => {
    it('without fee options', () => {
      const result = encodeUnwrapWETH9({ amountMinimum: amount, recipient })
      expect(result).toBe(
        '0x49404b7c000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000003'
      )
    })

    it('with fee options', () => {
      const result = encodeUnwrapWETH9({ amountMinimum: amount, recipient, feeOptions })
      expect(result).toBe(
        '0x9b2c0a37000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000009'
      )
    })
  })

  describe('encodeSweepToken', () => {
    it('without fee options', () => {
      const result = encodeSweepToken({ token, amountMinimum: amount, recipient })
      expect(result).toBe(
        '0xdf2ab5bb0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000003'
      )
    })

    it('with fee options', () => {
      const result = encodeSweepToken({ token, amountMinimum: amount, recipient, feeOptions })
      expect(result).toBe(
        '0xe0e189a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000007b0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000009'
      )
    })
  })

  describe('encodeRefundETH', () => {
    it('encodes correctly', () => {
      const result = encodeRefundETH()
      expect(result).toBe('0x12210e8a')
    })
  })
})
