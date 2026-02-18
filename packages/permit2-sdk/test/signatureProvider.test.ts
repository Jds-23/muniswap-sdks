import { describe, expect, it } from 'vitest'
import { SignatureProvider } from '../src/providers/SignatureProvider'

describe('SignatureProvider', () => {
  describe('isBitSet', () => {
    it('should check if a specific bit is set in a bitmap', () => {
      const bitmap = 1n

      expect(SignatureProvider.isBitSet(bitmap, 0)).toBe(true)
      expect(SignatureProvider.isBitSet(bitmap, 1)).toBe(false)
    })

    it('should handle different bit positions', () => {
      const bitmap = 0xffn

      for (let i = 0; i < 8; i++) {
        expect(SignatureProvider.isBitSet(bitmap, i)).toBe(true)
      }

      for (let i = 8; i < 16; i++) {
        expect(SignatureProvider.isBitSet(bitmap, i)).toBe(false)
      }
    })

    it('should throw error for invalid bit positions', () => {
      expect(() => SignatureProvider.isBitSet(0n, -1)).toThrow('BIT_POSITION_OUT_OF_RANGE')
      expect(() => SignatureProvider.isBitSet(0n, 256)).toThrow('BIT_POSITION_OUT_OF_RANGE')
    })
  })

  describe('getNoncePositions', () => {
    it('should calculate correct word and bit positions', () => {
      const positions = SignatureProvider.getNoncePositions(123n)

      expect(positions.wordPos).toBe(0n) // 123 >> 8 = 0
      expect(positions.bitPos).toBe(123) // 123 & 255 = 123
    })

    it('should handle nonces that span multiple words', () => {
      const positions = SignatureProvider.getNoncePositions(300n)

      expect(positions.wordPos).toBe(1n) // 300 >> 8 = 1
      expect(positions.bitPos).toBe(44) // 300 & 255 = 44
    })
  })

  describe('Integration Tests (requires FORK_URL)', () => {
    const forkUrl = process.env.FORK_URL

    function createJsonRpcProvider(url: string) {
      return {
        async call(params: { to: string; data: string }): Promise<string> {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_call',
              params: [{ to: params.to, data: params.data }, 'latest'],
            }),
          })
          const json = (await response.json()) as { result: string }
          return json.result
        },
        async getBlockTimestamp(): Promise<number> {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'eth_getBlockByNumber',
              params: ['latest', false],
            }),
          })
          const json = (await response.json()) as { result: { timestamp: string } }
          return Number(json.result.timestamp)
        },
      }
    }

    it.skipIf(!forkUrl)('should check specific used nonce for known swapper', async () => {
      const provider = createJsonRpcProvider(forkUrl!)
      const signatureProvider = new SignatureProvider(provider, '0x000000000022D473030F116dDEE9F6B43aC78BA3')

      const usedNonce = 1993349591429988950323706171037443285812821323100932422320925456272859199745n
      const swapper = '0xa7152Fad7467857dC2D4060FEcaAdf9f6B8227d3'

      const isUsed = await signatureProvider.isNonceUsed(swapper, usedNonce)
      expect(isUsed).toBe(true)
    })

    it.skipIf(!forkUrl)('should check specific unused nonce for known swapper', async () => {
      const provider = createJsonRpcProvider(forkUrl!)
      const signatureProvider = new SignatureProvider(provider, '0x000000000022D473030F116dDEE9F6B43aC78BA3')

      const unusedNonce = 1234567890n
      const swapper = '0x54539967a06Fc0E3C3ED0ee320Eb67362D13C5fF'

      const isUsed = await signatureProvider.isNonceUsed(swapper, unusedNonce)
      expect(isUsed).toBe(false)
    })
  })
})
