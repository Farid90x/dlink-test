// src/agent/agentClient.ts
import OpenAI from "openai";
import { tools } from "./tools-def"; // تعریف json tools
import "dotenv/config";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function askAgentForAction(ctx: {
  type: "NEW_POOL";
  pool: string;
  baseMint: string;
  quoteMint: string;
  coinCreator: string;
  liquidityUsd: number;
  recentBuyers: number;
  ageMs: number;
  fdv: number;
}) {
  const messages = [
    {
      role: "system" as const,
      content: `
تو یک trader بی‌رحم روی PumpSwap هستی.
قوانین:
- حداکثر سرمایه در هر معامله: 0.2 SOL
- فقط اگر ریسک قابل‌قبول بود بخر.
- خروجی همیشه باید JSON باشد با فیلدهای: action, reason, amountInLamports, tpPercent, slPercent.
- قبل از تصمیم، اگر لازم دیدی از ابزار getPoolLayout استفاده کن.
`,
    },
    {
      role: "user" as const,
      content: `
pool: ${ctx.pool}
baseMint: ${ctx.baseMint}
quoteMint: ${ctx.quoteMint}
coinCreator: ${ctx.coinCreator}
type: NEW_POOL
`,
    },
  ];

  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    tools,
    messages,
    response_format: { type: "json_object" },
  });

  const msg = res.choices[0].message;

  // اگر ابزار خواست صدا بزنه، مشابه چیزی که قبلاً نوشتیم اینجا هندل می‌کنی
  // الان برای ساده‌سازی، فرض می‌کنیم بدون tool تصمیم می‌گیره:

  const content = msg.content ?? "{}";
  return JSON.parse(content as string) as {
    action: "BUY" | "IGNORE";
    reason: string;
    amountInLamports: number;
    tpPercent: number;
    slPercent: number;
  };
}
