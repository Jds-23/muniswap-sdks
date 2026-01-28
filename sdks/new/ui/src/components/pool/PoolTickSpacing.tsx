import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PoolTickSpacingProps {
  tickSpacing: number;
  onChange: (tickSpacing: number) => void;
  disabled?: boolean;
}

export function PoolTickSpacing({
  tickSpacing,
  onChange,
  disabled,
}: PoolTickSpacingProps) {
  return (
    <div className="space-y-2">
      <Label>Tick Spacing</Label>
      <Input
        type="number"
        value={tickSpacing}
        onChange={(e) => {
          const value = Number.parseInt(e.target.value);
          if (!Number.isNaN(value) && value > 0) {
            onChange(value);
          }
        }}
        disabled={disabled}
        min={1}
      />
      <p className="text-xs text-muted-foreground">
        Determines price precision. Standard values: 1, 10, 60, 200
      </p>
    </div>
  );
}
