import { arbitrum, base, mainnet, optimism } from "wagmi/chains";

export const supportedChains = [arbitrum, mainnet, base, optimism] as const;

export type SupportedChain = (typeof supportedChains)[number];

export function getChainName(chainId: number): string {
  const chain = supportedChains.find((c) => c.id === chainId);
  return chain?.name ?? "Unknown";
}

export function isSupportedChain(chainId: number): boolean {
  return supportedChains.some((c) => c.id === chainId);
}
