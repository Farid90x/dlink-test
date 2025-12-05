// src/wallet.ts
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';

export function loadWalletFromEnv(): Keypair {
  const secret = process.env.WALLET_SECRET_KEY;
  if (!secret) throw new Error('WALLET_SECRET_KEY is not set in .env');

  try {
    const trimmed = secret.trim();
    if (trimmed.startsWith('[')) {
      const arr = JSON.parse(trimmed) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    // assume base58
    const decoded = bs58.decode(trimmed);
    return Keypair.fromSecretKey(Uint8Array.from(decoded));
  } catch (e: any) {
    throw new Error('Failed to parse WALLET_SECRET_KEY: ' + (e?.message ?? String(e)));
  }
}
