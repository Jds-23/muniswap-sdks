import { type Address, formatUnits, parseUnits } from "viem";

export function shortenAddress(address: Address, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 6,
): string {
  const formatted = formatUnits(amount, decimals);
  const [whole, fraction] = formatted.split(".");
  if (!fraction) return whole;
  return `${whole}.${fraction.slice(0, displayDecimals)}`;
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === "") return 0n;
  try {
    return parseUnits(amount, decimals);
  } catch {
    return 0n;
  }
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatNumber(num: number | bigint, decimals = 2): string {
  const value = typeof num === "bigint" ? Number(num) : num;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): number {
  const Q96 = 2n ** 96n;
  const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  const decimalAdjustment = 10 ** (decimals0 - decimals1);
  return price * decimalAdjustment;
}

export function tickToPrice(
  tick: number,
  decimals0: number,
  decimals1: number,
): number {
  const price = 1.0001 ** tick;
  const decimalAdjustment = 10 ** (decimals0 - decimals1);
  return price * decimalAdjustment;
}
