import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Navigation } from "./Navigation";

export function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Uniswap V4</span>
          </div>
          <Navigation />
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
