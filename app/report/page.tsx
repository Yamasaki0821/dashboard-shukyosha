'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "../../components/NavHeader";
import { ReportView } from "../../components/ReportView";
import { buildReport, type ReportSection, type ReportInput } from "../../lib/report";
import { isFutureFiscalYear, fyLabel, fyLabelLong, fyStartLabel, FISCAL_YEARS } from '../../lib/fiscalYear';
import { useFiscalYear } from '../../lib/useFiscalYear';

/**
 * 04 レポート（2026-09-04 新設）
 *
 * 3つのAPI（summary / hall / denomination）をまとめて取り、lib/report.ts に渡すだけ。
 * 文章の生成はすべて lib/report.ts が持つ。ここに判断を書かない。
 */

interface MonthlyRow {
  month: string; fee30: number; fee40: number; feeOther: number;
  total: number; planned: number; count: number;
  donation: number | null; budget: number; isKintone: boolean;
}
interface SummaryData {
  monthly: MonthlyRow[];
  totalFee: number; totalPlanned: number; totalDonation: number; totalCount: number;
  budgetTotal: number; budgetElapsed: number; elapsedMonth: string;
  feeByRate: { rate30: number; rate40: number; other: number };
  kintonePeriodLabel: string;
}
interface NamedRow { name: string; fee: number; donation: number; count: number; }
interface HallData { byHall: NamedRow[]; kintoneMonths: string[]; }
interface OfficiantRow { name: string; total: { fee: number; donation: number; count: number }; }
interface DenomData { byOfficiantMonthly: OfficiantRow[]; }

export default function ReportPage() {
  const [sections, setSections] = useState<ReportSection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  // 表示中の会計期はURLの ?fy= が正。ready になるまで取りに行かない（2回取るのを防ぐ）
  const { fy, ready: fyReady } = useFiscalYear();
  const futureFy = isFutureFiscalYear(fy);

  useEffect(() => {
    if (!fyReady) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = (type: string) =>
      fetch(`/api/actuals?type=${type}&fy=${fy}`).then(r => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      });

    Promise.all([load("summary"), load("hall"), load("denomination")])
      .then(([s, h, d]) => {
        if (cancelled || !s || !h || !d) return;
        if (s.error || h.error || d.error) {
          setError(s.error ?? h.error ?? d.error);
          return;
        }
        const sum = s as SummaryData;
        const hall = h as HallData;
        const den = d as DenomData;

        const input: ReportInput = {
          fiscalYearLabel: fyLabel(fy),
          isFuture: futureFy,
          monthly: sum.monthly,
          totalFee: sum.totalFee,
          totalPlanned: sum.totalPlanned,
          totalCount: sum.totalCount,
          totalDonation: sum.totalDonation,
          budgetTotal: sum.budgetTotal,
          budgetElapsed: sum.budgetElapsed,
          elapsedMonth: sum.elapsedMonth,
          feeByRate: sum.feeByRate,
          byHall: hall.byHall,
          byOfficiant: den.byOfficiantMonthly,
          kintoneMonths: hall.kintoneMonths,
          kintonePeriodLabel: sum.kintonePeriodLabel,
        };
        setSections(buildReport(input));
      })
      .catch(e => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [router, fy, fyReady, futureFy]);

  return (
    <>
      <NavHeader />

      <div className="page-inner">
        {/* まだ始まっていない期は実績が0で当たり前。
            「壊れているのか、これからなのか」を画面に書く（2026-09-04 山崎さん指摘） */}
        {futureFy && !loading && (
          <div style={{
            background: 'var(--color-warning-light)', border: '0.5px solid var(--color-warning)',
            borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 'var(--fs-heading)', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              {fyLabel(fy)}は{fyStartLabel(fy)}に始まります。実績はまだ1件もありません
            </div>
            <div className="section-note" style={{ marginTop: 0 }}>
              読めることが無いため、レポートは出していません。
              過去の期を見るときは、上の「{fyLabel(FISCAL_YEARS[0])}」に切り替えてください。
            </div>
          </div>
        )}

        {loading && <p style={{ color: "var(--color-text-muted)" }}>読み込み中...</p>}
        {error   && <p style={{ color: "var(--color-red)" }}>エラー: {error}</p>}

        {sections && !loading && (
          <div className="card">
            <div className="card-title">レポート（{fyLabelLong(fy)}）</div>
            <div className="card-subtitle" style={{ marginBottom: 18 }}>
              手数料率の構成比／会館別／宗教者の偏りの3つで読んでいます。
              数字はすべて確定分（葬儀日が今日以前）です。
            </div>
            <ReportView sections={sections} />
          </div>
        )}
      </div>
    </>
  );
}
