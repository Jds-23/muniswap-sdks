import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface MintButtonProps {
  onClick: () => void;
  isApproved: boolean;
  isPoolInitialized: boolean;
  hasValidPosition: boolean;
  isPending: boolean;
  isConfirming: boolean;
  disabled?: boolean;
}

export function MintButton({
  onClick,
  isApproved,
  isPoolInitialized,
  hasValidPosition,
  isPending,
  isConfirming,
  disabled,
}: MintButtonProps) {
  const getButtonText = () => {
    if (isPending) return "Confirm in Wallet";
    if (isConfirming) return "Minting...";
    if (!isPoolInitialized) return "Pool Not Initialized";
    if (!hasValidPosition) return "Enter Amounts";
    if (!isApproved) return "Approve First";
    return "Mint Position";
  };

  const isDisabled =
    disabled ||
    !isApproved ||
    !isPoolInitialized ||
    !hasValidPosition ||
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
