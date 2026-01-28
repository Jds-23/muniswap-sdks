import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAddress, type Address } from "viem";

interface PoolHooksInputProps {
  hooks: Address;
  onChange: (hooks: Address) => void;
}

export function PoolHooksInput({ hooks, onChange }: PoolHooksInputProps) {
  const isZeroAddress =
    hooks === "0x0000000000000000000000000000000000000000";

  return (
    <div className="space-y-2">
      <Label>Hooks Address</Label>
      <Input
        type="text"
        placeholder="0x0000...0000"
        value={hooks}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "" || isAddress(value)) {
            onChange(
              value === ""
                ? "0x0000000000000000000000000000000000000000"
                : (value as Address)
            );
          }
        }}
      />
      <p className="text-xs text-muted-foreground">
        {isZeroAddress
          ? "No hooks (standard pool)"
          : "Custom hooks contract address"}
      </p>
    </div>
  );
}
