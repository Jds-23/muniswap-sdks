import { describe, expect, it } from 'vitest'
import { addressSchema, parseAddress, safeParseAddress } from '../src'

describe('schemas', () => {
  describe('addressSchema', () => {
    it('validates valid address', () => {
      const result = addressSchema.safeParse('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
      expect(result.success).toBe(true)
    })

    it('checksums address', () => {
      const result = addressSchema.parse('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
      expect(result).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    })

    it('rejects invalid address', () => {
      const result = addressSchema.safeParse('invalid')
      expect(result.success).toBe(false)
    })

    it('rejects short address', () => {
      const result = addressSchema.safeParse('0x1234')
      expect(result.success).toBe(false)
    })
  })

  describe('parseAddress', () => {
    it('returns checksummed address', () => {
      expect(parseAddress('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')).toBe(
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      )
    })

    it('throws for invalid address', () => {
      expect(() => parseAddress('invalid')).toThrow()
    })
  })

  describe('safeParseAddress', () => {
    it('returns checksummed address for valid input', () => {
      expect(safeParseAddress('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')).toBe(
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
      )
    })

    it('returns undefined for invalid input', () => {
      expect(safeParseAddress('invalid')).toBeUndefined()
    })
  })
})
