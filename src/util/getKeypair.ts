// src/util/getKeypair.ts
import { Keypair } from "@solana/web3.js";

/*export function getKeypairFromSecret(secret: string): Keypair {
  const arr = Uint8Array.from(JSON.parse(secret));
  return Keypair.fromSecretKey(arr);
}*/

import bs58 from "bs58";

export function getKeypairFromSecret(secret: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secret));
}
