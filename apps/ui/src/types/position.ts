import type { PoolConfig } from "./pool";

export interface PositionConfig {
  tickLower: number;
  tickUpper: number;
  amount0: string;
  amount1: string;
}

export interface MintConfig extends PoolConfig, PositionConfig {
  slippageTolerance: number; // basis points
}

export interface PositionPreview {
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  amount0Max: bigint;
  amount1Max: bigint;
}

export interface ApprovalState {
  token0ToPermit2: boolean;
  token1ToPermit2: boolean;
  permit2Token0ToManager: boolean;
  permit2Token1ToManager: boolean;
}

export type ApprovalStep =
  | "token0_to_permit2"
  | "token1_to_permit2"
  | "permit2_token0"
  | "permit2_token1"
  | "ready";
