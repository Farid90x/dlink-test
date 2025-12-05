// pseudo: src/agentTools/poolLayout.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { buildPumpSwapBuyAccounts } from "../../src/pumpswap/buildPumpSwapBuyAccounts";


export async function agentGetBuyAccounts(args: {
  rpcUrl: string;
  pool: string;
  user: string;
  baseMint: string;
  quoteMint: string;
}) {
  const connection = new Connection(args.rpcUrl, "confirmed");
  const { accounts } = await buildPumpSwapBuyAccounts({
    connection,
    poolPubkey: new PublicKey(args.pool),
    userPubkey: new PublicKey(args.user),
    baseMint: new PublicKey(args.baseMint),
    quoteMint: new PublicKey(args.quoteMint),
  });

  // خروجی مناسب برای Agent (مثلاً به شکل JSON)
  return accounts.map((a, index) => ({
    index,
    pubkey: a.pubkey.toBase58(),
    isWritable: a.isWritable,
    isSigner: a.isSigner,
  }));
}
