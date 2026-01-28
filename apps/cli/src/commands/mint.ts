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
import { Token, Percent } from "@muniswap/sdk-core";
import { Pool, Position, V4PositionManager } from "@muniswap/v4-sdk";
import {
  DEFAULT_POOL,
  erc20Abi,
  PERMIT2,
  permit2Abi,
  POSITION_MANAGER,
  STATE_VIEW,
  WETH,
} from "../constants.js";
import { stateViewAbi } from "../abi/stateview.js";

config();

interface MintOptions {
  token0?: string;
  token1?: string;
  fee?: string;
  tickSpacing?: string;
  hook?: string;
  tickLower?: string;
  tickUpper?: string;
  amount0: string;
  amount1: string;
}

export async function mintCommand(options: MintOptions) {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;

  if (!privateKey) {
    console.error("PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  if (!options.amount0 || !options.amount1) {
    console.error("--amount0 and --amount1 required");
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
  const token0Addr = (options.token0 || DEFAULT_POOL.token0) as Address;
  const token1Addr = (options.token1 || DEFAULT_POOL.token1) as Address;
  const fee = options.fee ? parseInt(options.fee) : DEFAULT_POOL.fee;
  const tickSpacing = options.tickSpacing ? parseInt(options.tickSpacing) : DEFAULT_POOL.tickSpacing;
  const hooks = (options.hook || DEFAULT_POOL.hooks) as Address;
  const tickLower = options.tickLower ? parseInt(options.tickLower) : -887220;
  const tickUpper = options.tickUpper ? parseInt(options.tickUpper) : 887220;

  // Determine decimals (18 for WETH, 6 for stables)
  const decimals0 = token0Addr.toLowerCase() === WETH.toLowerCase() ? 18 : 6;
  const decimals1 = token1Addr.toLowerCase() === WETH.toLowerCase() ? 18 : 6;

  const amount0 = parseUnits(options.amount0, decimals0);
  const amount1 = parseUnits(options.amount1, decimals1);

  // Create Token objects for the SDK
  const currency0 = new Token(arbitrum.id, token0Addr, decimals0);
  const currency1 = new Token(arbitrum.id, token1Addr, decimals1);

  console.log("Pool:", `${token0Addr}/${token1Addr} fee=${fee} tickSpacing=${tickSpacing}`);
  console.log("Range:", `tickLower=${tickLower} tickUpper=${tickUpper}`);

  // Compute poolId using SDK
  const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks);

  // Get current pool state
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

  // Create Pool object using SDK
  const pool = new Pool(
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
    sqrtPriceX96,
    0n, // liquidity doesn't matter for position calculations
    Number(currentTick)
  );

  // Create Position from amounts using SDK
  const position = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0,
    amount1,
    useFullPrecision: true,
  });

  console.log("Liquidity:", position.liquidity.toString());

  // Calculate max amounts with slippage using SDK
  const slippageTolerance = new Percent(1, 100); // 1%
  const { amount0: amount0Max, amount1: amount1Max } = position.mintAmountsWithSlippage(slippageTolerance);

  // Permit2 expiration: 30 days from now
  const permit2Expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const maxUint160 = 2n ** 160n - 1n;
  const maxUint256 = 2n ** 256n - 1n;

  // Check and approve token0 to Permit2
  const erc20Allowance0 = await publicClient.readContract({
    address: token0Addr,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, PERMIT2],
  });

  if (erc20Allowance0 < amount0Max) {
    console.log("Approving token0 to Permit2...");
    const hash = await walletClient.writeContract({
      address: token0Addr,
      abi: erc20Abi,
      functionName: "approve",
      args: [PERMIT2, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Approved token0 to Permit2:", hash);
  }

  // Check and approve token1 to Permit2
  const erc20Allowance1 = await publicClient.readContract({
    address: token1Addr,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, PERMIT2],
  });

  if (erc20Allowance1 < amount1Max) {
    console.log("Approving token1 to Permit2...");
    const hash = await walletClient.writeContract({
      address: token1Addr,
      abi: erc20Abi,
      functionName: "approve",
      args: [PERMIT2, maxUint256],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Approved token1 to Permit2:", hash);
  }

  // Check Permit2 allowance for token0 to PositionManager
  const [permit2Amount0, permit2Exp0] = await publicClient.readContract({
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [account.address, token0Addr, POSITION_MANAGER],
  });

  if (permit2Amount0 < amount0Max || permit2Exp0 < Math.floor(Date.now() / 1000)) {
    console.log("Setting Permit2 allowance for token0...");
    const hash = await walletClient.writeContract({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "approve",
      args: [token0Addr, POSITION_MANAGER, maxUint160, permit2Expiration],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Permit2 allowance set for token0:", hash);
  }

  // Check Permit2 allowance for token1 to PositionManager
  const [permit2Amount1, permit2Exp1] = await publicClient.readContract({
    address: PERMIT2,
    abi: permit2Abi,
    functionName: "allowance",
    args: [account.address, token1Addr, POSITION_MANAGER],
  });

  if (permit2Amount1 < amount1Max || permit2Exp1 < Math.floor(Date.now() / 1000)) {
    console.log("Setting Permit2 allowance for token1...");
    const hash = await walletClient.writeContract({
      address: PERMIT2,
      abi: permit2Abi,
      functionName: "approve",
      args: [token1Addr, POSITION_MANAGER, maxUint160, permit2Expiration],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("Permit2 allowance set for token1:", hash);
  }

  // Set deadline to 20 minutes from now
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

  // Use SDK to generate calldata for minting
  const { calldata, value } = V4PositionManager.addCallParameters(position, {
    slippageTolerance,
    deadline,
    recipient: account.address,
  });

  console.log("Minting position...");
  const hash = await walletClient.sendTransaction({
    to: POSITION_MANAGER,
    data: calldata as `0x${string}`,
    value: BigInt(value),
  });

  console.log("Tx hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status === "success" ? "Success" : "Failed");
  console.log("Block:", receipt.blockNumber);
}
