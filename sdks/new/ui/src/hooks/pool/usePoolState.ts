import { useReadContract } from "wagmi";
import { stateViewAbi } from "@/abi/stateView";
import { getStateView } from "@/config/contracts";
import type { Hex } from "viem";

interface UsePoolStateParams {
  poolId: Hex | undefined;
  chainId: number | undefined;
}

interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export function usePoolState({ poolId, chainId }: UsePoolStateParams) {
  const stateView = chainId ? getStateView(chainId) : undefined;

  const { data, isLoading, error, refetch } = useReadContract({
    address: stateView,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [poolId as Hex],
    chainId,
    query: {
      enabled: !!poolId && !!stateView && !!chainId,
    },
  });

  const poolState: PoolState | undefined = data
    ? {
        sqrtPriceX96: data[0] as bigint,
        tick: Number(data[1]),
        protocolFee: Number(data[2]),
        lpFee: Number(data[3]),
      }
    : undefined;

  const isInitialized = poolState ? poolState.sqrtPriceX96 !== 0n : false;

  return {
    poolState,
    isInitialized,
    isLoading,
    error,
    refetch,
  };
}
