"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

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
      background: "#f0f4f8",
      fontFamily: "sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: "40px 36px",
        width: 340,
        boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#6a2d8f" }}>TEAR</div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>宗教者紹介 予実ダッシュボード</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, color: "#444", marginBottom: 6 }}>
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
                padding: "10px 12px",
                border: "1px solid #d0d7e0",
                borderRadius: 8,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, color: "#444", marginBottom: 6 }}>
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #d0d7e0",
                borderRadius: 8,
                fontSize: 15,
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{
              color: "#c0392b",
              fontSize: 13,
              marginBottom: 14,
              background: "#fff0ee",
              padding: "8px 12px",
              borderRadius: 6,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              background: loading ? "#a0b4cc" : "#6a2d8f",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "ログイン中..." : "ログイン"}
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
