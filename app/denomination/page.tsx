"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { TopBar, PageHeader } from "../../components/Shell";

interface DenomRow { name: string; fee: number; count: number; }
interface DenomData {
  byDenomination: DenomRow[];
  byOfficiant: DenomRow[];
}

function HorizontalBar({ data }: { data: DenomRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const top = data.slice(0, 20);
    const baseColor = "#fbbc04";

    chartRef.current = new w.Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: top.map(d => d.name),
        datasets: [{
          label: "手数料（千円）",
          data: top.map(d => d.fee),
          backgroundColor: baseColor,
          borderRadius: 4,
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
          x: { ticks: { callback: (v: number) => v.toLocaleString() }, grid: { color: "rgba(0,0,0,0.05)" } },
          y: { grid: { display: false } },
        },
      },
    });
  }, [data]);

  return <canvas ref={canvasRef} />;
}

function RankTable({ rows, label }: { rows: DenomRow[]; label: string }) {
  const total = rows.reduce((s, r) => s + r.fee, 0);
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>順位</th>
          <th>{label}</th>
          <th>手数料（千円）</th>
          <th>件数</th>
          <th>構成比</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`}>
            <td style={{ color: "var(--color-text-muted)" }}>{i + 1}</td>
            <td style={{ fontWeight: i < 3 ? 700 : 500 }}>{r.name}</td>
            <td style={{ fontWeight: 700 }}>{r.fee.toLocaleString()}</td>
            <td>{r.count.toLocaleString()}</td>
            <td style={{ color: "var(--color-text-sub)" }}>
              {total > 0 ? `${(r.fee / total * 100).toFixed(1)}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>合計</td>
          <td>{total.toLocaleString()}</td>
          <td>{rows.reduce((s, r) => s + r.count, 0).toLocaleString()}</td>
          <td>100%</td>
        </tr>
      </tfoot>
    </table>
  );
}

export default function DenominationPage() {
  const [data, setData]       = useState<DenomData | null>(null);
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
      <TopBar />
      <PageHeader active="denomination" />

      <div className="page-inner">
        {loading && <p style={{ color: "var(--color-text-muted)" }}>読み込み中...</p>}
        {error   && <p style={{ color: "var(--color-red)" }}>エラー: {error}</p>}

        {data && (
          <>
            {/* 宗派別 */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">宗派別手数料（累計）</div>
              <div className="card-subtitle">
                10〜3月（Excel）+ 4〜6月（Kintone）の合算　／　上位20宗派を表示
              </div>
              {chartReady ? (
                <div style={{ height: Math.min(700, Math.max(300, Math.min(data.byDenomination.length, 20) * 36)) }}>
                  <HorizontalBar data={data.byDenomination} />
                </div>
              ) : (
                <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>読み込み中...</div>
              )}
              <div style={{ marginTop: 20, overflowX: "auto" }}>
                <RankTable rows={data.byDenomination} label="宗旨宗派" />
              </div>
            </div>

            {/* 宗教者別 */}
            <div className="card">
              <div className="card-title">宗教者・寺院別手数料</div>
              <div className="card-subtitle">
                ※ Kintone連携データのみ（4〜6月実績）。10〜3月のExcelデータには宗教者名が含まれていません。
              </div>
              {data.byOfficiant.length === 0 ? (
                <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>データなし（Kintone未接続またはデータ0件）</p>
              ) : (
                <>
                  {chartReady ? (
                    <div style={{ height: Math.min(700, Math.max(300, Math.min(data.byOfficiant.length, 20) * 36)) }}>
                      <HorizontalBar data={data.byOfficiant} />
                    </div>
                  ) : (
                    <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>読み込み中...</div>
                  )}
                  <div style={{ marginTop: 20, overflowX: "auto" }}>
                    <RankTable rows={data.byOfficiant} label="宗教者名・寺院名" />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
