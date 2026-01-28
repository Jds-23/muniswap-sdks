import { Button } from "@/components/ui/button";
import type { TokenInfo } from "@/constants/tokens";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { TokenIcon } from "./TokenIcon";
import { TokenSelectorModal } from "./TokenSelectorModal";

interface TokenSelectorProps {
  selectedToken: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
  label?: string;
}

export function TokenSelector({
  selectedToken,
  onSelect,
  label,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="space-y-2">
        {label && (
          <label className="text-sm font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full justify-between"
        >
          {selectedToken ? (
            <div className="flex items-center gap-2">
              <TokenIcon
                symbol={selectedToken.symbol}
                logoURI={selectedToken.logoURI}
                size="sm"
              />
              <span>{selectedToken.symbol}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Select token</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </div>
      <TokenSelectorModal
        open={open}
        onOpenChange={setOpen}
        onSelect={onSelect}
        selectedToken={selectedToken}
      />
    </>
  );
}
