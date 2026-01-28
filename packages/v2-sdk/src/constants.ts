import { Percent, V2_FACTORY_ADDRESSES } from '@muniswap/sdk-core'
import type { Address, Hex } from 'ox'

/**
 * @deprecated use FACTORY_ADDRESS_MAP instead
 */
export const FACTORY_ADDRESS: Address.Address = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'

export const FACTORY_ADDRESS_MAP: { [chainId: number]: Address.Address } = V2_FACTORY_ADDRESSES as {
  [chainId: number]: Address.Address
}

export const INIT_CODE_HASH: Hex.Hex = '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'

export const MINIMUM_LIQUIDITY = 1000n

// exports for internal consumption
export const ZERO = 0n
export const ONE = 1n
export const FIVE = 5n
export const _997 = 997n
export const _1000 = 1000n
export const BASIS_POINTS = 10000n

export const ZERO_PERCENT = new Percent(ZERO)
export const ONE_HUNDRED_PERCENT = new Percent(ONE)
