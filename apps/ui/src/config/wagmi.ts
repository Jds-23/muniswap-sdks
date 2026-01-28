import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, base, mainnet, optimism } from "wagmi/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo";

export const wagmiConfig = getDefaultConfig({
  appName: "Uniswap V4 Liquidity Minter",
  projectId,
  chains: [arbitrum, mainnet, base, optimism],
  ssr: false,
});
