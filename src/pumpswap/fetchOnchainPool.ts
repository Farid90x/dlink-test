// src/fetchOnchainPool.ts
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import pumpAmmIdl from "./pump_amm.json"; // مسیر را با پروژه خودت هماهنگ کن
import {
  PUMP_AMM_PROGRAM_ID,
  globalConfigPda,
  feeConfigPda,
  globalVolumeAccumulatorPda,
} from "./derivePoolPDAs";

export type PumpAmmProgram = Program; // می‌تونی اگر خواستی type دقیق‌تری بسازی

// یک wallet ساختگی برای خواندن فقط‌خواندنی
const dummyWallet = {
  publicKey: null as PublicKey | null,
  async signAllTransactions<T>(txs: T[]): Promise<T[]> {
    return txs;
  },
  async signTransaction<T>(tx: T): Promise<T> {
    return tx;
  },
};

export function getPumpAmmProgram(connection: Connection): PumpAmmProgram {
  const provider = new AnchorProvider(
    connection,
    dummyWallet as any,
    AnchorProvider.defaultOptions(),
  );

  const program = new Program(
    pumpAmmIdl as Idl,
    PUMP_AMM_PROGRAM_ID,
    provider,
  );

  return program;
}

export interface PoolWithConfig {
  poolPubkey: PublicKey;
  pool: any; // می‌تونی بعداً type قوی‌تر اضافه کنی
  globalConfigPubkey: PublicKey;
  globalConfig: any;
  feeConfigPubkey: PublicKey;
  feeConfig: any;
  globalVolumeAccumulatorPubkey: PublicKey;
  globalVolumeAccumulator: any | null;
}

export async function fetchPoolWithConfig(
  connection: Connection,
  poolPubkey: PublicKey,
): Promise<PoolWithConfig> {
  const program = getPumpAmmProgram(connection);

  // Pool
  const pool = await program.account.pool.fetch(poolPubkey);

  // GlobalConfig
  const [globalConfigPubkey] = globalConfigPda();
  const globalConfig = await program.account.globalConfig.fetch(
    globalConfigPubkey,
  );

  // FeeConfig
  const [feeConfigPubkey] = feeConfigPda();
  const feeConfig = await program.account.feeConfig.fetch(feeConfigPubkey);

  // GlobalVolumeAccumulator (ممکنه وجود نداشته باشد)
  const [globalVolumeAccumulatorPubkey] = globalVolumeAccumulatorPda();
  let globalVolumeAccumulator: any | null = null;
  try {
    globalVolumeAccumulator =
      await program.account.globalVolumeAccumulator.fetch(
        globalVolumeAccumulatorPubkey,
      );
  } catch {
    globalVolumeAccumulator = null;
  }

  return {
    poolPubkey,
    pool,
    globalConfigPubkey,
    globalConfig,
    feeConfigPubkey,
    feeConfig,
    globalVolumeAccumulatorPubkey,
    globalVolumeAccumulator,
  };
}
