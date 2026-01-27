// Internal constants used by the SDK but not expected to be used externally

export const NEGATIVE_ONE = -1n
export const ZERO = 0n
export const ONE = 1n

// Used in liquidity amount math - Q notation represents fixed-point numbers
// Q96 = 2^96 - used for sqrt price representation
export const Q96 = 2n ** 96n
// Q192 = 2^192 - used for price ratios (Q96 squared)
export const Q192 = 2n ** 192n

// One ether in wei
export const ONE_ETHER = 10n ** 18n

// Default addresses and bytes
export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'
export const EMPTY_BYTES = '0x'
export const EMPTY_HOOK = '0x0000000000000000000000000000000000000000'

// Pool setup - common fee amounts
export const FEE_AMOUNT_LOW = 100
export const FEE_AMOUNT_MEDIUM = 3000
export const FEE_AMOUNT_HIGHEST = 10_000
export const TICK_SPACING_TEN = 10
export const TICK_SPACING_SIXTY = 60

// Used in position manager math
export const MIN_SLIPPAGE_DECREASE = 0

// Used when unwrapping weth in position manager - open delta (full amount)
export const OPEN_DELTA = 0n

// Default hook addresses
// Default prices - sqrt(1/1) = 1 << 96
export const SQRT_PRICE_1_1 = 79228162514264337593543950336n // encodeSqrtRatioX96(1, 1)

// Error constants
export const NATIVE_NOT_SET = 'NATIVE_NOT_SET'
export const ZERO_LIQUIDITY = 'ZERO_LIQUIDITY'
export const NO_SQRT_PRICE = 'NO_SQRT_PRICE'
export const CANNOT_BURN = 'CANNOT_BURN'

/**
 * Function fragments that exist on the PositionManager contract.
 */
export enum PositionFunctions {
  INITIALIZE_POOL = 'initializePool',
  MODIFY_LIQUIDITIES = 'modifyLiquidities',
  // Inherited from PermitForwarder
  PERMIT_BATCH = '0x002a3e3a', // "permitBatch(address,((address,uint160,uint48,uint48)[],address,uint256),bytes)"
  // Inherited from ERC721Permit
  ERC721PERMIT_PERMIT = '0x0f5730f1', // "permit(address,uint256,uint256,uint256,bytes)"
}

/**
 * The default factory enabled fee amounts, denominated in hundredths of bips.
 */
export enum FeeAmount {
  LOWEST = 100,
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

/**
 * The default factory tick spacings by fee amount.
 */
export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOWEST]: 1,
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}

/**
 * V4-specific: Dynamic fee flag for pools with variable fees
 * When this flag is set in the fee field, the pool uses dynamic fees from a hook
 */
export const DYNAMIC_FEE_FLAG = 0x800000
