import { describe, expect, it } from 'vitest'
import { MAX_TICK, MIN_TICK } from '../utils/tickMath'
import { Tick } from './tick'

describe('Tick', () => {
  describe('constructor', () => {
    it('throws for tick below MIN_TICK', () => {
      expect(() => new Tick({ index: MIN_TICK - 1, liquidityGross: 0, liquidityNet: 0 })).toThrow('TICK')
    })

    it('throws for tick above MAX_TICK', () => {
      expect(() => new Tick({ index: MAX_TICK + 1, liquidityGross: 0, liquidityNet: 0 })).toThrow('TICK')
    })

    it('succeeds for MIN_TICK', () => {
      const tick = new Tick({ index: MIN_TICK, liquidityGross: 1, liquidityNet: 1 })
      expect(tick.index).toBe(MIN_TICK)
      expect(tick.liquidityGross).toBe(1n)
      expect(tick.liquidityNet).toBe(1n)
    })

    it('succeeds for MAX_TICK', () => {
      const tick = new Tick({ index: MAX_TICK, liquidityGross: 1, liquidityNet: -1 })
      expect(tick.index).toBe(MAX_TICK)
      expect(tick.liquidityNet).toBe(-1n)
    })

    it('converts BigintIsh to bigint', () => {
      const tick = new Tick({ index: 0, liquidityGross: '100', liquidityNet: '50' })
      expect(tick.liquidityGross).toBe(100n)
      expect(tick.liquidityNet).toBe(50n)
    })
  })
})
