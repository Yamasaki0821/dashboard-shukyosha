import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { name, password } = await req.json();

  // 形式: "名前1:パスワード1,名前2:パスワード2"
  const usersRaw = process.env.AUTH_USERS ?? "";
  if (!usersRaw) {
    return NextResponse.json({ error: "設定エラー" }, { status: 500 });
  }
  const users = usersRaw.split(",").map((entry) => {
    const idx = entry.indexOf(":");
    return { name: entry.slice(0, idx), password: entry.slice(idx + 1) };
  });

  const user = users.find((u) => u.name === name && u.password === password);
  if (!user) {
    return NextResponse.json({ error: "名前またはパスワードが違います" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set("auth_user", name, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
