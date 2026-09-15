'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
// 期の定義は lib/fiscalYear.ts が唯一の正。ここに「第30期」等を直書きしない（2026-09-04）
import { FISCAL_YEARS, isFutureFiscalYear, fyLabel, fyLabelLong } from '../lib/fiscalYear';
import { useFiscalYear, fyHref } from '../lib/useFiscalYear';

const NAV = [
  { href: '/',             label: 'サマリー'       },
  { href: '/hall',         label: '事業部・会館'   },
  { href: '/denomination', label: '宗派・宗教者'   },
  { href: '/report',       label: 'レポート'       },
];

export default function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { fy } = useFiscalYear();
  const futureFy = isFutureFiscalYear(fy);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <>
      {/* トップバー（macOS/iOS translucent） */}
      <header
        style={{
          background: 'var(--color-topbar)',
          borderBottom: '0.5px solid var(--color-border)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          padding: '0 22px',
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'baseline', letterSpacing: '0.5px' }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>T</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)', marginLeft: 1 }}>EAR</span>
          </span>
          <span style={{ fontSize: 20, fontWeight: 500, color: 'var(--color-text)', letterSpacing: '-0.005em' }}>
            宗教者紹介事業 Analytics
          </span>
          <span style={{ flex: 1 }} />
          {/* どの期を見ているかは常に見えるところに置く。
              2026-09-04：下までスクロールすると期が分からず、0が並ぶ理由を判断できなかった */}
          <span style={{
            fontSize: 17, fontWeight: 600, marginRight: 4,
            color: futureFy ? 'var(--color-warning)' : 'var(--color-text-sub)',
          }}>
            {fyLabel(fy)}{futureFy ? '（未開始）' : ''}
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '0.5px solid var(--color-border)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-sub)',
              cursor: 'pointer',
              letterSpacing: '-0.005em',
            }}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* ページヘッダー（タイトル＋iOSセグメンテッドコントロール風タブ） */}
      <div className="page-header">
        <div className="page-header-inner">
          <h1 className="page-title">
            <span className="page-title-dot" />
            宗教者紹介事業 Analytics
          </h1>
          <p className="page-subtitle">{fyLabelLong(fy)}</p>
          {/* 期セレクタ。ページを移っても同じ期を見ていたいので、期はURLに持たせる。
              Linkではなく <a> にして本当に読み込み直す（3ページとも取り直すため） */}
          <div className="pill-tab-bar" style={{ marginBottom: 8 }}>
            <nav className="pill-nav" aria-label="会計期の切替">
              {FISCAL_YEARS.map((y) => (
                <a
                  key={y}
                  href={fyHref(pathname, y)}
                  className={`pill-tab ${fy === y ? 'active' : ''}`}
                >
                  {fyLabel(y)}
                </a>
              ))}
            </nav>
          </div>
          <div className="pill-tab-bar">
            <nav className="pill-nav">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={fyHref(n.href, fy)}
                  className={`pill-tab ${isActive(n.href) ? 'active' : ''}`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
