import { useChainId, useSwitchChain } from "wagmi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supportedChains } from "@/config/chains";

export function ChainSwitcher() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const currentChain = supportedChains.find((c) => c.id === chainId);

  return (
    <Select
      value={chainId?.toString()}
      onValueChange={(value) => switchChain?.({ chainId: parseInt(value) })}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue>{currentChain?.name || "Select Chain"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedChains.map((chain) => (
          <SelectItem key={chain.id} value={chain.id.toString()}>
            {chain.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
