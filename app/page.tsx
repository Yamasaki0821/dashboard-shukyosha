"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "../components/NavHeader";
import { isFutureFiscalYear, monthLabel, fyLabel, fyStartLabel, FISCAL_YEARS } from '../lib/fiscalYear';
import { useFiscalYear } from '../lib/useFiscalYear';
import { BudgetActualTable, LandingForecastTable, type BudgetRow } from "../components/BudgetTables";

interface MonthlyRow {
  month: string;
  fee30: number;
  fee40: number;
  feeOther: number;
  total: number;
  planned: number;        // 見込み（葬儀日が未来）
  plannedCount: number;
  donation: number | null;
  count: number;
  budget: number;
  isKintone: boolean;   // その月のデータがKintone由来か（第30期の前半だけCSV由来）
}

interface SummaryData {
  monthly: MonthlyRow[];
  totalFee: number;         // 確定のみ（葬儀日が今日以前）
  totalPlanned: number;     // 見込み（葬儀日が未来）
  totalPlannedCount: number;
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
  csvPeriodLabel: string | null;   // CSVを使わない期は null
  mixedSources: boolean;   // CSVとKintoneが混在する期か（第30期のみ true）
}

// 月の見出しは lib/fiscalYear.ts の monthLabel() を使う。期ごとの対応表は持たない（2026-09-04）


// 月別棒グラフ
function MonthlyBarChart({ data }: { data: MonthlyRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const w = window as any;
    if (!w.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const labels  = data.map(d => monthLabel(d.month));
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
  const [tab, setTab] = useState<"budget" | "breakdown">("budget");
  const router = useRouter();
  // 表示中の会計期はURLの ?fy= が正。ready になるまで取りに行かない（2回取るのを防ぐ）
  const { fy, ready: fyReady } = useFiscalYear();
  const futureFy = isFutureFiscalYear(fy);

  useEffect(() => {
    if ((window as any).Chart) { setChartReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
    s.onload = () => setChartReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!fyReady) return;
    setLoading(true);
    fetch(`/api/actuals?type=summary&fy=${fy}`)
      .then(r => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then(d => { if (d) setData(d); })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [router, fy, fyReady]);

  const avgUnit = data && data.funeralCount > 0
    ? Math.round(data.funeralFee / data.funeralCount)
    : 0;
  const elapsedLabel = data ? `${parseInt(data.elapsedMonth.slice(5), 10)}月` : "";

  /**
   * 予実表の行データ。型は霊園DB・不動産DB・相続DBと共通
   * （components/BudgetTables.tsx の BudgetRow）。
   *
   * 宗教者紹介の確定／見込みは葬儀日で分かれる（2026-08-24 山崎さん判断）。
   *   確定 = 葬儀日_法要日 が今日以前 → monthly[].total
   *   見込み = 葬儀日が未来           → monthly[].planned
   * APIは以前から planned を返していたが、月別表に列が無く画面に出ていなかった。
   *
   * confirmed に null を入れる＝「まだ締まっていない月」。0（締まったが売上ゼロ）と区別する。
   * これを入れないと、まだ来ていない月の 0 が累計に足し込まれて達成率が嘘になる。
   */
  const budgetRows: BudgetRow[] = data
    ? data.monthly.map(m => ({
        label: monthLabel(m.month),
        budget: m.budget,
        confirmed: m.month > data.elapsedMonth ? null : m.total,
        forecast: m.planned,
      }))
    : [];

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
            {/* iOSセグメント風タブ。
                2026-09-01 山崎さん指示：KPIカードは廃止し、予実と内訳をタブで分ける。
                「予算実績」＝表1→グラフ→表2 の順。「内訳」＝手数料率・お布施・件数・葬法区分 */}
            <div style={{ marginBottom: 20 }}>
              <div className="pill-nav">
                {([["budget", "01 予算実績"], ["breakdown", "02 内訳"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    className={`pill-tab ${tab === key ? "active" : ""}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "budget" && (
              <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">表1　月次 予算実績（確定分のみ）</div>
              <div className="card-subtitle">
                確定 = 葬儀日・法要日が今日以前。見込みは含めないので、月を締めたら動かない数字。単位：千円
              </div>
              <BudgetActualTable rows={budgetRows} />
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

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">表2　月次 着地見込み（実績＋見込）</div>
              <div className="card-subtitle">
                見込み = 葬儀日・法要日が未来。葬儀日の月に置いて通期の着地を予測する。単位：千円
              </div>
              <LandingForecastTable rows={budgetRows} />
            </div>
              </>
            )}

            {tab === "breakdown" && (
              <>
            {/* 内訳テーブル（予実から分離）。手数料率・お布施・件数はここで見る */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">月別内訳（手数料率・お布施・件数）</div>
              <div className="card-subtitle">単位：千円　／　お布施額は4月以降Kintone連携のみ　／　合計は経過月（10月〜{elapsedLabel}）の累計</div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table data-table--sticky is-md">
                  <thead>
                    <tr>
                      <th>月</th>
                      <th>30%手数料</th>
                      <th>40%手数料</th>
                      <th>その他の率</th>
                      <th>お布施額</th>
                      <th>件数</th>
                      <th>見込み件数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m) => {
                      // 出どころの表示はAPIの判定に従う。CSVを使わない期はバッジ自体を出さない
                      const isKintone = m.isKintone;
                      return (
                        <tr key={m.month}>
                          <td>
                            {monthLabel(m.month)}
                            {data.mixedSources && isKintone && <span className="badge badge-kintone">Kintone</span>}
                          </td>
                          <td>{m.fee30.toLocaleString()}</td>
                          <td>{m.fee40.toLocaleString()}</td>
                          <td>{m.feeOther.toLocaleString()}</td>
                          <td style={{ color: m.donation === null ? "var(--color-text-muted)" : "var(--color-text)" }}>
                            {m.donation === null ? "—" : m.donation.toLocaleString()}
                          </td>
                          <td>{m.count.toLocaleString()}</td>
                          <td style={{ color: m.plannedCount === 0 ? "var(--color-text-muted)" : "var(--color-planned, #34c759)" }}>
                            {m.plannedCount === 0 ? "—" : m.plannedCount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>合計</td>
                      <td>{data.feeByRate.rate30.toLocaleString()}</td>
                      <td>{data.feeByRate.rate40.toLocaleString()}</td>
                      <td>{data.feeByRate.other.toLocaleString()}</td>
                      <td>{data.totalDonation.toLocaleString()}</td>
                      <td>{data.totalCount.toLocaleString()}</td>
                      <td>{data.totalPlannedCount.toLocaleString()}</td>
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
                <div className="card-subtitle">
                  Kintone連携データのみ集計　／　葬儀系の平均手数料単価 {avgUnit > 0 ? avgUnit.toLocaleString() : "—"}千円（法要除く・{data.funeralCount}件）
                </div>
                <div className="card-subtitle" style={{ marginTop: 6 }}>
                  「葬儀（旧区分）」は2026年8月より前に登録された分です。当時は二日葬・一日葬に分けていなかったため、
                  どちらだったかはKintoneに記録がありません。8月以降の登録分だけが二日葬・一日葬に分かれます。
                </div>
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
                            {/* 「葬儀」は2026年8月に廃止された旧区分。二日葬・一日葬と並べると
                                第3の葬法があるように見えてしまうので、ラベルで区別する */}
                            <td style={{ fontWeight: 500 }}>{name === "葬儀" ? "葬儀（旧区分）" : name}</td>
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
          </>
        )}
      </div>
    </>
  );
}
