import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { permit2Abi } from "@/abi/permit2";
import { getPermit2 } from "@/config/contracts";
import { MAX_UINT160 } from "@/constants/defaults";
import type { Address } from "viem";

interface UseApprovePermit2Params {
  tokenAddress: Address | undefined;
  spenderAddress: Address | undefined;
}

export function useApprovePermit2({
  tokenAddress,
  spenderAddress,
}: UseApprovePermit2Params) {
  const chainId = useChainId();
  const permit2Address = chainId ? getPermit2(chainId) : undefined;

  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async () => {
    if (!tokenAddress || !spenderAddress || !permit2Address) return;

    // Expiration: 30 days from now
    const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    writeContract({
      address: permit2Address,
      abi: permit2Abi,
      functionName: "approve",
      args: [tokenAddress, spenderAddress, MAX_UINT160, expiration],
    });
  };

  return {
    approve,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error,
  };
}
