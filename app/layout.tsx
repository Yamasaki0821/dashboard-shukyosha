import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "宗教者紹介 Analytics | TEAR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          :root {
            --color-bg: #f1f3f4;
            --color-surface: #ffffff;
            --color-topbar: #f8f9fa;
            --color-border: #e0e0e0;
            --color-text: #3c4043;
            --color-text-sub: #5f6368;
            --color-text-muted: #80868b;
            --color-blue: #4285f4;
            --color-green: #34a853;
            --color-yellow: #fbbc04;
            --color-red: #ea4335;
            --color-purple: #9c27b0;
            --color-blue-light: #e8f0fe;
            --color-green-light: #e6f4ea;
            --color-yellow-light: #fef9e7;
            --color-red-light: #fce8e6;
            --color-purple-light: #f3e5f5;
          }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: 'Noto Sans JP', 'Segoe UI', sans-serif; background: var(--color-bg); color: var(--color-text); }

          .tab-nav { overflow-x: auto; -webkit-overflow-scrolling: touch; white-space: nowrap; display: flex; }
          .tab-nav::-webkit-scrollbar { display: none; }

          .kpi-grid { display: flex; gap: 12px; }
          .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .page-inner { padding: 20px 24px; max-width: 1280px; margin: 0 auto; }
          .topbar { background: #f8f9fa; border-bottom: 1px solid #e0e0e0; height: 48px; display: flex; align-items: center; padding: 0 24px; gap: 12px; }

          @media (max-width: 768px) {
            .page-inner { padding: 12px 12px; }
            .topbar { padding: 0 12px; }
            .kpi-grid { flex-wrap: wrap; }
            .kpi-grid > * { flex: 1 1 calc(50% - 6px) !important; min-width: calc(50% - 6px) !important; }
            .grid-2col { grid-template-columns: 1fr !important; }
            .kpi-value { font-size: 22px !important; }
          }

          @media (max-width: 480px) {
            .kpi-grid > * { flex: 1 1 100% !important; min-width: 100% !important; }
          }
        `}</style>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
