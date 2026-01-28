import { arbitrum, base, mainnet, optimism } from "wagmi/chains";
import type { Address } from "viem";

export const CONTRACTS = {
  [arbitrum.id]: {
    POSITION_MANAGER:
      "0xd88f38f930b7952f2db2432cb002e7abbf3dd869" as Address,
    STATE_VIEW: "0x76fd297e2d437cd7f76d50f01afe6160f86e9990" as Address,
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    POOL_MANAGER: "0x360e68faccca8ca495c1b759fd9eee466db9fb32" as Address,
  },
  [mainnet.id]: {
    POSITION_MANAGER:
      "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e" as Address,
    STATE_VIEW: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227" as Address,
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    POOL_MANAGER: "0x000000000004444c5dc75cb358380d2e3de08a90" as Address,
  },
  [base.id]: {
    POSITION_MANAGER:
      "0x7c5f5a4bbd8fd63184577525326123b519429bdc" as Address,
    STATE_VIEW: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71" as Address,
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    POOL_MANAGER: "0x498581ff718922c3f8e6a244956af099b2652b2b" as Address,
  },
  [optimism.id]: {
    POSITION_MANAGER:
      "0x3c3ea4b57a46241e54610e5f022e5c45859a1017" as Address,
    STATE_VIEW: "0xc18a3169788f4f1077d3b84e193b3b0a7ebcc92e" as Address,
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    POOL_MANAGER: "0x9a13f98cb987694c9f086b1f5eb990eea8264ec3" as Address,
  },
} as const;

export type SupportedChainId = keyof typeof CONTRACTS;

export function getContracts(chainId: number) {
  const contracts = CONTRACTS[chainId as SupportedChainId];
  if (!contracts) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  return contracts;
}
