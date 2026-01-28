import { ChainId } from '@muniswap/sdk-core'
import type { Address } from 'ox'

// Default V3 factory address (mainnet and most chains)
export const FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984' as Address.Address

// Zero address constant
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000' as Address.Address

// Default pool init code hash
export const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54' as `0x${string}`

/**
 * Returns the pool init code hash for a given chain.
 * Most chains use the default hash, but some (like ZKSync) have different bytecode.
 * @param chainId - The chain ID to get the init code hash for
 * @returns The init code hash for the chain
 */
export function poolInitCodeHash(chainId?: ChainId): `0x${string}` {
  switch (chainId) {
    case ChainId.ZKSYNC:
      return '0x010013f177ea1fcbc4520f9a3ca7cd2d1d77959e05aa66484027cb38e712aeed'
    default:
      return POOL_INIT_CODE_HASH
  }
}

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips (0.01%).
 * For example, 500 = 0.05% fee tier.
 */
export enum FeeAmount {
  LOWEST = 100,
  LOW_200 = 200,
  LOW_300 = 300,
  LOW_400 = 400,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

/**
 * The default factory tick spacings by fee amount.
 * Lower fee tiers have tighter tick spacing for more granular pricing.
 */
export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOWEST]: 1,
  [FeeAmount.LOW_200]: 4,
  [FeeAmount.LOW_300]: 6,
  [FeeAmount.LOW_400]: 8,
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}
