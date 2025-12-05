import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { buildPumpSwapSellAccounts } from "../pumpswap/buildPumpSwapSellAccounts"; // اگر بخواهی برایت می‌سازم
import { getKeypairFromSecret } from "../util/getKeypair";

export async function executeSell({
  rpcUrl,
  pool,
  baseMint,
  quoteMint,
  amountToSellLamports,
  userSecretKey,
}: {
  rpcUrl: string;
  pool: string;
  baseMint: string;
  quoteMint: string;
  amountToSellLamports: bigint;
  userSecretKey: string;
}) {

  const connection = new Connection(rpcUrl, "confirmed");
  const user = getKeypairFromSecret(userSecretKey);

  // 1) ساخت account layout
  const { accounts } = await buildPumpSwapSellAccounts({
    connection,
    poolPubkey: new PublicKey(pool),
    userPubkey: user.publicKey,
    baseMint: new PublicKey(baseMint),
    quoteMint: new PublicKey(quoteMint),
  });

  const ix = {
    programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    keys: accounts,
    data: Buffer.from([0])   // placeholder
  };

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [user]);

  return sig;
}
