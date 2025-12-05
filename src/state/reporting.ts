import { Position } from "./positions";
import fs from "fs";
import path from "path";

const POSITIONS_FILE = path.join(__dirname, "positions.json");

export function getPnlSummary() {
  if (!fs.existsSync(POSITIONS_FILE)) return { total: 0, count: 0 };
  const arr: Position[] = JSON.parse(fs.readFileSync(POSITIONS_FILE, "utf8"));

  const closed = arr.filter((p) => p.status === "CLOSED");
  const total = closed.reduce(
    (sum, p) => sum + (p.realizedPnlQuote ?? 0),
    0,
  );

  return {
    total,
    count: closed.length,
  };
}
