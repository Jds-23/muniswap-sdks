import { ConnectButton } from "@/components/wallet/ConnectButton";

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">Uniswap V4</span>
          <span className="text-muted-foreground">Liquidity Minter</span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
