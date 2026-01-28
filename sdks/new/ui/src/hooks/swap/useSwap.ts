import { universalRouterAbi } from "@/abi/universalRouter";
import { getUniversalRouter } from "@/config/contracts";
import { Actions, V4Planner } from "@uniswap/v4-sdk-next";
import { type Address, type Hex, encodeFunctionData } from "viem";
import {
  useChainId,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";

interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

interface UseSwapParams {
  poolKey: PoolKey | undefined;
  zeroForOne: boolean;
  amountIn: bigint | undefined;
  amountOutMinimum: bigint | undefined;
  tokenInAddress: Address | undefined;
  tokenOutAddress: Address | undefined;
}

// Universal Router V4_SWAP command
const V4_SWAP_COMMAND = 0x10;

export function useSwap({
  poolKey,
  zeroForOne,
  amountIn,
  amountOutMinimum,
  tokenInAddress,
  tokenOutAddress,
}: UseSwapParams) {
  const chainId = useChainId();
  const universalRouter = chainId ? getUniversalRouter(chainId) : undefined;

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

  const swap = () => {
    if (
      !poolKey ||
      !universalRouter ||
      !amountIn ||
      !amountOutMinimum ||
      !tokenInAddress ||
      !tokenOutAddress
    ) {
      return;
    }

    // Build the V4Planner actions
    const planner = new V4Planner();

    // Add swap exact in single action
    planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
      {
        poolKey: {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks,
        },
        zeroForOne,
        amountIn,
        amountOutMinimum,
        hookData: "0x",
      },
    ]);

    // Settle all: pay the input token
    planner.addAction(Actions.SETTLE_ALL, [tokenInAddress, amountIn]);

    // Take all: receive the output token
    planner.addAction(Actions.TAKE_ALL, [tokenOutAddress, amountOutMinimum]);

    // Finalize the planner to get the encoded actions
    const v4RouterInput = planner.finalize();

    // Build Universal Router execute calldata
    const commands =
      `0x${V4_SWAP_COMMAND.toString(16).padStart(2, "0")}` as Hex;
    const inputs = [v4RouterInput as Hex];
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

    const calldata = encodeFunctionData({
      abi: universalRouterAbi,
      functionName: "execute",
      args: [commands, inputs, deadline],
    });

    sendTransaction({
      to: universalRouter,
      data: calldata,
      value: 0n,
    });
  };

  return {
    swap,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    error: sendError || receiptError,
  };
}
