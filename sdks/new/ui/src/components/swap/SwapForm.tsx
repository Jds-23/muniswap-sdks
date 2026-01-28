import { SwapApprovalFlow } from "@/components/approval/SwapApprovalFlow";
import { PoolFeeSelector } from "@/components/pool/PoolFeeSelector";
import { PoolHooksInput } from "@/components/pool/PoolHooksInput";
import { PoolStateDisplay } from "@/components/pool/PoolStateDisplay";
import { SwapButton } from "@/components/swap/SwapButton";
import { SwapSummary } from "@/components/swap/SwapSummary";
import { TokenAmountInput } from "@/components/token/TokenAmountInput";
import { TransactionStatus } from "@/components/transaction/TransactionStatus";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_POOL } from "@/constants/defaults";
import type { TokenInfo } from "@/constants/tokens";
import { usePoolId } from "@/hooks/pool/usePoolId";
import { usePoolState } from "@/hooks/pool/usePoolState";
import { useSwap } from "@/hooks/swap/useSwap";
import { useSwapApprovalFlow } from "@/hooks/swap/useSwapApprovalFlow";
import { useSwapQuote } from "@/hooks/swap/useSwapQuote";
import { formatTokenAmount } from "@/lib/format";
import { ArrowDown } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { type Address, parseUnits } from "viem";
import { useAccount, useChainId } from "wagmi";

export function SwapForm() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  // Token state
  const [tokenIn, setTokenIn] = useState<TokenInfo | null>(null);
  const [tokenOut, setTokenOut] = useState<TokenInfo | null>(null);
  const [amountIn, setAmountIn] = useState("");

  // Pool config state
  const [fee, setFee] = useState(DEFAULT_POOL.fee);
  const [tickSpacing, setTickSpacing] = useState(DEFAULT_POOL.tickSpacing);
  const [hooks, setHooks] = useState<Address>(DEFAULT_POOL.hooks);

  // Sort tokens for pool key (currency0 < currency1)
  const sortedTokens = useMemo(() => {
    if (!tokenIn || !tokenOut) return null;

    const token0 =
      tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase()
        ? tokenIn
        : tokenOut;
    const token1 =
      tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase()
        ? tokenOut
        : tokenIn;

    return { token0, token1 };
  }, [tokenIn, tokenOut]);

  // Determine swap direction
  const zeroForOne = useMemo(() => {
    if (!tokenIn || !sortedTokens) return true;
    return (
      tokenIn.address.toLowerCase() ===
      sortedTokens.token0.address.toLowerCase()
    );
  }, [tokenIn, sortedTokens]);

  // Parse amount
  const amountInRaw = tokenIn
    ? parseUnits(amountIn || "0", tokenIn.decimals)
    : 0n;

  // Pool ID and state
  const { poolId } = usePoolId({
    token0Address: sortedTokens?.token0.address,
    token1Address: sortedTokens?.token1.address,
    token0Decimals: sortedTokens?.token0.decimals,
    token1Decimals: sortedTokens?.token1.decimals,
    fee,
    tickSpacing,
    hooks,
    chainId,
  });

  const { poolState, isInitialized } = usePoolState({
    poolId,
    chainId,
  });

  // Swap quote
  const swapQuote = useSwapQuote({
    amountIn: amountInRaw > 0n ? amountInRaw : undefined,
    sqrtPriceX96: poolState?.sqrtPriceX96,
    decimalsIn: tokenIn?.decimals,
    decimalsOut: tokenOut?.decimals,
    zeroForOne,
  });

  // Format output amount for display
  const amountOut = useMemo(() => {
    if (!swapQuote || !tokenOut) return "";
    return formatTokenAmount(
      swapQuote.amountOut,
      tokenOut.decimals,
      tokenOut.decimals,
    );
  }, [swapQuote, tokenOut]);

  // Approval flow
  const { isApproved } = useSwapApprovalFlow({
    tokenInAddress: tokenIn?.address,
    amountIn: amountInRaw > 0n ? amountInRaw : undefined,
  });

  // Pool key for swap
  const poolKey = useMemo(() => {
    if (!sortedTokens) return undefined;
    return {
      currency0: sortedTokens.token0.address,
      currency1: sortedTokens.token1.address,
      fee,
      tickSpacing,
      hooks,
    };
  }, [sortedTokens, fee, tickSpacing, hooks]);

  // Swap transaction
  const { swap, isPending, isConfirming, isSuccess, hash, error } = useSwap({
    poolKey,
    zeroForOne,
    amountIn: amountInRaw > 0n ? amountInRaw : undefined,
    amountOutMinimum: swapQuote?.amountOutMinimum,
    tokenInAddress: tokenIn?.address,
    tokenOutAddress: tokenOut?.address,
  });

  const handleFeeSelect = (newFee: number, newTickSpacing: number) => {
    setFee(newFee);
    setTickSpacing(newTickSpacing);
  };

  const handleApprovalComplete = useCallback(() => {
    // Approval flow is complete
  }, []);

  const handleSwapDirection = () => {
    const prevTokenIn = tokenIn;
    const prevTokenOut = tokenOut;
    setTokenIn(prevTokenOut);
    setTokenOut(prevTokenIn);
    setAmountIn("");
  };

  const hasValidSwap =
    swapQuote !== undefined && swapQuote.amountOut > 0n && amountInRaw > 0n;

  if (!isConnected) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Swap</CardTitle>
          <CardDescription>
            Connect your wallet to swap tokens through Uniswap V4
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          Please connect your wallet to continue
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Swap</CardTitle>
        <CardDescription>Swap tokens through a Uniswap V4 pool</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Selection and Amounts */}
        <div className="space-y-2">
          <TokenAmountInput
            token={tokenIn}
            amount={amountIn}
            onTokenSelect={setTokenIn}
            onAmountChange={setAmountIn}
            label="You pay"
          />

          <div className="flex justify-center -my-2 relative z-10">
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background"
              onClick={handleSwapDirection}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>

          <TokenAmountInput
            token={tokenOut}
            amount={amountOut}
            onTokenSelect={setTokenOut}
            onAmountChange={() => {}}
            label="You receive"
            disabled
            isCalculated
          />
        </div>

        {/* Pool Configuration */}
        <div className="space-y-4">
          <PoolFeeSelector
            fee={fee}
            tickSpacing={tickSpacing}
            onSelect={handleFeeSelect}
          />
          <PoolHooksInput hooks={hooks} onChange={setHooks} />
        </div>

        {/* Pool State */}
        {sortedTokens && (
          <PoolStateDisplay
            token0={sortedTokens.token0}
            token1={sortedTokens.token1}
            fee={fee}
            tickSpacing={tickSpacing}
            hooks={hooks}
            chainId={chainId}
          />
        )}

        {/* Swap Summary */}
        <SwapSummary
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          amountIn={amountInRaw > 0n ? amountInRaw : undefined}
          amountOut={swapQuote?.amountOut}
          amountOutMinimum={swapQuote?.amountOutMinimum}
          exchangeRate={swapQuote?.exchangeRate}
        />

        {/* Approval Flow */}
        {hasValidSwap && isInitialized && (
          <SwapApprovalFlow
            tokenIn={tokenIn}
            amountIn={amountInRaw > 0n ? amountInRaw : undefined}
            onApprovalComplete={handleApprovalComplete}
          />
        )}

        {/* Transaction Status */}
        <TransactionStatus
          hash={hash}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={error}
        />

        {/* Swap Button */}
        <SwapButton
          onClick={swap}
          isApproved={isApproved}
          isPoolInitialized={isInitialized}
          hasValidSwap={hasValidSwap}
          isPending={isPending}
          isConfirming={isConfirming}
        />
      </CardContent>
    </Card>
  );
}
