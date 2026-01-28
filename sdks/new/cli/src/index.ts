#!/usr/bin/env node
import { program } from "commander";
import { walletCommand } from "./commands/wallet.js";
import { mintCommand } from "./commands/mint.js";
import { swapCommand } from "./commands/swap.js";

program
	.name("uni-v4-script")
	.description("CLI for Uniswap V4 scripts")
	.version("0.1.0");

program
	.command("wallet")
	.description("Show wallet address and balances on Arbitrum")
	.action(walletCommand);

program
	.command("mint")
	.description("Mint Uniswap V4 liquidity position")
	.option("--token0 <addr>", "currency0 address (default: USDC)")
	.option("--token1 <addr>", "currency1 address (default: USDT)")
	.option("--fee <num>", "pool fee (default: 100)")
	.option("--tickSpacing <num>", "tick spacing (default: 1)")
	.option("--hook <addr>", "hook address (default: 0x0)")
	.option("--tickLower <num>", "lower tick (default: -887220)")
	.option("--tickUpper <num>", "upper tick (default: 887220)")
	.option("--amount0 <num>", "max token0 amount (required)")
	.option("--amount1 <num>", "max token1 amount (required)")
	.action(mintCommand);

program
	.command("swap")
	.description("Swap tokens through a V4 pool")
	.requiredOption("--token-in <address>", "Input token address")
	.requiredOption("--token-out <address>", "Output token address")
	.requiredOption("--amount-in <amount>", "Amount of input token")
	.requiredOption("--min-amount-out <amount>", "Minimum output amount")
	.option("--fee <fee>", "Pool fee")
	.option("--tick-spacing <spacing>", "Tick spacing")
	.option("--hook <address>", "Hook address")
	.action(swapCommand);

program.parse();
