import { useReadContracts } from "wagmi";
import { erc20Abi } from "@/abi/erc20";
import type { Address } from "viem";
import type { TokenData } from "@/types/token";

interface UseTokenInfoParams {
  address: Address | undefined;
  chainId: number | undefined;
}

export function useTokenInfo({ address, chainId }: UseTokenInfoParams) {
  const { data, isLoading, error } = useReadContracts({
    contracts: [
      {
        address: address as Address,
        abi: erc20Abi,
        functionName: "name",
        chainId,
      },
      {
        address: address as Address,
        abi: erc20Abi,
        functionName: "symbol",
        chainId,
      },
      {
        address: address as Address,
        abi: erc20Abi,
        functionName: "decimals",
        chainId,
      },
    ],
    query: {
      enabled: !!address && !!chainId,
    },
  });

  const tokenInfo: TokenData | undefined =
    data && data[0].result && data[1].result && data[2].result
      ? {
          address: address as Address,
          name: data[0].result as string,
          symbol: data[1].result as string,
          decimals: data[2].result as number,
        }
      : undefined;

  return {
    tokenInfo,
    isLoading,
    error,
  };
}
