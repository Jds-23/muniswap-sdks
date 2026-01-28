import { DEFAULT_SLIPPAGE_TOLERANCE } from "@/constants/defaults";
import { useMemo } from "react";

interface UseSwapQuoteParams {
  amountIn: bigint | undefined;
  sqrtPriceX96: bigint | undefined;
  decimalsIn: number | undefined;
  decimalsOut: number | undefined;
  zeroForOne: boolean;
}

interface SwapQuote {
  amountOut: bigint;
  amountOutMinimum: bigint;
  exchangeRate: number;
}

export function useSwapQuote({
  amountIn,
  sqrtPriceX96,
  decimalsIn,
  decimalsOut,
  zeroForOne,
}: UseSwapQuoteParams): SwapQuote | undefined {
  return useMemo(() => {
    if (
      amountIn === undefined ||
      amountIn === 0n ||
      sqrtPriceX96 === undefined ||
      sqrtPriceX96 === 0n ||
      decimalsIn === undefined ||
      decimalsOut === undefined
    ) {
      return undefined;
    }

    const Q96 = 2n ** 96n;

    // Calculate the price from sqrtPriceX96
    // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
    // This gives us the price of token1 in terms of token0
    const sqrtPriceSq = sqrtPriceX96 * sqrtPriceX96;
    const Q192 = Q96 * Q96;

    let amountOut: bigint;
    let exchangeRate: number;

    if (zeroForOne) {
      // Swapping token0 -> token1
      // amountOut = amountIn * price (adjusted for decimals)
      // price = sqrtPriceX96^2 / 2^192
      const decimalAdjustment = 10n ** BigInt(decimalsOut - decimalsIn);
      amountOut = (amountIn * sqrtPriceSq * decimalAdjustment) / Q192;

      // Exchange rate for display
      exchangeRate =
        Number(sqrtPriceSq) / Number(Q192) / 10 ** (decimalsIn - decimalsOut);
    } else {
      // Swapping token1 -> token0
      // amountOut = amountIn / price (adjusted for decimals)
      // 1/price = 2^192 / sqrtPriceX96^2
      const decimalAdjustment = 10n ** BigInt(decimalsIn - decimalsOut);
      amountOut = (amountIn * Q192 * decimalAdjustment) / sqrtPriceSq;

      // Exchange rate for display (token1 per token0)
      exchangeRate =
        Number(Q192) / Number(sqrtPriceSq) / 10 ** (decimalsOut - decimalsIn);
    }

    // Apply slippage (1% default)
    const slippageMultiplier = 10000n - BigInt(DEFAULT_SLIPPAGE_TOLERANCE);
    const amountOutMinimum = (amountOut * slippageMultiplier) / 10000n;

    return {
      amountOut,
      amountOutMinimum,
      exchangeRate,
    };
  }, [amountIn, sqrtPriceX96, decimalsIn, decimalsOut, zeroForOne]);
}
