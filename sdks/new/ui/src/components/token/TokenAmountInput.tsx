import { useAccount, useChainId } from "wagmi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TokenSelector } from "./TokenSelector";
import { TokenBalance } from "./TokenBalance";
import { useTokenBalance } from "@/hooks/token/useTokenBalance";
import { formatTokenAmount } from "@/lib/format";
import type { TokenInfo } from "@/constants/tokens";

interface TokenAmountInputProps {
  token: TokenInfo | null;
  amount: string;
  onTokenSelect: (token: TokenInfo) => void;
  onAmountChange: (amount: string) => void;
  label?: string;
  disabled?: boolean;
}

export function TokenAmountInput({
  token,
  amount,
  onTokenSelect,
  onAmountChange,
  label,
  disabled,
}: TokenAmountInputProps) {
  const { address: userAddress } = useAccount();
  const chainId = useChainId();

  const { balance } = useTokenBalance({
    tokenAddress: token?.address,
    userAddress,
    chainId,
  });

  const handleMax = () => {
    if (balance && token) {
      onAmountChange(formatTokenAmount(balance, token.decimals, token.decimals));
    }
  };

  return (
    <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
      <div className="flex justify-between items-center">
        {label && (
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
        )}
        {token && userAddress && (
          <TokenBalance
            tokenAddress={token.address}
            userAddress={userAddress}
            decimals={token.decimals}
            chainId={chainId}
            symbol={token.symbol}
          />
        )}
      </div>
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => {
            const value = e.target.value;
            if (/^[0-9]*\.?[0-9]*$/.test(value)) {
              onAmountChange(value);
            }
          }}
          disabled={disabled}
          className="flex-1 text-lg font-medium bg-transparent border-0 focus-visible:ring-0 p-0 h-auto"
        />
        <div className="flex items-center gap-2">
          {token && balance !== undefined && balance > 0n ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMax}
              className="text-xs"
            >
              MAX
            </Button>
          ) : null}
          <TokenSelector
            selectedToken={token}
            onSelect={onTokenSelect}
          />
        </div>
      </div>
    </div>
  );
}
