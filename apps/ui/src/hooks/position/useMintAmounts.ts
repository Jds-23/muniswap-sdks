import { Percent } from "@muniswap/sdk-core";
import type { Position } from "@muniswap/v4-sdk";
import { useMemo } from "react";

interface UseMintAmountsParams {
  position: Position | undefined;
  slippageTolerance: number; // basis points
}

interface MintAmounts {
  amount0: bigint;
  amount1: bigint;
  amount0Max: bigint;
  amount1Max: bigint;
  liquidity: bigint;
}

export function useMintAmounts({
  position,
  slippageTolerance,
}: UseMintAmountsParams) {
  const mintAmounts = useMemo<MintAmounts | undefined>(() => {
    if (!position) {
      return undefined;
    }

    try {
      const slippage = new Percent(slippageTolerance, 10000);
      const { amount0: amount0Max, amount1: amount1Max } =
        position.mintAmountsWithSlippage(slippage);

      return {
        amount0: position.mintAmounts.amount0,
        amount1: position.mintAmounts.amount1,
        amount0Max,
        amount1Max,
        liquidity: position.liquidity,
      };
    } catch (error) {
      console.error("Error calculating mint amounts:", error);
      return undefined;
    }
  }, [position, slippageTolerance]);

  return { mintAmounts };
}
