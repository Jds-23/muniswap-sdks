import { useChainId } from "wagmi";
import { useApprovalFlow } from "@/hooks/approval/useApprovalFlow";
import { useApproveErc20 } from "@/hooks/approval/useApproveErc20";
import { useApprovePermit2 } from "@/hooks/approval/useApprovePermit2";
import { ApprovalStep } from "./ApprovalStep";
import { getPermit2, getPositionManager } from "@/config/contracts";
import type { TokenInfo } from "@/constants/tokens";
import { useEffect } from "react";

interface ApprovalFlowProps {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  amount0Max: bigint | undefined;
  amount1Max: bigint | undefined;
  onApprovalComplete: () => void;
}

export function ApprovalFlow({
  token0,
  token1,
  amount0Max,
  amount1Max,
  onApprovalComplete,
}: ApprovalFlowProps) {
  const chainId = useChainId();
  const permit2Address = chainId ? getPermit2(chainId) : undefined;
  const positionManager = chainId ? getPositionManager(chainId) : undefined;

  const { approvalStatus, currentStep, isApproved, refetchAll } =
    useApprovalFlow({
      token0Address: token0?.address,
      token1Address: token1?.address,
      amount0Max,
      amount1Max,
    });

  // ERC20 approvals
  const {
    approve: approveToken0ToPermit2,
    isPending: isPendingToken0,
    isConfirming: isConfirmingToken0,
    isSuccess: isSuccessToken0,
  } = useApproveErc20({
    tokenAddress: token0?.address,
    spenderAddress: permit2Address,
  });

  const {
    approve: approveToken1ToPermit2,
    isPending: isPendingToken1,
    isConfirming: isConfirmingToken1,
    isSuccess: isSuccessToken1,
  } = useApproveErc20({
    tokenAddress: token1?.address,
    spenderAddress: permit2Address,
  });

  // Permit2 approvals
  const {
    approve: approvePermit2Token0,
    isPending: isPendingPermit2_0,
    isConfirming: isConfirmingPermit2_0,
    isSuccess: isSuccessPermit2_0,
  } = useApprovePermit2({
    tokenAddress: token0?.address,
    spenderAddress: positionManager,
  });

  const {
    approve: approvePermit2Token1,
    isPending: isPendingPermit2_1,
    isConfirming: isConfirmingPermit2_1,
    isSuccess: isSuccessPermit2_1,
  } = useApprovePermit2({
    tokenAddress: token1?.address,
    spenderAddress: positionManager,
  });

  // Refetch allowances after successful approvals
  useEffect(() => {
    if (isSuccessToken0 || isSuccessToken1 || isSuccessPermit2_0 || isSuccessPermit2_1) {
      refetchAll();
    }
  }, [isSuccessToken0, isSuccessToken1, isSuccessPermit2_0, isSuccessPermit2_1, refetchAll]);

  // Notify when approval is complete
  useEffect(() => {
    if (isApproved) {
      onApprovalComplete();
    }
  }, [isApproved, onApprovalComplete]);

  if (!token0 || !token1) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Approvals</h4>

      <ApprovalStep
        label={`Approve ${token0.symbol}`}
        description="Allow Permit2 to spend your tokens"
        isApproved={approvalStatus.token0ToPermit2}
        isActive={currentStep === "token0_to_permit2"}
        isPending={isPendingToken0 || isConfirmingToken0}
        onApprove={approveToken0ToPermit2}
      />

      <ApprovalStep
        label={`Approve ${token1.symbol}`}
        description="Allow Permit2 to spend your tokens"
        isApproved={approvalStatus.token1ToPermit2}
        isActive={currentStep === "token1_to_permit2"}
        isPending={isPendingToken1 || isConfirmingToken1}
        onApprove={approveToken1ToPermit2}
      />

      <ApprovalStep
        label={`Permit2 ${token0.symbol}`}
        description="Allow Position Manager to use Permit2"
        isApproved={approvalStatus.permit2Token0ToManager}
        isActive={currentStep === "permit2_token0"}
        isPending={isPendingPermit2_0 || isConfirmingPermit2_0}
        onApprove={approvePermit2Token0}
      />

      <ApprovalStep
        label={`Permit2 ${token1.symbol}`}
        description="Allow Position Manager to use Permit2"
        isApproved={approvalStatus.permit2Token1ToManager}
        isActive={currentStep === "permit2_token1"}
        isPending={isPendingPermit2_1 || isConfirmingPermit2_1}
        onApprove={approvePermit2Token1}
      />
    </div>
  );
}
