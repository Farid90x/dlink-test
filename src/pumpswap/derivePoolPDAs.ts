// src/derivePoolPDAs.ts
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const PUMP_AMM_PROGRAM_ID = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
);

// from IDL: system_program = 11111111111111111111111111111111
export const SYSTEM_PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111",
);

// from IDL: associated_token_program address
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

// from IDL: fee_program address
export const FEE_PROGRAM_ID = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
);

// =======================
//  Global-level PDAs
// =======================

export function globalConfigPda(): [PublicKey, number] {
  // seed "global_config"
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PUMP_AMM_PROGRAM_ID,
  );
}

export function globalVolumeAccumulatorPda(): [PublicKey, number] {
  // seed "global_volume_accumulator"
  return PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_AMM_PROGRAM_ID,
  );
}

export function userVolumeAccumulatorPda(
  user: PublicKey,
): [PublicKey, number] {
  // seeds: "user_volume_accumulator", user
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  );
}

// fee_config PDA از روی IDL:
//
// seeds:
//   - "fee_config"
//   - const [12, 20, 222, 252, 130, 94, 198, 118, 148, 37, 8, 24, 187, 101, 64, 101,
//            244, 41, 141, 49, 86, 213, 113, 180, 212, 248, 9, 12, 24, 233, 168, 99]
// program: fee_program (pfeeUx...)
//
// :contentReference[oaicite:1]{index=1}
const FEE_CONFIG_SALT = Buffer.from([
  12, 20, 222, 252, 130, 94, 198, 118, 148, 37, 8, 24, 187, 101, 64, 101, 244, 41,
  141, 49, 86, 213, 113, 180, 212, 248, 9, 12, 24, 233, 168, 99,
]);

export function feeConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_config"), FEE_CONFIG_SALT],
    FEE_PROGRAM_ID,
  );
}

// event_authority PDA: seed "__event_authority"
export function eventAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PUMP_AMM_PROGRAM_ID,
  );
}

// =======================
//  Pool-related helpers
// =======================

// در IDL، authority والت coin creator از روی seeds زیر ساخته می‌شود:
// seeds = ["creator_vault", pool.coin_creator]
// :contentReference[oaicite:2]{index=2}
export function coinCreatorVaultAuthorityPda(
  coinCreator: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), coinCreator.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  );
}

// ATA برای vault coin creator روی quote mint
export function coinCreatorVaultAta(
  coinCreatorVaultAuthority: PublicKey,
  quoteMint: PublicKey,
  quoteTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(
    quoteMint,
    coinCreatorVaultAuthority,
    true,
    quoteTokenProgram,
  );
}

// ATAهای pool
export function poolBaseTokenAta(
  pool: PublicKey,
  baseMint: PublicKey,
  baseTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(
    baseMint,
    pool,
    true,
    baseTokenProgram,
  );
}

export function poolQuoteTokenAta(
  pool: PublicKey,
  quoteMint: PublicKey,
  quoteTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(
    quoteMint,
    pool,
    true,
    quoteTokenProgram,
  );
}

// ATAهای کاربر
export function userBaseTokenAta(
  user: PublicKey,
  baseMint: PublicKey,
  baseTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(
    baseMint,
    user,
    false,
    baseTokenProgram,
  );
}

export function userQuoteTokenAta(
  user: PublicKey,
  quoteMint: PublicKey,
  quoteTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(
    quoteMint,
    user,
    false,
    quoteTokenProgram,
  );
}

// ATA پروتکل برای گرفتن fee روی quote mint
export function protocolFeeRecipientAta(
  protocolFeeRecipient: PublicKey,
  quoteMint: PublicKey,
  quoteTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): PublicKey {
  return getAssociatedTokenAddressSync(
    quoteMint,
    protocolFeeRecipient,
    false,
    quoteTokenProgram,
  );
}
