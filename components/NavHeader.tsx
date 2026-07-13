'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/',             label: 'サマリー'       },
  { href: '/hall',         label: '事業部・会館'   },
  { href: '/denomination', label: '宗派・宗教者'   },
];

export default function NavHeader() {
  const pathname = usePathname();
  const router = useRouter();

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
          height: 56,
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
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>T</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginLeft: 1 }}>EAR</span>
          </span>
          <span style={{ fontSize: 17, fontWeight: 500, color: 'var(--color-text)', letterSpacing: '-0.005em' }}>
            宗教者紹介事業 Analytics
          </span>
          <span style={{ flex: 1 }} />
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
          <p className="page-subtitle">第30期（2025年10月〜2026年9月）</p>
          <div className="pill-tab-bar">
            <nav className="pill-nav">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
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
