'use client';
import React from 'react';

/**
 * 予実表の正規版（2026-08-26 山崎さん承認）
 * 出典：アウトプット/01_提案・資料/v6_霊園DB予実表_型たたき台_20260825.html
 *
 * 全ダッシュボード共通の型。他DBへ横展開するときはこのファイルをそのままコピーし、
 * 呼び出し側で BudgetRow[] を組み立てるだけにする。
 *
 * ルールは スキル dashboard-table（.claude/skills/dashboard-table/SKILL.md）に準拠：
 *   - 先頭列は sticky 固定。背景色を必ず明示する（透けると数字が重なる）
 *   - 列順は 予算 → 実績 → 差異 → 達成率
 *   - Q小計は入れない。合計行は黒地×白文字
 *   - 軸の境目は 1px（2pxは太すぎる）／明細の行区切りは 0.5px
 *   - 色は 背景3色・文字3色＋差異のマイナスのみ赤
 *   - 数字は tabular-nums で桁を揃える
 */

export interface BudgetRow {
  /** 表示ラベル（例：2025年10月 / 11月） */
  label: string;
  /** 予算（千円 or 件） */
  budget: number;
  /**
   * 確定実績。月がまだ締まっておらず実績が立っていない場合は null（「未計上」と表示）。
   * 0 と null は区別する。0 は「締まったが売上ゼロ」を意味する
   */
  confirmed: number | null;
  /** 見込み（契約済だが未計上）。表2でのみ使う */
  forecast: number;
}

// ── 配色（dashboard-table ルール）──────────────────────────────
const C = {
  text: '#1d1d1f',
  budget: '#86868b',
  confirmed: '#0071e3',
  planned: '#34c759',
  muted: '#a1a1a6',
  danger: '#d70015',
  surface: '#ffffff',
  surface2: '#fafafc',
  hairline: '0.5px solid #f0f0f2',
  headBorder: '0.5px solid #d2d2d7',
  axis: '1px solid #c7c7cc',
  axisOnDark: '1px solid #6e6e73',
  dark: '#1d1d1f',
  dangerOnDark: '#ff6961',
  successOnDark: '#34c759',
  mutedOnDark: '#6e6e73',
} as const;

const cellBase: React.CSSProperties = {
  padding: '7px 9px',
  fontSize: 'var(--fs-body-dense)',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

/** 先頭の見出し列。sticky 固定＋背景の明示は必須 */
function headCell(bg: string, fg: string): React.CSSProperties {
  return {
    ...cellBase,
    textAlign: 'left',
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: bg,
    color: fg,
    fontWeight: 600,
    padding: '7px 4px 7px 10px',
    width: '1%',
  };
}

function thStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    ...cellBase,
    background: C.surface2,
    color: C.text,
    fontWeight: 600,
    borderBottom: C.headBorder,
    ...extra,
  };
}

const fmt = (n: number) => n.toLocaleString();

/** 差異。マイナスは ▼ ＋赤。▲ は会計のマイナスと紛らわしいので使わない */
function diffCell(diff: number, onDark: boolean): { text: string; color: string } {
  if (diff < 0) return { text: `▼${fmt(Math.abs(diff))}`, color: onDark ? C.dangerOnDark : C.danger };
  if (diff > 0) return { text: `＋${fmt(diff)}`, color: onDark ? C.successOnDark : C.planned };
  return { text: '0', color: onDark ? '#ffffff' : C.text };
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: '0.5px solid #d2d2d7', borderRadius: 11, overflow: 'hidden' }}>
      {/* スクロールはこの内側の div だけが担当する（親に overflow:hidden があると sticky が効かない） */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>
    </div>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '14px 14px', fontSize: 12.5, color: '#6e6e73' }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: it.color, flex: 'none' }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// 表1　月次 予算実績（確定分のみ）
// 単月と累計を左右に並べる。見込みは一切含めない＝月を締めたら動かない数字
// ══════════════════════════════════════════════════════════════
export function BudgetActualTable({ rows, unit = '千円' }: { rows: BudgetRow[]; unit?: string }) {
  // 累計は「未計上の月」で止める。まだ立っていない実績を足し込むと達成率が嘘になる
  let cumBudget = 0;
  let cumActual = 0;
  let cumStopped = false;

  const body = rows.map((r) => {
    cumBudget += r.budget;
    if (r.confirmed === null) cumStopped = true;
    else if (!cumStopped) cumActual += r.confirmed;

    const mDiff = r.confirmed === null ? null : r.confirmed - r.budget;
    const mRate = r.confirmed === null || r.budget <= 0 ? null : (r.confirmed / r.budget) * 100;
    const cDiff = cumStopped ? null : cumActual - cumBudget;
    const cRate = cumStopped || cumBudget <= 0 ? null : (cumActual / cumBudget) * 100;

    return { ...r, cumBudget, cumActual: cumStopped ? null : cumActual, mDiff, mRate, cDiff, cRate };
  });

  // 合計行は年間予算に対する進捗。単月側は累計と同じ数字になり意味が無いので空欄にする
  const annualBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + (r.confirmed ?? 0), 0);
  const totalDiff = totalActual - annualBudget;
  const totalRate = annualBudget > 0 ? (totalActual / annualBudget) * 100 : 0;
  const td = diffCell(totalDiff, true);

  return (
    <Card>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...thStyle({ textAlign: 'left', verticalAlign: 'bottom', position: 'sticky', left: 0, top: 0, zIndex: 3, padding: '7px 4px 7px 10px' }) }}>月</th>
            <th colSpan={4} style={thStyle({ textAlign: 'center' })}>単月</th>
            <th colSpan={4} style={thStyle({ textAlign: 'center', borderLeft: C.axis })}>累計</th>
          </tr>
          <tr>
            <th style={thStyle()}>予算</th>
            <th style={thStyle()}>実績</th>
            <th style={thStyle()}>差異</th>
            <th style={thStyle()}>達成率</th>
            <th style={thStyle({ borderLeft: C.axis })}>予算</th>
            <th style={thStyle()}>実績</th>
            <th style={thStyle()}>差異</th>
            <th style={thStyle()}>達成率</th>
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => {
            const pending = r.confirmed === null;
            const md = r.mDiff === null ? null : diffCell(r.mDiff, false);
            const cd = r.cDiff === null ? null : diffCell(r.cDiff, false);
            const dim = pending ? C.muted : undefined;
            return (
              <tr key={i} style={{ borderBottom: C.hairline }}>
                <td style={{ ...headCell(C.surface, pending ? C.muted : C.text) }}>{r.label}</td>
                <td style={{ ...cellBase, color: C.budget }}>{fmt(r.budget)}</td>
                <td style={{ ...cellBase, color: pending ? C.muted : C.confirmed, fontWeight: pending ? 400 : 600 }}>
                  {pending ? '未計上' : fmt(r.confirmed as number)}
                </td>
                <td style={{ ...cellBase, color: md ? md.color : C.muted }}>{md ? md.text : '—'}</td>
                <td style={{ ...cellBase, color: dim ?? C.text, fontWeight: pending ? 400 : 600 }}>
                  {r.mRate === null ? '—' : `${r.mRate.toFixed(1)}%`}
                </td>
                <td style={{ ...cellBase, color: C.budget, borderLeft: C.axis }}>{fmt(r.cumBudget)}</td>
                <td style={{ ...cellBase, color: r.cumActual === null ? C.muted : C.confirmed, fontWeight: r.cumActual === null ? 400 : 600 }}>
                  {r.cumActual === null ? '—' : fmt(r.cumActual)}
                </td>
                <td style={{ ...cellBase, color: cd ? cd.color : C.muted }}>{cd ? cd.text : '—'}</td>
                <td style={{ ...cellBase, color: r.cRate === null ? C.muted : C.text, fontWeight: r.cRate === null ? 400 : 600 }}>
                  {r.cRate === null ? '—' : `${r.cRate.toFixed(1)}%`}
                </td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...headCell(C.dark, '#ffffff'), fontWeight: 700 }}>合計（通期予算比）</td>
            {[0, 1, 2, 3].map((k) => (
              <td key={k} style={{ ...cellBase, background: C.dark, color: C.mutedOnDark, fontWeight: 700 }}>—</td>
            ))}
            <td style={{ ...cellBase, background: C.dark, color: C.muted, fontWeight: 600, borderLeft: C.axisOnDark }}>{fmt(annualBudget)}</td>
            <td style={{ ...cellBase, background: C.dark, color: '#ffffff', fontWeight: 700 }}>{fmt(totalActual)}</td>
            <td style={{ ...cellBase, background: C.dark, color: td.color, fontWeight: 700 }}>{td.text}</td>
            <td style={{ ...cellBase, background: C.dark, color: '#ffffff', fontWeight: 700 }}>{totalRate.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
      <Legend
        items={[
          { color: C.budget, label: `予算（${unit}）` },
          { color: C.confirmed, label: '実績（確定）' },
          { color: C.danger, label: '予算未達' },
        ]}
      />
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════
// 表2　月次 着地見込み（実績＋見込）
// 契約済だが未計上の分を「計上予定日」の月に置いて通期の着地を予測する
// ══════════════════════════════════════════════════════════════
export function LandingForecastTable({ rows, unit = '千円' }: { rows: BudgetRow[]; unit?: string }) {
  const annualBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totConfirmed = rows.reduce((s, r) => s + (r.confirmed ?? 0), 0);
  const totForecast = rows.reduce((s, r) => s + r.forecast, 0);
  const totLanding = totConfirmed + totForecast;
  const totDiff = totLanding - annualBudget;
  const totRate = annualBudget > 0 ? (totLanding / annualBudget) * 100 : 0;
  const td = diffCell(totDiff, true);

  return (
    <Card>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            <th style={thStyle({ textAlign: 'left', position: 'sticky', left: 0, top: 0, zIndex: 3, padding: '7px 4px 7px 10px' })}>月</th>
            <th style={thStyle()}>予算</th>
            <th style={thStyle()}>確定</th>
            <th style={thStyle()}>見込み</th>
            <th style={thStyle({ borderLeft: C.axis })}>小計</th>
            <th style={thStyle()}>差異</th>
            <th style={thStyle()}>達成率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const confirmed = r.confirmed ?? 0;
            const sub = confirmed + r.forecast;
            const hasForecast = r.forecast > 0;
            // 見込みしか無い月は達成率を出さない（まだ確定していない数字で率を語らない）
            const rate = r.budget > 0 && r.confirmed !== null ? (sub / r.budget) * 100 : null;
            const d = diffCell(sub - r.budget, false);
            const bg = hasForecast && r.confirmed === null ? C.surface2 : C.surface;
            return (
              <tr key={i} style={{ borderBottom: C.hairline }}>
                <td style={{ ...headCell(bg, C.text) }}>{r.label}{hasForecast && r.confirmed === null ? '（見込み）' : ''}</td>
                <td style={{ ...cellBase, background: bg, color: C.budget }}>{fmt(r.budget)}</td>
                <td style={{ ...cellBase, background: bg, color: r.confirmed === null ? C.muted : C.confirmed, fontWeight: r.confirmed === null ? 400 : 600 }}>
                  {r.confirmed === null ? '—' : fmt(r.confirmed)}
                </td>
                <td style={{ ...cellBase, background: bg, color: hasForecast ? C.planned : C.muted, fontWeight: hasForecast ? 600 : 400 }}>
                  {hasForecast ? fmt(r.forecast) : '—'}
                </td>
                <td style={{ ...cellBase, background: bg, color: C.text, borderLeft: C.axis }}>{fmt(sub)}</td>
                <td style={{ ...cellBase, background: bg, color: d.color }}>{d.text}</td>
                <td style={{ ...cellBase, background: bg, color: rate === null ? C.muted : C.text, fontWeight: rate === null ? 400 : 600 }}>
                  {rate === null ? '—' : `${rate.toFixed(1)}%`}
                </td>
              </tr>
            );
          })}
          <tr>
            <td style={{ ...headCell(C.dark, '#ffffff'), fontWeight: 700 }}>合計（通期・着地見込み）</td>
            <td style={{ ...cellBase, background: C.dark, color: C.muted, fontWeight: 600 }}>{fmt(annualBudget)}</td>
            <td style={{ ...cellBase, background: C.dark, color: '#ffffff', fontWeight: 700 }}>{fmt(totConfirmed)}</td>
            <td style={{ ...cellBase, background: C.dark, color: C.successOnDark, fontWeight: 700 }}>{fmt(totForecast)}</td>
            <td style={{ ...cellBase, background: C.dark, color: '#ffffff', fontWeight: 700, borderLeft: C.axisOnDark }}>{fmt(totLanding)}</td>
            <td style={{ ...cellBase, background: C.dark, color: td.color, fontWeight: 700 }}>{td.text}</td>
            <td style={{ ...cellBase, background: C.dark, color: '#ffffff', fontWeight: 700 }}>{totRate.toFixed(1)}%</td>
          </tr>
        </tbody>
      </table>
      <Legend
        items={[
          { color: C.budget, label: `予算（${unit}）` },
          { color: C.confirmed, label: '確定（実績）' },
          { color: C.planned, label: '見込み（着地予想）' },
          { color: C.danger, label: '予算未達' },
        ]}
      />
    </Card>
  );
}
