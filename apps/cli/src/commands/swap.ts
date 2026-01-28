import { config } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { Token } from "@muniswap/sdk-core";
import { Pool, V4Planner, Actions } from "@muniswap/v4-sdk";
import {
  DEFAULT_POOL,
  erc20Abi,
  PERMIT2,
  permit2Abi,
  UNIVERSAL_ROUTER,
  universalRouterAbi,
  STATE_VIEW,
  WETH,
} from "../constants.js";
import { stateViewAbi } from "../abi/stateview.js";

config();

interface SwapOptions {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  fee?: string;
  tickSpacing?: string;
  hook?: string;
}

export async function swapCommand(options: SwapOptions) {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;

  if (!privateKey) {
    console.error("PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({
    chain: arbitrum,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: arbitrum,
    transport: http(rpcUrl),
  });

  // Parse options with defaults
  const tokenInAddr = options.tokenIn as Address;
  const tokenOutAddr = options.tokenOut as Address;
  const fee = options.fee ? parseInt(options.fee) : DEFAULT_POOL.fee;
  const tickSpacing = options.tickSpacing ? parseInt(options.tickSpacing) : DEFAULT_POOL.tickSpacing;
  const hooks = (options.hook || DEFAULT_POOL.hooks) as Address;

  // Determine decimals (18 for WETH, 6 for stables)
  const decimalsIn = tokenInAddr.toLowerCase() === WETH.toLowerCase() ? 18 : 6;
  const decimalsOut = tokenOutAddr.toLowerCase() === WETH.toLowerCase() ? 18 : 6;

  const amountIn = parseUnits(options.amountIn, decimalsIn);
  const minAmountOut = parseUnits(options.minAmountOut, decimalsOut);

  // Sort tokens for pool key (currency0 < currency1 lexicographically)
  const [token0Addr, token1Addr] = tokenInAddr.toLowerCase() < tokenOutAddr.toLowerCase()
    ? [tokenInAddr, tokenOutAddr]
    : [tokenOutAddr, tokenInAddr];
  const zeroForOne = tokenInAddr.toLowerCase() === token0Addr.toLowerCase();

  const decimals0 = token0Addr.toLowerCase() === WETH.toLowerCase() ? 18 : 6;
  const decimals1 = token1Addr.toLowerCase() === WETH.toLowerCase() ? 18 : 6;

  // Create Token objects for the SDK
  const currency0 = new Token(arbitrum.id, token0Addr, decimals0);
  const currency1 = new Token(arbitrum.id, token1Addr, decimals1);

  console.log("Swap:", `${tokenInAddr} -> ${tokenOutAddr}`);
  console.log("Pool:", `${token0Addr}/${token1Addr} fee=${fee} tickSpacing=${tickSpacing}`);
  console.log("Direction:", zeroForOne ? "token0 -> token1" : "token1 -> token0");
  console.log("Amount In:", options.amountIn);
  console.log("Min Amount Out:", options.minAmountOut);

  // Compute poolId using SDK
  const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks);

  // Get current pool state to validate pool exists
  console.log("Fetching pool state...");
  console.log("Pool ID:", poolId);
  const [sqrtPriceX96, currentTick] = await publicClient.readContract({
    address: STATE_VIEW,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [poolId as `0x${string}`],
  });

  if (sqrtPriceX96 === 0n) {
    console.error("Pool not initialized. Initialize pool first or use different params.");
    process.exit(1);
  }

  console.log("sqrtPriceX96:", sqrtPriceX96.toString());
  console.log("Current tick:", currentTick);

  // Handle Permit2 approvals (tokenIn to Permit2, then Permit2 to Universal Router)
  const permit2Expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const maxUint160 = 2n ** 160n - 1n;
  const maxUint256 = 2n ** 256n - 1n;

  // Check and approve tokenIn to Permit2
  const erc20Allowance = await publicClient.readContract({
    address: tokenInAddr,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, PERMIT2],
  });

  if (erc20Allowance < amountIn) {
    console.log("Approving tokenIn to Permit2...");
    const hash = await walletClient.writeContract({
      address: tokenInAddr,
      abi: erc20Abi,
      functionName: "approve",
      args: [PERMIT2, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Approved tokenIn to Permit2:", hash);
  }

  // Check Permit2 allowance for tokenIn to Universal Router
  const [permit2Amount, permit2Exp] = await publicClient.readContract({
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [account.address, tokenInAddr, UNIVERSAL_ROUTER],
  });

  if (permit2Amount < amountIn || permit2Exp < Math.floor(Date.now() / 1000)) {
    console.log("Setting Permit2 allowance for tokenIn to Universal Router...");
    const hash = await walletClient.writeContract({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "approve",
      args: [tokenInAddr, UNIVERSAL_ROUTER, maxUint160, permit2Expiration],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Permit2 allowance set:", hash);
  }

  // Build swap calldata using V4Planner
  const planner = new V4Planner();

  // Add SWAP_EXACT_IN_SINGLE action
  planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
    {
      poolKey: {
        currency0: token0Addr,
        currency1: token1Addr,
        fee,
        tickSpacing,
        hooks,
      },
      zeroForOne,
      amountIn,
      amountOutMinimum: minAmountOut,
      hookData: "0x",
    },
  ]);

  // Add SETTLE_ALL action (pay input token)
  planner.addAction(Actions.SETTLE_ALL, [tokenInAddr, amountIn]);

  // Add TAKE_ALL action (receive output token)
  planner.addAction(Actions.TAKE_ALL, [tokenOutAddr, minAmountOut]);

  const v4RouterInput = planner.finalize();

  // Encode for Universal Router execute (V4_SWAP command = 0x10)
  const V4_SWAP_COMMAND = 0x10;
  const commands = `0x${V4_SWAP_COMMAND.toString(16).padStart(2, "0")}` as `0x${string}`;
  const inputs = [v4RouterInput as `0x${string}`];
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes from now

  console.log("Executing swap...");
  const hash = await walletClient.writeContract({
    address: UNIVERSAL_ROUTER,
    abi: universalRouterAbi,
    functionName: "execute",
    args: [commands, inputs, deadline],
  });

  console.log("Tx hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status === "success" ? "Success" : "Failed");
  console.log("Block:", receipt.blockNumber);
}
