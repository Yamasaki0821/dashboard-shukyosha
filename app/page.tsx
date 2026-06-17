"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ── 型定義 ──────────────────────────────────────────────────────
interface MonthlyRow {
  month: string;
  fee30: number;
  fee40: number;
  total: number;
  count: number;
  budget: number;
}

interface SummaryData {
  monthly: MonthlyRow[];
  totalFee: number;
  totalCount: number;
  budgetTotal: number;
  feeByRate: { rate30: number; rate40: number };
  feeByCategory: Record<string, number>;
}

// ── 共通スタイル ─────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

const MONTH_LABELS: Record<string, string> = {
  "2025-10": "10月", "2025-11": "11月", "2025-12": "12月",
  "2026-01": "1月",  "2026-02": "2月",  "2026-03": "3月",
  "2026-04": "4月",  "2026-05": "5月",  "2026-06": "6月",
};

const PURPLE = "#6a2d8f";
const PURPLE_LIGHT = "#9c4fbe";

// ── ナビゲーション ────────────────────────────────────────────────
function TopNav({ active }: { active: "summary" | "hall" | "denomination" }) {
  const tabs = [
    { key: "summary",      label: "サマリー",    href: "/" },
    { key: "hall",         label: "事業部・会館", href: "/hall" },
    { key: "denomination", label: "宗派・宗教者", href: "/denomination" },
  ];
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div className="tab-nav" style={{ gap: 0 }}>
          {tabs.map(t => (
            <a key={t.key} href={t.href} style={{
              display: "inline-block",
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: active === t.key ? 700 : 400,
              color: active === t.key ? PURPLE : "#5f6368",
              borderBottom: active === t.key ? `3px solid ${PURPLE}` : "3px solid transparent",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}>{t.label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── KPI カード ────────────────────────────────────────────────────
function KPICard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...card, flex: "1 1 0", minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#5f6368", marginBottom: 6 }}>{label}</div>
      <div className="kpi-value" style={{ fontSize: 28, fontWeight: 700, color: color ?? "#3c4043" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#80868b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── 月別棒グラフ（Chart.js）────────────────────────────────────────
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
    const budgets = data.map(d => d.budget);

    chartRef.current = new w.Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "30%手数料",
            data: fee30,
            backgroundColor: "#ce93d8",
            stack: "fee",
          },
          {
            label: "40%手数料",
            data: fee40,
            backgroundColor: PURPLE,
            stack: "fee",
          },
          {
            label: "予算",
            data: budgets,
            type: "line",
            borderColor: "#fbbc04",
            backgroundColor: "transparent",
            borderWidth: 2,
            pointRadius: 3,
            tension: 0,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
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
          },
          x: { stacked: true },
        },
      },
    });
  }, [data]);

  return <canvas ref={canvasRef} style={{ maxHeight: 320 }} />;
}

// ── ドーナツグラフ（手数料率）────────────────────────────────────
function DonutChart({ rate30, rate40 }: { rate30: number; rate40: number }) {
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
        labels: ["30%手数料", "40%手数料"],
        datasets: [{
          data: [rate30, rate40],
          backgroundColor: ["#ce93d8", PURPLE],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.label}: ${ctx.parsed.toLocaleString()}千円`,
            },
          },
        },
      },
    });
  }, [rate30, rate40]);

  return <canvas ref={canvasRef} style={{ maxHeight: 260 }} />;
}

// ── 区分別バーチャート ────────────────────────────────────────────
function CategoryBarChart({ data }: { data: Record<string, number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const entries = Object.entries(data).sort(([,a],[,b]) => b - a);
    const COLORS = ["#6a2d8f","#9c4fbe","#ce93d8","#34a853","#fbbc04","#ea4335"];

    chartRef.current = new w.Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: entries.map(([k]) => k),
        datasets: [{
          label: "手数料（千円）",
          data: entries.map(([,v]) => v),
          backgroundColor: entries.map((_, i) => COLORS[i % COLORS.length]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y" as const,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.parsed.x.toLocaleString()}千円`,
            },
          },
        },
        scales: {
          x: { ticks: { callback: (v: number) => `${v.toLocaleString()}` } },
        },
      },
    });
  }, [data]);

  return <canvas ref={canvasRef} style={{ maxHeight: 220 }} />;
}

// ── メインページ ─────────────────────────────────────────────────
export default function SummaryPage() {
  const [data, setData]       = useState<SummaryData | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const router = useRouter();

  // Chart.js CDN ロード
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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const achieveRate = data && data.budgetTotal > 0
    ? Math.round((data.totalFee / data.budgetTotal) * 100)
    : 0;

  return (
    <>
      {/* Script: Chart.js */}
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js" async />

      {/* Topbar */}
      <div className="topbar">
        <span style={{ fontWeight: 700, fontSize: 15, color: PURPLE }}>TEAR</span>
        <span style={{ fontSize: 13, color: "#5f6368" }}>宗教者紹介 ダッシュボード</span>
        <span style={{ flex: 1 }} />
        <button onClick={handleLogout} style={{
          background: "none", border: "1px solid #d0d0d0",
          borderRadius: 6, padding: "4px 12px", fontSize: 13,
          cursor: "pointer", color: "#5f6368",
        }}>ログアウト</button>
      </div>

      {/* Tab Navigation */}
      <TopNav active="summary" />

      <div className="page-inner">
        {loading && <p style={{ color: "#888" }}>読み込み中...</p>}
        {error   && <p style={{ color: "red" }}>エラー: {error}</p>}

        {data && (
          <>
            {/* KPI カード */}
            <div className="kpi-grid" style={{ marginBottom: 20 }}>
              <KPICard
                label="累計手数料（千円）"
                value={data.totalFee.toLocaleString()}
                sub={`予算: ${data.budgetTotal.toLocaleString()}千円`}
                color={PURPLE}
              />
              <KPICard
                label="予算達成率"
                value={`${achieveRate}%`}
                color={achieveRate >= 100 ? "#34a853" : achieveRate >= 80 ? "#fbbc04" : "#ea4335"}
              />
              <KPICard
                label="累計件数"
                value={`${data.totalCount.toLocaleString()}件`}
              />
              <KPICard
                label="平均手数料単価（千円）"
                value={data.totalCount > 0 ? Math.round(data.totalFee / data.totalCount).toLocaleString() : "—"}
              />
            </div>

            {/* 月別グラフ */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                月別手数料実績 vs 予算（千円）
              </div>
              {chartReady ? (
                <div style={{ height: 320 }}>
                  <MonthlyBarChart data={data.monthly} />
                </div>
              ) : (
                <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>グラフ読み込み中...</div>
              )}
            </div>

            <div className="grid-2col" style={{ marginBottom: 20 }}>
              {/* 手数料率構成ドーナツ */}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>手数料率構成（累計）</div>
                {chartReady ? (
                  <div style={{ height: 260 }}>
                    <DonutChart rate30={data.feeByRate.rate30} rate40={data.feeByRate.rate40} />
                  </div>
                ) : (
                  <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>読み込み中...</div>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "#5f6368" }}>
                  <span>30%: {data.feeByRate.rate30.toLocaleString()}千円</span>
                  <span>40%: {data.feeByRate.rate40.toLocaleString()}千円</span>
                </div>
              </div>

              {/* 区分別（葬儀/法要）*/}
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>葬法区分別手数料（4〜6月）</div>
                <div style={{ fontSize: 11, color: "#80868b", marginBottom: 12 }}>※ Kintone連携データのみ（4〜6月実績）</div>
                {Object.keys(data.feeByCategory).length === 0 ? (
                  <p style={{ color: "#888", fontSize: 13 }}>Kintoneデータなし</p>
                ) : chartReady ? (
                  <div style={{ height: 220 }}>
                    <CategoryBarChart data={data.feeByCategory} />
                  </div>
                ) : (
                  <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>読み込み中...</div>
                )}
              </div>
            </div>

            {/* 月別テーブル */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>月別詳細</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      {["月", "30%手数料", "40%手数料", "合計（千円）", "予算（千円）", "達成率", "件数"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#5f6368", borderBottom: "1px solid #e0e0e0", whiteSpace: "nowrap" }}>
                          {h === "月" ? <span style={{ textAlign: "left", display: "block" }}>{h}</span> : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m, i) => {
                      const rate = m.budget > 0 ? Math.round((m.total / m.budget) * 100) : 0;
                      const rateColor = rate >= 100 ? "#34a853" : rate >= 80 ? "#fbbc04" : "#ea4335";
                      const isKintone = m.month >= "2026-04";
                      return (
                        <tr key={m.month} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "8px 12px", color: "#3c4043", whiteSpace: "nowrap" }}>
                            {MONTH_LABELS[m.month] ?? m.month}
                            {isKintone && <span style={{ fontSize: 10, color: "#9c27b0", marginLeft: 4 }}>Kintone</span>}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{m.fee30.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{m.fee40.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{m.total.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#5f6368" }}>{m.budget.toLocaleString()}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: rateColor }}>{m.budget > 0 ? `${rate}%` : "—"}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{m.count.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f3e5f5", fontWeight: 700 }}>
                      <td style={{ padding: "8px 12px" }}>合計</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{data.feeByRate.rate30.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{data.feeByRate.rate40.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{data.totalFee.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{data.budgetTotal.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: achieveRate >= 100 ? "#34a853" : "#ea4335" }}>{achieveRate}%</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{data.totalCount.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
