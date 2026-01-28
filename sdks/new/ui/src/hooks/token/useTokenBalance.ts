import { erc20Abi } from "@/abi/erc20";
import type { Address } from "viem";
import { useReadContract } from "wagmi";

interface UseTokenBalanceParams {
  tokenAddress: Address | undefined;
  userAddress: Address | undefined;
  chainId: number | undefined;
}

export function useTokenBalance({
  tokenAddress,
  userAddress,
  chainId,
}: UseTokenBalanceParams) {
  const {
    data: balance,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [userAddress as Address],
    chainId,
    query: {
      enabled: !!tokenAddress && !!userAddress && !!chainId,
    },
  });

  return {
    balance: balance as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}
