export type SwapApprovalStep =
  | "tokenIn_to_permit2"
  | "permit2_tokenIn"
  | "ready";

export interface SwapApprovalStatus {
  tokenInToPermit2: boolean;
  permit2TokenInToRouter: boolean;
}
