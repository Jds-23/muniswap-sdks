import { getPermit2, getUniversalRouter } from "@/config/contracts";
import type { TokenInfo } from "@/constants/tokens";
import { useApproveErc20 } from "@/hooks/approval/useApproveErc20";
import { useApprovePermit2 } from "@/hooks/approval/useApprovePermit2";
import { useSwapApprovalFlow } from "@/hooks/swap/useSwapApprovalFlow";
import { useEffect } from "react";
import { useChainId } from "wagmi";
import { ApprovalStep } from "./ApprovalStep";

interface SwapApprovalFlowProps {
  tokenIn: TokenInfo | null;
  amountIn: bigint | undefined;
  onApprovalComplete: () => void;
}

export function SwapApprovalFlow({
  tokenIn,
  amountIn,
  onApprovalComplete,
}: SwapApprovalFlowProps) {
  const chainId = useChainId();
  const permit2Address = chainId ? getPermit2(chainId) : undefined;
  const universalRouter = chainId ? getUniversalRouter(chainId) : undefined;

  const { approvalStatus, currentStep, isApproved, refetchAll } =
    useSwapApprovalFlow({
      tokenInAddress: tokenIn?.address,
      amountIn,
    });

  // ERC20 approval
  const {
    approve: approveTokenInToPermit2,
    isPending: isPendingTokenIn,
    isConfirming: isConfirmingTokenIn,
    isSuccess: isSuccessTokenIn,
  } = useApproveErc20({
    tokenAddress: tokenIn?.address,
    spenderAddress: permit2Address,
  });

  // Permit2 approval
  const {
    approve: approvePermit2TokenIn,
    isPending: isPendingPermit2,
    isConfirming: isConfirmingPermit2,
    isSuccess: isSuccessPermit2,
  } = useApprovePermit2({
    tokenAddress: tokenIn?.address,
    spenderAddress: universalRouter,
  });

  // Refetch allowances after successful approvals
  useEffect(() => {
    if (isSuccessTokenIn || isSuccessPermit2) {
      refetchAll();
    }
  }, [isSuccessTokenIn, isSuccessPermit2, refetchAll]);

  // Notify when approval is complete
  useEffect(() => {
    if (isApproved) {
      onApprovalComplete();
    }
  }, [isApproved, onApprovalComplete]);

  if (!tokenIn) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Approvals</h4>

      <ApprovalStep
        label={`Approve ${tokenIn.symbol}`}
        description="Allow Permit2 to spend your tokens"
        isApproved={approvalStatus.tokenInToPermit2}
        isActive={currentStep === "tokenIn_to_permit2"}
        isPending={isPendingTokenIn || isConfirmingTokenIn}
        onApprove={approveTokenInToPermit2}
      />

      <ApprovalStep
        label={`Permit2 ${tokenIn.symbol}`}
        description="Allow Universal Router to use Permit2"
        isApproved={approvalStatus.permit2TokenInToRouter}
        isActive={currentStep === "permit2_tokenIn"}
        isPending={isPendingPermit2 || isConfirmingPermit2}
        onApprove={approvePermit2TokenIn}
      />
    </div>
  );
}
