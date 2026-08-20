"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "../components/NavHeader";

interface MonthlyRow {
  month: string;
  fee30: number;
  fee40: number;
  feeOther: number;
  total: number;
  donation: number | null;
  count: number;
  budget: number;
}

interface SummaryData {
  monthly: MonthlyRow[];
  totalFee: number;
  totalDonation: number;
  totalCount: number;
  budgetTotal: number;      // 通期予算
  budgetElapsed: number;    // 経過月（期首〜当月）の予算
  elapsedMonth: string;     // 当月（YYYY-MM）
  feeByRate: { rate30: number; rate40: number; other: number };
  feeByCategory: Record<string, number>;
  funeralCount: number;
  funeralFee: number;
  kintonePeriodLabel: string;
}

const MONTH_LABELS: Record<string, string> = {
  "2025-10": "10月", "2025-11": "11月", "2025-12": "12月",
  "2026-01": "1月",  "2026-02": "2月",  "2026-03": "3月",
  "2026-04": "4月",  "2026-05": "5月",  "2026-06": "6月",
  "2026-07": "7月",  "2026-08": "8月",  "2026-09": "9月",
};

// 達成率→色クラス
function rateColor(rate: number) {
  if (rate >= 90) return "var(--color-green)";
  if (rate >= 70) return "var(--color-amber-dark)";
  return "var(--color-red)";
}
function rateBadge(rate: number) {
  if (rate >= 90) return "badge badge-green";
  if (rate >= 70) return "badge badge-amber";
  return "badge badge-red";
}

// KPIカード（iOS統一・アクセントなし）
function KpiCard({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}{unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// 月別棒グラフ
function MonthlyBarChart({ data }: { data: MonthlyRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const labels  = data.map(d => MONTH_LABELS[d.month] ?? d.month);
    const fee30   = data.map(d => d.fee30);
    const fee40   = data.map(d => d.fee40);
    const feeOther = data.map(d => d.feeOther);
    const budgets = data.map(d => d.budget);

    chartRef.current = new w.Chart(canvasRef.current, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "30%手数料",
            data: fee30,
            backgroundColor: "#a5d8ff",
            stack: "fee",
            order: 3,
          },
          {
            type: "bar",
            label: "40%手数料",
            data: fee40,
            backgroundColor: "#0071e3",
            stack: "fee",
            order: 3,
          },
          {
            type: "bar",
            label: "その他の率",
            data: feeOther,
            backgroundColor: "#34c759",
            stack: "fee",
            order: 3,
          },
          {
            type: "line",
            label: "予算",
            data: budgets,
            borderColor: "#86868b",
            backgroundColor: "#86868b",
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: "#86868b",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            tension: 0,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}千円`,
            },
          },
        },
        scales: {
          y: {
            stacked: true,
            ticks: { callback: (v: number) => `${v.toLocaleString()}` },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          x: { stacked: true, grid: { display: false } },
        },
      },
    });
  }, [data]);

  return <canvas ref={canvasRef} style={{ maxHeight: 320 }} />;
}

// ドーナツ（手数料率）
function DonutChart({ rate30, rate40, other }: { rate30: number; rate40: number; other: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    chartRef.current = new w.Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: ["30%手数料", "40%手数料", "その他の率"],
        datasets: [{
          data: [rate30, rate40, other],
          backgroundColor: ["#a5d8ff", "#0071e3", "#34c759"],
          borderColor: "#fff",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "60%",
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 12 }, padding: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.label}: ${ctx.parsed.toLocaleString()}千円`,
            },
          },
        },
      },
    });
  }, [rate30, rate40, other]);

  return <canvas ref={canvasRef} style={{ maxHeight: 260 }} />;
}

export default function SummaryPage() {
  const [data, setData]       = useState<SummaryData | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if ((window as any).Chart) { setChartReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
    s.onload = () => setChartReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    fetch("/api/actuals?type=summary")
      .then(r => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [router]);

  // 達成率は「経過月（期首〜当月）の予算」に対して見る。通期予算で割ると期の途中では必ず低く出る
  const achieveRate = data && data.budgetElapsed > 0
    ? Math.round((data.totalFee / data.budgetElapsed) * 100)
    : 0;
  const achieveRateFy = data && data.budgetTotal > 0
    ? Math.round((data.totalFee / data.budgetTotal) * 100)
    : 0;
  const avgUnit = data && data.funeralCount > 0
    ? Math.round(data.funeralFee / data.funeralCount)
    : 0;
  const elapsedLabel = data ? `${parseInt(data.elapsedMonth.slice(5), 10)}月` : "";

  return (
    <>
      <NavHeader />

      <div className="page-inner">
        {loading && <p style={{ color: "var(--color-text-muted)" }}>読み込み中...</p>}
        {error   && <p style={{ color: "var(--color-red)" }}>エラー: {error}</p>}

        {data && (
          <>
            {/* KPIカード（iOS統一デザイン） */}
            <div className="kpi-grid" style={{ marginBottom: 20 }}>
              <KpiCard
                label="累計予算（10月〜当月）"
                value={data.budgetElapsed.toLocaleString()}
                unit="千円"
                sub={`通期予算 ${data.budgetTotal.toLocaleString()}千円`}
              />
              <KpiCard
                label="累計手数料合計"
                value={data.totalFee.toLocaleString()}
                unit="千円"
                sub={`10月〜${elapsedLabel}実績`}
              />
              <KpiCard
                label="累計予算達成率"
                value={`${achieveRate}%`}
                sub={`10月〜${elapsedLabel}の予算に対して（通期比 ${achieveRateFy}%）`}
              />
              <KpiCard
                label="累計件数"
                value={data.totalCount.toLocaleString()}
                unit="件"
                sub={`葬儀＋法要 合計　／　平均手数料単価 ${avgUnit > 0 ? avgUnit.toLocaleString() : "—"}千円（葬儀系・法要除く・${data.kintonePeriodLabel} ${data.funeralCount}件）`}
              />
            </div>

            {/* 月別グラフ */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">月別手数料実績 vs 予算</div>
              <div className="card-subtitle">単位：千円　／　棒=実績（30%・40%・その他の率）　線=予算</div>
              {chartReady ? (
                <div style={{ height: 320 }}>
                  <MonthlyBarChart data={data.monthly} />
                </div>
              ) : (
                <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>グラフ読み込み中...</div>
              )}
            </div>

            {/* 月別詳細テーブル */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">月別詳細（10月〜9月・第30期）</div>
              <div className="card-subtitle">単位：千円　／　お布施額は4月以降Kintone連携のみ　／　達成率：90%↑緑・70-89%黄・70%未満赤　／　合計行の予算は経過月（10月〜{elapsedLabel}）の累計</div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>月</th>
                      <th>予算</th>
                      <th>手数料合計</th>
                      <th>達成率</th>
                      <th>30%手数料</th>
                      <th>40%手数料</th>
                      <th>その他の率</th>
                      <th>お布施額</th>
                      <th>件数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m) => {
                      const rate = m.budget > 0 ? Math.round((m.total / m.budget) * 100) : 0;
                      const isKintone = m.month >= "2026-04";
                      return (
                        <tr key={m.month}>
                          <td>
                            {MONTH_LABELS[m.month] ?? m.month}
                            {isKintone && <span className="badge badge-kintone">Kintone</span>}
                          </td>
                          <td style={{ color: "var(--color-text-muted)" }}>{m.budget.toLocaleString()}</td>
                          <td style={{ fontWeight: 700 }}>{m.total.toLocaleString()}</td>
                          <td>{m.budget > 0 ? <span className={rateBadge(rate)}>{rate}%</span> : "—"}</td>
                          <td>{m.fee30.toLocaleString()}</td>
                          <td>{m.fee40.toLocaleString()}</td>
                          <td>{m.feeOther.toLocaleString()}</td>
                          <td style={{ color: m.donation === null ? "var(--color-text-muted)" : "var(--color-text)" }}>
                            {m.donation === null ? "—" : m.donation.toLocaleString()}
                          </td>
                          <td>{m.count.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>合計</td>
                      <td>{data.budgetElapsed.toLocaleString()}</td>
                      <td>{data.totalFee.toLocaleString()}</td>
                      <td style={{ color: achieveRate >= 90 ? "#a8f0c1" : achieveRate >= 70 ? "#fde293" : "#fcc1bb" }}>{achieveRate}%</td>
                      <td>{data.feeByRate.rate30.toLocaleString()}</td>
                      <td>{data.feeByRate.rate40.toLocaleString()}</td>
                      <td>{data.feeByRate.other.toLocaleString()}</td>
                      <td>{data.totalDonation.toLocaleString()}</td>
                      <td>{data.totalCount.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid-2col" style={{ marginBottom: 20 }}>
              {/* 手数料率構成ドーナツ */}
              <div className="card">
                <div className="card-title">手数料率構成（累計）</div>
                <div className="card-subtitle">30%／40%／その他（20%・15%・0%・未入力）の構成比</div>
                {chartReady ? (
                  <div style={{ height: 260 }}>
                    <DonutChart rate30={data.feeByRate.rate30} rate40={data.feeByRate.rate40} other={data.feeByRate.other} />
                  </div>
                ) : (
                  <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>読み込み中...</div>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--color-text-sub)" }}>
                  <span>30%: {data.feeByRate.rate30.toLocaleString()}千円</span>
                  <span>40%: {data.feeByRate.rate40.toLocaleString()}千円</span>
                  <span>その他: {data.feeByRate.other.toLocaleString()}千円</span>
                </div>
              </div>

              {/* 区分別表 */}
              <div className="card">
                <div className="card-title">葬法区分別手数料（{data.kintonePeriodLabel}）</div>
                <div className="card-subtitle">Kintone連携データのみ集計</div>
                {Object.keys(data.feeByCategory).length === 0 ? (
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Kintoneデータなし</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>区分</th>
                        <th>手数料（千円）</th>
                        <th>構成比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const entries = Object.entries(data.feeByCategory).sort(([,a],[,b]) => b - a);
                        const catTotal = entries.reduce((s,[,v]) => s + v, 0);
                        return entries.map(([name, fee]) => (
                          <tr key={name}>
                            <td style={{ fontWeight: 500 }}>{name}</td>
                            <td style={{ fontWeight: 700, color: "var(--color-text)" }}>{fee.toLocaleString()}</td>
                            <td style={{ color: "var(--color-text-sub)" }}>
                              {catTotal > 0 ? `${Math.round(fee / catTotal * 100)}%` : "—"}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>合計</td>
                        <td>{Object.values(data.feeByCategory).reduce((s,v) => s+v, 0).toLocaleString()}</td>
                        <td>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
