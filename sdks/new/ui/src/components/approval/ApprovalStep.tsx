import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApprovalStepProps {
  label: string;
  description: string;
  isApproved: boolean;
  isActive: boolean;
  isPending: boolean;
  onApprove: () => void;
  disabled?: boolean;
}

export function ApprovalStep({
  label,
  description,
  isApproved,
  isActive,
  isPending,
  onApprove,
  disabled,
}: ApprovalStepProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border",
        isApproved && "border-green-500/50 bg-green-500/5",
        isActive && !isApproved && "border-primary/50 bg-primary/5",
        !isActive && !isApproved && "border-muted opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
            isApproved && "bg-green-500 text-white",
            !isApproved && "bg-muted"
          )}
        >
          {isApproved ? <Check className="h-4 w-4" /> : null}
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {!isApproved && (
        <Button
          size="sm"
          onClick={onApprove}
          disabled={!isActive || isPending || disabled}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Approving
            </>
          ) : (
            "Approve"
          )}
        </Button>
      )}
    </div>
  );
}
