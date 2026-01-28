import { useTokenBalance } from "@/hooks/token/useTokenBalance";
import { formatTokenAmount } from "@/lib/format";
import type { Address } from "viem";

interface TokenBalanceProps {
  tokenAddress: Address;
  userAddress: Address | undefined;
  decimals: number;
  chainId: number | undefined;
  symbol: string;
}

export function TokenBalance({
  tokenAddress,
  userAddress,
  decimals,
  chainId,
  symbol,
}: TokenBalanceProps) {
  const { balance, isLoading } = useTokenBalance({
    tokenAddress,
    userAddress,
    chainId,
  });

  if (isLoading) {
    return <span className="text-muted-foreground text-sm">Loading...</span>;
  }

  if (balance === undefined) {
    return null;
  }

  return (
    <span className="text-muted-foreground text-sm">
      Balance: {formatTokenAmount(balance, decimals)} {symbol}
    </span>
  );
}
