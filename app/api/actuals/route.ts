export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { fetchAllKintoneRecords, str, num, toYM } from "../../../lib/kintone";

// ── 期の定義（第30期）───────────────────────────────────────────
// 期が変わったらこの3つだけ直す
const FY_START = "2025-10";           // 期首
const FY_END   = "2026-09";           // 期末
const FY_END_DATE = "2026-09-30";     // 期末の末日
const CSV_LAST = "2026-03";           // CSV（Excel集計）が担当する最終月。これより後はKintoneを採用

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

// 日本時間の「今月」（サーバーがUTCでも当月がズレないように+9時間）
function currentYMJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 表記ゆれ吸収（会館名・人名）
function normalizeName(s: string): string {
  return s.replace(/[\s　]+/g, "").trim();
}

// 葬法区分の表記ゆれ吸収。
// 2026-08にKintone側の選択肢が変わり「葬儀」→「葬儀　※8月削除」となり、
// 代わりに「二日葬」「一日葬」が新設された。注記は落として旧区分名に戻す
function normalizeCategory(s: string): string {
  const t = s.replace(/[\s　]*※.*$/, "").trim();
  return t || "その他";
}

// 平均単価は「葬儀系（法要を除く）」で見る
const FUNERAL_CATEGORIES = ["葬儀", "二日葬", "一日葬", "炉前"];

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

// ── Kintone クエリ（期全体を取得し、集計側でCSV期間を除外する）──
const KINTONE_QUERY = `葬儀日_法要日 >= "${FY_START}-01" and 葬儀日_法要日 <= "${FY_END_DATE}"`;

const yen = (v: number) => Math.round(v);          // 円は整数で持つ
const toK = (v: number) => Math.round(v / 1000);   // 千円へは最後に1回だけ丸める

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

    // Kintoneレコード整形（金額はすべて「円」のまま保持する）
    const kRecs = kintoneRecords.map(r => ({
      fee:          yen(num(r, "手数料金額")),
      donation:     yen(num(r, "御布施金額")),
      rate:         num(r, "手数料率"),
      // 宗教名は「新宗教名」へ移行中。新側に入力があればそちらを優先する
      denomination: str(r, "新宗教名") || str(r, "宗教名"),
      // 会館名フィールドはKintone改修で名称が変わった（2026-08時点：ルックアップ_会館名／会館名_ティアグループ）
      hall:         normalizeName(str(r, "ルックアップ_会館名") || str(r, "会館名_ティアグループ")),
      date:         str(r, "葬儀日_法要日"),
      category:     normalizeCategory(str(r, "葬法区分")),
      division:     str(r, "事業部名"),
      branch:       str(r, "支社名"),
      block:        str(r, "ブロック名"),
      area:         str(r, "エリア名"),
      officiant:    normalizeName(str(r, "新宗教者名") || str(r, "宗教者名")),
      yearMonth:    toYM(str(r, "葬儀日_法要日")) ?? "",
    }))
    // CSVが担当する期間（〜2026-03）と期外は除外する＝二重計上・期ズレの防止
    .filter(r => r.yearMonth > CSV_LAST && r.yearMonth >= FY_START && r.yearMonth <= FY_END);

    const kintoneMonths = MONTHS_ORDER.filter(m => m > CSV_LAST);
    const kintonePeriodLabel = `${parseInt(kintoneMonths[0].slice(5), 10)}月〜${parseInt(kintoneMonths[kintoneMonths.length - 1].slice(5), 10)}月`;

    // ══════════════════════════════════════════════════════════════
    // type=summary
    // ══════════════════════════════════════════════════════════════
    if (type === "summary") {
      // CSV 月別（円で保持・手数料のみ／お布施なし）
      const csvMonthMap = new Map<string, { fee30: number; fee40: number; total: number; count: number }>();
      for (const row of csvMonthly) {
        const ym = csvMonthToYM(row["月"] ?? "");
        if (!ym || ym > CSV_LAST) continue;
        csvMonthMap.set(ym, {
          fee30: parseFloat(row["30%手数料"] ?? "0") || 0,
          fee40: parseFloat(row["40%手数料"] ?? "0") || 0,
          total: parseFloat(row["月合計"]    ?? "0") || 0,
          count: parseInt(row["件数"] ?? "0", 10) || 0,
        });
      }

      // Kintone 月別（円で保持）
      const kMonthMap = new Map<string, { fee30: number; fee40: number; total: number; donation: number; count: number }>();
      for (const r of kRecs) {
        const ym = r.yearMonth;
        if (!ym) continue;
        const e = kMonthMap.get(ym) ?? { fee30: 0, fee40: 0, total: 0, donation: 0, count: 0 };
        e.total    += r.fee;
        e.donation += r.donation;
        e.count    += 1;
        if (r.rate === 30) e.fee30 += r.fee;
        else if (r.rate === 40) e.fee40 += r.fee;
        // 30%/40%以外（20%・15%・0%・未入力）は feeOther として下で差分計上する
        kMonthMap.set(ym, e);
      }

      const monthly = MONTHS_ORDER.map(ym => {
        const csv = csvMonthMap.get(ym) ?? { fee30: 0, fee40: 0, total: 0, count: 0 };
        const kt  = kMonthMap.get(ym)  ?? { fee30: 0, fee40: 0, total: 0, donation: 0, count: 0 };
        const isKintonePeriod = ym > CSV_LAST;

        // 千円への丸めは「月ごとに1回だけ」。内訳は縦計・横計の両方が必ず合うように、
        // 30%とその他を丸め、最大構成の40%で残差を吸収する
        const total  = toK(csv.total + kt.total);
        const fee30  = toK(csv.fee30 + kt.fee30);
        const feeOther = toK((csv.total - csv.fee30 - csv.fee40) + (kt.total - kt.fee30 - kt.fee40));
        const fee40  = total - fee30 - feeOther;

        return {
          month:    ym,
          fee30,
          fee40,
          feeOther,
          total,
          donation: isKintonePeriod ? toK(kt.donation) : null,
          count:    csv.count + kt.count,
          budget:   BUDGET[ym] ?? 0,
        };
      });

      const totalFee      = monthly.reduce((s, m) => s + m.total, 0);
      const totalDonation = monthly.reduce((s, m) => s + (m.donation ?? 0), 0);
      const totalCount    = monthly.reduce((s, m) => s + m.count, 0);
      const budgetTotal   = monthly.reduce((s, m) => s + m.budget, 0);

      // 達成率の分母は「経過月（期首〜当月）の予算」。通期予算で割ると達成率が不当に低く出る
      const nowYM = currentYMJst();
      const elapsedMonth = nowYM < FY_START ? FY_START : (nowYM > FY_END ? FY_END : nowYM);
      const budgetElapsed = MONTHS_ORDER
        .filter(m => m <= elapsedMonth)
        .reduce((s, m) => s + (BUDGET[m] ?? 0), 0);

      // 手数料率別（累計）は月別テーブルの内訳と必ず一致させる
      const feeByRate = {
        rate30: monthly.reduce((s, m) => s + m.fee30, 0),
        rate40: monthly.reduce((s, m) => s + m.fee40, 0),
        other:  monthly.reduce((s, m) => s + m.feeOther, 0),
      };

      // 葬法区分別（Kintone期間のみ・円で集計してから丸める）
      const catMap = new Map<string, number>();
      for (const r of kRecs) {
        const cat = r.category || "その他";
        catMap.set(cat, (catMap.get(cat) ?? 0) + r.fee);
      }
      const feeByCategory: Record<string, number> = {};
      for (const [k, v] of catMap.entries()) feeByCategory[k] = toK(v);

      const funeral = kRecs.filter(r => FUNERAL_CATEGORIES.includes(r.category));
      const funeralCount = funeral.length;
      const funeralFee   = toK(funeral.reduce((s, r) => s + r.fee, 0));

      return NextResponse.json({
        monthly, totalFee, totalDonation, totalCount,
        budgetTotal, budgetElapsed, elapsedMonth,
        feeByRate, feeByCategory, funeralCount, funeralFee,
        kintonePeriodLabel,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // type=hall（会館・事業部・エリア別）
    // ══════════════════════════════════════════════════════════════
    if (type === "hall") {
      // 会館別（CSV=手数料のみ + Kintone=手数料+お布施）※すべて円で集計し、最後に千円へ
      const hallMap = new Map<string, { fee: number; donation: number; count: number; hasKintone: boolean }>();
      const addHall = (name: string, fee: number, donation: number, count: number, fromKintone: boolean) => {
        const e = hallMap.get(name) ?? { fee: 0, donation: 0, count: 0, hasKintone: false };
        e.fee += fee; e.donation += donation; e.count += count;
        if (fromKintone) e.hasKintone = true;
        hallMap.set(name, e);
      };
      for (const row of csvHall) {
        const name = normalizeName(row["会館名"] || "") || "未入力";
        addHall(name, parseFloat(row["手数料合計"] ?? "0") || 0, 0, parseInt(row["件数"] ?? "0", 10) || 0, false);
      }
      for (const r of kRecs) {
        addHall(r.hall || "未入力", r.fee, r.donation, 1, true);
      }
      const byHall = Array.from(hallMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({ name, fee: toK(v.fee), donation: toK(v.donation), count: v.count, hasKintone: v.hasKintone }));

      // 支社別（Kintone のみ）
      const brMap = aggregateBy(kRecs, r => r.branch);

      // エリア別 月別マトリクス（Kintone のみ）
      const areaMonthly = new Map<string, {
        monthly: Record<string, { fee: number; donation: number; count: number }>;
        total: { fee: number; donation: number; count: number };
      }>();
      for (const r of kRecs) {
        const name = r.area || "未入力";
        const ym = r.yearMonth;
        const e = areaMonthly.get(name) ?? { monthly: {}, total: { fee: 0, donation: 0, count: 0 } };
        if (ym) {
          const mm = e.monthly[ym] ?? { fee: 0, donation: 0, count: 0 };
          mm.fee += r.fee; mm.donation += r.donation; mm.count += 1;
          e.monthly[ym] = mm;
        }
        e.total.fee += r.fee; e.total.donation += r.donation; e.total.count += 1;
        areaMonthly.set(name, e);
      }
      const byAreaMonthly = Array.from(areaMonthly.entries())
        .sort(([,a],[,b]) => b.total.fee - a.total.fee)
        .map(([name, v]) => ({
          name,
          monthly: Object.fromEntries(Object.entries(v.monthly).map(([ym, c]) => [ym, {
            fee: toK(c.fee), donation: toK(c.donation), count: c.count,
          }])),
          total: { fee: toK(v.total.fee), donation: toK(v.total.donation), count: v.total.count },
        }));

      return NextResponse.json({
        byHall,
        byBranch: mapToArray(brMap),
        byAreaMonthly,
        kintoneMonths,
        kintonePeriodLabel,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // type=denomination（宗派・宗教者別＋月別マトリクス）
    // ══════════════════════════════════════════════════════════════
    if (type === "denomination") {
      // 宗派別（CSV=手数料のみ + Kintone=手数料+お布施+件数）※円で集計
      const denomMap = new Map<string, { fee: number; donation: number; count: number; kintoneCount: number }>();
      for (const row of csvDenom) {
        const name = row["宗旨宗派"] || "未入力";
        const e = denomMap.get(name) ?? { fee: 0, donation: 0, count: 0, kintoneCount: 0 };
        e.fee   += parseFloat(row["手数料合計"] ?? "0") || 0;
        e.count += parseInt(row["件数"] ?? "0", 10) || 0;
        denomMap.set(name, e);
      }
      for (const r of kRecs) {
        const name = r.denomination || "未入力";
        const e = denomMap.get(name) ?? { fee: 0, donation: 0, count: 0, kintoneCount: 0 };
        e.fee          += r.fee;
        e.donation     += r.donation;
        e.count        += 1;
        e.kintoneCount += 1;
        denomMap.set(name, e);
      }
      const byDenomination = Array.from(denomMap.entries())
        .sort(([,a],[,b]) => b.fee - a.fee)
        .map(([name, v]) => ({
          name,
          fee:         toK(v.fee),
          donation:    toK(v.donation),
          count:       v.count,
          avgDonation: v.kintoneCount > 0 ? toK(v.donation / v.kintoneCount) : 0,
          avgFee:      v.count > 0 ? toK(v.fee / v.count) : 0,
        }));

      // 宗教者別（Kintoneのみ）月別マトリクス
      const officiantMonthly = new Map<string, {
        monthly: Record<string, number>;
        total: { fee: number; donation: number; count: number };
      }>();
      for (const r of kRecs) {
        const name = r.officiant || "未入力";
        const ym = r.yearMonth;
        const e = officiantMonthly.get(name) ?? { monthly: {}, total: { fee: 0, donation: 0, count: 0 } };
        if (ym) e.monthly[ym] = (e.monthly[ym] ?? 0) + r.fee;
        e.total.fee      += r.fee;
        e.total.donation += r.donation;
        e.total.count    += 1;
        officiantMonthly.set(name, e);
      }
      const byOfficiantMonthly = Array.from(officiantMonthly.entries())
        .sort(([,a],[,b]) => b.total.fee - a.total.fee)
        .map(([name, v]) => ({
          name,
          monthly: Object.fromEntries(Object.entries(v.monthly).map(([ym, f]) => [ym, toK(f)])),
          total: { fee: toK(v.total.fee), donation: toK(v.total.donation), count: v.total.count },
        }));

      return NextResponse.json({
        byDenomination,
        byOfficiantMonthly,
        kintoneMonths,
        kintonePeriodLabel,
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
    e.fee      += r.fee;
    e.donation += r.donation;
    e.count    += 1;
    m.set(name, e);
  }
  return m;
}

function mapToArray(m: Map<string, { fee: number; donation: number; count: number }>) {
  return Array.from(m.entries())
    .sort(([,a],[,b]) => b.fee - a.fee)
    .map(([name, v]) => ({ name, fee: Math.round(v.fee / 1000), donation: Math.round(v.donation / 1000), count: v.count }));
}
