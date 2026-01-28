import type { TokenInfo } from "@/constants/tokens";
import { usePoolId } from "@/hooks/pool/usePoolId";
import { usePoolPrice } from "@/hooks/pool/usePoolPrice";
import { usePoolState } from "@/hooks/pool/usePoolState";
import { formatNumber, shortenAddress } from "@/lib/format";
import { AlertCircle, CheckCircle } from "lucide-react";
import type { Address, Hex } from "viem";

interface PoolStateDisplayProps {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  chainId: number | undefined;
}

export function PoolStateDisplay({
  token0,
  token1,
  fee,
  tickSpacing,
  hooks,
  chainId,
}: PoolStateDisplayProps) {
  const { poolId } = usePoolId({
    token0Address: token0?.address,
    token1Address: token1?.address,
    token0Decimals: token0?.decimals,
    token1Decimals: token1?.decimals,
    fee,
    tickSpacing,
    hooks,
    chainId,
  });

  const { poolState, isInitialized, isLoading, error } = usePoolState({
    poolId,
    chainId,
  });

  const { price } = usePoolPrice({
    sqrtPriceX96: poolState?.sqrtPriceX96,
    tick: poolState?.tick,
    decimals0: token0?.decimals,
    decimals1: token1?.decimals,
  });

  if (!token0 || !token1) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        Select both tokens to see pool state
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        Loading pool state...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Error loading pool state
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="p-4 bg-amber-500/10 rounded-lg text-sm text-amber-500 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Pool not initialized
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <div className="flex items-center gap-2 text-green-500 text-sm">
        <CheckCircle className="h-4 w-4" />
        Pool Active
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Pool ID:</span>
          <p className="font-mono text-xs">
            {shortenAddress(poolId as Hex, 8)}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Current Tick:</span>
          <p className="font-medium">{poolState?.tick}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Price:</span>
          <p className="font-medium">
            {price !== undefined
              ? `${formatNumber(price, 6)} ${token1.symbol}/${token0.symbol}`
              : "-"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">LP Fee:</span>
          <p className="font-medium">{(poolState?.lpFee ?? 0) / 10000}%</p>
        </div>
      </div>
    </div>
  );
}
