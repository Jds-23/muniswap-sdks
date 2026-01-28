import { describe, expect, it } from 'vitest'
import {
  CurrencyAmount,
  Percent,
  Price,
  Token,
  computePriceImpact,
  sortedInsert,
  sqrt,
  validateAndParseAddress,
} from '../src'

describe('validateAndParseAddress', () => {
  it('returns checksummed address', () => {
    expect(validateAndParseAddress('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')).toBe(
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
    )
  })

  it('throws for invalid address', () => {
    expect(() => validateAndParseAddress('invalid')).toThrow('is not a valid address')
  })

  it('throws for short address', () => {
    expect(() => validateAndParseAddress('0x1234')).toThrow('is not a valid address')
  })
})

describe('sqrt', () => {
  it('computes sqrt of small numbers', () => {
    expect(sqrt(4n)).toBe(2n)
    expect(sqrt(9n)).toBe(3n)
    expect(sqrt(16n)).toBe(4n)
  })

  it('computes sqrt of zero', () => {
    expect(sqrt(0n)).toBe(0n)
  })

  it('computes sqrt of one', () => {
    expect(sqrt(1n)).toBe(1n)
  })

  it('floors non-perfect squares', () => {
    expect(sqrt(2n)).toBe(1n)
    expect(sqrt(3n)).toBe(1n)
    expect(sqrt(5n)).toBe(2n)
    expect(sqrt(8n)).toBe(2n)
  })

  it('computes sqrt of large numbers', () => {
    const large = 2n ** 128n
    const sqrtLarge = sqrt(large)
    expect(sqrtLarge * sqrtLarge).toBeLessThanOrEqual(large)
    expect((sqrtLarge + 1n) * (sqrtLarge + 1n)).toBeGreaterThan(large)
  })

  it('throws for negative numbers', () => {
    expect(() => sqrt(-1n)).toThrow('NEGATIVE')
  })
})

describe('sortedInsert', () => {
  const comparator = (a: number, b: number) => a - b

  it('inserts into empty array', () => {
    const items: number[] = []
    const removed = sortedInsert(items, 5, 3, comparator)
    expect(items).toEqual([5])
    expect(removed).toBeNull()
  })

  it('inserts in sorted order', () => {
    const items = [1, 3, 5]
    sortedInsert(items, 2, 5, comparator)
    expect(items).toEqual([1, 2, 3, 5])
  })

  it('inserts at beginning', () => {
    const items = [2, 3, 4]
    sortedInsert(items, 1, 5, comparator)
    expect(items).toEqual([1, 2, 3, 4])
  })

  it('inserts at end', () => {
    const items = [1, 2, 3]
    sortedInsert(items, 4, 5, comparator)
    expect(items).toEqual([1, 2, 3, 4])
  })

  it('removes last item when full', () => {
    const items = [1, 2, 3]
    const removed = sortedInsert(items, 0, 3, comparator)
    expect(items).toEqual([0, 1, 2])
    expect(removed).toBe(3)
  })

  it('returns item if would be removed immediately', () => {
    const items = [1, 2, 3]
    const removed = sortedInsert(items, 4, 3, comparator)
    expect(items).toEqual([1, 2, 3])
    expect(removed).toBe(4)
  })

  it('throws for maxSize zero', () => {
    expect(() => sortedInsert([], 1, 0, comparator)).toThrow('MAX_SIZE_ZERO')
  })

  it('throws if items exceed maxSize', () => {
    expect(() => sortedInsert([1, 2, 3, 4], 5, 3, comparator)).toThrow('ITEMS_SIZE')
  })
})

describe('computePriceImpact', () => {
  const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
  const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'
  const token0 = new Token(1, ADDRESS_ONE, 18, 'T0', 'Token 0')
  const token1 = new Token(1, ADDRESS_TWO, 18, 'T1', 'Token 1')

  it('computes price impact', () => {
    // Mid price: 1 T0 = 1 T1
    const midPrice = new Price(token0, token1, 1n, 1n)
    // Trade: 100 T0 -> 90 T1 (10% price impact)
    const inputAmount = CurrencyAmount.fromRawAmount(token0, 100n)
    const outputAmount = CurrencyAmount.fromRawAmount(token1, 90n)

    const impact = computePriceImpact(midPrice, inputAmount, outputAmount)

    expect(impact).toBeInstanceOf(Percent)
    expect(impact.toFixed(0)).toBe('10')
  })

  it('handles zero price impact', () => {
    const midPrice = new Price(token0, token1, 1n, 1n)
    const inputAmount = CurrencyAmount.fromRawAmount(token0, 100n)
    const outputAmount = CurrencyAmount.fromRawAmount(token1, 100n)

    const impact = computePriceImpact(midPrice, inputAmount, outputAmount)
    expect(impact.toFixed(2)).toBe('0.00')
  })
})
