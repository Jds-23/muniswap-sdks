import { describe, expect, it } from 'vitest'
import { isSorted } from './isSorted'

const numComparator = (a: number, b: number) => a - b

describe('isSorted', () => {
  it('empty list', () => {
    expect(isSorted([], numComparator)).toEqual(true)
  })

  it('one element', () => {
    expect(isSorted([1], numComparator)).toEqual(true)
  })

  it('two sorted elements', () => {
    expect(isSorted([1, 2], numComparator)).toEqual(true)
  })

  it('two equal elements', () => {
    expect(isSorted([1, 1], numComparator)).toEqual(true)
  })

  it('two unsorted elements', () => {
    expect(isSorted([2, 1], numComparator)).toEqual(false)
  })

  it('many elements with one unsorted pair in the middle', () => {
    expect(isSorted([1, 2, 4, 3, 5], numComparator)).toEqual(false)
  })

  it('many elements with one unsorted pair at the end', () => {
    expect(isSorted([1, 2, 3, 5, 4], numComparator)).toEqual(false)
  })

  it('many elements with one unsorted pair at the beginning', () => {
    expect(isSorted([2, 1, 3, 4, 5], numComparator)).toEqual(false)
  })

  it('many sorted elements with duplicates', () => {
    expect(isSorted([1, 1, 2, 2, 3], numComparator)).toEqual(true)
  })

  it('opposite comparator', () => {
    expect(isSorted([5, 4, 3, 2, 1], (a, b) => b - a)).toEqual(true)
  })

  it('reverse with opposite comparator', () => {
    expect(isSorted([1, 2, 3, 4, 5], (a, b) => b - a)).toEqual(false)
  })
})
