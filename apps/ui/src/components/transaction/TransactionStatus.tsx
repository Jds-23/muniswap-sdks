import { supportedChains } from "@/config/chains";
import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import type { Hex } from "viem";
import { useChainId } from "wagmi";

interface TransactionStatusProps {
  hash: Hex | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
}

export function TransactionStatus({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
}: TransactionStatusProps) {
  const chainId = useChainId();
  const chain = supportedChains.find((c) => c.id === chainId);
  const explorerUrl = chain?.blockExplorers?.default?.url;

  if (!hash && !isPending && !error) {
    return null;
  }

  return (
    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
      {isPending && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Confirm transaction in your wallet...</span>
        </div>
      )}

      {isConfirming && (
        <div className="flex items-center gap-2 text-amber-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Waiting for confirmation...</span>
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center gap-2 text-green-500">
          <CheckCircle className="h-4 w-4" />
          <span>Transaction successful!</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-4 w-4" />
          <span className="text-sm">
            {error.message.slice(0, 100)}
            {error.message.length > 100 ? "..." : ""}
          </span>
        </div>
      )}

      {hash && explorerUrl && (
        <a
          href={`${explorerUrl}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View on Explorer
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
