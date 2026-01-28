import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { parseUnits, type Address } from "viem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TokenAmountInput } from "@/components/token/TokenAmountInput";
import { PoolFeeSelector } from "@/components/pool/PoolFeeSelector";
import { PoolHooksInput } from "@/components/pool/PoolHooksInput";
import { PoolStateDisplay } from "@/components/pool/PoolStateDisplay";
import { TickRangeSelector } from "@/components/position/TickRangeSelector";
import { PositionSummary } from "@/components/position/PositionSummary";
import { ApprovalFlow } from "@/components/approval/ApprovalFlow";
import { MintButton } from "@/components/transaction/MintButton";
import { TransactionStatus } from "@/components/transaction/TransactionStatus";
import { usePoolId } from "@/hooks/pool/usePoolId";
import { usePoolState } from "@/hooks/pool/usePoolState";
import { usePosition } from "@/hooks/position/usePosition";
import { useMintAmounts } from "@/hooks/position/useMintAmounts";
import { useMintPosition } from "@/hooks/transaction/useMintPosition";
import { useApprovalFlow } from "@/hooks/approval/useApprovalFlow";
import { DEFAULT_POOL, TICK_RANGE_FULL, DEFAULT_SLIPPAGE_TOLERANCE, DEFAULT_DEADLINE_MINUTES } from "@/constants/defaults";
import type { TokenInfo } from "@/constants/tokens";

export function MintForm() {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();

  // Token state
  const [token0, setToken0] = useState<TokenInfo | null>(null);
  const [token1, setToken1] = useState<TokenInfo | null>(null);
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");

  // Pool config state
  const [fee, setFee] = useState(DEFAULT_POOL.fee);
  const [tickSpacing, setTickSpacing] = useState(DEFAULT_POOL.tickSpacing);
  const [hooks, setHooks] = useState<Address>(DEFAULT_POOL.hooks);

  // Position state
  const [tickLower, setTickLower] = useState(TICK_RANGE_FULL.tickLower);
  const [tickUpper, setTickUpper] = useState(TICK_RANGE_FULL.tickUpper);

  // Parse amounts
  const amount0Raw = token0 ? parseUnits(amount0 || "0", token0.decimals) : 0n;
  const amount1Raw = token1 ? parseUnits(amount1 || "0", token1.decimals) : 0n;

  // Pool ID and state
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

  const { poolState, isInitialized } = usePoolState({
    poolId,
    chainId,
  });

  // Position
  const { position } = usePosition({
    token0Address: token0?.address,
    token1Address: token1?.address,
    token0Decimals: token0?.decimals,
    token1Decimals: token1?.decimals,
    fee,
    tickSpacing,
    hooks,
    sqrtPriceX96: poolState?.sqrtPriceX96,
    currentTick: poolState?.tick,
    tickLower,
    tickUpper,
    amount0: amount0Raw,
    amount1: amount1Raw,
    chainId,
  });

  const { mintAmounts } = useMintAmounts({
    position,
    slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
  });

  // Approval flow
  const { isApproved } = useApprovalFlow({
    token0Address: token0?.address,
    token1Address: token1?.address,
    amount0Max: mintAmounts?.amount0Max,
    amount1Max: mintAmounts?.amount1Max,
  });

  // Mint transaction
  const { mint, isPending, isConfirming, isSuccess, hash, error } =
    useMintPosition({
      position,
      recipient: userAddress,
      slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
      deadlineMinutes: DEFAULT_DEADLINE_MINUTES,
    });

  const handleFeeSelect = (newFee: number, newTickSpacing: number) => {
    setFee(newFee);
    setTickSpacing(newTickSpacing);
  };

  const handleApprovalComplete = useCallback(() => {
    // Approval flow is complete
  }, []);

  const hasValidPosition =
    mintAmounts !== undefined && mintAmounts.liquidity > 0n;

  if (!isConnected) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Mint V4 Position</CardTitle>
          <CardDescription>
            Connect your wallet to mint a Uniswap V4 liquidity position
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
        <CardTitle>Mint V4 Position</CardTitle>
        <CardDescription>
          Add liquidity to a Uniswap V4 pool
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Token Selection and Amounts */}
        <div className="space-y-2">
          <TokenAmountInput
            token={token0}
            amount={amount0}
            onTokenSelect={setToken0}
            onAmountChange={setAmount0}
            label="Token 0"
          />
          <TokenAmountInput
            token={token1}
            amount={amount1}
            onTokenSelect={setToken1}
            onAmountChange={setAmount1}
            label="Token 1"
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
        <PoolStateDisplay
          token0={token0}
          token1={token1}
          fee={fee}
          tickSpacing={tickSpacing}
          hooks={hooks}
          chainId={chainId}
        />

        {/* Tick Range */}
        {token0 && token1 && (
          <TickRangeSelector
            tickLower={tickLower}
            tickUpper={tickUpper}
            tickSpacing={tickSpacing}
            onTickLowerChange={setTickLower}
            onTickUpperChange={setTickUpper}
            token0={token0}
            token1={token1}
            currentTick={poolState?.tick}
          />
        )}

        {/* Position Summary */}
        <PositionSummary
          token0={token0}
          token1={token1}
          amount0={mintAmounts?.amount0}
          amount1={mintAmounts?.amount1}
          amount0Max={mintAmounts?.amount0Max}
          amount1Max={mintAmounts?.amount1Max}
          liquidity={mintAmounts?.liquidity}
          slippageTolerance={DEFAULT_SLIPPAGE_TOLERANCE}
        />

        {/* Approval Flow */}
        {hasValidPosition && isInitialized && (
          <ApprovalFlow
            token0={token0}
            token1={token1}
            amount0Max={mintAmounts?.amount0Max}
            amount1Max={mintAmounts?.amount1Max}
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

        {/* Mint Button */}
        <MintButton
          onClick={mint}
          isApproved={isApproved}
          isPoolInitialized={isInitialized}
          hasValidPosition={hasValidPosition}
          isPending={isPending}
          isConfirming={isConfirming}
        />
      </CardContent>
    </Card>
  );
}
