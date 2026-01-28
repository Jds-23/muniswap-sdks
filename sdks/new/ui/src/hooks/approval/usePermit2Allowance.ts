import { useReadContract } from "wagmi";
import { permit2Abi } from "@/abi/permit2";
import { getPermit2 } from "@/config/contracts";
import type { Address } from "viem";

interface UsePermit2AllowanceParams {
  tokenAddress: Address | undefined;
  ownerAddress: Address | undefined;
  spenderAddress: Address | undefined;
  chainId: number | undefined;
}

interface Permit2Allowance {
  amount: bigint;
  expiration: number;
  nonce: number;
}

export function usePermit2Allowance({
  tokenAddress,
  ownerAddress,
  spenderAddress,
  chainId,
}: UsePermit2AllowanceParams) {
  const permit2Address = chainId ? getPermit2(chainId) : undefined;

  const { data, isLoading, error, refetch } = useReadContract({
    address: permit2Address as Address,
    abi: permit2Abi,
    functionName: "allowance",
    args: [
      ownerAddress as Address,
      tokenAddress as Address,
      spenderAddress as Address,
    ],
    chainId,
    query: {
      enabled:
        !!tokenAddress &&
        !!ownerAddress &&
        !!spenderAddress &&
        !!permit2Address &&
        !!chainId,
    },
  });

  const allowance: Permit2Allowance | undefined = data
    ? {
        amount: data[0] as bigint,
        expiration: Number(data[1]),
        nonce: Number(data[2]),
      }
    : undefined;

  const isExpired = allowance
    ? allowance.expiration < Math.floor(Date.now() / 1000)
    : false;

  return {
    allowance,
    isExpired,
    isLoading,
    error,
    refetch,
  };
}
