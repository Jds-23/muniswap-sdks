import { useState } from "react";
import { TickInput } from "./TickInput";
import { FullRangeToggle } from "./FullRangeToggle";
import { tickToPrice } from "@/lib/format";
import type { TokenInfo } from "@/constants/tokens";

interface TickRangeSelectorProps {
  tickLower: number;
  tickUpper: number;
  tickSpacing: number;
  onTickLowerChange: (tick: number) => void;
  onTickUpperChange: (tick: number) => void;
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  currentTick?: number;
}

export function TickRangeSelector({
  tickLower,
  tickUpper,
  tickSpacing,
  onTickLowerChange,
  onTickUpperChange,
  token0,
  token1,
  currentTick,
}: TickRangeSelectorProps) {
  const [isFullRange, setIsFullRange] = useState(true);

  const handleFullRangeChange = (
    fullRange: boolean,
    newTickLower: number,
    newTickUpper: number
  ) => {
    setIsFullRange(fullRange);
    if (fullRange) {
      onTickLowerChange(newTickLower);
      onTickUpperChange(newTickUpper);
    } else if (currentTick !== undefined) {
      // Set a reasonable default range around current tick
      const rangeTicks = tickSpacing * 100;
      const alignedLower =
        Math.floor((currentTick - rangeTicks) / tickSpacing) * tickSpacing;
      const alignedUpper =
        Math.ceil((currentTick + rangeTicks) / tickSpacing) * tickSpacing;
      onTickLowerChange(alignedLower);
      onTickUpperChange(alignedUpper);
    }
  };

  const priceLower =
    token0 && token1
      ? tickToPrice(tickLower, token0.decimals, token1.decimals)
      : undefined;

  const priceUpper =
    token0 && token1
      ? tickToPrice(tickUpper, token0.decimals, token1.decimals)
      : undefined;

  return (
    <div className="space-y-4">
      <FullRangeToggle
        isFullRange={isFullRange}
        onChange={handleFullRangeChange}
        tickSpacing={tickSpacing}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <TickInput
            label="Min Tick"
            value={tickLower}
            onChange={(value) => {
              setIsFullRange(false);
              onTickLowerChange(value);
            }}
            tickSpacing={tickSpacing}
            disabled={isFullRange}
          />
          {priceLower !== undefined && token0 && token1 && (
            <p className="text-xs text-muted-foreground">
              ≈ {priceLower.toFixed(6)} {token1.symbol}/{token0.symbol}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <TickInput
            label="Max Tick"
            value={tickUpper}
            onChange={(value) => {
              setIsFullRange(false);
              onTickUpperChange(value);
            }}
            tickSpacing={tickSpacing}
            disabled={isFullRange}
          />
          {priceUpper !== undefined && token0 && token1 && (
            <p className="text-xs text-muted-foreground">
              ≈ {priceUpper.toFixed(6)} {token1.symbol}/{token0.symbol}
            </p>
          )}
        </div>
      </div>

      {currentTick !== undefined && (
        <p className="text-xs text-muted-foreground text-center">
          Current tick: {currentTick}
          {tickLower <= currentTick && currentTick <= tickUpper && (
            <span className="text-green-500 ml-2">(in range)</span>
          )}
          {(tickLower > currentTick || currentTick > tickUpper) && (
            <span className="text-amber-500 ml-2">(out of range)</span>
          )}
        </p>
      )}
    </div>
  );
}
