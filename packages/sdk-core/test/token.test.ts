import { describe, expect, it } from 'vitest'
import { Token } from '../src'

describe('Token', () => {
  const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
  const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'

  describe('constructor', () => {
    it('constructs with valid address', () => {
      const token = new Token(1, ADDRESS_ONE, 18, 'TEST', 'Test Token')
      expect(token.chainId).toBe(1)
      expect(token.decimals).toBe(18)
      expect(token.symbol).toBe('TEST')
      expect(token.name).toBe('Test Token')
    })

    it('checksums address', () => {
      const token = new Token(1, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18)
      expect(token.address).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    })

    it('throws for invalid address', () => {
      expect(() => new Token(1, 'invalid', 18)).toThrow('is not a valid address')
    })

    it('bypasses checksum when specified', () => {
      const address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
      const token = new Token(1, address, 18, 'TEST', 'Test', true)
      expect(token.address).toBe(address)
    })

    it('accepts buyFeeBps and sellFeeBps', () => {
      const token = new Token(1, ADDRESS_ONE, 18, 'TEST', 'Test', false, 100n, 200n)
      expect(token.buyFeeBps).toBe(100n)
      expect(token.sellFeeBps).toBe(200n)
    })

    it('throws for negative buyFeeBps', () => {
      expect(() => new Token(1, ADDRESS_ONE, 18, 'TEST', 'Test', false, -1n)).toThrow('NON-NEGATIVE FOT FEES')
    })

    it('throws for negative sellFeeBps', () => {
      expect(() => new Token(1, ADDRESS_ONE, 18, 'TEST', 'Test', false, undefined, -1n)).toThrow(
        'NON-NEGATIVE FOT FEES'
      )
    })

    it('fails with negative decimals', () => {
      expect(() => new Token(3, ADDRESS_ONE, -1)).toThrow('DECIMALS')
    })

    it('fails with 256 decimals', () => {
      expect(() => new Token(3, ADDRESS_ONE, 256)).toThrow('DECIMALS')
    })

    it('fails with non-integer decimals', () => {
      expect(() => new Token(3, ADDRESS_ONE, 1.5)).toThrow('DECIMALS')
    })
  })

  describe('constructor with bypassChecksum', () => {
    const bypassChecksum = true

    it('creates the token with a valid address', () => {
      expect(new Token(3, ADDRESS_TWO, 18, undefined, undefined, bypassChecksum).address).toBe(ADDRESS_TWO)
    })

    it('fails with invalid address', () => {
      expect(
        () => new Token(3, '0xhello00000000000000000000000000000000002', 18, undefined, undefined, bypassChecksum)
      ).toThrow('is not a valid address')
    })

    it('fails with negative decimals', () => {
      expect(() => new Token(3, ADDRESS_ONE, -1, undefined, undefined, bypassChecksum)).toThrow('DECIMALS')
    })

    it('fails with 256 decimals', () => {
      expect(() => new Token(3, ADDRESS_ONE, 256, undefined, undefined, bypassChecksum)).toThrow('DECIMALS')
    })

    it('fails with non-integer decimals', () => {
      expect(() => new Token(3, ADDRESS_ONE, 1.5, undefined, undefined, bypassChecksum)).toThrow('DECIMALS')
    })
  })

  describe('equals', () => {
    it('returns true for same token', () => {
      const token1 = new Token(1, ADDRESS_ONE, 18)
      const token2 = new Token(1, ADDRESS_ONE, 18)
      expect(token1.equals(token2)).toBe(true)
    })

    it('returns false for different chain', () => {
      const token1 = new Token(1, ADDRESS_ONE, 18)
      const token2 = new Token(5, ADDRESS_ONE, 18)
      expect(token1.equals(token2)).toBe(false)
    })

    it('returns false for different address', () => {
      const token1 = new Token(1, ADDRESS_ONE, 18)
      const token2 = new Token(1, ADDRESS_TWO, 18)
      expect(token1.equals(token2)).toBe(false)
    })

    it('is case insensitive for address', () => {
      const token1 = new Token(1, ADDRESS_ONE.toUpperCase(), 18, undefined, undefined, true)
      const token2 = new Token(1, ADDRESS_ONE.toLowerCase(), 18, undefined, undefined, true)
      expect(token1.equals(token2)).toBe(true)
    })

    it('true if only decimals differs', () => {
      expect(new Token(1, ADDRESS_ONE, 9).equals(new Token(1, ADDRESS_ONE, 18))).toBe(true)
    })

    it('true on reference equality', () => {
      const token = new Token(1, ADDRESS_ONE, 18)
      expect(token.equals(token)).toBe(true)
    })

    it('true even if name/symbol/decimals differ', () => {
      const tokenA = new Token(1, ADDRESS_ONE, 9, 'abc', 'def')
      const tokenB = new Token(1, ADDRESS_ONE, 18, 'ghi', 'jkl')
      expect(tokenA.equals(tokenB)).toBe(true)
    })
  })

  describe('sortsBefore', () => {
    it('returns true when address sorts before', () => {
      const token1 = new Token(1, ADDRESS_ONE, 18)
      const token2 = new Token(1, ADDRESS_TWO, 18)
      expect(token1.sortsBefore(token2)).toBe(true)
    })

    it('returns false when address sorts after', () => {
      const token1 = new Token(1, ADDRESS_TWO, 18)
      const token2 = new Token(1, ADDRESS_ONE, 18)
      expect(token1.sortsBefore(token2)).toBe(false)
    })

    it('throws for same address', () => {
      const token1 = new Token(1, ADDRESS_ONE, 18)
      const token2 = new Token(1, ADDRESS_ONE, 18)
      expect(() => token1.sortsBefore(token2)).toThrow('ADDRESSES')
    })

    it('throws for different chains', () => {
      const token1 = new Token(1, ADDRESS_ONE, 18)
      const token2 = new Token(5, ADDRESS_TWO, 18)
      expect(() => token1.sortsBefore(token2)).toThrow('CHAIN_IDS')
    })
  })

  describe('wrapped', () => {
    it('returns itself', () => {
      const token = new Token(1, ADDRESS_ONE, 18)
      expect(token.wrapped).toBe(token)
    })
  })

  describe('isToken/isNative', () => {
    it('has correct flags', () => {
      const token = new Token(1, ADDRESS_ONE, 18)
      expect(token.isToken).toBe(true)
      expect(token.isNative).toBe(false)
    })
  })
})
