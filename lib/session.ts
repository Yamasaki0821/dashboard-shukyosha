// 署名付きセッション（HMAC-SHA256）
//
// なぜ必要か：
//   以前は cookie "auth_user=名前" の「有無」だけを見ていた。名前は平文で、
//   誰でもブラウザから自分で書ける。つまり誰でもログインを偽装できた。
//   ここでは「サーバーの秘密鍵(AUTH_SECRET)で署名した印」をcookieに入れる。
//   偽造すると署名が合わず弾かれる。秘密鍵はサーバーだけが持つ。
//
// Edge(middleware)でもNode(route handler)でも動くよう Web Crypto を使う。

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// 名前 + 有効期限 に署名したトークンを作る（ログイン成功時に呼ぶ）
export async function createSession(
  name: string,
  secret: string,
  ttlSec = 60 * 60 * 24 * 7
): Promise<string> {
  const exp = Date.now() + ttlSec * 1000;
  const payload = `${encodeURIComponent(name)}.${exp}`;
  const key = await getKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

// トークンを検証し、正しければ名前を返す。偽造・期限切れは null（毎リクエストで呼ぶ）
export async function verifySession(
  token: string | undefined | null,
  secret: string
): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [name, exp, sig] = parts;
  const payload = `${name}.${exp}`;
  const key = await getKey(secret);
  const expected = b64url(
    await crypto.subtle.sign("HMAC", key, enc.encode(payload))
  );
  // 長さが違えば即false。同長なら全文字XORで定数時間比較（タイミング攻撃対策）
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (diff !== 0) return null;
  if (Date.now() > Number(exp)) return null;
  return decodeURIComponent(name);
}
