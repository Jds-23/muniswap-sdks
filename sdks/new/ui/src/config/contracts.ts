import { CONTRACTS, type SupportedChainId } from "@/constants/addresses";
import type { Address } from "viem";

export function getPositionManager(chainId: number): Address {
  const contracts = CONTRACTS[chainId as SupportedChainId];
  if (!contracts) throw new Error(`Unsupported chain: ${chainId}`);
  return contracts.POSITION_MANAGER;
}

export function getStateView(chainId: number): Address {
  const contracts = CONTRACTS[chainId as SupportedChainId];
  if (!contracts) throw new Error(`Unsupported chain: ${chainId}`);
  return contracts.STATE_VIEW;
}

export function getPermit2(chainId: number): Address {
  const contracts = CONTRACTS[chainId as SupportedChainId];
  if (!contracts) throw new Error(`Unsupported chain: ${chainId}`);
  return contracts.PERMIT2;
}

export function getPoolManager(chainId: number): Address {
  const contracts = CONTRACTS[chainId as SupportedChainId];
  if (!contracts) throw new Error(`Unsupported chain: ${chainId}`);
  return contracts.POOL_MANAGER;
}

export function getUniversalRouter(chainId: number): Address {
  const contracts = CONTRACTS[chainId as SupportedChainId];
  if (!contracts) throw new Error(`Unsupported chain: ${chainId}`);
  return contracts.UNIVERSAL_ROUTER;
}
