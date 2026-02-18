import { describe, expect, it } from 'vitest'
import { InstantExpiration, MaxUint48, MaxUint160, MaxUint256 } from '../src/constants'

describe('Constants', () => {
  it('MaxUint256', () => {
    expect(MaxUint256).toBe(2n ** 256n - 1n)
  })

  it('MaxUint160', () => {
    expect(MaxUint160).toBe(2n ** 160n - 1n)
  })

  it('MaxUint48', () => {
    expect(MaxUint48).toBe(2n ** 48n - 1n)
  })

  it('InstantExpiration', () => {
    expect(InstantExpiration).toBe(0n)
  })
})
