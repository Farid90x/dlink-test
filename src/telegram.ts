// src/telegram.ts
import * as nodeFetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const fetchFn = (nodeFetch as any).default ?? (nodeFetch as any);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

// --- START: بخش جدید برای خواندن تنظیمات از .env ---
const PROXY_URL = process.env.PROXY_URL;
const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

// اگر متغیر در .env نبود، پیش‌فرض true در نظر گرفته می‌شود
const areNotificationsEnabled = (process.env.ENABLE_TELEGRAM_NOTIFICATIONS ?? 'true').toLowerCase() === 'true';
// --- END: بخش جدید ---


export async function sendTelegram(message: string): Promise<void> {
  // مرحله ۱: چک کردن اینکه آیا نوتیفیکیشن‌ها فعال هستند یا نه
  if (!areNotificationsEnabled) {
    return; // اگر غیرفعال بود، هیچ کاری انجام نده
  }

  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("⚠️ Telegram Bot Token or Chat ID is not set in the .env file.");
    return;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      }),
      // مرحله ۲: استفاده از پروکسی در صورت تنظیم شدن
      agent: agent 
    } as any);
  } catch (error: any) {
    // برای جلوگیری از کرش کردن برنامه، فقط کد خطا را لاگ می‌کنیم
    console.error("❌ Error sending message to Telegram:", error.code || error.message);
  }
}