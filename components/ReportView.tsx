'use client';
import React from 'react';
import type { ReportSection, ReportLevel } from '../lib/report';

/**
 * 04 レポート（2026-08-28）
 *
 * 文章は lib/report.ts が作る。ここは並べるだけにする。
 * 色は達成率バッジと同じ信号色（context/design_guide.md）。カード自体は塗らず、
 * 色はレベルのバッジと左の細い線だけに使う（色数を増やさない）。
 */

const STYLES: Record<ReportLevel, { label: string; color: string; bg: string }> = {
  alert: { label: '要対応', color: '#c72c22', bg: '#ffebeb' },
  watch: { label: '注視',   color: '#a85800', bg: '#fff2e5' },
  good:  { label: 'good',   color: '#248a3d', bg: '#e5f8ea' },
  info:  { label: '提案',   color: '#0071e3', bg: '#eaf4fe' },
};

export function ReportView({ sections }: { sections: ReportSection[] }) {
  if (sections.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: '#6e6e73', fontSize: 15 }}>
        レポートを作るためのデータが揃っていません。画面上部の警告をご確認ください。
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {sections.map(sec => (
        <section key={sec.key}>
          <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: '#1d1d1f' }}>
            {sec.heading}
          </h3>
          {sec.lead && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6e6e73', lineHeight: 1.6 }}>
              {sec.lead}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sec.items.map(item => {
              const s = STYLES[item.level];
              return (
                <div
                  key={item.key}
                  style={{
                    background: '#ffffff',
                    border: '0.5px solid #d2d2d7',
                    borderLeft: `3px solid ${s.color}`,
                    borderRadius: 11,
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        flex: 'none',
                        fontSize: 12.5, fontWeight: 600,
                        color: s.color, background: s.bg,
                        borderRadius: 6, padding: '2px 8px',
                      }}
                    >
                      {s.label}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', lineHeight: 1.5 }}>
                      {item.title}
                    </span>
                  </div>

                  {item.body.map((line, i) => (
                    <p key={i} style={{ margin: '8px 0 0', fontSize: 14, color: '#1d1d1f', lineHeight: 1.7 }}>
                      {line}
                    </p>
                  ))}

                  {item.table && (
                    <div style={{ marginTop: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420, whiteSpace: 'nowrap' }}>
                        <thead>
                          <tr>
                            {item.table.headers.map((h, i) => (
                              <th
                                key={h}
                                style={{
                                  padding: '7px 9px', fontSize: 13, fontWeight: 600, color: '#1d1d1f',
                                  background: '#fafafc', borderBottom: '0.5px solid #d2d2d7',
                                  textAlign: i === 0 ? 'left' : i === item.table!.headers.length - 1 ? 'left' : 'right',
                                  position: i === 0 ? 'sticky' : undefined, left: i === 0 ? 0 : undefined, zIndex: i === 0 ? 2 : undefined,
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {item.table.rows.map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '0.5px solid #f0f0f2' }}>
                              {row.map((cell, ci) => (
                                <td
                                  key={ci}
                                  style={{
                                    padding: '7px 9px', fontSize: 13.5, color: ci === row.length - 1 ? '#6e6e73' : '#1d1d1f',
                                    fontVariantNumeric: 'tabular-nums',
                                    textAlign: ci === 0 ? 'left' : ci === row.length - 1 ? 'left' : 'right',
                                    fontWeight: ci === 0 ? 600 : 400,
                                    position: ci === 0 ? 'sticky' : undefined, left: ci === 0 ? 0 : undefined,
                                    background: ci === 0 ? '#ffffff' : undefined, zIndex: ci === 0 ? 1 : undefined,
                                  }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {item.list && item.list.length > 0 && (
                    <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none' }}>
                      {item.list.map((li, i) => (
                        <li
                          key={i}
                          style={{
                            padding: '5px 0', fontSize: 13.5, lineHeight: 1.6,
                            borderTop: i === 0 ? 'none' : '0.5px solid #f0f0f2',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {li.url
                            ? <a href={li.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0071e3', textDecoration: 'none' }}>{li.text}</a>
                            : <span style={{ color: '#1d1d1f' }}>{li.text}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.listNote && (
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#86868b' }}>{item.listNote}</p>
                  )}

                  {item.action && (
                    <p
                      style={{
                        margin: '10px 0 0',
                        padding: '10px 12px',
                        background: '#f5f5f7',
                        borderRadius: 8,
                        fontSize: 14,
                        color: '#1d1d1f',
                        lineHeight: 1.7,
                      }}
                    >
                      <b style={{ fontWeight: 600 }}>やるべきこと：</b>
                      {item.action}
                    </p>
                  )}

                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#86868b', lineHeight: 1.6 }}>
                    根拠：{item.basis}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
