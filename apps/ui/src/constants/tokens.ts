import type { Address } from "viem";
import { arbitrum, base, mainnet, optimism } from "wagmi/chains";

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export const NATIVE_TOKEN: TokenInfo = {
  address: "0x0000000000000000000000000000000000000000" as Address,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
};

export const COMMON_TOKENS: Record<number, TokenInfo[]> = {
  [arbitrum.id]: [
    {
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    {
      address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" as Address,
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
    },
    {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as Address,
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
    },
  ],
  [mainnet.id]: [
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    {
      address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address,
      symbol: "WBTC",
      name: "Wrapped BTC",
      decimals: 8,
    },
    {
      address: "0x6B175474E89094C44Da98b954EescdeCB5c811111" as Address,
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
    },
  ],
  [base.id]: [
    {
      address: "0x4200000000000000000000000000000000000006" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    {
      address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as Address,
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
    },
  ],
  [optimism.id]: [
    {
      address: "0x4200000000000000000000000000000000000006" as Address,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
    },
    {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
    {
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" as Address,
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
    },
    {
      address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as Address,
      symbol: "DAI",
      name: "Dai Stablecoin",
      decimals: 18,
    },
  ],
};

export function getTokensForChain(chainId: number): TokenInfo[] {
  return COMMON_TOKENS[chainId] || [];
}
