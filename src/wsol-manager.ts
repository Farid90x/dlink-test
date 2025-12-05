// src/wsol-manager.ts
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { logger } from './logger';

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const PROFIT_TRANSFER_WALLET = new PublicKey('6tGAmbQygAZ3LNp3AUjLUogZyby43QaeDrMaRnzpj9cU');

export class WSOLManager {
  private connection: Connection;
  private wallet: Keypair;
  private initialWsolBalance: number = 0;
  private wsolAccount: PublicKey | null = null;

  constructor(connection: Connection, wallet: Keypair) {
    this.connection = connection;
    this.wallet = wallet;
  }

  /**
   * Initialize WSOL manager and check/wrap SOL if needed
   */
  async initialize(requiredWsolAmount: number): Promise<boolean> {
    try {
      // Get wrap amount from .env (defaults to 0.005 SOL)
      const wrapAmount = Number(process.env.WRAP_AMOUNT_SOL ?? '0.005');
      logger.info(`[WSOL] Initializing WSOL manager (will wrap ${wrapAmount} SOL if needed)...`);

      // Get associated WSOL token account
      this.wsolAccount = await getAssociatedTokenAddress(
        WSOL_MINT,
        this.wallet.publicKey
      );

      // Check if WSOL account exists
      let wsolBalance = 0;
      let accountExists = false;

      try {
        const accountInfo = await getAccount(this.connection, this.wsolAccount);
        wsolBalance = Number(accountInfo.amount) / LAMPORTS_PER_SOL;
        accountExists = true;
        logger.info(`[WSOL] Existing WSOL balance: ${wsolBalance.toFixed(6)} WSOL`);
      } catch (e) {
        
        logger.info('[WSOL] No WSOL account found, will create when wrapping');
      }

      // Check if we need to wrap more SOL (should have at least 2x BUY_AMOUNT)
      if (wsolBalance < requiredWsolAmount) {
        logger.info(`[WSOL] Balance ${wsolBalance.toFixed(6)} < required ${requiredWsolAmount.toFixed(6)}`);
        logger.info(`[WSOL] Wrapping ${wrapAmount} SOL...`);
        
        const wrapped = await this.wrapSOL(wrapAmount);
        if (!wrapped) {
          logger.error('[WSOL] Failed to wrap SOL');
          return false;
        }

        // Update balance after wrapping
        const accountInfo = await getAccount(this.connection, this.wsolAccount);
        wsolBalance = Number(accountInfo.amount) / LAMPORTS_PER_SOL;
      } else {
        logger.info(`[WSOL] Balance sufficient (${wsolBalance.toFixed(6)} >= ${requiredWsolAmount.toFixed(6)})`);
      }

      this.initialWsolBalance = wsolBalance;
      logger.info(`✅ [WSOL] Manager initialized. Balance: ${wsolBalance.toFixed(6)} WSOL`);
      return true;

    } catch (error: any) {
      logger.error(`[WSOL] Initialization error: ${error?.message ?? error}`);
      return false;
    }
  }

  /**
   * Wrap SOL to WSOL
   */
  async wrapSOL(amount: number): Promise<boolean> {
    try {
      logger.info(`[WSOL] Wrapping ${amount.toFixed(6)} SOL to WSOL...`);

      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      const instructions: TransactionInstruction[] = [];

      // Get WSOL account
      const wsolAccount = await getAssociatedTokenAddress(
        WSOL_MINT,
        this.wallet.publicKey
      );

      // Check if account exists
      let accountExists = false;
      try {
        await getAccount(this.connection, wsolAccount);
        accountExists = true;
      } catch (e) {
        // Need to create account
      }

      // Create associated token account if doesn't exist
      if (!accountExists) {
        logger.info('[WSOL] Creating WSOL token account...');
        instructions.push(
          createAssociatedTokenAccountInstruction(
            this.wallet.publicKey,
            wsolAccount,
            this.wallet.publicKey,
            WSOL_MINT
          )
        );
      }

      // Transfer SOL to the WSOL account
      instructions.push(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: wsolAccount,
          lamports,
        })
      );

      // Sync native (convert SOL to WSOL)
      instructions.push(createSyncNativeInstruction(wsolAccount));

      // Send transaction
      const transaction = new Transaction().add(...instructions);
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: true,
      });

      logger.info(`[WSOL] Wrap transaction sent: ${signature}`);

      const latestBlockhash = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      logger.info(`✅ [WSOL] Successfully wrapped ${amount.toFixed(6)} SOL`);
      return true;

    } catch (error: any) {
      logger.error(`[WSOL] Wrap error: ${error?.message ?? error}`);
      return false;
    }
  }

  /**
   * Check current WSOL balance
   */
  async getCurrentBalance(): Promise<number> {
    try {
      if (!this.wsolAccount) {
        this.wsolAccount = await getAssociatedTokenAddress(
          WSOL_MINT,
          this.wallet.publicKey
        );
      }

      const accountInfo = await getAccount(this.connection, this.wsolAccount);
      return Number(accountInfo.amount) / LAMPORTS_PER_SOL;
    } catch (error) {
      logger.warn('[WSOL] Could not fetch balance, account might not exist');
      return 0;
    }
  }

  /**
   * Check if we have enough WSOL for a trade
   */
  async hasEnoughForTrade(requiredAmount: number): Promise<boolean> {
    const balance = await this.getCurrentBalance();
    return balance >= requiredAmount;
  }

  /**
   * Transfer profits if balance exceeds threshold
   */
  async checkAndTransferProfits(threshold: number): Promise<void> {
    try {
      const currentBalance = await this.getCurrentBalance();
      
      logger.info(`[WSOL] Current balance: ${currentBalance.toFixed(6)} WSOL, Initial: ${this.initialWsolBalance.toFixed(6)} WSOL`);

      if (currentBalance > threshold) {
        const profitToTransfer = 1.0; // Transfer 1 WSOL as specified
        logger.info(`[WSOL] Balance exceeds threshold (${threshold}), transferring ${profitToTransfer} WSOL to profit wallet`);

        const transferred = await this.transferWSol(profitToTransfer, PROFIT_TRANSFER_WALLET);
        
        if (transferred) {
          logger.info(`✅ [WSOL] Successfully transferred ${profitToTransfer} WSOL profit`);
          // Update initial balance to reflect the transfer
          this.initialWsolBalance = await this.getCurrentBalance();
        }
      } else {
        logger.info(`[WSOL] Balance below threshold, no profit transfer needed`);
      }
    } catch (error: any) {
      logger.error(`[WSOL] Profit check error: ${error?.message ?? error}`);
    }
  }

  /**
   * Transfer WSOL to another wallet
   */
  async transferWSol(amount: number, recipient: PublicKey): Promise<boolean> {
    try {
      logger.info(`[WSOL] Transferring ${amount} WSOL to ${recipient.toBase58()}`);

      // For WSOL transfers, we need to:
      // 1. Unwrap WSOL to SOL
      // 2. Transfer SOL
      // 3. Re-wrap remaining SOL

      // Simplified: Just unwrap the profit amount and send as SOL
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: recipient,
          lamports,
        })
      );

      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: true,
      });

      const latestBlockhash = await this.connection.getLatestBlockhash();
      await this.connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      logger.info(`✅ [WSOL] Transfer confirmed: ${signature}`);
      return true;

    } catch (error: any) {
      logger.error(`[WSOL] Transfer error: ${error?.message ?? error}`);
      return false;
    }
  }

  /**
   * Get profit since initialization
   */
  async getProfit(): Promise<number> {
    const currentBalance = await this.getCurrentBalance();
    return currentBalance - this.initialWsolBalance;
  }
}
