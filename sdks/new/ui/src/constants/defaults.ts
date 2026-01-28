import type { Address } from "viem";

export const DEFAULT_POOL = {
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000" as Address,
};

export const TICK_RANGE_FULL = {
  tickLower: -887220,
  tickUpper: 887220,
};

export const FEE_TIERS = [
  { fee: 100, tickSpacing: 1, label: "0.01%" },
  { fee: 500, tickSpacing: 10, label: "0.05%" },
  { fee: 3000, tickSpacing: 60, label: "0.3%" },
  { fee: 10000, tickSpacing: 200, label: "1%" },
] as const;

export const DEFAULT_SLIPPAGE_TOLERANCE = 100; // 1% in basis points
export const DEFAULT_DEADLINE_MINUTES = 20;

export const MAX_UINT160 = 2n ** 160n - 1n;
export const MAX_UINT256 = 2n ** 256n - 1n;
