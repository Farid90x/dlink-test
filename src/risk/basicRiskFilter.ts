// src/risk/basicRiskFilter.ts

import "dotenv/config";
import blacklistData from "./blacklist.json";
const blacklist: string[] = blacklistData as string[];
const MIN_LIQ = Number(process.env.MIN_LIQUIDITY_USD || 300);
const MIN_BUYERS = Number(process.env.MIN_BUYERS_IN_WINDOW || 1);

export async function basicRiskFilter(event: {
  pool: string;
  baseMint: string;
  quoteMint: string;
  coinCreator: string;
  liquidityUsd: number;
  recentBuyers: number;
  ageMs: number;
  decimals: number;
}) {
  // Liquidity check
  if (event.liquidityUsd < MIN_LIQ) {
    return { approved: false, reason: "LOW_LIQUIDITY" };
  }

  // Blacklist creator
  if (blacklist.includes(event.coinCreator)) {
    return { approved: false, reason: "BLACKLIST_CREATOR" };
  }

  // Buyer momentum
  if (event.recentBuyers < MIN_BUYERS) {
    return { approved: false, reason: "NO_BUYER_SUPPORT" };
  }

  // Age window
  if (event.ageMs < 150) {
    return { approved: false, reason: "TOO_EARLY" };
  }

  if (event.ageMs > 5000) {
    return { approved: false, reason: "TOO_LATE" };
  }

  // Decimal sanity check
  if (event.decimals !== 9) {
    return { approved: false, reason: "INVALID_DECIMALS" };
  }

  return { approved: true };
}
