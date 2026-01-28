import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type TokenInfo, getTokensForChain } from "@/constants/tokens";
import { useTokenInfo } from "@/hooks/token/useTokenInfo";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { type Address, isAddress } from "viem";
import { useChainId } from "wagmi";
import { TokenIcon } from "./TokenIcon";

interface TokenSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (token: TokenInfo) => void;
  selectedToken?: TokenInfo | null;
}

export function TokenSelectorModal({
  open,
  onOpenChange,
  onSelect,
  selectedToken,
}: TokenSelectorModalProps) {
  const chainId = useChainId();
  const [search, setSearch] = useState("");

  const tokens = getTokensForChain(chainId);

  const isValidAddress = isAddress(search);
  const { tokenInfo: customToken, isLoading: isLoadingCustom } = useTokenInfo({
    address: isValidAddress ? (search as Address) : undefined,
    chainId,
  });

  const filteredTokens = tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(search.toLowerCase()) ||
      token.name.toLowerCase().includes(search.toLowerCase()) ||
      token.address.toLowerCase() === search.toLowerCase(),
  );

  const handleSelect = (token: TokenInfo) => {
    onSelect(token);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Search by name or paste address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {filteredTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => handleSelect(token)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors",
                  selectedToken?.address === token.address && "bg-accent",
                )}
              >
                <TokenIcon symbol={token.symbol} logoURI={token.logoURI} />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-sm text-muted-foreground">
                    {token.name}
                  </span>
                </div>
              </button>
            ))}
            {isValidAddress && customToken && (
              <button
                onClick={() =>
                  handleSelect({
                    address: search as Address,
                    symbol: customToken.symbol,
                    name: customToken.name,
                    decimals: customToken.decimals,
                  })
                }
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <TokenIcon symbol={customToken.symbol} />
                <div className="flex flex-col items-start">
                  <span className="font-medium">{customToken.symbol}</span>
                  <span className="text-sm text-muted-foreground">
                    {customToken.name}
                  </span>
                </div>
              </button>
            )}
            {isValidAddress && isLoadingCustom && (
              <div className="p-3 text-muted-foreground text-sm">
                Loading token...
              </div>
            )}
            {filteredTokens.length === 0 &&
              !isValidAddress &&
              !isLoadingCustom && (
                <div className="p-3 text-muted-foreground text-sm text-center">
                  No tokens found. Paste a token address to add a custom token.
                </div>
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
