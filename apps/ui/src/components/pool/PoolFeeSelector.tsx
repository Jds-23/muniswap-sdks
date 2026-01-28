import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FEE_TIERS } from "@/constants/defaults";

interface PoolFeeSelectorProps {
  fee: number;
  tickSpacing: number;
  onSelect: (fee: number, tickSpacing: number) => void;
}

export function PoolFeeSelector({
  fee,
  tickSpacing,
  onSelect,
}: PoolFeeSelectorProps) {
  const currentTier = FEE_TIERS.find(
    (t) => t.fee === fee && t.tickSpacing === tickSpacing,
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        Fee Tier
      </label>
      <Select
        value={
          currentTier
            ? `${currentTier.fee}-${currentTier.tickSpacing}`
            : "custom"
        }
        onValueChange={(value) => {
          const tier = FEE_TIERS.find(
            (t) => `${t.fee}-${t.tickSpacing}` === value,
          );
          if (tier) {
            onSelect(tier.fee, tier.tickSpacing);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue>
            {currentTier ? currentTier.label : `Custom (${fee / 10000}%)`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FEE_TIERS.map((tier) => (
            <SelectItem
              key={`${tier.fee}-${tier.tickSpacing}`}
              value={`${tier.fee}-${tier.tickSpacing}`}
            >
              <div className="flex justify-between w-full gap-4">
                <span>{tier.label}</span>
                <span className="text-muted-foreground text-xs">
                  tick spacing: {tier.tickSpacing}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
