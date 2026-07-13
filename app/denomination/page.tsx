"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "../../components/NavHeader";

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
  byDenomination: DenomRow[];
  byOfficiantMonthly: OfficiantRow[];
  kintoneMonths: string[];
}

const MONTH_LABELS: Record<string, string> = {
  "2026-04": "4月", "2026-05": "5月", "2026-06": "6月",
  "2026-07": "7月", "2026-08": "8月", "2026-09": "9月",
};

function DenomTable({ rows }: { rows: DenomRow[] }) {
  const totalFee      = rows.reduce((s, r) => s + r.fee, 0);
  const totalDonation = rows.reduce((s, r) => s + r.donation, 0);
  const totalCount    = rows.reduce((s, r) => s + r.count, 0);
  return (
    <table className="data-table">
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
    <table className="data-table">
      <thead>
        <tr>
          <th>順位</th>
          <th>宗教者名・寺院名</th>
          {months.map(m => <th key={m}>{MONTH_LABELS[m] ?? m}</th>)}
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

  useEffect(() => {
    fetch("/api/actuals?type=denomination")
      .then(r => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <>
      <NavHeader />

      <div className="page-inner">
        {loading && <p style={{ color: "var(--color-text-muted)" }}>読み込み中...</p>}
        {error   && <p style={{ color: "var(--color-red)" }}>エラー: {error}</p>}

        {data && (
          <>
            {/* 宗派別 */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">宗派別（お布施額・手数料・平均単価）</div>
              <div className="card-subtitle">
                10月〜3月（Excel・手数料のみ）+ 4月〜9月（Kintone・お布施額含む）　／　平均お布施はKintone期間のみ
              </div>
              <div style={{ overflowX: "auto" }}>
                <DenomTable rows={data.byDenomination} />
              </div>
            </div>

            {/* 宗教者・寺院別 月別マトリクス */}
            <div className="card">
              <div className="card-title">宗教者・寺院別 月別手数料</div>
              <div className="card-subtitle">
                ※ Kintone連携データのみ（4月〜9月）。手数料合計順で全宗教者表示。単位：千円
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
