import { describe, expect, it } from 'vitest'
import { FeeAmount, TICK_SPACINGS } from './constants'

describe('constants', () => {
  describe('FeeAmount', () => {
    it('LOWEST is 100', () => {
      expect(FeeAmount.LOWEST).toEqual(100)
    })

    it('LOW is 500', () => {
      expect(FeeAmount.LOW).toEqual(500)
    })

    it('MEDIUM is 3000', () => {
      expect(FeeAmount.MEDIUM).toEqual(3000)
    })

    it('HIGH is 10000', () => {
      expect(FeeAmount.HIGH).toEqual(10000)
    })
  })

  describe('TICK_SPACINGS', () => {
    it('LOWEST maps to 1', () => {
      expect(TICK_SPACINGS[FeeAmount.LOWEST]).toEqual(1)
    })

    it('LOW maps to 10', () => {
      expect(TICK_SPACINGS[FeeAmount.LOW]).toEqual(10)
    })

    it('MEDIUM maps to 60', () => {
      expect(TICK_SPACINGS[FeeAmount.MEDIUM]).toEqual(60)
    })

    it('HIGH maps to 200', () => {
      expect(TICK_SPACINGS[FeeAmount.HIGH]).toEqual(200)
    })
  })
})
