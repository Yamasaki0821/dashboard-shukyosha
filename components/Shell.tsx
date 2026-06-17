"use client";

import { useRouter } from "next/navigation";

export function TopBar() {
  const router = useRouter();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }
  return (
    <div className="topbar">
      <span>
        <span className="logo-T">T</span>
        <span className="logo-EAR">EAR</span>
      </span>
      <span className="topbar-sub">宗教者紹介事業 Analytics</span>
      <span style={{ flex: 1 }} />
      <button onClick={handleLogout} className="topbar-btn">ログアウト</button>
    </div>
  );
}

export function PageHeader({ active }: { active: "summary" | "hall" | "denomination" }) {
  const tabs = [
    { key: "summary",      label: "サマリー",          href: "/" },
    { key: "hall",         label: "事業部・会館",      href: "/hall" },
    { key: "denomination", label: "宗派・宗教者",      href: "/denomination" },
  ];
  return (
    <div className="page-header">
      <div className="page-header-inner">
        <h1 className="page-title">
          <span className="page-title-dot" />
          宗教者紹介事業 Analytics
        </h1>
        <p className="page-subtitle">第30期（2025年10月〜2026年9月）</p>
        <div className="pill-tab-bar">
          <nav className="pill-nav">
            {tabs.map(t => (
              <a key={t.key} href={t.href} className={`pill-tab ${active === t.key ? "active" : ""}`}>
                {t.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
