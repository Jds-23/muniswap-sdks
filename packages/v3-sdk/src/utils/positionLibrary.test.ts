import { describe, expect, it } from 'vitest'
import { getTokensOwed } from './positionLibrary'

describe('positionLibrary', () => {
  describe('#getTokensOwed', () => {
    it('zero case', () => {
      const [tokensOwed0, tokensOwed1] = getTokensOwed(0n, 0n, 0n, 0n, 0n)
      expect(tokensOwed0).toEqual(0n)
      expect(tokensOwed1).toEqual(0n)
    })

    it('non-zero case', () => {
      const [tokensOwed0, tokensOwed1] = getTokensOwed(0n, 0n, 1n, 2n ** 128n, 2n ** 128n)
      expect(tokensOwed0).toEqual(1n)
      expect(tokensOwed1).toEqual(1n)
    })
  })
})
