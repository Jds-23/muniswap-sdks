import type { Pool as V4Pool } from '@muniswap/v4-sdk'
import type { Pair } from '@muniswap/v2-sdk'
import type { Pool as V3Pool } from '@muniswap/v3-sdk'

export type TPool = Pair | V3Pool | V4Pool
