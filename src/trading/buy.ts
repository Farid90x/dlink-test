import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { buildPumpSwapBuyAccounts } from "../pumpswap/buildPumpSwapBuyAccounts";
import { getKeypairFromSecret } from "../util/getKeypair";

export async function executeBuy({
  rpcUrl,
  pool,
  baseMint,
  quoteMint,
  amountInLamports,
  userSecretKey,
}: {
  rpcUrl: string;
  pool: string;
  baseMint: string;
  quoteMint: string;
  amountInLamports: bigint;
  userSecretKey: string;
}) {
  
  const connection = new Connection(rpcUrl, "confirmed");
  const user = getKeypairFromSecret(userSecretKey);

  // 1) ساخت account layout
  const { accounts } = await buildPumpSwapBuyAccounts({
    connection,
    poolPubkey: new PublicKey(pool),
    userPubkey: user.publicKey,
    baseMint: new PublicKey(baseMint),
    quoteMint: new PublicKey(quoteMint),
  });

  // 2) ساخت instruction BUY
  const ix = {
    programId: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
    keys: accounts,
    data: Buffer.from([0])   // placeholder
  };

  const tx = new Transaction().add(ix);

  // 3) ارسال
  const sig = await sendAndConfirmTransaction(connection, tx, [user]);
  return sig;
}
