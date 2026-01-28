import { getPositionManager } from "@/config/contracts";
import { Percent } from "@uniswap/sdk-core-next";
import { type Position, V4PositionManager } from "@uniswap/v4-sdk-next";
import type { Address, Hex } from "viem";
import {
  useChainId,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";

interface UseMintPositionParams {
  position: Position | undefined;
  recipient: Address | undefined;
  slippageTolerance: number; // basis points
  deadlineMinutes: number;
}

export function useMintPosition({
  position,
  recipient,
  slippageTolerance,
  deadlineMinutes,
}: UseMintPositionParams) {
  const chainId = useChainId();
  const positionManager = chainId ? getPositionManager(chainId) : undefined;

  const {
    sendTransaction,
    data: hash,
    isPending,
    error: sendError,
  } = useSendTransaction();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const mint = () => {
    if (!position || !recipient || !positionManager) {
      return;
    }

    const slippage = new Percent(slippageTolerance, 10000);
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + deadlineMinutes * 60,
    );

    const { calldata, value } = V4PositionManager.addCallParameters(position, {
      slippageTolerance: slippage,
      deadline,
      recipient,
    });

    sendTransaction({
      to: positionManager,
      data: calldata as Hex,
      value: BigInt(value),
    });
  };

  return {
    mint,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error: sendError || receiptError,
  };
}
