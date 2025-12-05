// src/executebuy.ts
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import {
  OnlinePumpAmmSdk,
  PUMP_AMM_SDK,
  buyQuoteInput,
  canonicalPumpPoolPda,
} from '@pump-fun/pump-swap-sdk';
import { MintLayout, RawMint } from '@solana/spl-token';
import { logger } from './logger';

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

export async function executeBuy(
  connection: Connection,
  mint: PublicKey,
  keypair: Keypair,
  quoteAmountLamports: bigint, // مقدار SOL به lamports
  slippageBps: number,         // مثلا 300 = 3%
  skipPreflight: boolean,
): Promise<string | null> {
  try {
    if (quoteAmountLamports <= 0n) {
      logger.error('[BUY] quoteAmountLamports must be > 0');
      return null;
    }

    // در buy.spec: slippage=1 یعنی 1%
    const slippagePercent = slippageBps / 100; // 100 bps = 1%

    const onlineSdk = new OnlinePumpAmmSdk(connection);

    // === 1) پیدا کردن pool برای (base = mint, quote = WSOL)
    const poolKey = canonicalPumpPoolPda(mint);

    const user = keypair.publicKey;

    // === 2) گرفتن swapSolanaState مثل مثال رسمی
    let retries = 0;
    while (retries < 10) {
        const acc = await connection.getAccountInfo(poolKey);
        if (acc) break;
        await new Promise(r => setTimeout(r, 350));  // ~ 1 slot
        retries++;
    }

    if (retries >= 10) {
        logger.error(`[BUY] Pool account still not found for ${poolKey.toBase58()}`);
        return null;
    }

    const swapState = await onlineSdk.swapSolanaState(poolKey, user);
    const { globalConfig, pool, poolBaseAmount, poolQuoteAmount } = swapState;

    const baseReserve = poolBaseAmount;
    const quoteReserve = poolQuoteAmount;

    const feeConfig = await onlineSdk.fetchFeeConfigAccount();

    // === 3) خواندن mint واقعی روی چین و decode به RawMint
    const mintAccountInfo = await connection.getAccountInfo(pool.baseMint);
    if (!mintAccountInfo) {
      throw new Error('Base mint account not found on chain');
    }
    const baseMintAccount = MintLayout.decode(mintAccountInfo.data) as RawMint;

    // === 4) تبدیل مقدار SOL به BN و محاسبه‌ی مقدار توکن (base) با buyQuoteInput
    const quoteBn = new BN(quoteAmountLamports.toString());

    const { base } = buyQuoteInput({
      quote: quoteBn,
      slippage: slippagePercent,
      baseReserve,
      quoteReserve,
      globalConfig,
      baseMintAccount,
      baseMint: pool.baseMint,
      coinCreator: pool.coinCreator,
      creator: pool.creator,
      feeConfig,
    });

    if (base.lten(0)) {
      logger.error('[BUY] Computed base amount <= 0, aborting');
      return null;
    }

    logger.info(
      `[BUY] Using PUMP_AMM_SDK.buyBaseInput base=${base.toString()} slippage=${slippagePercent}%`
    );

    // === 5) ساخت اینستراکشن با PUMP_AMM_SDK مثل تست "should build the instruction successfully"
    const rawResult = await PUMP_AMM_SDK.buyBaseInput(
      swapState,
      base,
      slippagePercent,
    );

    const instructions: TransactionInstruction[] = Array.isArray(rawResult)
      ? rawResult
      : (rawResult as any)?.instructions;

    if (!instructions || instructions.length === 0) {
      logger.error('[BUY] PUMP_AMM_SDK.buyBaseInput produced no instructions');
      return null;
    }

    logger.info(`[BUY] SDK produced ${instructions.length} instructions`);

    // === 6) ساخت و ارسال تراکنش
    const latest = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction({
      feePayer: user,
      recentBlockhash: latest.blockhash,
    }).add(...instructions);

    tx.sign(keypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight,
    });

    logger.info(`[BUY] Sent transaction: ${sig}`);

    await connection.confirmTransaction(
      {
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      'confirmed',
    );

    logger.info(`[BUY] Confirmed: https://solscan.io/tx/${sig}`);
    return sig;
  } catch (e: any) {
    logger.error(`[BUY] executeBuy error for mint ${mint.toBase58()}: ${e?.message ?? e}`);
    return null;
  }
}
