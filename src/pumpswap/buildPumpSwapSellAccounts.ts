// src/pumpswap/buildPumpSwapSellAccounts.ts

import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  FEE_PROGRAM_ID,
  globalConfigPda,
  poolBaseTokenAta,
  poolQuoteTokenAta,
  userBaseTokenAta,
  userQuoteTokenAta,
  protocolFeeRecipientAta,
  coinCreatorVaultAuthorityPda,
  coinCreatorVaultAta,
  eventAuthorityPda,
} from "./derivePoolPDAs";
import { fetchPoolWithConfig } from "./fetchOnchainPool";

export interface BuildSellAccountsInput {
  connection: Connection;
  poolPubkey: PublicKey;
  userPubkey: PublicKey;
  baseMint: PublicKey;  // توکن لانچ (base)
  quoteMint: PublicKey; // معمولاً WSOL
}

export interface BuiltSellAccounts {
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
 * ساختن چیدمان کامل accounts برای ix = "sell" در pump_amm
 * ترتیب دقیقاً از روی IDL گرفته شده.
 */
export async function buildPumpSwapSellAccounts(
  params: BuildSellAccountsInput,
): Promise<BuiltSellAccounts> {
  const { connection, poolPubkey, userPubkey, baseMint, quoteMint } = params;

  // ۱) pool + globalConfig را از روی chain بخوان
  const { pool, globalConfig } = await fetchPoolWithConfig(
    connection,
    poolPubkey,
  );

  // ۲) PDA ها و ATA ها
  const [globalConfigPk] = globalConfigPda();

  const baseTokenProgram = TOKEN_PROGRAM_ID;
  const quoteTokenProgram = TOKEN_PROGRAM_ID;

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

  // protocol_fee_recipient[0] از globalConfig
  const protocolFeeRecipients = globalConfig.protocolFeeRecipients as any[];
  const protocolFeeRecipient = new PublicKey(protocolFeeRecipients[0]);
  const protocolFeeRecipientTokenAccount = protocolFeeRecipientAta(
    protocolFeeRecipient,
    quoteMint,
    quoteTokenProgram,
  );

  // coin_creator و vault
  const coinCreator = new PublicKey(pool.coinCreator as string);
  const [coinCreatorVaultAuthorityPk] =
    coinCreatorVaultAuthorityPda(coinCreator);
  const coinCreatorVaultAtaPk = coinCreatorVaultAta(
    coinCreatorVaultAuthorityPk,
    quoteMint,
    quoteTokenProgram,
  );

  const [eventAuthorityPk] = eventAuthorityPda();

  // ۳) چیدن accounts طبق IDL برای sell:
  //
  // pool,
  // user,
  // global_config,
  // base_mint,
  // quote_mint,
  // user_base_token_account,
  // user_quote_token_account,
  // pool_base_token_account,
  // pool_quote_token_account,
  // protocol_fee_recipient,
  // protocol_fee_recipient_token_account,
  // base_token_program,
  // quote_token_program,
  // system_program,
  // associated_token_program,
  // event_authority,
  // program,
  // coin_creator_vault_ata,
  // coin_creator_vault_authority,
  // fee_config,
  // fee_program
  //
  // (global_volume_accumulator و user_volume_accumulator فقط در buy هستند، نه sell)

  const accounts = [
    { pubkey: poolPubkey, isWritable: true, isSigner: false },          // 0 pool
    { pubkey: userPubkey, isWritable: true, isSigner: true },           // 1 user
    { pubkey: globalConfigPk, isWritable: false, isSigner: false },     // 2 global_config
    { pubkey: baseMint, isWritable: false, isSigner: false },           // 3 base_mint
    { pubkey: quoteMint, isWritable: false, isSigner: false },          // 4 quote_mint
    { pubkey: userBaseAta, isWritable: true, isSigner: false },         // 5 user_base_token_account
    { pubkey: userQuoteAta, isWritable: true, isSigner: false },        // 6 user_quote_token_account
    { pubkey: poolBaseAta, isWritable: true, isSigner: false },         // 7 pool_base_token_account
    { pubkey: poolQuoteAta, isWritable: true, isSigner: false },        // 8 pool_quote_token_account
    { pubkey: protocolFeeRecipient, isWritable: false, isSigner: false }, // 9 protocol_fee_recipient
    {
      pubkey: protocolFeeRecipientTokenAccount,
      isWritable: true,
      isSigner: false,
    },                                                                  // 10 protocol_fee_recipient_token_account
    { pubkey: baseTokenProgram, isWritable: false, isSigner: false },   // 11 base_token_program
    { pubkey: quoteTokenProgram, isWritable: false, isSigner: false },  // 12 quote_token_program
    { pubkey: SystemProgram.programId, isWritable: false, isSigner: false }, // 13 system_program
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isWritable: false,
      isSigner: false,
    },                                                                  // 14 associated_token_program
    { pubkey: eventAuthorityPk, isWritable: false, isSigner: false },   // 15 event_authority
    { pubkey: PUMP_AMM_PROGRAM_ID, isWritable: false, isSigner: false },// 16 program
    { pubkey: coinCreatorVaultAtaPk, isWritable: true, isSigner: false },     // 17 coin_creator_vault_ata
    {
      pubkey: coinCreatorVaultAuthorityPk,
      isWritable: false,
      isSigner: false,
    },                                                                  // 18 coin_creator_vault_authority
    { pubkey: (await (async () => {
      const [feeConfigPk] = (await import("./derivePoolPDAs")).feeConfigPda();
      return feeConfigPk;
    })()), isWritable: false, isSigner: false },                        // 19 fee_config
    { pubkey: FEE_PROGRAM_ID, isWritable: false, isSigner: false },     // 20 fee_program
  ];

  return {
    accounts,
    meta: { pool, globalConfig },
  };
}
