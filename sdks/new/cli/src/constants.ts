// Arbitrum contract addresses
export const POSITION_MANAGER = "0xd88f38f930b7952f2db2432cb002e7abbf3dd869" as const;
export const POOL_MANAGER = "0x360e68faccca8ca495c1b759fd9eee466db9fb32" as const;
export const STATE_VIEW = "0x76fd297e2d437cd7f76d50f01afe6160f86e9990" as const;
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
export const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const;
export const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
export const USDT = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as const;

// Default pool config (USDC/USDT)
export const DEFAULT_POOL = {
  token0: USDC,
  token1: USDT,
  fee: 8,
  tickSpacing: 1,
  hooks: "0x0000000000000000000000000000000000000000" as const,
};

export const erc20Abi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const permit2Abi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
    stateMutability: "view",
  },
] as const;
