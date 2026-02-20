import { describe, expect, it } from 'vitest'
import { getFeeGrowthInside } from './tickLibrary'

const Q128 = 2n ** 128n

describe('tickLibrary', () => {
  describe('#getFeeGrowthInside', () => {
    it('returns all zeros when fee growth is zero', () => {
      const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(
        { feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n },
        { feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n },
        -1,
        1,
        0,
        0n,
        0n
      )
      expect(feeGrowthInside0).toEqual(0n)
      expect(feeGrowthInside1).toEqual(0n)
    })

    it('returns all inside when fee growth is non-zero and all inside', () => {
      const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(
        { feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n },
        { feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n },
        -1,
        1,
        0,
        Q128,
        Q128
      )
      expect(feeGrowthInside0).toEqual(Q128)
      expect(feeGrowthInside1).toEqual(Q128)
    })

    it('returns zero when fee growth is non-zero and all outside', () => {
      const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(
        { feeGrowthOutside0X128: Q128, feeGrowthOutside1X128: Q128 },
        { feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n },
        -1,
        1,
        0,
        Q128,
        Q128
      )
      expect(feeGrowthInside0).toEqual(0n)
      expect(feeGrowthInside1).toEqual(0n)
    })

    it('returns correct value when some fee growth is outside', () => {
      const [feeGrowthInside0, feeGrowthInside1] = getFeeGrowthInside(
        { feeGrowthOutside0X128: 2n ** 127n, feeGrowthOutside1X128: 2n ** 127n },
        { feeGrowthOutside0X128: 0n, feeGrowthOutside1X128: 0n },
        -1,
        1,
        0,
        Q128,
        Q128
      )
      expect(feeGrowthInside0).toEqual(2n ** 127n)
      expect(feeGrowthInside1).toEqual(2n ** 127n)
    })
  })
})
