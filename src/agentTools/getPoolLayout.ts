import { Connection, PublicKey } from "@solana/web3.js";
import { buildPumpSwapBuyAccounts } from "../pumpswap/buildPumpSwapBuyAccounts";

/**
 * Agent Tool: getPoolLayout
 *
 * این ابزار لیست کامل accountهای مورد نیاز دستور BUY را
 * از برنامه PumpSwap AMM تولید می‌کند.
 */
export async function getPoolLayout(input: {
  rpcUrl: string;
  pool: string;
  baseMint: string;
  quoteMint: string;
  user: string;
}) {

  // ایجاد connection
  const connection = new Connection(input.rpcUrl, "confirmed");

  // تبدیل ورودی‌ها به PublicKey
  const poolPk = new PublicKey(input.pool);
  const baseMintPk = new PublicKey(input.baseMint);
  const quoteMintPk = new PublicKey(input.quoteMint);
  const userPk = new PublicKey(input.user);

  // ساخت چیدمان کامل اکانت‌ها از روی PDAها و ATAها
  const { accounts } = await buildPumpSwapBuyAccounts({
    connection,
    poolPubkey: poolPk,
    userPubkey: userPk,
    baseMint: baseMintPk,
    quoteMint: quoteMintPk,
  });

  // خروجی Agent-friendly
  return accounts.map((acc, index) => ({
    index,
    pubkey: acc.pubkey.toBase58(),
    writable: acc.isWritable,
    signer: acc.isSigner,
  }));
}
