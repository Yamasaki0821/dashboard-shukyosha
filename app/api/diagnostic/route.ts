export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from "next/server";
import { fetchAllKintoneRecords, str } from "../../../lib/kintone";

const KINTONE_QUERY = '葬儀日_法要日 >= "2026-04-01" and 葬儀日_法要日 <= "2026-09-30"';

// 文字化けの原因となる文字コード範囲
// 参考: 一般的な日本語文字は以下のいずれか
//   ASCII (U+0020-U+007E)
//   CJK Unified Ideographs (U+4E00-U+9FFF)  ← 通常の漢字
//   Hiragana (U+3040-U+309F)
//   Katakana (U+30A0-U+30FF)
//   全角記号 (U+FF00-U+FFEF)
//   ちなみに1・2・3などの半角数字
//
// これ以外の範囲、特に以下は文字化けの原因になりやすい:
//   Surrogate half (U+D800-U+DFFF)          ← 破損したサロゲート
//   CJK Compatibility Ideographs (U+F900-U+FAFF)  ← 互換漢字
//   Private Use Area (U+E000-U+F8FF)        ← 外字
//   Enclosed Alphanumerics (U+2460-U+24FF)  ← ①②③など
//   Roman Numerals (U+2160-U+217F)          ← ⅠⅡⅢなど
//   その他BMP外(U+10000以上) = サロゲートペア = 絵文字系

// 「安全な範囲」以外を全部拾う方式に変更
function isSafeChar(cp: number): boolean {
  return (
    (cp >= 0x0020 && cp <= 0x007E) ||   // ASCII印字可能
    (cp >= 0x00A0 && cp <= 0x00FF) ||   // Latin-1補助
    (cp >= 0x2010 && cp <= 0x2027) ||   // 一般句読点(‐–—等)
    (cp >= 0x3000 && cp <= 0x303F) ||   // CJK記号(、。「」等)
    (cp >= 0x3040 && cp <= 0x309F) ||   // ひらがな
    (cp >= 0x30A0 && cp <= 0x30FF) ||   // カタカナ
    (cp >= 0x3400 && cp <= 0x4DBF) ||   // CJK拡張A(古字)
    (cp >= 0x4E00 && cp <= 0x9FFF) ||   // CJK基本漢字
    (cp >= 0xFF00 && cp <= 0xFFEF)      // 半角/全角
  );
}

function findSuspiciousChars(text: string): { char: string; codePoint: string; range: string }[] {
  if (!text) return [];
  const results: { char: string; codePoint: string; range: string }[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (isSafeChar(cp)) continue;

    let range = "不明な範囲";
    if (cp === 0xFFFD) range = "置換文字(U+FFFD)=文字化けの残骸";
    else if (cp >= 0xD800 && cp <= 0xDFFF) range = "破損サロゲート";
    else if (cp >= 0xF900 && cp <= 0xFAFF) range = "CJK互換漢字";
    else if (cp >= 0xE000 && cp <= 0xF8FF) range = "私用領域(外字)";
    else if (cp >= 0x2460 && cp <= 0x24FF) range = "囲み英数(①②③等)";
    else if (cp >= 0x2160 && cp <= 0x217F) range = "ローマ数字(ⅠⅡⅢ等)";
    else if (cp >= 0x25A0 && cp <= 0x25FF) range = "幾何記号(■◆◇等)";
    else if (cp >= 0x2600 && cp <= 0x26FF) range = "その他記号(☆等)";
    else if (cp >= 0x10000) range = "BMP外(絵文字・異体字)";
    else if (cp >= 0x2000 && cp <= 0x2FFF) range = "汎用句読点/記号";

    results.push({
      char: ch,
      codePoint: "U+" + cp.toString(16).toUpperCase().padStart(4, "0"),
      range,
    });
  }
  return results;
}

export async function GET(): Promise<NextResponse> {
  try {
    const records = await fetchAllKintoneRecords(KINTONE_QUERY);
    const suspects: Array<{
      recordId: string;
      date: string;
      hallTear: string;
      hallGroup: string;
      area: string;
      division: string;
      branch: string;
      block: string;
      issues: Array<{ field: string; value: string; problems: { char: string; codePoint: string; range: string }[] }>;
    }> = [];

    for (const r of records) {
      const fields = {
        "会館名(ティア)": str(r, "ルックアップ_会館名ティア"),
        "会館名(ティアグループ)": str(r, "ルックアップ_会館名ティアグループ"),
        "エリア名": str(r, "エリア名"),
        "事業部名": str(r, "事業部名"),
        "支社名": str(r, "支社名"),
        "ブロック名": str(r, "ブロック名"),
      };
      const issues: Array<{ field: string; value: string; problems: { char: string; codePoint: string; range: string }[] }> = [];
      for (const [field, value] of Object.entries(fields)) {
        const problems = findSuspiciousChars(value);
        if (problems.length > 0) issues.push({ field, value, problems });
      }
      if (issues.length > 0) {
        suspects.push({
          recordId: str(r, "$id") || str(r, "レコード番号") || "?",
          date: str(r, "葬儀日_法要日"),
          hallTear: fields["会館名(ティア)"],
          hallGroup: fields["会館名(ティアグループ)"],
          area: fields["エリア名"],
          division: fields["事業部名"],
          branch: fields["支社名"],
          block: fields["ブロック名"],
          issues,
        });
      }
    }

    return NextResponse.json({
      totalRecords: records.length,
      suspiciousRecords: suspects.length,
      suspects,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
