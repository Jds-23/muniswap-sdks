import { beforeEach, describe, expect, it } from 'vitest'
import { Tick } from '../entities/tick'
import {
  getTick,
  isAtOrAboveLargest,
  isBelowSmallest,
  nextInitializedTick,
  nextInitializedTickWithinOneWord,
  validateTickList,
} from './tickList'
import { MAX_TICK, MIN_TICK } from './tickMath'

describe('tickList', () => {
  let lowTick: Tick
  let midTick: Tick
  let highTick: Tick

  beforeEach(() => {
    lowTick = new Tick({
      index: MIN_TICK + 1,
      liquidityNet: 10n,
      liquidityGross: 10n,
    })
    midTick = new Tick({
      index: 0,
      liquidityNet: -5n,
      liquidityGross: 5n,
    })
    highTick = new Tick({
      index: MAX_TICK - 1,
      liquidityNet: -5n,
      liquidityGross: 5n,
    })
  })

  describe('validateTickList', () => {
    it('validates a correct tick list with zero net liquidity', () => {
      const ticks = [
        new Tick({ index: -10, liquidityGross: 1n, liquidityNet: 1n }),
        new Tick({ index: 10, liquidityGross: 1n, liquidityNet: -1n }),
      ]
      expect(() => validateTickList(ticks, 10)).not.toThrow()
    })

    it('throws for non-zero tick spacing', () => {
      const ticks = [
        new Tick({ index: -10, liquidityGross: 1n, liquidityNet: 1n }),
        new Tick({ index: 10, liquidityGross: 1n, liquidityNet: -1n }),
      ]
      expect(() => validateTickList(ticks, 0)).toThrow('TICK_SPACING_NONZERO')
    })

    it('throws for non-zero net liquidity', () => {
      expect(() => validateTickList([lowTick], 1)).toThrow('ZERO_NET')
    })

    it('throws for unsorted tick list', () => {
      expect(() => validateTickList([highTick, lowTick, midTick], 1)).toThrow('SORTED')
    })

    it('throws for ticks not on valid spacing boundary', () => {
      expect(() => validateTickList([highTick, lowTick, midTick], 1337)).toThrow('TICK_SPACING')
    })

    it('throws for wrong tick spacing', () => {
      const ticks = [
        new Tick({ index: -10, liquidityGross: 1n, liquidityNet: 1n }),
        new Tick({ index: 10, liquidityGross: 1n, liquidityNet: -1n }),
      ]
      expect(() => validateTickList(ticks, 3)).toThrow('TICK_SPACING')
    })
  })

  describe('isBelowSmallest', () => {
    it('returns true when tick is below the smallest', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(isBelowSmallest(ticks, MIN_TICK)).toBe(true)
    })

    it('returns false when tick equals the smallest', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(isBelowSmallest(ticks, MIN_TICK + 1)).toBe(false)
    })

    it('returns false when tick is above the smallest', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(isBelowSmallest(ticks, 0)).toBe(false)
    })

    it('throws for empty tick list', () => {
      expect(() => isBelowSmallest([], 0)).toThrow('LENGTH')
    })
  })

  describe('isAtOrAboveLargest', () => {
    it('returns true when tick equals the largest', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(isAtOrAboveLargest(ticks, MAX_TICK - 1)).toBe(true)
    })

    it('returns true when tick is above the largest', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(isAtOrAboveLargest(ticks, MAX_TICK)).toBe(true)
    })

    it('returns false when tick is below the largest', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(isAtOrAboveLargest(ticks, MAX_TICK - 2)).toBe(false)
    })

    it('throws for empty tick list', () => {
      expect(() => isAtOrAboveLargest([], 0)).toThrow('LENGTH')
    })
  })

  describe('getTick', () => {
    it('returns the tick at the given index', () => {
      const ticks = [lowTick, midTick, highTick]
      const tick = getTick(ticks, 0)
      expect(tick).toEqual(midTick)
      expect(tick.liquidityNet).toBe(-5n)
    })

    it('throws for a tick not contained in the list', () => {
      const ticks = [lowTick, midTick, highTick]
      expect(() => getTick(ticks, 1)).toThrow('NOT_CONTAINED')
    })
  })

  describe('nextInitializedTick', () => {
    let ticks: Tick[]

    beforeEach(() => {
      ticks = [lowTick, midTick, highTick]
    })

    it('low tick - lte = true', () => {
      expect(() => nextInitializedTick(ticks, MIN_TICK, true)).toThrow('BELOW_SMALLEST')
      expect(nextInitializedTick(ticks, MIN_TICK + 1, true)).toEqual(lowTick)
      expect(nextInitializedTick(ticks, MIN_TICK + 2, true)).toEqual(lowTick)
    })

    it('low tick - lte = false', () => {
      expect(nextInitializedTick(ticks, MIN_TICK, false)).toEqual(lowTick)
      expect(nextInitializedTick(ticks, MIN_TICK + 1, false)).toEqual(midTick)
    })

    it('mid tick - lte = true', () => {
      expect(nextInitializedTick(ticks, 0, true)).toEqual(midTick)
      expect(nextInitializedTick(ticks, 1, true)).toEqual(midTick)
    })

    it('mid tick - lte = false', () => {
      expect(nextInitializedTick(ticks, -1, false)).toEqual(midTick)
      expect(nextInitializedTick(ticks, 1, false)).toEqual(highTick)
    })

    it('high tick - lte = true', () => {
      expect(nextInitializedTick(ticks, MAX_TICK - 1, true)).toEqual(highTick)
      expect(nextInitializedTick(ticks, MAX_TICK, true)).toEqual(highTick)
    })

    it('high tick - lte = false', () => {
      expect(() => nextInitializedTick(ticks, MAX_TICK - 1, false)).toThrow('AT_OR_ABOVE_LARGEST')
      expect(nextInitializedTick(ticks, MAX_TICK - 2, false)).toEqual(highTick)
      expect(nextInitializedTick(ticks, MAX_TICK - 3, false)).toEqual(highTick)
    })
  })

  describe('nextInitializedTickWithinOneWord', () => {
    let ticks: Tick[]

    beforeEach(() => {
      ticks = [lowTick, midTick, highTick]
    })

    it('words around 0, lte = true', () => {
      expect(nextInitializedTickWithinOneWord(ticks, -257, true, 1)).toEqual([-512, false])
      expect(nextInitializedTickWithinOneWord(ticks, -256, true, 1)).toEqual([-256, false])
      expect(nextInitializedTickWithinOneWord(ticks, -1, true, 1)).toEqual([-256, false])
      expect(nextInitializedTickWithinOneWord(ticks, 0, true, 1)).toEqual([0, true])
      expect(nextInitializedTickWithinOneWord(ticks, 1, true, 1)).toEqual([0, true])
      expect(nextInitializedTickWithinOneWord(ticks, 255, true, 1)).toEqual([0, true])
      expect(nextInitializedTickWithinOneWord(ticks, 256, true, 1)).toEqual([256, false])
      expect(nextInitializedTickWithinOneWord(ticks, 257, true, 1)).toEqual([256, false])
    })

    it('words around 0, lte = false', () => {
      expect(nextInitializedTickWithinOneWord(ticks, -258, false, 1)).toEqual([-257, false])
      expect(nextInitializedTickWithinOneWord(ticks, -257, false, 1)).toEqual([-1, false])
      expect(nextInitializedTickWithinOneWord(ticks, -256, false, 1)).toEqual([-1, false])
      expect(nextInitializedTickWithinOneWord(ticks, -2, false, 1)).toEqual([-1, false])
      expect(nextInitializedTickWithinOneWord(ticks, -1, false, 1)).toEqual([0, true])
      expect(nextInitializedTickWithinOneWord(ticks, 0, false, 1)).toEqual([255, false])
      expect(nextInitializedTickWithinOneWord(ticks, 1, false, 1)).toEqual([255, false])
      expect(nextInitializedTickWithinOneWord(ticks, 254, false, 1)).toEqual([255, false])
      expect(nextInitializedTickWithinOneWord(ticks, 255, false, 1)).toEqual([511, false])
      expect(nextInitializedTickWithinOneWord(ticks, 256, false, 1)).toEqual([511, false])
    })

    it('performs correctly with tickSpacing > 1', () => {
      const spacedTicks = [
        new Tick({ index: 0, liquidityNet: 0n, liquidityGross: 0n }),
        new Tick({ index: 511, liquidityNet: 0n, liquidityGross: 0n }),
      ]

      expect(nextInitializedTickWithinOneWord(spacedTicks, 0, false, 1)).toEqual([255, false])
      expect(nextInitializedTickWithinOneWord(spacedTicks, 0, false, 2)).toEqual([510, false])
    })
  })
})
