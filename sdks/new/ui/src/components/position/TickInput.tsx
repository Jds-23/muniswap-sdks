import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";

interface TickInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tickSpacing: number;
  disabled?: boolean;
}

export function TickInput({
  label,
  value,
  onChange,
  tickSpacing,
  disabled,
}: TickInputProps) {
  const roundToTickSpacing = (tick: number) => {
    return Math.round(tick / tickSpacing) * tickSpacing;
  };

  const increment = () => {
    onChange(value + tickSpacing);
  };

  const decrement = () => {
    onChange(value - tickSpacing);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={decrement}
          disabled={disabled}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const newValue = Number.parseInt(e.target.value);
            if (!Number.isNaN(newValue)) {
              onChange(roundToTickSpacing(newValue));
            }
          }}
          disabled={disabled}
          className="text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={increment}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
