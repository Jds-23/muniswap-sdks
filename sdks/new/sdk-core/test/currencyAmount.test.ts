import { describe, expect, it } from 'vitest'
import { CurrencyAmount, Ether, Rounding, Token } from '../src'

describe('CurrencyAmount', () => {
  const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
  const token = new Token(1, ADDRESS_ONE, 18, 'TEST', 'Test Token')
  const token6 = new Token(1, ADDRESS_ONE, 6, 'TEST6', 'Test Token 6')

  describe('fromRawAmount', () => {
    it('constructs from raw amount', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 1000000000000000000n)
      expect(amount.quotient).toBe(1000000000000000000n)
      expect(amount.currency).toBe(token)
    })

    it('works with string', () => {
      const amount = CurrencyAmount.fromRawAmount(token, '1000000000000000000')
      expect(amount.quotient).toBe(1000000000000000000n)
    })

    it('works with number', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 1000000)
      expect(amount.quotient).toBe(1000000n)
    })
  })

  describe('fromFractionalAmount', () => {
    it('constructs from fractional amount', () => {
      const amount = CurrencyAmount.fromFractionalAmount(token, 1n, 2n)
      expect(amount.numerator).toBe(1n)
      expect(amount.denominator).toBe(2n)
    })
  })

  describe('add', () => {
    it('adds amounts of same currency', () => {
      const amount1 = CurrencyAmount.fromRawAmount(token, 100n)
      const amount2 = CurrencyAmount.fromRawAmount(token, 200n)
      const result = amount1.add(amount2)
      expect(result.quotient).toBe(300n)
    })

    it('throws for different currencies', () => {
      const token2 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 'TEST2', 'Test Token 2')
      const amount1 = CurrencyAmount.fromRawAmount(token, 100n)
      const amount2 = CurrencyAmount.fromRawAmount(token2, 200n)
      expect(() => amount1.add(amount2)).toThrow('CURRENCY')
    })
  })

  describe('subtract', () => {
    it('subtracts amounts of same currency', () => {
      const amount1 = CurrencyAmount.fromRawAmount(token, 300n)
      const amount2 = CurrencyAmount.fromRawAmount(token, 100n)
      const result = amount1.subtract(amount2)
      expect(result.quotient).toBe(200n)
    })
  })

  describe('multiply', () => {
    it('multiplies amount', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 100n)
      const result = amount.multiply(2n)
      expect(result.quotient).toBe(200n)
    })
  })

  describe('divide', () => {
    it('divides amount', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 100n)
      const result = amount.divide(2n)
      expect(result.quotient).toBe(50n)
    })
  })

  describe('toSignificant', () => {
    it('returns human readable amount', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 1000000000000000000n)
      expect(amount.toSignificant(6)).toBe('1')
    })

    it('handles small amounts', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 123456789012345678n)
      expect(amount.toSignificant(4)).toBe('0.1234')
    })
  })

  describe('toFixed', () => {
    it('returns fixed decimal string', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 1500000000000000000n)
      expect(amount.toFixed(2)).toBe('1.50')
    })

    it('uses currency decimals by default', () => {
      const amount = CurrencyAmount.fromRawAmount(token6, 1500000n)
      expect(amount.toFixed()).toBe('1.500000')
    })

    it('throws if decimal places exceed currency decimals', () => {
      const amount = CurrencyAmount.fromRawAmount(token6, 1500000n)
      expect(() => amount.toFixed(8)).toThrow('DECIMALS')
    })
  })

  describe('toExact', () => {
    it('returns exact decimal representation', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 1234567890123456789n)
      expect(amount.toExact()).toBe('1.234567890123456789')
    })
  })

  describe('wrapped', () => {
    it('returns wrapped token for native currency', () => {
      const ether = Ether.onChain(1)
      const amount = CurrencyAmount.fromRawAmount(ether, 1000000000000000000n)
      const wrapped = amount.wrapped
      expect(wrapped.currency.isToken).toBe(true)
    })

    it('returns same amount for token', () => {
      const amount = CurrencyAmount.fromRawAmount(token, 100n)
      const wrapped = amount.wrapped
      expect(wrapped).toBe(amount)
    })
  })
})
