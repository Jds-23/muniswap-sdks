import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SwapButtonProps {
  onClick: () => void;
  isApproved: boolean;
  isPoolInitialized: boolean;
  hasValidSwap: boolean;
  isPending: boolean;
  isConfirming: boolean;
  disabled?: boolean;
}

export function SwapButton({
  onClick,
  isApproved,
  isPoolInitialized,
  hasValidSwap,
  isPending,
  isConfirming,
  disabled,
}: SwapButtonProps) {
  const getButtonText = () => {
    if (isPending) return "Confirm in Wallet";
    if (isConfirming) return "Swapping...";
    if (!isPoolInitialized) return "Pool Not Initialized";
    if (!hasValidSwap) return "Enter Amount";
    if (!isApproved) return "Approve First";
    return "Swap";
  };

  const isDisabled =
    disabled ||
    !isApproved ||
    !isPoolInitialized ||
    !hasValidSwap ||
    isPending ||
    isConfirming;

  return (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className="w-full"
      size="lg"
    >
      {(isPending || isConfirming) && (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      )}
      {getButtonText()}
    </Button>
  );
}
