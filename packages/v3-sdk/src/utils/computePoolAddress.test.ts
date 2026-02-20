import { Token } from '@muniswap/sdk-core'
import { describe, expect, it } from 'vitest'
import { FeeAmount } from '../constants'
import { computePoolAddress } from './computePoolAddress'

describe('computePoolAddress', () => {
  const factoryAddress = '0x1111111111111111111111111111111111111111' as const
  const tokenA = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 18, 'USDC', 'USD Coin')
  const tokenB = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')

  it('computes a valid pool address', () => {
    const address = computePoolAddress({
      factoryAddress,
      tokenA,
      tokenB,
      fee: FeeAmount.LOW,
    })
    expect(address).toBeDefined()
    expect(address.startsWith('0x')).toBe(true)
    expect(address.length).toBe(42)
  })

  it('matches the expected address for known tokens', () => {
    const address = computePoolAddress({
      factoryAddress,
      tokenA,
      tokenB,
      fee: FeeAmount.LOW,
    })
    expect(address).toEqual('0xFbA077515A3a465239a47bB1269CCb36357AfC4b')
  })

  it('computes the same address regardless of token order', () => {
    const address1 = computePoolAddress({
      factoryAddress,
      tokenA,
      tokenB,
      fee: FeeAmount.LOW,
    })
    const address2 = computePoolAddress({
      factoryAddress,
      tokenA: tokenB,
      tokenB: tokenA,
      fee: FeeAmount.LOW,
    })
    expect(address1).toEqual(address2)
  })

  it('different fee tiers produce different addresses', () => {
    const addressLow = computePoolAddress({
      factoryAddress,
      tokenA,
      tokenB,
      fee: FeeAmount.LOW,
    })
    const addressMedium = computePoolAddress({
      factoryAddress,
      tokenA,
      tokenB,
      fee: FeeAmount.MEDIUM,
    })
    expect(addressLow).not.toEqual(addressMedium)
  })

  it('uses default factory address when not provided', () => {
    const address = computePoolAddress({
      tokenA,
      tokenB,
      fee: FeeAmount.MEDIUM,
    })
    expect(address).toBeDefined()
    expect(address.startsWith('0x')).toBe(true)
    expect(address.length).toBe(42)

    // Verify it differs from one with an explicit different factory
    const addressWithCustomFactory = computePoolAddress({
      factoryAddress,
      tokenA,
      tokenB,
      fee: FeeAmount.MEDIUM,
    })
    expect(address).not.toEqual(addressWithCustomFactory)
  })
})
