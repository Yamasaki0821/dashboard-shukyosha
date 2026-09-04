/**
 * 会計期の唯一の正（2026-09-04 新設）。
 *
 * これまで各APIが「2025-10-01」「2026-09-30」やPERIOD_MONTHSを個別に直書きしていた。
 * 期を切り替えるたびに6ファイルを探して回ることになり、必ず取り残しが出るため1か所に集約した。
 * **期に関わる定数をこのファイルの外に書かない。**
 *
 * ㈱ティアの期首は10月。第30期＝2025-10〜2026-09、第31期＝2026-10〜2027-09。
 * ※ ㈱ティアネクストは「第2期」で数える（不動産DB・相続DB）。このファイルはティア用。
 *
 * 初出は dashboard-reien。**6DBで同じ内容を保つ。片方だけ直さない。**
 */

export type FiscalYear = 30 | 31;

/** 画面のセレクタに出す順。新しい期を足すときはここと FY_START_YEAR の2か所だけ */
export const FISCAL_YEARS: FiscalYear[] = [30, 31];

/** 期首（10月）の西暦年 */
const FY_START_YEAR: Record<FiscalYear, number> = { 30: 2025, 31: 2026 };

const pad = (n: number) => String(n).padStart(2, "0");

/** 第N期の12か月を期首（10月）から並べて返す */
export function fyMonths(fy: FiscalYear): string[] {
  const y = FY_START_YEAR[fy];
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = 10 + i;
    out.push(m <= 12 ? `${y}-${pad(m)}` : `${y + 1}-${pad(m - 12)}`);
  }
  return out;
}

/** Kintoneクエリ用の期首日（YYYY-MM-DD） */
export function fyStart(fy: FiscalYear): string {
  return `${FY_START_YEAR[fy]}-10-01`;
}

/** Kintoneクエリ用の期末日（YYYY-MM-DD） */
export function fyEnd(fy: FiscalYear): string {
  return `${FY_START_YEAR[fy] + 1}-09-30`;
}

/** 期末の年月（YYYY-MM） */
export function fyEndYM(fy: FiscalYear): string {
  return `${FY_START_YEAR[fy] + 1}-09`;
}

/** 四半期の定義。ラベルは月だけを出す（年をまたぐが表の見た目を揃える） */
export function fyQuarters(fy: FiscalYear): { label: string; months: string[] }[] {
  const m = fyMonths(fy);
  return [
    { label: "Q1（10〜12月）", months: m.slice(0, 3) },
    { label: "Q2（1〜3月）", months: m.slice(3, 6) },
    { label: "Q3（4〜6月）", months: m.slice(6, 9) },
    { label: "Q4（7〜9月）", months: m.slice(9, 12) },
  ];
}

/** 年月（2026-10）から表の見出し用の月（10月）へ。期が変わっても使い回せる */
export function monthLabel(ym: string): string {
  return `${parseInt(ym.slice(5), 10)}月`;
}

/** 「第30期」「第31期」 */
export function fyLabel(fy: FiscalYear): string {
  return `第${fy}期`;
}

/** 「第30期（2025年10月〜2026年9月）」 */
export function fyLabelLong(fy: FiscalYear): string {
  const y = FY_START_YEAR[fy];
  return `第${fy}期（${y}年10月〜${y + 1}年9月）`;
}

/**
 * 今日が属する期。Vercelの実行環境はUTCなので、月末に前月と判定されないようJSTへ寄せる。
 * 一覧に無い期（第32期以降）に入ったら、暫定で最後の期を返す。
 */
export function currentFiscalYear(now: Date = new Date()): FiscalYear {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const startYear = m >= 10 ? y : y - 1;
  const hit = FISCAL_YEARS.find(fy => FY_START_YEAR[fy] === startYear);
  if (hit) return hit;
  return startYear < FY_START_YEAR[FISCAL_YEARS[0]]
    ? FISCAL_YEARS[0]
    : FISCAL_YEARS[FISCAL_YEARS.length - 1];
}

/**
 * その期がまだ始まっていない（＝実績が0で当たり前）か。
 * 2026-09-04：第31期に切り替えると全部0になり「壊れているのか、まだ始まっていないのか」が
 * 画面から判断できなかったため追加した。0を出す画面は必ずこれを見て理由を書く。
 */
export function isFutureFiscalYear(fy: FiscalYear, now: Date = new Date()): boolean {
  return fy > currentFiscalYear(now);
}

/** 期首の表示用（「2026年10月」） */
export function fyStartLabel(fy: FiscalYear): string {
  return `${FY_START_YEAR[fy]}年10月`;
}

/** クエリ文字列 ?fy=31 を読む。未指定・不正値は今日が属する期にフォールバックする */
export function parseFiscalYear(raw: string | null | undefined): FiscalYear {
  const n = Number(raw);
  return (FISCAL_YEARS as number[]).includes(n) ? (n as FiscalYear) : currentFiscalYear();
}
