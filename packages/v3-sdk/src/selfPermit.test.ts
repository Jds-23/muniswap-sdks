import { Token } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import {
  type AllowedPermitArguments,
  type StandardPermitArguments,
  encodeSelfPermit,
  encodeSelfPermitIfNecessary,
} from './selfPermit'

const token = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
const owner = '0x0000000000000000000000000000000000000003'

const standardPermitOptions: StandardPermitArguments = {
  v: 0,
  r: '0x0000000000000000000000000000000000000000000000000000000000000001',
  s: '0x0000000000000000000000000000000000000000000000000000000000000002',
  amount: 123n,
  deadline: 123n,
}

const allowedPermitOptions: AllowedPermitArguments = {
  v: 0,
  r: '0x0000000000000000000000000000000000000000000000000000000000000001',
  s: '0x0000000000000000000000000000000000000000000000000000000000000002',
  nonce: 123n,
  expiry: 123n,
}

describe('selfPermit', () => {
  describe('encodeSelfPermit', () => {
    it('standard permit (EIP-2612)', () => {
      const result = encodeSelfPermit(token, owner, standardPermitOptions)
      expect(result).toBe(
        '0xf3995c670000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002'
      )
    })

    it('allowed permit (DAI-style)', () => {
      const result = encodeSelfPermit(token, owner, allowedPermitOptions)
      expect(result).toBe(
        '0x4659a4940000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000007b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002'
      )
    })
  })

  describe('encodeSelfPermitIfNecessary', () => {
    it('standard permit (EIP-2612)', () => {
      const result = encodeSelfPermitIfNecessary(token, owner, standardPermitOptions)
      expect(result.startsWith('0x')).toBe(true)
      // selfPermitIfNecessary has a different function selector than selfPermit
      expect(result).not.toBe(encodeSelfPermit(token, owner, standardPermitOptions))
    })

    it('allowed permit (DAI-style)', () => {
      const result = encodeSelfPermitIfNecessary(token, owner, allowedPermitOptions)
      expect(result.startsWith('0x')).toBe(true)
      // selfPermitAllowedIfNecessary has a different function selector than selfPermitAllowed
      expect(result).not.toBe(encodeSelfPermit(token, owner, allowedPermitOptions))
    })
  })
})
