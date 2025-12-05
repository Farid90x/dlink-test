// src/executesell.ts
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  canonicalPumpPoolPda,
} from '@pump-fun/pump-swap-sdk';
import { getMint } from '@solana/spl-token';
import { logger } from './logger';

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export async function executeSell(
  mint: string,
  tokenAmount: number,       // مقدار توکن در واحد انسانی (مثلا 123.45)
  connection: Connection,
  keypair: Keypair,
  slippageBps: number,       // مثلا 300 = 3%
  skipPreflight: boolean,
): Promise<string | null> {
  try {
    const mintPk = new PublicKey(mint);

    if (tokenAmount <= 0) {
      logger.warn(`[SELL] tokenAmount must be > 0 (got ${tokenAmount})`);
      return null;
    }

    const slippagePercent = slippageBps / 100; // 100 bps = 1%

    const onlineSdk = new OnlinePumpAmmSdk(connection);

    // === 1) pool (base = mint, quote = WSOL)
    const poolKey = canonicalPumpPoolPda(mintPk);



    const user = keypair.publicKey;

    // === 2) swapSolanaState مثل sell.spec
    const swapState = await onlineSdk.swapSolanaState(poolKey, user);
    const { pool } = swapState;

    // === 3) گرفتن decimals برای تبدیل مقدار انسانی → lamports
    const mintInfo = await getMint(connection, pool.baseMint);
    const decimals = mintInfo.decimals;

    const lamportsToSell = new BN(
      Math.floor(tokenAmount * 10 ** decimals).toString(),
    );

    if (lamportsToSell.lte(new BN(0))) {
      logger.warn(
        `[SELL] Computed lamportsToSell <= 0 for amount=${tokenAmount} decimals=${decimals}`,
      );
      return null;
    }

    logger.info(
      `[SELL] Using PUMP_AMM_SDK.sellBaseInput base=${lamportsToSell.toString()} slippage=${slippagePercent}%`
    );

    // === 4) ساخت اینستراکشن مثل تست "should build the instruction successfully"
    const rawResult = await PUMP_AMM_SDK.sellBaseInput(
      swapState,
      lamportsToSell,
      slippagePercent,
    );

    const instructions: TransactionInstruction[] = Array.isArray(rawResult)
      ? rawResult
      : (rawResult as any)?.instructions;

    if (!instructions || instructions.length === 0) {
      logger.error('[SELL] PUMP_AMM_SDK.sellBaseInput produced no instructions');
      return null;
    }

    logger.info(`[SELL] SDK produced ${instructions.length} instructions`);

    // === 5) تراکنش و ارسال
    const latest = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction({
      feePayer: user,
      recentBlockhash: latest.blockhash,
    }).add(...instructions);

    tx.sign(keypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight,
    });

    logger.info(`[SELL] Sent transaction: ${sig}`);

    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed',
    );

    logger.info(`[SELL] Confirmed: https://solscan.io/tx/${sig}`);
    return sig;
  } catch (e: any) {
    logger.error(`[SELL] executeSell error for mint ${mint}: ${e?.message ?? e}`);
    return null;
  }
}
