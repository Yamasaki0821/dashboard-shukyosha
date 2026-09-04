"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "../../components/NavHeader";
import { isFutureFiscalYear, monthLabel, fyLabel, fyStartLabel, FISCAL_YEARS } from '../../lib/fiscalYear';
import { useFiscalYear } from '../../lib/useFiscalYear';

interface DenomRow {
  name: string;
  fee: number;
  donation: number;
  count: number;
  avgDonation: number;
  avgFee: number;
}

interface OfficiantRow {
  name: string;
  monthly: Record<string, number>;
  total: { fee: number; donation: number; count: number };
}

interface DenomData {
  kintonePeriodLabel: string;
  csvPeriodLabel: string | null;   // CSVを使わない期は null
  byDenomination: DenomRow[];
  byOfficiantMonthly: OfficiantRow[];
  kintoneMonths: string[];
}

// 月の見出しは lib/fiscalYear.ts の monthLabel() を使う。期ごとの対応表は持たない（2026-09-04）

function DenomTable({ rows }: { rows: DenomRow[] }) {
  const totalFee      = rows.reduce((s, r) => s + r.fee, 0);
  const totalDonation = rows.reduce((s, r) => s + r.donation, 0);
  const totalCount    = rows.reduce((s, r) => s + r.count, 0);
  return (
    <table className="data-table data-table--sticky is-rank is-md">
      <thead>
        <tr>
          <th>順位</th>
          <th>宗旨宗派</th>
          <th>お布施額（千円）</th>
          <th>手数料（千円）</th>
          <th>件数</th>
          <th>平均お布施（千円）</th>
          <th>平均手数料（千円）</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`}>
            <td style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
            <td style={{ fontWeight: i < 3 ? 700 : 500 }}>{r.name}</td>
            <td style={{ color: r.donation > 0 ? "var(--color-text)" : "var(--color-text-muted)" }}>
              {r.donation > 0 ? r.donation.toLocaleString() : "—"}
            </td>
            <td style={{ fontWeight: 700 }}>{r.fee.toLocaleString()}</td>
            <td>{r.count.toLocaleString()}</td>
            <td style={{ color: r.avgDonation > 0 ? "var(--color-text)" : "var(--color-text-muted)" }}>
              {r.avgDonation > 0 ? r.avgDonation.toLocaleString() : "—"}
            </td>
            <td>{r.avgFee.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>合計</td>
          <td>{totalDonation.toLocaleString()}</td>
          <td>{totalFee.toLocaleString()}</td>
          <td>{totalCount.toLocaleString()}</td>
          <td>—</td>
          <td>—</td>
        </tr>
      </tfoot>
    </table>
  );
}

function OfficiantMatrix({ rows, months }: { rows: OfficiantRow[]; months: string[] }) {
  const grandTotalFee   = rows.reduce((s, r) => s + r.total.fee, 0);
  const monthTotals: Record<string, number> = {};
  months.forEach(m => {
    monthTotals[m] = rows.reduce((s, r) => s + (r.monthly[m] ?? 0), 0);
  });
  return (
    <table className="data-table data-table--sticky is-rank is-lg">
      <thead>
        <tr>
          <th>順位</th>
          <th>宗教者名・寺院名</th>
          {months.map(m => <th key={m}>{monthLabel(m)}</th>)}
          <th>手数料合計</th>
          <th>件数</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`}>
            <td style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
            <td style={{ fontWeight: i < 3 ? 700 : 500 }}>{r.name}</td>
            {months.map(m => (
              <td key={m} style={{ color: (r.monthly[m] ?? 0) === 0 ? "var(--color-text-muted)" : "var(--color-text)" }}>
                {(r.monthly[m] ?? 0) === 0 ? "—" : (r.monthly[m] ?? 0).toLocaleString()}
              </td>
            ))}
            <td style={{ fontWeight: 700 }}>{r.total.fee.toLocaleString()}</td>
            <td>{r.total.count.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>合計</td>
          {months.map(m => <td key={m}>{monthTotals[m].toLocaleString()}</td>)}
          <td>{grandTotalFee.toLocaleString()}</td>
          <td>{rows.reduce((s, r) => s + r.total.count, 0).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function DenominationPage() {
  const [data, setData]       = useState<DenomData | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // 表示中の会計期はURLの ?fy= が正。ready になるまで取りに行かない（2回取るのを防ぐ）
  const { fy, ready: fyReady } = useFiscalYear();
  const futureFy = isFutureFiscalYear(fy);

  useEffect(() => {
    if (!fyReady) return;
    setLoading(true);
    fetch(`/api/actuals?type=denomination&fy=${fy}`)
      .then(r => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [router, fy, fyReady]);

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
              いま表示されている0は、集計が壊れているのではなく、対象期間がこれから始まるためです。
              過去の数字を見るときは、上の「{fyLabel(FISCAL_YEARS[0])}」に切り替えてください。
            </div>
          </div>
        )}
        {loading && <p style={{ color: "var(--color-text-muted)" }}>読み込み中...</p>}
        {error   && <p style={{ color: "var(--color-red)" }}>エラー: {error}</p>}

        {data && (
          <>
            {/* 宗派別 */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">宗派別（お布施額・手数料・平均単価）</div>
              <div className="card-subtitle">
                {data.csvPeriodLabel
                  ? `${data.csvPeriodLabel}（Excel・手数料のみ）+ ${data.kintonePeriodLabel}（Kintone・お布施額含む）　／　平均お布施はKintone期間のみ`
                  : `Kintone連携データ（${data.kintonePeriodLabel}）`}
              </div>
              <div style={{ overflowX: "auto" }}>
                <DenomTable rows={data.byDenomination} />
              </div>
            </div>

            {/* 宗教者・寺院別 月別マトリクス */}
            <div className="card">
              <div className="card-title">宗教者・寺院別 月別手数料</div>
              <div className="card-subtitle">
                {`※ Kintone連携データのみ（${data.kintonePeriodLabel}）。手数料合計順で全宗教者表示。単位：千円`}
              </div>
              {data.byOfficiantMonthly.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>データなし</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <OfficiantMatrix rows={data.byOfficiantMonthly} months={data.kintoneMonths} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
