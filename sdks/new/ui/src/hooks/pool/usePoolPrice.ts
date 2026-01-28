import { useMemo } from "react";
import { sqrtPriceX96ToPrice, tickToPrice } from "@/lib/format";

interface UsePoolPriceParams {
  sqrtPriceX96: bigint | undefined;
  tick: number | undefined;
  decimals0: number | undefined;
  decimals1: number | undefined;
}

export function usePoolPrice({
  sqrtPriceX96,
  tick,
  decimals0,
  decimals1,
}: UsePoolPriceParams) {
  const price = useMemo(() => {
    if (
      sqrtPriceX96 === undefined ||
      decimals0 === undefined ||
      decimals1 === undefined
    ) {
      return undefined;
    }
    return sqrtPriceX96ToPrice(sqrtPriceX96, decimals0, decimals1);
  }, [sqrtPriceX96, decimals0, decimals1]);

  const priceFromTick = useMemo(() => {
    if (
      tick === undefined ||
      decimals0 === undefined ||
      decimals1 === undefined
    ) {
      return undefined;
    }
    return tickToPrice(tick, decimals0, decimals1);
  }, [tick, decimals0, decimals1]);

  return { price, priceFromTick };
}
