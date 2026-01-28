import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useErc20Allowance } from "./useErc20Allowance";
import { usePermit2Allowance } from "./usePermit2Allowance";
import { getPermit2, getPositionManager } from "@/config/contracts";
import type { Address } from "viem";
import type { ApprovalStep } from "@/types/position";

interface UseApprovalFlowParams {
  token0Address: Address | undefined;
  token1Address: Address | undefined;
  amount0Max: bigint | undefined;
  amount1Max: bigint | undefined;
}

interface ApprovalStatus {
  token0ToPermit2: boolean;
  token1ToPermit2: boolean;
  permit2Token0ToManager: boolean;
  permit2Token1ToManager: boolean;
}

export function useApprovalFlow({
  token0Address,
  token1Address,
  amount0Max,
  amount1Max,
}: UseApprovalFlowParams) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const permit2Address = chainId ? getPermit2(chainId) : undefined;
  const positionManager = chainId ? getPositionManager(chainId) : undefined;

  // ERC20 allowances to Permit2
  const { allowance: erc20Allowance0, refetch: refetchErc20_0 } =
    useErc20Allowance({
      tokenAddress: token0Address,
      ownerAddress: userAddress,
      spenderAddress: permit2Address,
      chainId,
    });

  const { allowance: erc20Allowance1, refetch: refetchErc20_1 } =
    useErc20Allowance({
      tokenAddress: token1Address,
      ownerAddress: userAddress,
      spenderAddress: permit2Address,
      chainId,
    });

  // Permit2 allowances to PositionManager
  const {
    allowance: permit2Allowance0,
    isExpired: isPermit2_0Expired,
    refetch: refetchPermit2_0,
  } = usePermit2Allowance({
    tokenAddress: token0Address,
    ownerAddress: userAddress,
    spenderAddress: positionManager,
    chainId,
  });

  const {
    allowance: permit2Allowance1,
    isExpired: isPermit2_1Expired,
    refetch: refetchPermit2_1,
  } = usePermit2Allowance({
    tokenAddress: token1Address,
    ownerAddress: userAddress,
    spenderAddress: positionManager,
    chainId,
  });

  const approvalStatus = useMemo<ApprovalStatus>(() => {
    return {
      token0ToPermit2:
        erc20Allowance0 !== undefined &&
        amount0Max !== undefined &&
        erc20Allowance0 >= amount0Max,
      token1ToPermit2:
        erc20Allowance1 !== undefined &&
        amount1Max !== undefined &&
        erc20Allowance1 >= amount1Max,
      permit2Token0ToManager:
        permit2Allowance0 !== undefined &&
        amount0Max !== undefined &&
        !isPermit2_0Expired &&
        permit2Allowance0.amount >= amount0Max,
      permit2Token1ToManager:
        permit2Allowance1 !== undefined &&
        amount1Max !== undefined &&
        !isPermit2_1Expired &&
        permit2Allowance1.amount >= amount1Max,
    };
  }, [
    erc20Allowance0,
    erc20Allowance1,
    permit2Allowance0,
    permit2Allowance1,
    amount0Max,
    amount1Max,
    isPermit2_0Expired,
    isPermit2_1Expired,
  ]);

  const currentStep = useMemo<ApprovalStep>(() => {
    if (!approvalStatus.token0ToPermit2) return "token0_to_permit2";
    if (!approvalStatus.token1ToPermit2) return "token1_to_permit2";
    if (!approvalStatus.permit2Token0ToManager) return "permit2_token0";
    if (!approvalStatus.permit2Token1ToManager) return "permit2_token1";
    return "ready";
  }, [approvalStatus]);

  const isApproved = currentStep === "ready";

  const refetchAll = async () => {
    await Promise.all([
      refetchErc20_0(),
      refetchErc20_1(),
      refetchPermit2_0(),
      refetchPermit2_1(),
    ]);
  };

  return {
    approvalStatus,
    currentStep,
    isApproved,
    refetchAll,
    permit2Address,
    positionManager,
  };
}
