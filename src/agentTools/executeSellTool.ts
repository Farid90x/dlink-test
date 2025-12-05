// src/agentTools/executeSellTool.ts

import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

import { getKeypairFromSecret } from "../util/getKeypair";
import { buildPumpSwapSellAccounts } from "../pumpswap/buildPumpSwapSellAccounts";
import "dotenv/config";

/**
 * executeSellTool
 *
 * Agent این tool را صدا می‌زند تا یک SELL واقعی روی PumpSwap انجام شود.
 */
export async function executeSellTool(args: {
  rpcUrl: string;
  pool: string;
  baseMint: string;
  quoteMint: string;
  userSecret: string;         // private key user
  amountIn: number;           // amount of BASE tokens to sell (lamports)
  prioritize?: boolean;       // add priority fee?
}) {
  console.log("🔻 [executeSellTool] Starting SELL...");

  const connection = new Connection(args.rpcUrl, "confirmed");
  const user = getKeypairFromSecret(args.userSecret);

  const poolPk = new PublicKey(args.pool);
  const baseMintPk = new PublicKey(args.baseMint);
  const quoteMintPk = new PublicKey(args.quoteMint);
  const lamportsIn = BigInt(args.amountIn);

  // 1) ساخت account layout با فایل sellAccounts
  const { accounts } = await buildPumpSwapSellAccounts({
    connection,
    poolPubkey: poolPk,
    userPubkey: user.publicKey,
    baseMint: baseMintPk,
    quoteMint: quoteMintPk,
  });

  console.log("🧩 Built SELL accounts:", accounts.length);

  // 2) ساختن data برای SELL instruction
  //
  // ساختار SELL در PumpSwap:
  // tag = 1
  // amount_in: u64  (base token sold)
  // slippage_bps: u16
  //
  const slippageBps = 300; // 3%

  const data = Buffer.alloc(1 + 8 + 2);
  data.writeUInt8(1, 0);                        // tag = 1 (SELL)
  data.writeBigUInt64LE(lamportsIn, 1);         // sell amount
  data.writeUInt16LE(slippageBps, 1 + 8);       // slippage

  // 3) ساخت instruction SELL

  const ix = {
    programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    keys: accounts,
    data,
  };

  const tx = new Transaction();

  // Priority Fee (optional)
  if (args.prioritize) {
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 50000,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 300000,
      })
    );
  }

  tx.add(ix);
  tx.feePayer = user.publicKey;

  const blockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;

  console.log("📤 Sending SELL transaction...");

  const sig = await connection.sendTransaction(tx, [user], {
    skipPreflight: true,
  });

  console.log("✅ SELL Sent! Signature:", sig);

  return {
    signature: sig,
  };
}
