import { useMemo } from "react";
import { Token } from "@uniswap/sdk-core-next";
import { Pool, Position } from "@uniswap/v4-sdk-next";
import type { Address } from "viem";

interface UsePositionParams {
  token0Address: Address | undefined;
  token1Address: Address | undefined;
  token0Decimals: number | undefined;
  token1Decimals: number | undefined;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  sqrtPriceX96: bigint | undefined;
  currentTick: number | undefined;
  tickLower: number;
  tickUpper: number;
  amount0: bigint;
  amount1: bigint;
  chainId: number | undefined;
}

export function usePosition({
  token0Address,
  token1Address,
  token0Decimals,
  token1Decimals,
  fee,
  tickSpacing,
  hooks,
  sqrtPriceX96,
  currentTick,
  tickLower,
  tickUpper,
  amount0,
  amount1,
  chainId,
}: UsePositionParams) {
  const position = useMemo(() => {
    if (
      !token0Address ||
      !token1Address ||
      token0Decimals === undefined ||
      token1Decimals === undefined ||
      sqrtPriceX96 === undefined ||
      currentTick === undefined ||
      !chainId
    ) {
      return undefined;
    }

    try {
      const currency0 = new Token(chainId, token0Address, token0Decimals);
      const currency1 = new Token(chainId, token1Address, token1Decimals);

      const pool = new Pool(
        currency0,
        currency1,
        fee,
        tickSpacing,
        hooks,
        sqrtPriceX96,
        0n, // liquidity doesn't matter for position calculations
        currentTick
      );

      return Position.fromAmounts({
        pool,
        tickLower,
        tickUpper,
        amount0,
        amount1,
        useFullPrecision: true,
      });
    } catch (error) {
      console.error("Error creating position:", error);
      return undefined;
    }
  }, [
    token0Address,
    token1Address,
    token0Decimals,
    token1Decimals,
    fee,
    tickSpacing,
    hooks,
    sqrtPriceX96,
    currentTick,
    tickLower,
    tickUpper,
    amount0,
    amount1,
    chainId,
  ]);

  return { position };
}
