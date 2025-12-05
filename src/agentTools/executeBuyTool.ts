// src/agentTools/executeBuyTool.ts

import { Connection, PublicKey, Transaction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import { getKeypairFromSecret } from "../util/getKeypair"; 
import { buildPumpSwapBuyAccounts } from "../pumpswap/buildPumpSwapBuyAccounts";
import "dotenv/config";

/**
 * executeBuyTool
 *
 * Agent این تابع را صدا می‌زند تا یک خرید واقعی روی PumpSwap انجام دهد.
 */
export async function executeBuyTool(args: {
  rpcUrl: string;
  pool: string;
  baseMint: string;
  quoteMint: string;
  userSecret: string;          // کلید خصوصی کاربر
  amountIn: number;            // مقدار ورودی (Lamports)
  prioritize?: boolean;        // آیا priority fee فعال شود؟
}) {
  console.log("🚀 [executeBuyTool] Starting BUY...");

  const connection = new Connection(args.rpcUrl, "confirmed");

  const user = getKeypairFromSecret(args.userSecret);
  const poolPk = new PublicKey(args.pool);
  const baseMintPk = new PublicKey(args.baseMint);
  const quoteMintPk = new PublicKey(args.quoteMint);

  const lamportsIn = BigInt(args.amountIn);

  // 1) ساختن account layout کامل:
  const { accounts } = await buildPumpSwapBuyAccounts({
    connection,
    poolPubkey: poolPk,
    userPubkey: user.publicKey,
    baseMint: baseMintPk,
    quoteMint: quoteMintPk,
  });

  console.log("🧩 Built accounts for BUY:", accounts.length);

  // 2) ساختن دیتا (data) برای instruction BUY
  //
  // PumpSwap AMM از layout زیر برای BUY استفاده می‌کند:
  // tag = 0
  // amount_in: u64 (quote in)
  // slippage_bps: u16
  //
  // فعلاً slippage = 300 bps → 3%
  // می‌توانیم بعداً این را configurable کنیم

  const slippageBps = 300; // 3%

  const data = Buffer.alloc(1 + 8 + 2);
  data.writeUInt8(0, 0);                           // tag = 0
  data.writeBigUInt64LE(lamportsIn, 1);            // amount_in
  data.writeUInt16LE(slippageBps, 1 + 8);          // slippage

  // 3) ساختن Instruction

  const ix = {
    programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    keys: accounts,
    data,
  };

  // 4) ساخت تراکنش

  const tx = new Transaction();

  // Priority Fee (اختیاری)
  if (args.prioritize) {
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 })
    );
  }

  tx.add(ix);

  tx.feePayer = user.publicKey;

  const blockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;

  console.log("🧾 Sending BUY transaction...");

  const sig = await connection.sendTransaction(tx, [user], {
    skipPreflight: true,
  });

  console.log("✅ BUY Sent! Signature:", sig);

  return {
    signature: sig,
  };
}
