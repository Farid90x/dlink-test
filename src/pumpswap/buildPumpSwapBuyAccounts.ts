// src/buildPumpSwapBuyAccounts.ts
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  coinCreatorVaultAta,
  coinCreatorVaultAuthorityPda,
  eventAuthorityPda,
  feeConfigPda,
  globalConfigPda,
  globalVolumeAccumulatorPda,
  protocolFeeRecipientAta,
  PUMP_AMM_PROGRAM_ID,
  userBaseTokenAta,
  userQuoteTokenAta,
  userVolumeAccumulatorPda,
  poolBaseTokenAta,
  poolQuoteTokenAta,
  FEE_PROGRAM_ID,
} from "./derivePoolPDAs";
import { fetchPoolWithConfig } from "./fetchOnchainPool";

export interface BuildBuyAccountsInput {
  connection: Connection;
  poolPubkey: PublicKey;
  userPubkey: PublicKey;
  baseMint: PublicKey;  // توکن جدید (base)
  quoteMint: PublicKey; // معمولاً WSOL
}

export interface BuiltBuyAccounts {
  accounts: {
    pubkey: PublicKey;
    isWritable: boolean;
    isSigner: boolean;
  }[];
  meta: {
    pool: any;
    globalConfig: any;
  };
}

/**
 * این تابع دقیقا همان ترتیب accounts برای ix = "buy" در pump_amm را تولید می‌کند.
 * ساختار بر اساس IDL رسمی است (نه حدس و گمان).
 */
export async function buildPumpSwapBuyAccounts(
  params: BuildBuyAccountsInput,
): Promise<BuiltBuyAccounts> {
  const { connection, poolPubkey, userPubkey, baseMint, quoteMint } = params;

  // ۱) خواندن pool + globalConfig + feeConfig از روی chain
  const {
    pool,
    globalConfig,
  } = await fetchPoolWithConfig(connection, poolPubkey);

  // ۲) مشتق‌سازی PDAها و ATAها
  const [globalConfigPk] = globalConfigPda();
  const [globalVolumeAccumulatorPk] = globalVolumeAccumulatorPda();
  const [userVolumeAccumulatorPk] = userVolumeAccumulatorPda(userPubkey);
  const [feeConfigPk] = feeConfigPda();
  const [eventAuthorityPk] = eventAuthorityPda();

  const baseTokenProgram = TOKEN_PROGRAM_ID;
  const quoteTokenProgram = TOKEN_PROGRAM_ID; // WSOL/USDC و غیره

  const userBaseAta = userBaseTokenAta(
    userPubkey,
    baseMint,
    baseTokenProgram,
  );
  const userQuoteAta = userQuoteTokenAta(
    userPubkey,
    quoteMint,
    quoteTokenProgram,
  );

  const poolBaseAta = poolBaseTokenAta(
    poolPubkey,
    baseMint,
    baseTokenProgram,
  );
  const poolQuoteAta = poolQuoteTokenAta(
    poolPubkey,
    quoteMint,
    quoteTokenProgram,
  );

  // طبق GlobalConfig، لیست protocol_fee_recipients یک آرایه‌ی ۸تایی pubkey است.
  // ما از index صفر استفاده می‌کنیم (Canonical setup).
  const protocolFeeRecipient = new PublicKey(
    (globalConfig.protocolFeeRecipients as string[] | Uint8Array[])[0],
  );

  const protocolFeeRecipientTokenAccount = protocolFeeRecipientAta(
    protocolFeeRecipient,
    quoteMint,
    quoteTokenProgram,
  );

  const coinCreator = new PublicKey(pool.coinCreator as string);
  const [coinCreatorVaultAuthorityPk] =
    coinCreatorVaultAuthorityPda(coinCreator);
  const coinCreatorVaultAtaPk = coinCreatorVaultAta(
    coinCreatorVaultAuthorityPk,
    quoteMint,
    quoteTokenProgram,
  );

  // ۳) ساخت آرایه accounts طبق IDL برای ix = "buy"
  // ترتیب از pump_amm.json → instruction "buy". :contentReference[oaicite:5]{index=5}
  const accounts = [
    // 0: pool (writable)
    { pubkey: poolPubkey, isWritable: true, isSigner: false },

    // 1: user (writable, signer)
    { pubkey: userPubkey, isWritable: true, isSigner: true },

    // 2: global_config
    { pubkey: globalConfigPk, isWritable: false, isSigner: false },

    // 3: base_mint
    { pubkey: baseMint, isWritable: false, isSigner: false },

    // 4: quote_mint
    { pubkey: quoteMint, isWritable: false, isSigner: false },

    // 5: user_base_token_account
    { pubkey: userBaseAta, isWritable: true, isSigner: false },

    // 6: user_quote_token_account
    { pubkey: userQuoteAta, isWritable: true, isSigner: false },

    // 7: pool_base_token_account
    { pubkey: poolBaseAta, isWritable: true, isSigner: false },

    // 8: pool_quote_token_account
    { pubkey: poolQuoteAta, isWritable: true, isSigner: false },

    // 9: protocol_fee_recipient
    { pubkey: protocolFeeRecipient, isWritable: false, isSigner: false },

    // 10: protocol_fee_recipient_token_account
    {
      pubkey: protocolFeeRecipientTokenAccount,
      isWritable: true,
      isSigner: false,
    },

    // 11: base_token_program
    { pubkey: baseTokenProgram, isWritable: false, isSigner: false },

    // 12: quote_token_program
    { pubkey: quoteTokenProgram, isWritable: false, isSigner: false },

    // 13: system_program
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },

    // 14: associated_token_program
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isWritable: false,
      isSigner: false,
    },

    // 15: event_authority (PDA)
    { pubkey: eventAuthorityPk, isWritable: false, isSigner: false },

    // 16: program (خود pump_amm)
    { pubkey: PUMP_AMM_PROGRAM_ID, isWritable: false, isSigner: false },

    // 17: coin_creator_vault_ata
    { pubkey: coinCreatorVaultAtaPk, isWritable: true, isSigner: false },

    // 18: coin_creator_vault_authority
    {
      pubkey: coinCreatorVaultAuthorityPk,
      isWritable: false,
      isSigner: false,
    },

    // 19: global_volume_accumulator
    {
      pubkey: globalVolumeAccumulatorPk,
      isWritable: false,
      isSigner: false,
    },

    // 20: user_volume_accumulator
    {
      pubkey: userVolumeAccumulatorPk,
      isWritable: true,
      isSigner: false,
    },

    // 21: fee_config
    { pubkey: feeConfigPk, isWritable: false, isSigner: false },

    // 22: fee_program
    { pubkey: FEE_PROGRAM_ID, isWritable: false, isSigner: false },
  ];

  return {
    accounts,
    meta: {
      pool,
      globalConfig,
    },
  };
}
