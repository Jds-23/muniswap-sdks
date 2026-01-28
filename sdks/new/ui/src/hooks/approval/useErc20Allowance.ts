import { useReadContract } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import type { Address } from "viem";

interface UseErc20AllowanceParams {
  tokenAddress: Address | undefined;
  ownerAddress: Address | undefined;
  spenderAddress: Address | undefined;
  chainId: number | undefined;
}

export function useErc20Allowance({
  tokenAddress,
  ownerAddress,
  spenderAddress,
  chainId,
}: UseErc20AllowanceParams) {
  const { data: allowance, isLoading, error, refetch } = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [ownerAddress as Address, spenderAddress as Address],
    chainId,
    query: {
      enabled:
        !!tokenAddress && !!ownerAddress && !!spenderAddress && !!chainId,
    },
  });

  return {
    allowance: allowance as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}
