export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { fetchAllKintoneRecords, str, num, toYM } from "../../../lib/kintone";

// ── 予算（千円単位） ────────────────────────────────────────────
const BUDGET: Record<string, number> = {
  "2025-10": 16073,
  "2025-11": 17408,
  "2025-12": 19597,
  "2026-01": 23685,
  "2026-02": 19156,
  "2026-03": 18824,
  "2026-04": 18709,
  "2026-05": 17336,
  "2026-06": 15923,
};

// ── CSV パーサー（シンプル） ────────────────────────────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}

function readCSV(filename: string): Record<string, string>[] {
  const filePath = path.join(process.cwd(), "data", filename);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return parseCSV(content);
  } catch {
    return [];
  }
}

// 月名 → YYYY-MM 変換（CSVの「10月」→「2025-10」等）
function csvMonthToYM(month: string): string | null {
  const m = month.replace("月", "");
  const n = parseInt(m, 10);
  if (isNaN(n)) return null;
  // 10〜3月: 10〜12 = 2025年, 1〜3 = 2026年
  if (n >= 10) return `2025-${String(n).padStart(2, "0")}`;
  if (n >= 1 && n <= 3) return `2026-${String(n).padStart(2, "0")}`;
  return null;
}

// ── Kintone クエリ ───────────────────────────────────────────────
const KINTONE_QUERY = '葬儀日_法要日 >= "2026-04-01" and 葬儀日_法要日 <= "2026-06-30"';

// ── メイン GET ───────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const type = req.nextUrl.searchParams.get("type") ?? "summary";

  try {
    // CSV 読み込み
    const csvMonthly = readCSV("集計_月別手数料率別.csv");
    const csvDenom   = readCSV("集計_宗派別.csv");
    const csvHall    = readCSV("集計_会館別.csv");

    // Kintone レコード取得
    let kintoneRecords: Awaited<ReturnType<typeof fetchAllKintoneRecords>> = [];
    try {
      kintoneRecords = await fetchAllKintoneRecords(KINTONE_QUERY);
    } catch (e) {
      console.error("Kintone fetch error:", e);
      // Kintone エラーは無視して CSV のみで続行
    }

    // Kintone レコード整形
    const kRecs = kintoneRecords.map(r => ({
      fee:      Math.round(num(r, "手数料金額")),
      rate:     num(r, "手数料率"),
      denomination: str(r, "宗教名"),
      hall:     str(r, "ルックアップ_会館名ティア"),
      date:     str(r, "葬儀日_法要日"),
      category: str(r, "葬法区分"),
      division: str(r, "事業部名"),
      officiant: str(r, "宗教者名"),
      yearMonth: toYM(str(r, "葬儀日_法要日")) ?? "",
    }));

    // ── summary ───────────────────────────────────────────────────
    if (type === "summary") {
      // CSV 月別
      const csvMonthMap = new Map<string, { fee30: number; fee40: number; total: number; count: number }>();
      for (const row of csvMonthly) {
        const ym = csvMonthToYM(row["月"] ?? "");
        if (!ym) continue;
        csvMonthMap.set(ym, {
          fee30:  Math.round(parseFloat(row["30%手数料"] ?? "0") / 1000),
          fee40:  Math.round(parseFloat(row["40%手数料"] ?? "0") / 1000),
          total:  Math.round(parseFloat(row["月合計"] ?? "0") / 1000),
          count:  parseInt(row["件数"] ?? "0", 10),
        });
      }

      // Kintone 月別（4〜6月）
      const kMonthMap = new Map<string, { fee30: number; fee40: number; total: number; count: number }>();
      for (const r of kRecs) {
        const ym = r.yearMonth;
        if (!ym) continue;
        const e = kMonthMap.get(ym) ?? { fee30: 0, fee40: 0, total: 0, count: 0 };
        const feeK = Math.round(r.fee / 1000);
        e.total += feeK;
        e.count += 1;
        if (r.rate === 30) e.fee30 += feeK;
        else if (r.rate === 40) e.fee40 += feeK;
        kMonthMap.set(ym, e);
      }

      const MONTHS = Object.keys(BUDGET);
      const monthly = MONTHS.map(ym => {
        const csv = csvMonthMap.get(ym) ?? { fee30: 0, fee40: 0, total: 0, count: 0 };
        const kt  = kMonthMap.get(ym)  ?? { fee30: 0, fee40: 0, total: 0, count: 0 };
        return {
          month: ym,
          fee30:  csv.fee30 + kt.fee30,
          fee40:  csv.fee40 + kt.fee40,
          total:  csv.total + kt.total,
          count:  csv.count + kt.count,
          budget: BUDGET[ym] ?? 0,
        };
      });

      const totalFee     = monthly.reduce((s, m) => s + m.total, 0);
      const totalCount   = monthly.reduce((s, m) => s + m.count, 0);
      const budgetTotal  = monthly.reduce((s, m) => s + m.budget, 0);

      // 手数料率別合計（全期間）
      const rate30csv = csvMonthly.reduce((s, r) => s + parseFloat(r["30%手数料"] ?? "0"), 0);
      const rate40csv = csvMonthly.reduce((s, r) => s + parseFloat(r["40%手数料"] ?? "0"), 0);
      const rate30k   = kRecs.filter(r => r.rate === 30).reduce((s, r) => s + r.fee, 0);
      const rate40k   = kRecs.filter(r => r.rate === 40).reduce((s, r) => s + r.fee, 0);

      const feeByRate = {
        rate30: Math.round((rate30csv + rate30k) / 1000),
        rate40: Math.round((rate40csv + rate40k) / 1000),
      };

      // 区分別（Kintone のみ 4〜6月）
      const catMap = new Map<string, number>();
      for (const r of kRecs) {
        const cat = r.category || "その他";
        catMap.set(cat, (catMap.get(cat) ?? 0) + Math.round(r.fee / 1000));
      }
      const feeByCategory: Record<string, number> = {};
      for (const [k, v] of catMap.entries()) feeByCategory[k] = v;

      return NextResponse.json({ monthly, totalFee, totalCount, budgetTotal, feeByRate, feeByCategory });
    }

    // ── hall ──────────────────────────────────────────────────────
    if (type === "hall") {
      // 会館別：CSV (10-3月) + Kintone (4-6月) 合算
      const hallMap = new Map<string, { fee: number; count: number }>();
      const add = (name: string, fee: number, count: number) => {
        const e = hallMap.get(name) ?? { fee: 0, count: 0 };
        e.fee += fee; e.count += count;
        hallMap.set(name, e);
      };
      for (const row of csvHall) {
        const name = row["会館名"] || "未入力";
        add(name, Math.round(parseFloat(row["手数料合計"] ?? "0") / 1000), parseInt(row["件数"] ?? "0", 10));
      }
      for (const r of kRecs) {
        const name = r.hall || "未入力";
        add(name, Math.round(r.fee / 1000), 1);
      }
      const byHall = Array.from(hallMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({ name, fee: v.fee, count: v.count }));

      // 事業部別（Kintone のみ）
      const divMap = new Map<string, { fee: number; count: number }>();
      for (const r of kRecs) {
        const name = r.division || "未入力";
        const e = divMap.get(name) ?? { fee: 0, count: 0 };
        e.fee += Math.round(r.fee / 1000); e.count += 1;
        divMap.set(name, e);
      }
      const byDivision = Array.from(divMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({ name, fee: v.fee, count: v.count }));

      return NextResponse.json({ byHall, byDivision });
    }

    // ── denomination ──────────────────────────────────────────────
    if (type === "denomination") {
      // 宗派別：CSV + Kintone 合算
      const denomMap = new Map<string, { fee: number; count: number }>();
      const addD = (name: string, fee: number, count: number) => {
        const e = denomMap.get(name) ?? { fee: 0, count: 0 };
        e.fee += fee; e.count += count;
        denomMap.set(name, e);
      };
      for (const row of csvDenom) {
        const name = row["宗旨宗派"] || "未入力";
        addD(name, Math.round(parseFloat(row["手数料合計"] ?? "0") / 1000), parseInt(row["件数"] ?? "0", 10));
      }
      for (const r of kRecs) {
        const name = r.denomination || "未入力";
        addD(name, Math.round(r.fee / 1000), 1);
      }
      const byDenomination = Array.from(denomMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({ name, fee: v.fee, count: v.count }));

      // 宗教者別（Kintone のみ）
      const officiMap = new Map<string, { fee: number; count: number }>();
      for (const r of kRecs) {
        const name = r.officiant || "未入力";
        const e = officiMap.get(name) ?? { fee: 0, count: 0 };
        e.fee += Math.round(r.fee / 1000); e.count += 1;
        officiMap.set(name, e);
      }
      const byOfficiant = Array.from(officiMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({ name, fee: v.fee, count: v.count }));

      return NextResponse.json({ byDenomination, byOfficiant });
    }

    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
