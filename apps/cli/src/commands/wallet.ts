import { config } from "dotenv";
import { createPublicClient, formatEther, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";

config();

const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const USDT_ADDRESS = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as const;

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export async function walletCommand() {
  const privateKey = process.env.PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;

  if (!privateKey) {
    console.error("PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const address = account.address;

  const client = createPublicClient({
    chain: arbitrum,
    transport: http(rpcUrl),
  });

  const [ethBalance, tokenBalances] = await Promise.all([
    client.getBalance({ address }),
    client.multicall({
      contracts: [
        { address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] },
        { address: USDT_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address] },
      ],
    }),
  ]);

  const usdcBalance = tokenBalances[0].status === "success" ? tokenBalances[0].result : 0n;
  const usdtBalance = tokenBalances[1].status === "success" ? tokenBalances[1].result : 0n;

  const formatToken = (val: bigint, decimals: number) =>
    Number(formatUnits(val, decimals)).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  console.log(`Address: ${address}`);
  console.log(`ETH:     ${formatEther(ethBalance)}`);
  console.log(`USDC:    ${formatToken(usdcBalance, 6)}`);
  console.log(`USDT:    ${formatToken(usdtBalance, 6)}`);
}
