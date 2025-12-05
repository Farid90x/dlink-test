// logger.ts
import * as winston from 'winston';
import * as fs from 'fs';
import { createObjectCsvWriter } from 'csv-writer';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    })
  ]
});

type PoolRecord = {
  timestamp: string;
  signature: string;
  name: string;
  symbol: string;
  priceUSD: number;
  liquidityUSD: number;
};

const POOLS_CSV_PATH = 'pools.csv';
const fileExists = fs.existsSync(POOLS_CSV_PATH);

const csvWriter = createObjectCsvWriter({
  path: POOLS_CSV_PATH,
  header: [
    { id: 'timestamp', title: 'Timestamp' },
    { id: 'signature', title: 'Signature' },
    { id: 'name', title: 'Name' },
    { id: 'symbol', title: 'Symbol' },
    { id: 'priceUSD', title: 'PriceUSD' },
    { id: 'liquidityUSD', title: 'LiquidityUSD' },
  ],
  // اگر فایل وجود دارد append: true => هدر نوشته نمی‌شود
  append: fileExists
});

if (!fileExists) {
  // csv-writer خودش هدر را می‌نویسد (append: false)، پس نیازی به این نیست
} else {
  // حالت خاص: اگر خواستید دستی هدر بنویسید
  // fs.appendFileSync(POOLS_CSV_PATH, 'Timestamp,Signature,Name,Symbol,PriceUSD,LiquidityUSD\n');
}

export async function logPool(
  signature: string,
  name: string,
  symbol: string,
  priceUSD: number,
  liquidityUSD: number
): Promise<void> {
  try {
    const record: PoolRecord[] = [{
      timestamp: new Date().toISOString(),
      signature,
      name,
      symbol,
      priceUSD,
      liquidityUSD,
    }];
    await csvWriter.writeRecords(record);
  } catch (error: any) {
    logger.error(`Failed to write to CSV: ${error?.message ?? String(error)}`);
  }
}
// =======================================================================
// ============== START: بخش جدید برای لاگ کردن نتایج تستر ==============
// =======================================================================

const TESTER_CSV_PATH = 'tester_results.csv';
const testerFileExists = fs.existsSync(TESTER_CSV_PATH);

const testerCsvWriter = createObjectCsvWriter({
  path: TESTER_CSV_PATH,
  header: [
    { id: 'symbol', title: 'Symbol' },
    { id: 'entryTime', title: 'EntryTime' },
    { id: 'buyPrice', title: 'BuyPrice_SOL' },
    { id: 'entryLiquidity', title: 'EntryLiquidity_USD' },
    { id: 'solPrice', title: 'SolPrice_USD' }, // <-- این خط را اضافه کنید
    { id: 'exitTime', title: 'ExitTime' },
    { id: 'sellPrice', title: 'SellPrice_SOL' },
    { id: 'exitLiquidity', title: 'ExitLiquidity_USD' },
    { id: 'exitReason', title: 'ExitReason' },
    { id: 'removeLiqTime', title: 'RemoveLiqTime' },
    { id: 'tokenMint', title: 'TokenMint' }
  ],
  append: testerFileExists,
});

export async function logTestResult(record: any): Promise<void> {
  try {
    await testerCsvWriter.writeRecords([record]);
    logger.info(`[TESTER] Result for ${record.symbol} logged to tester_results.csv`);
  } catch (error: any) {
    logger.error(`[TESTER] Failed to write result to CSV: ${error?.message ?? String(error)}`);
  }
}
// =======================================================================
// ================ END: بخش جدید برای لاگ کردن نتایج تستر ================
// =======================================================================

// =======================================================================
// ======== START: بخش جدید برای لاگ کردن سیگنال‌های رد شده ========
// =======================================================================

export async function logTestRejection(record: any): Promise<void> {
  try {
    const rejectionRecord = {
      symbol: record.symbol,
      tokenMint: record.tokenMint,
      entryTime: new Date().toISOString(),
      exitReason: record.rejectionReason, // از ستون دلیل خروج برای ثبت دلیل رد شدن استفاده می‌کنیم
      // بقیه ستون‌ها را خالی می‌گذاریم
      buyPrice: '',
      entryLiquidity: '',
      solPrice: '',
      exitTime: '',
      sellPrice: '',
      exitLiquidity: '',
      removeLiqTime: '',
    };
    await testerCsvWriter.writeRecords([rejectionRecord]);
    logger.warn(`[TESTER] Rejected signal for ${record.symbol} logged to tester_results.csv. Reason: ${record.rejectionReason}`);
  } catch (error: any) {
    logger.error(`[TESTER] Failed to write rejection to CSV: ${error?.message ?? String(error)}`);
  }
}
// =======================================================================
// ========= END: بخش جدید برای لاگ کردن سیگنال‌های رد شده =========
// =======================================================================
