import type { PermitSingle } from '@muniswap/permit2-sdk'
import { AbiParameters, Hex, Signature } from 'ox'
import { describe, expect, it } from 'vitest'
import { encodePermit } from '../utils/inputTokens'
import { RoutePlanner, parseSolidityType } from '../utils/routerCommands'
import { generatePermitSignature, makePermit } from './utils/permit2'
import { USDC } from './utils/uniswapData'

const PERMIT_STRUCT =
  '((address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline)'

// Private key for test signing (padded to 32 bytes)
const TEST_PRIVATE_KEY = Hex.padLeft('0x1234', 32)

// note: these tests aren't testing much but registering calldata to interop file
// for use in forge fork tests
describe('Permit2', () => {
  describe('v2', () => {
    it('does not sanitize a normal permit', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const permit = makePermit(USDC.address, inputUSDC)
      const signature = generatePermitSignature(permit, TEST_PRIVATE_KEY, 1)
      const sanitized = getSanitizedSignature(permit, signature)
      expect(sanitized).toBe(signature)
    })

    it('does not sanitize a triple length permit', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const permit = makePermit(USDC.address, inputUSDC)
      const signature = generatePermitSignature(permit, TEST_PRIVATE_KEY, 1)
      const multisigSignature = signature + signature.slice(2) + signature.slice(2)
      const sanitized = getSanitizedSignature(permit, multisigSignature)
      expect(sanitized).toBe(multisigSignature)
    })

    it('does not sanitize a short permit', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const permit = makePermit(USDC.address, inputUSDC)
      const tinySignature = '0x12341234132412341344'
      const sanitized = getSanitizedSignature(permit, tinySignature)
      expect(sanitized).toBe(tinySignature)
    })

    it('sanitizes a malformed permit', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const permit = makePermit(USDC.address, inputUSDC)
      const originalSignature = generatePermitSignature(permit, TEST_PRIVATE_KEY, 1)

      const parsed = Signature.from(originalSignature as Hex.Hex)
      // recoveryParam is 0 or 1 (yParity)
      const recoveryParam = parsed.yParity

      // slice off current v byte
      let signature = originalSignature.substring(0, originalSignature.length - 2)
      // append recoveryParam as v (0 or 1 instead of 27 or 28)
      signature += recoveryParam.toString(16).padStart(2, '0')

      const sanitized = getSanitizedSignature(permit, signature)
      expect(sanitized).toBe(originalSignature)
    })
  })

  function getSanitizedSignature(permit: PermitSingle, signature: string): string {
    const planner = new RoutePlanner()
    encodePermit(planner, Object.assign({}, permit, { signature: signature }))
    const decoded = AbiParameters.decode(
      // biome-ignore lint/suspicious/noExplicitAny: ox ABI parameter types are complex
      [parseSolidityType(PERMIT_STRUCT, 'permit'), { type: 'bytes', name: 'signature' }] as any,
      planner.inputs[0]! as Hex.Hex
    )
    return decoded[1] as string
  }
})
