// Internal constants used by the SDK but not expected to be used externally

export const NEGATIVE_ONE = -1n
export const ZERO = 0n
export const ONE = 1n
export const TWO = 2n

// Used in liquidity amount math - Q notation represents fixed-point numbers
// Q96 = 2^96 - used for sqrt price representation
export const Q96 = 2n ** 96n
// Q192 = 2^192 - used for price ratios (Q96 squared)
export const Q192 = 2n ** 192n
// Q128 = 2^128 - used for fee growth calculations
export const Q128 = 2n ** 128n
// Q256 = 2^256 - used for overflow handling in subtraction
export const Q256 = 2n ** 256n
// Q32 = 2^32 - used for time-weighted calculations
export const Q32 = 2n ** 32n

// Maximum value for uint256
export const MaxUint256 = 2n ** 256n - 1n
// Maximum value for uint160
export const MaxUint160 = 2n ** 160n - 1n
// Maximum value for uint128
export const MaxUint128 = 2n ** 128n - 1n
