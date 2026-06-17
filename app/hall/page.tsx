"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface HallRow { name: string; fee: number; count: number; }

interface HallData {
  byHall: HallRow[];
  byDivision: HallRow[];
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

const PURPLE = "#6a2d8f";

function TopNav({ active }: { active: "summary" | "hall" | "denomination" }) {
  const tabs = [
    { key: "summary",      label: "サマリー",    href: "/" },
    { key: "hall",         label: "事業部・会館", href: "/hall" },
    { key: "denomination", label: "宗派・宗教者", href: "/denomination" },
  ];
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div className="tab-nav">
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

function HorizontalBar({ data, colorFn }: { data: HallRow[]; colorFn?: (i: number) => string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const top = data.slice(0, 20);
    const COLORS = ["#6a2d8f","#7b3fa0","#8c52b0","#9d65c1","#ae78d2","#bf8be3","#ce93d8","#d9a8e0","#e3bde8","#edcfef"];

    chartRef.current = new w.Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: top.map(d => d.name),
        datasets: [{
          label: "手数料（千円）",
          data: top.map(d => d.fee),
          backgroundColor: top.map((_, i) => colorFn ? colorFn(i) : COLORS[i % COLORS.length]),
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
              label: (ctx: any) => `${ctx.parsed.x.toLocaleString()}千円 / ${top[ctx.dataIndex].count}件`,
            },
          },
        },
        scales: {
          x: { ticks: { callback: (v: number) => v.toLocaleString() } },
        },
      },
    });
  }, [data, colorFn]);

  return <canvas ref={canvasRef} />;
}

function RankTable({ rows, label }: { rows: HallRow[]; label: string }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#f8f9fa" }}>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#5f6368", borderBottom: "1px solid #e0e0e0" }}>順位</th>
          <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#5f6368", borderBottom: "1px solid #e0e0e0" }}>{label}</th>
          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#5f6368", borderBottom: "1px solid #e0e0e0" }}>手数料（千円）</th>
          <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#5f6368", borderBottom: "1px solid #e0e0e0" }}>件数</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.name} style={{ borderBottom: "1px solid #f0f0f0", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
            <td style={{ padding: "8px 12px", color: "#80868b" }}>{i + 1}</td>
            <td style={{ padding: "8px 12px", fontWeight: i < 3 ? 600 : 400 }}>{r.name}</td>
            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: PURPLE }}>{r.fee.toLocaleString()}</td>
            <td style={{ padding: "8px 12px", textAlign: "right" }}>{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HallPage() {
  const [data, setData]       = useState<HallData | null>(null);
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
    fetch("/api/actuals?type=hall")
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

  return (
    <>
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

      <TopNav active="hall" />

      <div className="page-inner">
        {loading && <p style={{ color: "#888" }}>読み込み中...</p>}
        {error   && <p style={{ color: "red" }}>エラー: {error}</p>}

        {data && (
          <>
            {/* 事業部別（Kintoneのみ）*/}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>事業部別手数料</div>
              <div style={{ fontSize: 11, color: "#80868b", marginBottom: 16 }}>
                ※ Kintone連携データのみ（4〜6月実績）。10〜3月のExcelデータには事業部情報が含まれていません。
              </div>
              {data.byDivision.length === 0 ? (
                <p style={{ color: "#888", fontSize: 13 }}>データなし（Kintone未接続またはデータ0件）</p>
              ) : chartReady ? (
                <div style={{ height: Math.max(200, data.byDivision.length * 40) }}>
                  <HorizontalBar data={data.byDivision} />
                </div>
              ) : (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>読み込み中...</div>
              )}
              {data.byDivision.length > 0 && (
                <div style={{ marginTop: 16, overflowX: "auto" }}>
                  <RankTable rows={data.byDivision} label="事業部" />
                </div>
              )}
            </div>

            {/* 会館別 */}
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>会館別手数料（累計）</div>
              <div style={{ fontSize: 11, color: "#80868b", marginBottom: 16 }}>
                10〜3月（Excel）+ 4〜6月（Kintone）の合算。上位20会館を表示。
              </div>
              {chartReady ? (
                <div style={{ height: Math.min(800, Math.max(400, data.byHall.length * 32)) }}>
                  <HorizontalBar data={data.byHall} />
                </div>
              ) : (
                <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>読み込み中...</div>
              )}
              <div style={{ marginTop: 20, overflowX: "auto" }}>
                <RankTable rows={data.byHall} label="会館名" />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
