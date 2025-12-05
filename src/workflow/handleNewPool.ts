// @ts-nocheck
// src/handleNewPool.ts
import { PublicKey } from "@solana/web3.js";
import logger from "./logger";
import { basicRiskFilter } from "./risk/basicRiskFilter";
import { askAgentForAction } from "./agent/agentClient";
import { executeBuyTool } from "./agentTools/executeBuyTool";
import { savePosition } from "./state/positions";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = process.env.RPC_URL!;
const TRADER_SECRET = process.env.TRADER_SECRET!;

export interface NewPoolEvent {
  mintPubkey: PublicKey;
  poolPubkey: PublicKey;
  isPumpfunPool: boolean;
  coinCreator: string;
  liquidityUsd: number;
  recentBuyers: number;
  ageMs: number;
  decimals: number;
}

export async function handleNewPool(event: NewPoolEvent) {
  const {
    mintPubkey,
    poolPubkey,
    isPumpfunPool,
    coinCreator,
    liquidityUsd,
    recentBuyers,
    ageMs,
    decimals,
  } = event;

  logger.info(
    `[NEW_POOL] mint=${mintPubkey.toBase58()} pool=${poolPubkey.toBase58()} pumpfun=${isPumpfunPool}`,
  );

  // 1) اگر pumpfun-style هست فعلاً غیرفعال بماند
  if (isPumpfunPool) {
    logger.info(
      `[BUY] pumpfun-style detected → currently disabled in handleNewPool`,
    );
    return;
  }

  // 2) اینجا به‌طور پیش‌فرض فرض می‌کنیم مسیر مستقیم PumpSwap است
  logger.info(
    `[BUY] Direct PumpSwap token detected → applying RISK filter first...`,
  );

  const risk = await basicRiskFilter({
    pool: poolPubkey.toBase58(),
    baseMint: mintPubkey.toBase58(),
    quoteMint: WSOL_MINT,
    coinCreator,
    liquidityUsd,
    recentBuyers,
    ageMs,
    decimals,
  });

  if (!risk.approved) {
    logger.warn(`[RISK] Pool rejected: ${risk.reason}`);
    return;
  }

  logger.info(`[RISK] Pool passed. Handing decision to Agent...`);

  // 3) Agent تصمیم می‌گیرد «بخر / نخر / چقدر بخر / TP/SL»
  const decision = await askAgentForAction({
    type: "NEW_POOL",
    pool: poolPubkey.toBase58(),
    baseMint: mintPubkey.toBase58(),
    quoteMint: WSOL_MINT,
    coinCreator,
    liquidityUsd,
    recentBuyers,
    ageMs,
  });

  if (decision.action !== "BUY") {
    logger.warn(`[AGENT] Rejected BUY: ${decision.reason}`);
    return;
  }

  const amountIn = decision.amountInLamports;

  logger.info(
    `[AGENT] BUY approved → amount=${amountIn} lamports, TP=${decision.tpPercent}%, SL=${decision.slPercent}%`,
  );

  // 4) اجرای واقعی BUY با Tool
  const buyResult = await executeBuyTool({
    rpcUrl: RPC_URL,
    pool: poolPubkey.toBase58(),
    baseMint: mintPubkey.toBase58(),
    quoteMint: WSOL_MINT,
    userSecret: TRADER_SECRET,
    amountIn,
    prioritize: true,
  });

  const buySig = buyResult?.signature;
  if (!buySig) {
    logger.error(`[BUY] executeBuyTool did not return signature`);
    return;
  }

  logger.info(`[BUY] Success. Signature = ${buySig}`);

  // 5) ذخیره پوزیشن برای Auto-Sell / مانیتور بعدی
  await savePosition({
    pool: poolPubkey.toBase58(),
    baseMint: mintPubkey.toBase58(),
    quoteMint: WSOL_MINT,
    buySignature: buySig,
    buyAmountLamports: amountIn,
    status: "OPEN",
    tpPercent: decision.tpPercent,
    slPercent: decision.slPercent,
    openedAt: Date.now(),
  });
}
