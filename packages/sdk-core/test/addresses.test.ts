import { describe, expect, it } from 'vitest'
import { ChainId, SWAP_ROUTER_02_ADDRESSES } from '../src'

describe('SWAP_ROUTER_02_ADDRESSES', () => {
  const swapRouter02Chains = [
    ChainId.BNB,
    ChainId.OPTIMISM_SEPOLIA,
    ChainId.ARBITRUM_SEPOLIA,
    ChainId.SEPOLIA,
    ChainId.BASE,
    ChainId.BASE_GOERLI,
    ChainId.BASE_SEPOLIA,
    ChainId.AVALANCHE,
    ChainId.BLAST,
    ChainId.ZKSYNC,
    ChainId.WORLDCHAIN,
    ChainId.UNICHAIN_SEPOLIA,
    ChainId.UNICHAIN,
    ChainId.ZORA,
    ChainId.ROOTSTOCK,
    ChainId.SONEIUM,
    ChainId.MONAD_TESTNET,
    ChainId.XLAYER,
  ] as const

  for (const chainId of swapRouter02Chains) {
    it(`has a swap router 02 address for chain ${chainId}`, () => {
      const address = SWAP_ROUTER_02_ADDRESSES(chainId)
      expect(address).toBeTruthy()
      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/)
    })
  }

  it('returns default address for chains without explicit swapRouter02Address', () => {
    // Mainnet doesn't have swapRouter02Address set in MAINNET_ADDRESSES, so uses default
    const address = SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET)
    expect(address).toBe('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
  })

  it('returns empty string for unsupported chain', () => {
    const address = SWAP_ROUTER_02_ADDRESSES(999999)
    expect(address).toBe('')
  })
})
