"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "../../components/NavHeader";

interface Row { name: string; fee: number; donation: number; count: number; }

interface MonthlyCell { fee: number; donation: number; count: number; }
interface AreaMonthlyRow {
  name: string;
  monthly: Record<string, MonthlyCell>;
  total: MonthlyCell;
}

interface HallData {
  byHall: Row[];
  byBranch: Row[];
  byAreaMonthly: AreaMonthlyRow[];
  kintoneMonths: string[];
}

const MONTH_LABELS: Record<string, string> = {
  "2026-04": "4月", "2026-05": "5月", "2026-06": "6月",
  "2026-07": "7月", "2026-08": "8月", "2026-09": "9月",
};

// 通常のテーブル（支社別・会館別）
function Table({ rows, label, showDonation }: { rows: Row[]; label: string; showDonation: boolean }) {
  const totalFee      = rows.reduce((s, r) => s + r.fee, 0);
  const totalDonation = rows.reduce((s, r) => s + r.donation, 0);
  const totalCount    = rows.reduce((s, r) => s + r.count, 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>順位</th>
          <th>{label}</th>
          {showDonation && <th>お布施額（千円）</th>}
          <th>手数料（千円）</th>
          <th>件数</th>
          {showDonation && <th>実質手数料率</th>}
          <th>手数料構成比</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const realRate = r.donation > 0 ? (r.fee / r.donation * 100) : 0;
          return (
            <tr key={`${r.name}-${i}`}>
              <td style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
              <td style={{ fontWeight: i < 3 ? 700 : 500 }}>{r.name}</td>
              {showDonation && (
                <td style={{ color: r.donation > 0 ? "var(--color-text)" : "var(--color-text-muted)" }}>
                  {r.donation > 0 ? r.donation.toLocaleString() : "—"}
                </td>
              )}
              <td style={{ fontWeight: 700 }}>{r.fee.toLocaleString()}</td>
              <td>{r.count.toLocaleString()}</td>
              {showDonation && (
                <td style={{ color: "var(--color-text-sub)" }}>
                  {realRate > 0 ? `${realRate.toFixed(1)}%` : "—"}
                </td>
              )}
              <td style={{ color: "var(--color-text-sub)" }}>
                {totalFee > 0 ? `${(r.fee / totalFee * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>合計</td>
          {showDonation && <td>{totalDonation.toLocaleString()}</td>}
          <td>{totalFee.toLocaleString()}</td>
          <td>{totalCount.toLocaleString()}</td>
          {showDonation && <td>—</td>}
          <td>100%</td>
        </tr>
      </tfoot>
    </table>
  );
}

// エリア別 月別マトリクス（お布施額・手数料を月ごとに）
function AreaMatrix({ rows, months, metric }: { rows: AreaMonthlyRow[]; months: string[]; metric: "fee" | "donation" }) {
  const monthTotals: Record<string, number> = {};
  months.forEach(m => {
    monthTotals[m] = rows.reduce((s, r) => s + (r.monthly[m]?.[metric] ?? 0), 0);
  });
  const grandTotal = rows.reduce((s, r) => s + r.total[metric], 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>順位</th>
          <th>エリア名</th>
          {months.map(m => <th key={m}>{MONTH_LABELS[m] ?? m}</th>)}
          <th>合計</th>
          <th>件数</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`}>
            <td style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
            <td style={{ fontWeight: i < 3 ? 700 : 500 }}>{r.name}</td>
            {months.map(m => {
              const v = r.monthly[m]?.[metric] ?? 0;
              return (
                <td key={m} style={{ color: v === 0 ? "var(--color-text-muted)" : "var(--color-text)" }}>
                  {v === 0 ? "—" : v.toLocaleString()}
                </td>
              );
            })}
            <td style={{ fontWeight: 700 }}>{r.total[metric].toLocaleString()}</td>
            <td>{r.total.count.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>合計</td>
          {months.map(m => <td key={m}>{monthTotals[m].toLocaleString()}</td>)}
          <td>{grandTotal.toLocaleString()}</td>
          <td>{rows.reduce((s, r) => s + r.total.count, 0).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function HallPage() {
  const [data, setData]       = useState<HallData | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/actuals?type=hall")
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
            {/* 支社別 */}
            {data.byBranch.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">支社別（お布施額・手数料）</div>
                <div className="card-subtitle">Kintone連携データ（4月〜9月）</div>
                <div style={{ overflowX: "auto" }}>
                  <Table rows={data.byBranch} label="支社名" showDonation />
                </div>
              </div>
            )}

            {/* エリア別 月別マトリクス（お布施額） */}
            {data.byAreaMonthly.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">エリア別 月別 お布施額</div>
                <div className="card-subtitle">Kintone連携データ（4月〜9月）　／　単位：千円</div>
                <div style={{ overflowX: "auto" }}>
                  <AreaMatrix rows={data.byAreaMonthly} months={data.kintoneMonths} metric="donation" />
                </div>
              </div>
            )}

            {/* エリア別 月別マトリクス（手数料） */}
            {data.byAreaMonthly.length > 0 && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-title">エリア別 月別 手数料</div>
                <div className="card-subtitle">Kintone連携データ（4月〜9月）　／　単位：千円</div>
                <div style={{ overflowX: "auto" }}>
                  <AreaMatrix rows={data.byAreaMonthly} months={data.kintoneMonths} metric="fee" />
                </div>
              </div>
            )}

            {/* 会館別 */}
            <div className="card">
              <div className="card-title">会館別（お布施額・手数料）</div>
              <div className="card-subtitle">
                10月〜3月（Excel・手数料のみ）+ 4月〜9月（Kintone・お布施額含む）　／　手数料順で全会館表示
              </div>
              <div style={{ overflowX: "auto" }}>
                <Table rows={data.byHall} label="会館名" showDonation />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
