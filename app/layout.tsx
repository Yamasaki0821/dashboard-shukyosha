import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "宗教者紹介事業 Analytics | TEAR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --color-bg: #f1f3f4;
            --color-surface: #ffffff;
            --color-topbar: #f8f9fa;
            --color-border: #e0e0e0;
            --color-text: #3c4043;
            --color-text-strong: #202124;
            --color-text-sub: #5f6368;
            --color-text-muted: #80868b;
            --color-blue: #4285f4;
            --color-green: #34a853;
            --color-yellow: #fbbc04;
            --color-red: #ea4335;
            --color-amber-dark: #b06000;
            --color-blue-light: #e8f0fe;
            --color-green-light: #e6f4ea;
            --color-yellow-light: #fef9e7;
            --color-red-light: #fce8e6;
            /* 宗教者紹介テーマ: アンバー */
            --color-theme: #fbbc04;
            --color-theme-deep: #b06000;
            --color-theme-light: #fef9e7;
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body {
            font-family: 'Noto Sans JP', 'Segoe UI', sans-serif;
            background: var(--color-bg);
            color: var(--color-text);
            font-size: 14px;
            -webkit-font-smoothing: antialiased;
          }

          /* トップバー */
          .topbar {
            background: var(--color-topbar);
            border-bottom: 1px solid var(--color-border);
            height: 48px;
            display: flex;
            align-items: center;
            padding: 0 24px;
            gap: 12px;
          }
          .logo-T { color: var(--color-text); font-weight: 700; font-size: 15px; letter-spacing: 0.5px; }
          .logo-EAR { color: var(--color-blue); font-weight: 700; font-size: 15px; letter-spacing: 0.5px; margin-left: 1px; }
          .topbar-sub { font-size: 13px; color: var(--color-text-sub); margin-left: 10px; }
          .topbar-btn {
            background: transparent;
            border: 1px solid var(--color-border);
            border-radius: 6px;
            padding: 5px 14px;
            font-size: 12px;
            cursor: pointer;
            color: var(--color-text-sub);
          }
          .topbar-btn:hover { background: var(--color-bg); }

          /* ページヘッダー */
          .page-header {
            background: var(--color-surface);
            border-bottom: 1px solid var(--color-border);
            padding: 20px 24px 0;
          }
          .page-header-inner { max-width: 1280px; margin: 0 auto; }
          .page-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--color-text);
            margin: 0 0 4px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .page-title-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: var(--color-theme);
          }
          .page-subtitle {
            font-size: 13px;
            color: var(--color-text-sub);
            margin: 0 0 16px;
          }

          /* ピル型タブナビ */
          .pill-nav {
            display: flex;
            gap: 4px;
            padding: 4px;
            background: var(--color-bg);
            border-radius: 10px;
            margin: 0;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            white-space: nowrap;
            width: fit-content;
            max-width: 100%;
          }
          .pill-nav::-webkit-scrollbar { display: none; }
          .pill-tab {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 9px 18px;
            font-size: 13px;
            font-weight: 500;
            color: var(--color-text-sub);
            text-decoration: none;
            border-radius: 8px;
            transition: all 0.15s ease;
            white-space: nowrap;
          }
          .pill-tab:hover { color: var(--color-text); background: rgba(0,0,0,0.03); }
          .pill-tab.active {
            background: var(--color-surface);
            color: var(--color-theme-deep);
            font-weight: 700;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px var(--color-theme);
          }
          .pill-tab-bar {
            margin-top: 16px;
            padding-bottom: 12px;
          }

          /* ページ本体 */
          .page-inner { padding: 24px; max-width: 1280px; margin: 0 auto; }

          /* カード */
          .card {
            background: var(--color-surface);
            border-radius: 8px;
            padding: 20px 24px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.06);
            border: 1px solid var(--color-border);
          }
          .card-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--color-text);
            margin-bottom: 4px;
          }
          .card-subtitle {
            font-size: 11px;
            color: var(--color-text-muted);
            margin-bottom: 16px;
          }

          /* KPIカード */
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .kpi-card {
            background: var(--color-surface);
            border: 1.5px solid var(--color-border);
            border-radius: 8px;
            padding: 16px 18px 16px 22px;
            position: relative;
            overflow: hidden;
          }
          .kpi-card::before {
            content: "";
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 4px;
            background: var(--accent, var(--color-blue));
          }
          .kpi-label {
            font-size: 13px;
            font-weight: 500;
            color: var(--color-text-sub);
            margin-bottom: 8px;
          }
          .kpi-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--color-text-strong);
            line-height: 1.1;
          }
          .kpi-unit {
            font-size: 13px;
            font-weight: 500;
            color: var(--color-text-muted);
            margin-left: 4px;
          }
          .kpi-sub {
            font-size: 11px;
            color: var(--color-text-muted);
            margin-top: 6px;
          }

          /* 2カラム */
          .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

          /* テーブル */
          .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .data-table thead th {
            background: var(--color-text-sub);
            color: #fff;
            font-weight: 600;
            font-size: 12px;
            padding: 10px 12px;
            text-align: right;
            white-space: nowrap;
          }
          .data-table thead th:first-child { text-align: left; border-top-left-radius: 6px; }
          .data-table thead th:last-child { border-top-right-radius: 6px; }
          .data-table tbody td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--color-bg);
            text-align: right;
            color: var(--color-text);
          }
          .data-table tbody td:first-child { text-align: left; }
          .data-table tbody tr:hover { background: var(--color-bg); }
          .data-table tfoot td {
            background: var(--color-text);
            color: #fff;
            padding: 10px 12px;
            font-weight: 700;
            text-align: right;
          }
          .data-table tfoot td:first-child { text-align: left; }

          /* バッジ */
          .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          }
          .badge-green { background: var(--color-green-light); color: var(--color-green); }
          .badge-amber { background: var(--color-yellow-light); color: var(--color-amber-dark); }
          .badge-red { background: var(--color-red-light); color: var(--color-red); }
          .badge-kintone { background: var(--color-blue-light); color: var(--color-blue); margin-left: 6px; }

          /* レスポンシブ */
          @media (max-width: 900px) {
            .kpi-grid { grid-template-columns: repeat(2, 1fr); }
            .grid-2col { grid-template-columns: 1fr; }
          }
          @media (max-width: 600px) {
            .page-inner { padding: 16px 12px; }
            .topbar { padding: 0 12px; }
            .page-header { padding: 16px 12px 0; }
            .kpi-grid { grid-template-columns: 1fr; }
            .kpi-value { font-size: 24px; }
            .page-title { font-size: 18px; }
            .card { padding: 16px; }
          }

          /* ダークモード */
          @media (prefers-color-scheme: dark) {
            :root {
              --color-bg: #1a1a1a;
              --color-surface: #2a2a2a;
              --color-topbar: #232323;
              --color-border: #3a3a3a;
              --color-text: #e8eaed;
              --color-text-strong: #ffffff;
              --color-text-sub: #bdc1c6;
              --color-text-muted: #9aa0a6;
            }
            .pill-tab.active { background: #3a3a3a; }
            .data-table thead th { background: #4a4a4a; }
            .data-table tfoot td { background: #5a5a5a; }
            .data-table tbody tr:hover { background: rgba(255,255,255,0.04); }
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
