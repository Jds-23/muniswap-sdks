import { describe, expect, it } from 'vitest'
import {
  CHAIN_CONFIGS,
  UNIVERSAL_ROUTER_ADDRESS,
  UNIVERSAL_ROUTER_CREATION_BLOCK,
  UniversalRouterVersion,
} from '../utils/constants'

describe('Universal Router Constants', () => {
  // only the chain numbers that have a router deployed
  const chainIds = Object.keys(CHAIN_CONFIGS).map(Number)
  const versions = Object.keys(CHAIN_CONFIGS[1]!.routerConfigs) as unknown as UniversalRouterVersion[]

  describe('UNIVERSAL_ROUTER_ADDRESS', () => {
    for (const version of versions) {
      for (const chainId of chainIds) {
        it(`should return a valid address for version ${UniversalRouterVersion[version as unknown as keyof typeof UniversalRouterVersion] ?? version} on chain ${chainId}`, () => {
          const address = UNIVERSAL_ROUTER_ADDRESS(version, chainId)
          expect(typeof address).toBe('string')
          expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
          expect(address).toBe(UNIVERSAL_ROUTER_ADDRESS(version, chainId))
        })
      }
    }

    it('should throw an error for an unsupported chain', () => {
      expect(() => UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V1_2, 999999)).toThrow(
        'Universal Router not deployed on chain 999999'
      )
    })
  })

  describe('UNIVERSAL_ROUTER_CREATION_BLOCK', () => {
    for (const version of versions) {
      for (const chainId of chainIds) {
        it(`should return a valid block number for version ${UniversalRouterVersion[version as unknown as keyof typeof UniversalRouterVersion] ?? version} on chain ${chainId}`, () => {
          const blockNumber = UNIVERSAL_ROUTER_CREATION_BLOCK(version, chainId)
          expect(typeof blockNumber).toBe('number')
          expect(blockNumber).toBeGreaterThan(0)
          expect(blockNumber).toBe(UNIVERSAL_ROUTER_CREATION_BLOCK(version, chainId))
        })
      }
    }

    it('should throw an error for an unsupported chain', () => {
      expect(() => UNIVERSAL_ROUTER_CREATION_BLOCK(UniversalRouterVersion.V1_2, 999999)).toThrow(
        'Universal Router not deployed on chain 999999'
      )
    })
  })
})
