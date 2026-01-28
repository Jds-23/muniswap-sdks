import { erc20Abi } from "@/abi/erc20";
import { MAX_UINT256 } from "@/constants/defaults";
import type { Address } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";

interface UseApproveErc20Params {
  tokenAddress: Address | undefined;
  spenderAddress: Address | undefined;
}

export function useApproveErc20({
  tokenAddress,
  spenderAddress,
}: UseApproveErc20Params) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const approve = async () => {
    if (!tokenAddress || !spenderAddress) return;

    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, MAX_UINT256],
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
