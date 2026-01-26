import { describe, expect, it } from 'vitest'
import { Ether, WETH9 } from '../src'

describe('Ether', () => {
  describe('onChain', () => {
    it('returns Ether instance', () => {
      const ether = Ether.onChain(1)
      expect(ether.chainId).toBe(1)
      expect(ether.decimals).toBe(18)
      expect(ether.symbol).toBe('ETH')
      expect(ether.name).toBe('Ether')
    })

    it('caches instances', () => {
      const ether1 = Ether.onChain(1)
      const ether2 = Ether.onChain(1)
      expect(ether1).toBe(ether2)
    })

    it('returns different instances for different chains', () => {
      const ether1 = Ether.onChain(1)
      const ether5 = Ether.onChain(5)
      expect(ether1).not.toBe(ether5)
      expect(ether1.chainId).toBe(1)
      expect(ether5.chainId).toBe(5)
    })
  })

  describe('equals', () => {
    it('returns true for same chain Ether', () => {
      const ether1 = Ether.onChain(1)
      const ether2 = Ether.onChain(1)
      expect(ether1.equals(ether2)).toBe(true)
    })

    it('returns false for different chain Ether', () => {
      const ether1 = Ether.onChain(1)
      const ether5 = Ether.onChain(5)
      expect(ether1.equals(ether5)).toBe(false)
    })

    it('returns false for token', () => {
      const ether = Ether.onChain(1)
      const weth = WETH9[1]!
      expect(ether.equals(weth)).toBe(false)
    })
  })

  describe('wrapped', () => {
    it('returns WETH9 for mainnet', () => {
      const ether = Ether.onChain(1)
      expect(ether.wrapped).toBe(WETH9[1])
    })

    it('throws for chain without WETH9', () => {
      const ether = Ether.onChain(999)
      expect(() => ether.wrapped).toThrow('WRAPPED')
    })
  })

  describe('isNative/isToken', () => {
    it('has correct flags', () => {
      const ether = Ether.onChain(1)
      expect(ether.isNative).toBe(true)
      expect(ether.isToken).toBe(false)
    })
  })
})
