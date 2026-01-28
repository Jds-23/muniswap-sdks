import type { TokenInfo } from "@/constants/tokens";
import { formatTokenAmount } from "@/lib/format";

interface PositionSummaryProps {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  amount0: bigint | undefined;
  amount1: bigint | undefined;
  amount0Max: bigint | undefined;
  amount1Max: bigint | undefined;
  liquidity: bigint | undefined;
  slippageTolerance: number;
}

export function PositionSummary({
  token0,
  token1,
  amount0,
  amount1,
  amount0Max,
  amount1Max,
  liquidity,
  slippageTolerance,
}: PositionSummaryProps) {
  if (!token0 || !token1 || liquidity === undefined || liquidity === 0n) {
    return null;
  }

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <h4 className="font-medium">Position Summary</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Liquidity:</span>
          <p className="font-mono">{liquidity.toString()}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Slippage:</span>
          <p>{slippageTolerance / 100}%</p>
        </div>
        {amount0 !== undefined && (
          <div>
            <span className="text-muted-foreground">
              {token0.symbol} Amount:
            </span>
            <p className="font-medium">
              {formatTokenAmount(amount0, token0.decimals)}
            </p>
            {amount0Max !== undefined && (
              <p className="text-xs text-muted-foreground">
                Max: {formatTokenAmount(amount0Max, token0.decimals)}
              </p>
            )}
          </div>
        )}
        {amount1 !== undefined && (
          <div>
            <span className="text-muted-foreground">
              {token1.symbol} Amount:
            </span>
            <p className="font-medium">
              {formatTokenAmount(amount1, token1.decimals)}
            </p>
            {amount1Max !== undefined && (
              <p className="text-xs text-muted-foreground">
                Max: {formatTokenAmount(amount1Max, token1.decimals)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
