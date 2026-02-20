import { describe, expect, it } from 'vitest'
import { MAX_SQRT_RATIO, MAX_TICK, MIN_SQRT_RATIO, MIN_TICK, getSqrtRatioAtTick, getTickAtSqrtRatio } from './tickMath'

describe('tickMath', () => {
  describe('constants', () => {
    it('MIN_TICK', () => {
      expect(MIN_TICK).toEqual(-887272)
    })

    it('MAX_TICK', () => {
      expect(MAX_TICK).toEqual(887272)
    })
  })

  describe('#getSqrtRatioAtTick', () => {
    it('throws for non-integer tick', () => {
      expect(() => getSqrtRatioAtTick(1.5)).toThrow('TICK')
    })

    it('throws for tick too small', () => {
      expect(() => getSqrtRatioAtTick(MIN_TICK - 1)).toThrow('TICK')
    })

    it('throws for tick too large', () => {
      expect(() => getSqrtRatioAtTick(MAX_TICK + 1)).toThrow('TICK')
    })

    it('returns the correct value for min tick', () => {
      expect(getSqrtRatioAtTick(MIN_TICK)).toEqual(MIN_SQRT_RATIO)
    })

    it('returns the correct value for tick 0', () => {
      expect(getSqrtRatioAtTick(0)).toEqual(1n << 96n)
    })

    it('returns the correct value for max tick', () => {
      expect(getSqrtRatioAtTick(MAX_TICK)).toEqual(MAX_SQRT_RATIO)
    })
  })

  describe('#getTickAtSqrtRatio', () => {
    it('returns the correct value for MIN_SQRT_RATIO', () => {
      expect(getTickAtSqrtRatio(MIN_SQRT_RATIO)).toEqual(MIN_TICK)
    })

    it('returns the correct value for MAX_SQRT_RATIO - 1', () => {
      expect(getTickAtSqrtRatio(MAX_SQRT_RATIO - 1n)).toEqual(MAX_TICK - 1)
    })
  })
})
