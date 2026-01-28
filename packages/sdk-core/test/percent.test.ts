import { describe, expect, it } from 'vitest'
import { Percent } from '../src'

describe('Percent', () => {
  describe('constructor', () => {
    it('constructs percent', () => {
      const percent = new Percent(1n, 100n)
      expect(percent.numerator).toBe(1n)
      expect(percent.denominator).toBe(100n)
      expect(percent.isPercent).toBe(true)
    })
  })

  describe('toSignificant', () => {
    it('returns percentage value', () => {
      const percent = new Percent(1n, 100n)
      expect(percent.toSignificant(2)).toBe('1')
    })

    it('handles larger percentages', () => {
      const percent = new Percent(50n, 100n)
      expect(percent.toSignificant(2)).toBe('50')
    })

    it('handles small percentages', () => {
      const percent = new Percent(1n, 10000n)
      expect(percent.toSignificant(4)).toBe('0.01')
    })
  })

  describe('toFixed', () => {
    it('returns fixed decimal percentage', () => {
      const percent = new Percent(1n, 100n)
      expect(percent.toFixed(2)).toBe('1.00')
    })

    it('handles fractional percentages', () => {
      const percent = new Percent(15n, 1000n)
      expect(percent.toFixed(2)).toBe('1.50')
    })
  })

  describe('add', () => {
    it('returns Percent instance', () => {
      const percent1 = new Percent(1n, 100n)
      const percent2 = new Percent(2n, 100n)
      const result = percent1.add(percent2)
      expect(result.isPercent).toBe(true)
      expect(result.toFixed(0)).toBe('3')
    })
  })

  describe('subtract', () => {
    it('returns Percent instance', () => {
      const percent1 = new Percent(5n, 100n)
      const percent2 = new Percent(2n, 100n)
      const result = percent1.subtract(percent2)
      expect(result.isPercent).toBe(true)
      expect(result.toFixed(0)).toBe('3')
    })
  })

  describe('multiply', () => {
    it('returns Percent instance', () => {
      const percent = new Percent(10n, 100n)
      const result = percent.multiply(2n)
      expect(result.isPercent).toBe(true)
      expect(result.toFixed(0)).toBe('20')
    })
  })

  describe('divide', () => {
    it('returns Percent instance', () => {
      const percent = new Percent(10n, 100n)
      const result = percent.divide(2n)
      expect(result.isPercent).toBe(true)
      expect(result.toFixed(0)).toBe('5')
    })
  })
})
