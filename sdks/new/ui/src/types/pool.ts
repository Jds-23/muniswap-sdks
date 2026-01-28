import type { Address, Hex } from "viem";
import type { TokenData } from "./token";

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface PoolState {
  poolId: Hex;
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
  liquidity: bigint;
}

export interface PoolInfo extends PoolKey, PoolState {
  token0: TokenData;
  token1: TokenData;
}

export interface PoolConfig {
  token0: TokenData | null;
  token1: TokenData | null;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}
