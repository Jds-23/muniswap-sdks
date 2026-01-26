import { describe, expect, it } from 'vitest'
import { CurrencyAmount, Price, Token } from '../src'

describe('Price', () => {
  const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
  const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'
  const ADDRESS_THREE = '0x0000000000000000000000000000000000000003'

  const token0 = new Token(1, ADDRESS_ONE, 18, 'T0', 'Token 0')
  const token1 = new Token(1, ADDRESS_TWO, 18, 'T1', 'Token 1')
  const token2 = new Token(1, ADDRESS_THREE, 18, 'T2', 'Token 2')

  const token0_6 = new Token(1, ADDRESS_ONE, 6, 'T0', 'Token 0')
  const token1_18 = new Token(1, ADDRESS_TWO, 18, 'T1', 'Token 1')

  describe('constructor', () => {
    it('constructs with base and quote values', () => {
      const price = new Price(token0, token1, 1n, 2n)
      expect(price.baseCurrency).toBe(token0)
      expect(price.quoteCurrency).toBe(token1)
    })

    it('constructs from currency amounts', () => {
      const baseAmount = CurrencyAmount.fromRawAmount(token0, 100n)
      const quoteAmount = CurrencyAmount.fromRawAmount(token1, 200n)
      const price = new Price({ baseAmount, quoteAmount })
      expect(price.baseCurrency).toBe(token0)
      expect(price.quoteCurrency).toBe(token1)
      expect(price.toSignificant(4)).toBe('2')
    })
  })

  describe('invert', () => {
    it('inverts the price', () => {
      const price = new Price(token0, token1, 1n, 2n)
      const inverted = price.invert()
      expect(inverted.baseCurrency).toBe(token1)
      expect(inverted.quoteCurrency).toBe(token0)
      expect(inverted.toSignificant(4)).toBe('0.5')
    })
  })

  describe('multiply', () => {
    it('multiplies prices', () => {
      const price1 = new Price(token0, token1, 1n, 2n)
      const price2 = new Price(token1, token2, 1n, 3n)
      const result = price1.multiply(price2)
      expect(result.baseCurrency).toBe(token0)
      expect(result.quoteCurrency).toBe(token2)
      expect(result.toSignificant(4)).toBe('6')
    })

    it('throws for mismatched currencies', () => {
      const price1 = new Price(token0, token1, 1n, 2n)
      const price2 = new Price(token0, token2, 1n, 3n)
      expect(() => price1.multiply(price2)).toThrow('TOKEN')
    })
  })

  describe('quote', () => {
    it('quotes amount', () => {
      const price = new Price(token0, token1, 1n, 2n)
      const baseAmount = CurrencyAmount.fromRawAmount(token0, 100n)
      const quoteAmount = price.quote(baseAmount)
      expect(quoteAmount.quotient).toBe(200n)
      expect(quoteAmount.currency).toBe(token1)
    })

    it('throws for wrong currency', () => {
      const price = new Price(token0, token1, 1n, 2n)
      const wrongAmount = CurrencyAmount.fromRawAmount(token1, 100n)
      expect(() => price.quote(wrongAmount)).toThrow('TOKEN')
    })
  })

  describe('toSignificant', () => {
    it('adjusts for decimals', () => {
      // price of 1 token0 (6 decimals) = 2 token1 (18 decimals)
      const price = new Price(token0_6, token1_18, 1n, 2n)
      // scalar = 10^6 / 10^18 = 10^-12
      // adjusted = 2 * 10^-12 = 0.000000000002
      expect(price.toSignificant(4)).toBe('0.000000000002')
    })

    it('handles same decimals', () => {
      const price = new Price(token0, token1, 1n, 2n)
      expect(price.toSignificant(4)).toBe('2')
    })
  })

  describe('toFixed', () => {
    it('returns fixed decimal representation', () => {
      const price = new Price(token0, token1, 3n, 10n)
      expect(price.toFixed(4)).toBe('3.3333')
    })
  })
})
