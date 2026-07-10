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
  "2026-07": 17101,
  "2026-08": 15229,
  "2026-09": 15747,
};

const MONTHS_ORDER = Object.keys(BUDGET);

// ── CSV パーサー ────────────────────────────────────────────────
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

// 月名 → YYYY-MM 変換
function csvMonthToYM(month: string): string | null {
  const m = month.replace("月", "");
  const n = parseInt(m, 10);
  if (isNaN(n)) return null;
  if (n >= 10) return `2025-${String(n).padStart(2, "0")}`;
  if (n >= 1 && n <= 9) return `2026-${String(n).padStart(2, "0")}`;
  return null;
}

// ── Kintone クエリ ───────────────────────────────────────────────
const KINTONE_QUERY = '葬儀日_法要日 >= "2026-04-01" and 葬儀日_法要日 <= "2026-09-30"';

// ── メイン GET ───────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const type = req.nextUrl.searchParams.get("type") ?? "summary";

  try {
    const csvMonthly = readCSV("集計_月別手数料率別.csv");
    const csvDenom   = readCSV("集計_宗派別.csv");
    const csvHall    = readCSV("集計_会館別.csv");

    let kintoneRecords: Awaited<ReturnType<typeof fetchAllKintoneRecords>> = [];
    try {
      kintoneRecords = await fetchAllKintoneRecords(KINTONE_QUERY);
    } catch (e) {
      console.error("Kintone fetch error:", e);
    }

    // Kintoneレコード整形
    const kRecs = kintoneRecords.map(r => ({
      fee:          Math.round(num(r, "手数料金額")),
      donation:     Math.round(num(r, "御布施金額")),
      rate:         num(r, "手数料率"),
      denomination: str(r, "宗教名"),
      hall:         str(r, "ルックアップ_会館名ティア"),
      date:         str(r, "葬儀日_法要日"),
      category:     str(r, "葬法区分"),
      division:     str(r, "事業部名"),
      branch:       str(r, "支社名"),
      block:        str(r, "ブロック名"),
      area:         str(r, "エリア名"),
      officiant:    str(r, "宗教者名"),
      yearMonth:    toYM(str(r, "葬儀日_法要日")) ?? "",
    }));

    // ══════════════════════════════════════════════════════════════
    // type=summary
    // ══════════════════════════════════════════════════════════════
    if (type === "summary") {
      // CSV 月別（手数料のみ・お布施なし）
      const csvMonthMap = new Map<string, { fee30: number; fee40: number; total: number; count: number }>();
      for (const row of csvMonthly) {
        const ym = csvMonthToYM(row["月"] ?? "");
        if (!ym) continue;
        csvMonthMap.set(ym, {
          fee30: Math.round(parseFloat(row["30%手数料"] ?? "0") / 1000),
          fee40: Math.round(parseFloat(row["40%手数料"] ?? "0") / 1000),
          total: Math.round(parseFloat(row["月合計"] ?? "0") / 1000),
          count: parseInt(row["件数"] ?? "0", 10),
        });
      }

      // Kintone 月別（手数料・お布施両方）
      const kMonthMap = new Map<string, { fee30: number; fee40: number; total: number; donation: number; count: number }>();
      for (const r of kRecs) {
        const ym = r.yearMonth;
        if (!ym) continue;
        const e = kMonthMap.get(ym) ?? { fee30: 0, fee40: 0, total: 0, donation: 0, count: 0 };
        const feeK = Math.round(r.fee / 1000);
        const donK = Math.round(r.donation / 1000);
        e.total    += feeK;
        e.donation += donK;
        e.count    += 1;
        if (r.rate === 30) e.fee30 += feeK;
        else if (r.rate === 40) e.fee40 += feeK;
        kMonthMap.set(ym, e);
      }

      const monthly = MONTHS_ORDER.map(ym => {
        const csv = csvMonthMap.get(ym) ?? { fee30: 0, fee40: 0, total: 0, count: 0 };
        const kt  = kMonthMap.get(ym)  ?? { fee30: 0, fee40: 0, total: 0, donation: 0, count: 0 };
        const isKintonePeriod = ym >= "2026-04";
        return {
          month:    ym,
          fee30:    csv.fee30 + kt.fee30,
          fee40:    csv.fee40 + kt.fee40,
          total:    csv.total + kt.total,
          donation: isKintonePeriod ? kt.donation : null,
          count:    csv.count + kt.count,
          budget:   BUDGET[ym] ?? 0,
        };
      });

      const totalFee      = monthly.reduce((s, m) => s + m.total, 0);
      const totalDonation = monthly.reduce((s, m) => s + (m.donation ?? 0), 0);
      const totalCount    = monthly.reduce((s, m) => s + m.count, 0);
      const budgetTotal   = monthly.reduce((s, m) => s + m.budget, 0);

      const rate30csv = csvMonthly.reduce((s, r) => s + parseFloat(r["30%手数料"] ?? "0"), 0);
      const rate40csv = csvMonthly.reduce((s, r) => s + parseFloat(r["40%手数料"] ?? "0"), 0);
      const rate30k   = kRecs.filter(r => r.rate === 30).reduce((s, r) => s + r.fee, 0);
      const rate40k   = kRecs.filter(r => r.rate === 40).reduce((s, r) => s + r.fee, 0);

      const feeByRate = {
        rate30: Math.round((rate30csv + rate30k) / 1000),
        rate40: Math.round((rate40csv + rate40k) / 1000),
      };

      const catMap = new Map<string, number>();
      for (const r of kRecs) {
        const cat = r.category || "その他";
        catMap.set(cat, (catMap.get(cat) ?? 0) + Math.round(r.fee / 1000));
      }
      const feeByCategory: Record<string, number> = {};
      for (const [k, v] of catMap.entries()) feeByCategory[k] = v;

      const funeral = kRecs.filter(r => r.category === "葬儀");
      const funeralCount = funeral.length;
      const funeralFee   = Math.round(funeral.reduce((s, r) => s + r.fee, 0) / 1000);

      return NextResponse.json({
        monthly, totalFee, totalDonation, totalCount, budgetTotal,
        feeByRate, feeByCategory, funeralCount, funeralFee,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // type=hall（会館・事業部・エリア別）
    // ══════════════════════════════════════════════════════════════
    if (type === "hall") {
      // 会館別（CSV=手数料のみ + Kintone=手数料+お布施）
      const hallMap = new Map<string, { fee: number; donation: number; count: number; hasKintone: boolean }>();
      const addHall = (name: string, fee: number, donation: number, count: number, fromKintone: boolean) => {
        const e = hallMap.get(name) ?? { fee: 0, donation: 0, count: 0, hasKintone: false };
        e.fee += fee; e.donation += donation; e.count += count;
        if (fromKintone) e.hasKintone = true;
        hallMap.set(name, e);
      };
      for (const row of csvHall) {
        const name = row["会館名"] || "未入力";
        addHall(name, Math.round(parseFloat(row["手数料合計"] ?? "0") / 1000), 0, parseInt(row["件数"] ?? "0", 10), false);
      }
      for (const r of kRecs) {
        const name = r.hall || "未入力";
        addHall(name, Math.round(r.fee / 1000), Math.round(r.donation / 1000), 1, true);
      }
      const byHall = Array.from(hallMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({ name, fee: v.fee, donation: v.donation, count: v.count, hasKintone: v.hasKintone }));

      // 事業部別（Kintone のみ）
      const divMap = aggregateBy(kRecs, r => r.division);
      // 支社別（Kintone のみ）
      const brMap  = aggregateBy(kRecs, r => r.branch);
      // エリア別（Kintone のみ）
      const areaMap = aggregateBy(kRecs, r => r.area);

      return NextResponse.json({
        byHall,
        byDivision: mapToArray(divMap),
        byBranch:   mapToArray(brMap),
        byArea:     mapToArray(areaMap),
      });
    }

    // ══════════════════════════════════════════════════════════════
    // type=denomination（宗派・宗教者別＋月別マトリクス）
    // ══════════════════════════════════════════════════════════════
    if (type === "denomination") {
      // 宗派別（CSV=手数料のみ + Kintone=手数料+お布施+件数）
      // 平均単価: お布施÷件数, 手数料÷件数
      const denomMap = new Map<string, { fee: number; donation: number; count: number; kintoneCount: number }>();
      for (const row of csvDenom) {
        const name = row["宗旨宗派"] || "未入力";
        const e = denomMap.get(name) ?? { fee: 0, donation: 0, count: 0, kintoneCount: 0 };
        e.fee   += Math.round(parseFloat(row["手数料合計"] ?? "0") / 1000);
        e.count += parseInt(row["件数"] ?? "0", 10);
        denomMap.set(name, e);
      }
      for (const r of kRecs) {
        const name = r.denomination || "未入力";
        const e = denomMap.get(name) ?? { fee: 0, donation: 0, count: 0, kintoneCount: 0 };
        e.fee          += Math.round(r.fee / 1000);
        e.donation     += Math.round(r.donation / 1000);
        e.count        += 1;
        e.kintoneCount += 1;
        denomMap.set(name, e);
      }
      const byDenomination = Array.from(denomMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({
          name,
          fee:         v.fee,
          donation:    v.donation,
          count:       v.count,
          avgDonation: v.kintoneCount > 0 ? Math.round(v.donation / v.kintoneCount) : 0,
          avgFee:      v.count > 0 ? Math.round(v.fee / v.count) : 0,
        }));

      // 宗教者別（Kintoneのみ）月別マトリクス
      // { name, monthly: { "2026-04": fee, ... }, total: { fee, donation, count } }
      const officiantMonthly = new Map<string, {
        monthly: Record<string, number>;
        total: { fee: number; donation: number; count: number };
      }>();
      for (const r of kRecs) {
        const name = r.officiant || "未入力";
        const ym = r.yearMonth;
        const e = officiantMonthly.get(name) ?? {
          monthly: {},
          total: { fee: 0, donation: 0, count: 0 },
        };
        const feeK = Math.round(r.fee / 1000);
        if (ym) {
          e.monthly[ym] = (e.monthly[ym] ?? 0) + feeK;
        }
        e.total.fee      += feeK;
        e.total.donation += Math.round(r.donation / 1000);
        e.total.count    += 1;
        officiantMonthly.set(name, e);
      }
      const byOfficiantMonthly = Array.from(officiantMonthly.entries())
        .sort(([,a],[,b]) => b.total.fee - a.total.fee)
        .map(([name, v]) => ({ name, monthly: v.monthly, total: v.total }));

      // Kintone期間の月（4月〜9月）
      const kintoneMonths = MONTHS_ORDER.filter(m => m >= "2026-04");

      return NextResponse.json({
        byDenomination,
        byOfficiantMonthly,
        kintoneMonths,
      });
    }

    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// ── ヘルパー ─────────────────────────────────────────────────────
function aggregateBy(
  recs: Array<{ fee: number; donation: number; [k: string]: any }>,
  keyFn: (r: any) => string,
): Map<string, { fee: number; donation: number; count: number }> {
  const m = new Map<string, { fee: number; donation: number; count: number }>();
  for (const r of recs) {
    const name = keyFn(r) || "未入力";
    const e = m.get(name) ?? { fee: 0, donation: 0, count: 0 };
    e.fee      += Math.round(r.fee / 1000);
    e.donation += Math.round(r.donation / 1000);
    e.count    += 1;
    m.set(name, e);
  }
  return m;
}

function mapToArray(m: Map<string, { fee: number; donation: number; count: number }>) {
  return Array.from(m.entries())
    .sort(([,a],[,b]) => b.fee - a.fee)
    .map(([name, v]) => ({ name, fee: v.fee, donation: v.donation, count: v.count }));
}
