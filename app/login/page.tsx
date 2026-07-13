"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });

    if (res.ok) {
      router.push(redirect);
    } else {
      const data = await res.json();
      setError(data.error ?? "ログインに失敗しました");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Hiragino Sans', 'Yu Gothic', sans-serif",
      letterSpacing: "-0.01em",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: "44px 40px",
        width: 380,
        border: "0.5px solid #d2d2d7",
        boxShadow: "0 6px 24px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "baseline", letterSpacing: "0.5px" }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#1d1d1f" }}>T</span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#0071e3", marginLeft: 1 }}>EAR</span>
          </div>
          <div style={{ fontSize: 15, color: "#6e6e73", marginTop: 12, fontWeight: 500 }}>
            宗教者紹介事業 Analytics
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 14, color: "#1d1d1f", marginBottom: 8, fontWeight: 500 }}>
              お名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="例：山崎"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "0.5px solid #d2d2d7",
                borderRadius: 10,
                fontSize: 16,
                background: "#fafafc",
                color: "#1d1d1f",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 14, color: "#1d1d1f", marginBottom: 8, fontWeight: 500 }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "0.5px solid #d2d2d7",
                borderRadius: 10,
                fontSize: 16,
                background: "#fafafc",
                color: "#1d1d1f",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              color: "#ff3b30",
              fontSize: 14,
              marginBottom: 16,
              background: "#ffebeb",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading ? "#86868b" : "#0071e3",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "-0.005em",
              transition: "opacity 0.15s ease",
            }}
          >
            {loading ? "ログイン中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
