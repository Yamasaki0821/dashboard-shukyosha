export interface KintoneRecord {
  [key: string]: { type: string; value: string | string[] | null };
}

const APP_ID       = "1883";
const PROXY_URL    = (process.env.KINTONE_PROXY_URL    ?? "").trim();
const PROXY_SECRET = (process.env.KINTONE_PROXY_SECRET ?? "").trim();

async function proxyGet(query: string): Promise<{ records?: KintoneRecord[] }> {
  const base = PROXY_URL.replace(/\/$/, "");
  const qs = `app=${encodeURIComponent(APP_ID)}&query=${encodeURIComponent(query)}`;
  const url = `${base}/kintone?${qs}`;

  const res = await fetch(url, {
    headers: { "x-proxy-secret": PROXY_SECRET },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy error: ${res.status} - ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchAllKintoneRecords(query: string = ""): Promise<KintoneRecord[]> {
  const all: KintoneRecord[] = [];
  const limit = 500;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const q = query
      ? `${query} limit ${limit} offset ${offset}`
      : `limit ${limit} offset ${offset}`;
    const data = await proxyGet(q);
    const records = data.records ?? [];
    all.push(...records);
    if (records.length < limit) hasMore = false;
    else offset += limit;
  }
  return all;
}

export function str(r: KintoneRecord, key: string): string {
  const v = r[key]?.value;
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

export function num(r: KintoneRecord, key: string): number {
  const v = r[key]?.value;
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(Array.isArray(v) ? v[0] : v));
  return isNaN(n) ? 0 : n;
}

export function toYM(d: string | null | undefined): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4}-\d{2})/);
  return m ? m[1] : null;
}
