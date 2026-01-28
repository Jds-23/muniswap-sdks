import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TICK_RANGE_FULL } from "@/constants/defaults";

interface FullRangeToggleProps {
  isFullRange: boolean;
  onChange: (
    isFullRange: boolean,
    tickLower: number,
    tickUpper: number,
  ) => void;
  tickSpacing: number;
}

export function FullRangeToggle({
  isFullRange,
  onChange,
  tickSpacing,
}: FullRangeToggleProps) {
  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Align to tick spacing
      const alignedLower =
        Math.ceil(TICK_RANGE_FULL.tickLower / tickSpacing) * tickSpacing;
      const alignedUpper =
        Math.floor(TICK_RANGE_FULL.tickUpper / tickSpacing) * tickSpacing;
      onChange(true, alignedLower, alignedUpper);
    } else {
      onChange(false, 0, 0);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>Full Range</Label>
        <p className="text-xs text-muted-foreground">
          Provide liquidity across all prices
        </p>
      </div>
      <Switch checked={isFullRange} onCheckedChange={handleToggle} />
    </div>
  );
}
