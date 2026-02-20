import { describe, expect, it } from 'vitest'
import { encodeMulticall } from './multicall'

describe('encodeMulticall', () => {
  it('single calldata string returns as-is', () => {
    const calldata = '0x01' as `0x${string}`
    expect(encodeMulticall(calldata)).toBe(calldata)
  })

  it('single element array returns as-is', () => {
    const calldata = '0x01' as `0x${string}`
    expect(encodeMulticall([calldata])).toBe(calldata)
  })

  it('multiple calldatas encodes multicall', () => {
    const result = encodeMulticall([
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
    ])
    expect(result).toBe(
      '0xac9650d800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0000000000000000000000000000000000000000000000000000000000000020bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    )
  })

  it('multicall selector is 0xac9650d8', () => {
    const result = encodeMulticall(['0xaa' as `0x${string}`, '0xbb' as `0x${string}`])
    expect(result.startsWith('0xac9650d8')).toBe(true)
  })

  it('returns a hex string', () => {
    const result = encodeMulticall(['0xaa' as `0x${string}`, '0xbb' as `0x${string}`])
    expect(result.startsWith('0x')).toBe(true)
  })
})
