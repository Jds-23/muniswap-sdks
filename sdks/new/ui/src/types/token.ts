import type { Address } from "viem";

export interface TokenData {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
  logoURI?: string;
}

export interface TokenAmount {
  token: TokenData;
  amount: string;
  amountRaw?: bigint;
}
