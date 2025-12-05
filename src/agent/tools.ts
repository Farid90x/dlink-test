// src/agent/tools.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { buildPumpSwapBuyAccounts } from "../pumpswap/buildPumpSwapBuyAccounts";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
if (!RPC_URL) {
  throw new Error("RPC_URL is not set in .env");
}

/**
 * این تابع همون چیزی‌ه که Agent به عنوان "getPoolLayout" صداش می‌زنه.
 * ورودی ساده، خروجی JSON تمیز.
 */
export async function getPoolLayoutTool(args: {
  pool: string;
  baseMint: string;
  quoteMint: string;
  user: string;
}) {
  const connection = new Connection(RPC_URL, "confirmed");

  const poolPk = new PublicKey(args.pool);
  const baseMintPk = new PublicKey(args.baseMint);
  const quoteMintPk = new PublicKey(args.quoteMint);
  const userPk = new PublicKey(args.user);

  const { accounts } = await buildPumpSwapBuyAccounts({
    connection,
    poolPubkey: poolPk,
    userPubkey: userPk,
    baseMint: baseMintPk,
    quoteMint: quoteMintPk,
  });

  return accounts.map((acc, index) => ({
    index,
    pubkey: acc.pubkey.toBase58(),
    writable: acc.isWritable,
    signer: acc.isSigner,
  }));
}
