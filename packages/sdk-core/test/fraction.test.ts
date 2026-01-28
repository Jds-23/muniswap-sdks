import { describe, expect, it } from 'vitest'
import { Fraction, Rounding } from '../src'

describe('Fraction', () => {
  describe('constructor', () => {
    it('constructs with bigint', () => {
      const fraction = new Fraction(1n, 2n)
      expect(fraction.numerator).toBe(1n)
      expect(fraction.denominator).toBe(2n)
    })

    it('constructs with number', () => {
      const fraction = new Fraction(1, 2)
      expect(fraction.numerator).toBe(1n)
      expect(fraction.denominator).toBe(2n)
    })

    it('constructs with string', () => {
      const fraction = new Fraction('1', '2')
      expect(fraction.numerator).toBe(1n)
      expect(fraction.denominator).toBe(2n)
    })

    it('constructs with hex string', () => {
      const fraction = new Fraction('0x10', '0x20')
      expect(fraction.numerator).toBe(16n)
      expect(fraction.denominator).toBe(32n)
    })

    it('defaults denominator to 1', () => {
      const fraction = new Fraction(5n)
      expect(fraction.numerator).toBe(5n)
      expect(fraction.denominator).toBe(1n)
    })
  })

  describe('quotient', () => {
    it('returns floor division', () => {
      expect(new Fraction(7n, 3n).quotient).toBe(2n)
      expect(new Fraction(8n, 3n).quotient).toBe(2n)
      expect(new Fraction(9n, 3n).quotient).toBe(3n)
    })
  })

  describe('remainder', () => {
    it('returns remainder after floor division', () => {
      expect(new Fraction(7n, 3n).remainder.equalTo(new Fraction(1n, 3n))).toBe(true)
      expect(new Fraction(8n, 3n).remainder.equalTo(new Fraction(2n, 3n))).toBe(true)
      expect(new Fraction(9n, 3n).remainder.equalTo(new Fraction(0n, 3n))).toBe(true)
    })
  })

  describe('invert', () => {
    it('flips numerator and denominator', () => {
      const fraction = new Fraction(3n, 4n).invert()
      expect(fraction.numerator).toBe(4n)
      expect(fraction.denominator).toBe(3n)
    })
  })

  describe('add', () => {
    it('adds fractions with same denominator', () => {
      const result = new Fraction(1n, 10n).add(new Fraction(4n, 10n))
      expect(result.numerator).toBe(5n)
      expect(result.denominator).toBe(10n)
    })

    it('adds fractions with different denominators', () => {
      const result = new Fraction(1n, 10n).add(new Fraction(4n, 12n))
      expect(result.numerator).toBe(52n)
      expect(result.denominator).toBe(120n)
    })

    it('adds BigintIsh', () => {
      const result = new Fraction(1n, 2n).add(2n)
      expect(result.numerator).toBe(5n)
      expect(result.denominator).toBe(2n)
    })
  })

  describe('subtract', () => {
    it('subtracts fractions with same denominator', () => {
      const result = new Fraction(5n, 10n).subtract(new Fraction(2n, 10n))
      expect(result.numerator).toBe(3n)
      expect(result.denominator).toBe(10n)
    })

    it('subtracts fractions with different denominators', () => {
      const result = new Fraction(1n, 2n).subtract(new Fraction(1n, 3n))
      expect(result.numerator).toBe(1n)
      expect(result.denominator).toBe(6n)
    })
  })

  describe('multiply', () => {
    it('multiplies fractions', () => {
      const result = new Fraction(1n, 2n).multiply(new Fraction(2n, 3n))
      expect(result.numerator).toBe(2n)
      expect(result.denominator).toBe(6n)
    })

    it('multiplies by BigintIsh', () => {
      const result = new Fraction(1n, 2n).multiply(3n)
      expect(result.numerator).toBe(3n)
      expect(result.denominator).toBe(2n)
    })
  })

  describe('divide', () => {
    it('divides fractions', () => {
      const result = new Fraction(1n, 2n).divide(new Fraction(2n, 3n))
      expect(result.numerator).toBe(3n)
      expect(result.denominator).toBe(4n)
    })

    it('divides by BigintIsh', () => {
      const result = new Fraction(1n, 2n).divide(2n)
      expect(result.numerator).toBe(1n)
      expect(result.denominator).toBe(4n)
    })
  })

  describe('lessThan', () => {
    it('returns true when less than', () => {
      expect(new Fraction(1n, 3n).lessThan(new Fraction(1n, 2n))).toBe(true)
    })

    it('returns false when equal', () => {
      expect(new Fraction(1n, 2n).lessThan(new Fraction(2n, 4n))).toBe(false)
    })

    it('returns false when greater', () => {
      expect(new Fraction(2n, 3n).lessThan(new Fraction(1n, 2n))).toBe(false)
    })
  })

  describe('equalTo', () => {
    it('returns true when equal', () => {
      expect(new Fraction(1n, 2n).equalTo(new Fraction(2n, 4n))).toBe(true)
    })

    it('returns false when not equal', () => {
      expect(new Fraction(1n, 2n).equalTo(new Fraction(1n, 3n))).toBe(false)
    })
  })

  describe('greaterThan', () => {
    it('returns true when greater', () => {
      expect(new Fraction(2n, 3n).greaterThan(new Fraction(1n, 2n))).toBe(true)
    })

    it('returns false when equal', () => {
      expect(new Fraction(1n, 2n).greaterThan(new Fraction(2n, 4n))).toBe(false)
    })

    it('returns false when less', () => {
      expect(new Fraction(1n, 3n).greaterThan(new Fraction(1n, 2n))).toBe(false)
    })
  })

  describe('toSignificant', () => {
    it('returns correct significant digits', () => {
      expect(new Fraction(1n, 3n).toSignificant(4)).toBe('0.3333')
    })

    it('respects rounding', () => {
      expect(new Fraction(1n, 3n).toSignificant(1, {}, Rounding.ROUND_DOWN)).toBe('0.3')
      expect(new Fraction(1n, 3n).toSignificant(1, {}, Rounding.ROUND_UP)).toBe('0.4')
    })

    it('handles large numbers', () => {
      expect(new Fraction(123456789n, 1n).toSignificant(4)).toBe('123500000')
    })
  })

  describe('toFixed', () => {
    it('returns correct decimal places', () => {
      expect(new Fraction(1n, 2n).toFixed(2)).toBe('0.50')
      expect(new Fraction(1n, 3n).toFixed(4)).toBe('0.3333')
    })

    it('respects rounding', () => {
      expect(new Fraction(1n, 3n).toFixed(2, {}, Rounding.ROUND_DOWN)).toBe('0.33')
      expect(new Fraction(1n, 3n).toFixed(2, {}, Rounding.ROUND_UP)).toBe('0.34')
      expect(new Fraction(1n, 2n).toFixed(0, {}, Rounding.ROUND_HALF_UP)).toBe('1')
    })

    it('handles zero decimal places', () => {
      expect(new Fraction(5n, 2n).toFixed(0)).toBe('3')
    })
  })

  describe('asFraction', () => {
    it('returns a new Fraction', () => {
      const fraction = new Fraction(1n, 2n)
      const asFraction = fraction.asFraction
      expect(asFraction).toBeInstanceOf(Fraction)
      expect(asFraction.numerator).toBe(fraction.numerator)
      expect(asFraction.denominator).toBe(fraction.denominator)
    })
  })
})
