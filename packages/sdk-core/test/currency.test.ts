import { describe, expect, it } from 'vitest'
import { Ether, Token } from '../src'

describe('Currency', () => {
  const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
  const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'

  describe('equals', () => {
    it('ether on same chain is equal', () => {
      expect(Ether.onChain(1).equals(Ether.onChain(1))).toBe(true)
    })

    it('ether is not equal to token', () => {
      expect(Ether.onChain(1).equals(new Token(1, ADDRESS_ONE, 18))).toBe(false)
    })

    it('token is not equal to ether', () => {
      expect(new Token(1, ADDRESS_ONE, 18).equals(Ether.onChain(1))).toBe(false)
    })

    it('token is equal to same token', () => {
      expect(new Token(1, ADDRESS_ONE, 18).equals(new Token(1, ADDRESS_ONE, 18))).toBe(true)
    })

    it('token is not equal to different token', () => {
      expect(new Token(1, ADDRESS_ONE, 18).equals(new Token(1, ADDRESS_TWO, 18))).toBe(false)
    })
  })
})
