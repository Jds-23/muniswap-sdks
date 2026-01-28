import { getPermit2, getUniversalRouter } from "@/config/contracts";
import { useErc20Allowance } from "@/hooks/approval/useErc20Allowance";
import { usePermit2Allowance } from "@/hooks/approval/usePermit2Allowance";
import type { SwapApprovalStatus, SwapApprovalStep } from "@/types/swap";
import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount, useChainId } from "wagmi";

interface UseSwapApprovalFlowParams {
  tokenInAddress: Address | undefined;
  amountIn: bigint | undefined;
}

export function useSwapApprovalFlow({
  tokenInAddress,
  amountIn,
}: UseSwapApprovalFlowParams) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const permit2Address = chainId ? getPermit2(chainId) : undefined;
  const universalRouter = chainId ? getUniversalRouter(chainId) : undefined;

  // ERC20 allowance to Permit2
  const { allowance: erc20Allowance, refetch: refetchErc20 } =
    useErc20Allowance({
      tokenAddress: tokenInAddress,
      ownerAddress: userAddress,
      spenderAddress: permit2Address,
      chainId,
    });

  // Permit2 allowance to Universal Router
  const {
    allowance: permit2Allowance,
    isExpired: isPermit2Expired,
    refetch: refetchPermit2,
  } = usePermit2Allowance({
    tokenAddress: tokenInAddress,
    ownerAddress: userAddress,
    spenderAddress: universalRouter,
    chainId,
  });

  const approvalStatus = useMemo<SwapApprovalStatus>(() => {
    return {
      tokenInToPermit2:
        erc20Allowance !== undefined &&
        amountIn !== undefined &&
        erc20Allowance >= amountIn,
      permit2TokenInToRouter:
        permit2Allowance !== undefined &&
        amountIn !== undefined &&
        !isPermit2Expired &&
        permit2Allowance.amount >= amountIn,
    };
  }, [erc20Allowance, permit2Allowance, amountIn, isPermit2Expired]);

  const currentStep = useMemo<SwapApprovalStep>(() => {
    if (!approvalStatus.tokenInToPermit2) return "tokenIn_to_permit2";
    if (!approvalStatus.permit2TokenInToRouter) return "permit2_tokenIn";
    return "ready";
  }, [approvalStatus]);

  const isApproved = currentStep === "ready";

  const refetchAll = async () => {
    await Promise.all([refetchErc20(), refetchPermit2()]);
  };

  return {
    approvalStatus,
    currentStep,
    isApproved,
    refetchAll,
    permit2Address,
    universalRouter,
  };
}
