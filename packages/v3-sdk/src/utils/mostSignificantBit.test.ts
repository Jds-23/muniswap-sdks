import { describe, expect, it } from 'vitest'
import { mostSignificantBit } from './mostSignificantBit'

const MaxUint256 = 2n ** 256n - 1n

describe('mostSignificantBit', () => {
  it('throws for zero', () => {
    expect(() => mostSignificantBit(0n)).toThrow('ZERO')
  })

  it('correct value for every power of 2', () => {
    for (let i = 1; i < 256; i++) {
      expect(mostSignificantBit(2n ** BigInt(i))).toEqual(i)
    }
  })

  it('correct value for every power of 2 minus 1', () => {
    for (let i = 2; i < 256; i++) {
      expect(mostSignificantBit(2n ** BigInt(i) - 1n)).toEqual(i - 1)
    }
  })

  it('succeeds for MaxUint256', () => {
    expect(mostSignificantBit(MaxUint256)).toEqual(255)
  })

  it('throws for MaxUint256 + 1', () => {
    expect(() => mostSignificantBit(MaxUint256 + 1n)).toThrow('MAX')
  })
})
