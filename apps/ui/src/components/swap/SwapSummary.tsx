import { DEFAULT_SLIPPAGE_TOLERANCE } from "@/constants/defaults";
import type { TokenInfo } from "@/constants/tokens";
import { formatTokenAmount } from "@/lib/format";

interface SwapSummaryProps {
  tokenIn: TokenInfo | null;
  tokenOut: TokenInfo | null;
  amountIn: bigint | undefined;
  amountOut: bigint | undefined;
  amountOutMinimum: bigint | undefined;
  exchangeRate: number | undefined;
}

export function SwapSummary({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  amountOutMinimum,
  exchangeRate,
}: SwapSummaryProps) {
  if (
    !tokenIn ||
    !tokenOut ||
    amountIn === undefined ||
    amountIn === 0n ||
    amountOut === undefined
  ) {
    return null;
  }

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <h4 className="font-medium">Swap Summary</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">You pay:</span>
          <span className="font-medium">
            {formatTokenAmount(amountIn, tokenIn.decimals)} {tokenIn.symbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            You receive (estimated):
          </span>
          <span className="font-medium">
            {formatTokenAmount(amountOut, tokenOut.decimals)} {tokenOut.symbol}
          </span>
        </div>
        {amountOutMinimum !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Minimum received:</span>
            <span className="text-muted-foreground">
              {formatTokenAmount(amountOutMinimum, tokenOut.decimals)}{" "}
              {tokenOut.symbol}
            </span>
          </div>
        )}
        {exchangeRate !== undefined && exchangeRate > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exchange rate:</span>
            <span className="text-muted-foreground">
              1 {tokenIn.symbol} = {exchangeRate.toFixed(6)} {tokenOut.symbol}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Slippage tolerance:</span>
          <span className="text-muted-foreground">
            {DEFAULT_SLIPPAGE_TOLERANCE / 100}%
          </span>
        </div>
      </div>
    </div>
  );
}
