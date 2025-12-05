// src/state/positions.ts
import fs from "fs";
import path from "path";

const POSITIONS_FILE = path.join(__dirname, "positions.json");

export type PositionStatus = "OPEN" | "CLOSED";

export interface Position {
  id: string;
  pool: string;
  baseMint: string;
  quoteMint: string;
  buySignature: string;
  buyAmountLamports: number;
  buyPriceInQuote: number;   // قیمت خرید بر حسب WSOL یا USD (هرچی داری)
  tpPercent: number;
  slPercent: number;
  openedAt: number;
  closedAt?: number;
  closeSignature?: string;
  closePriceInQuote?: number;
  status: PositionStatus;
  realizedPnlQuote?: number;  // سود/ضرر واقعی
}

function readAll(): Position[] {
  if (!fs.existsSync(POSITIONS_FILE)) return [];
  return JSON.parse(fs.readFileSync(POSITIONS_FILE, "utf8"));
}

function writeAll(positions: Position[]) {
  fs.writeFileSync(POSITIONS_FILE, JSON.stringify(positions, null, 2));
}

export function getOpenPositions(): Position[] {
  return readAll().filter((p) => p.status === "OPEN");
}

export function saveNewPosition(pos: Omit<Position, "id" | "status">) {
  const all = readAll();
  const id = `${pos.pool}-${Date.now()}`;
  const newPos: Position = { ...pos, id, status: "OPEN" };
  all.push(newPos);
  writeAll(all);
  return newPos;
}

export function closePosition(id: string, data: {
  closeSignature: string;
  closePriceInQuote: number;
}) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return;

  const p = all[idx];
  const priceChange =
    (data.closePriceInQuote - p.buyPriceInQuote) / p.buyPriceInQuote;
  const realizedPnl = priceChange * (p.buyAmountLamports / 1e9); // اگر quote = SOL

  all[idx] = {
    ...p,
    status: "CLOSED",
    closedAt: Date.now(),
    closeSignature: data.closeSignature,
    closePriceInQuote: data.closePriceInQuote,
    realizedPnlQuote: realizedPnl,
  };

  writeAll(all);
  return all[idx];
}
