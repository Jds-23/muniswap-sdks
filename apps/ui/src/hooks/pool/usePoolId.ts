import { Token } from "@muniswap/sdk-core";
import { Pool } from "@muniswap/v4-sdk";
import { useMemo } from "react";
import type { Address, Hex } from "viem";

interface UsePoolIdParams {
  token0Address: Address | undefined;
  token1Address: Address | undefined;
  token0Decimals: number | undefined;
  token1Decimals: number | undefined;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  chainId: number | undefined;
}

export function usePoolId({
  token0Address,
  token1Address,
  token0Decimals,
  token1Decimals,
  fee,
  tickSpacing,
  hooks,
  chainId,
}: UsePoolIdParams) {
  const poolId = useMemo<Hex | undefined>(() => {
    if (
      !token0Address ||
      !token1Address ||
      token0Decimals === undefined ||
      token1Decimals === undefined ||
      !chainId
    ) {
      return undefined;
    }

    try {
      const currency0 = new Token(chainId, token0Address, token0Decimals);
      const currency1 = new Token(chainId, token1Address, token1Decimals);

      return Pool.getPoolId(
        currency0,
        currency1,
        fee,
        tickSpacing,
        hooks,
      ) as Hex;
    } catch {
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
    chainId,
  ]);

  return { poolId };
}
