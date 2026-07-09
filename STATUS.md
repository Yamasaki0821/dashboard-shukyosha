# 宗教者紹介ダッシュボード STATUS

最終更新: 2026-06-17

## 概要
- 対象事業：宗教者紹介事業（葬儀／法要における宗教者紹介手数料）
- 対象会社：ティア（未来開発事業本部）
- ローカルパス：`C:\Users\tear100054\Desktop\Multi_Agent\dashboard-shukyosha\`
- GitHubリポジトリ：`Yamasaki0821/dashboard-shukyosha`
- 本番URL：要確認（Vercel デプロイ状況・ドメイン未確認）

## 技術スタック
- フレームワーク：Next.js 14（App Router）+ TypeScript
- 依存ライブラリ：dotenv 16.4 のみ（recharts なし → Chart.js を CDN ロードで描画）
- データソース：**Kintone（4〜6月）＋ CSV（10〜3月）ハイブリッド**
  - 過去（2025-10〜2026-03）：`data/集計_月別手数料率別.csv`、`data/集計_宗派別.csv`、`data/集計_会館別.csv`
  - 直近（2026-04〜）：Kintone アプリ 1883 から取得
- KintoneアプリID：**1883**（コード内ハードコード `lib/kintone.ts`、他DBと挙動が異なる）
- 認証方式：Cookieベース（`auth_user`）＋ middleware による全ルート保護。
  `/api/actuals`（**つまり主要 API**）が middleware で未認証許可されている（要確認）

## データ仕様（統括DB設計に必須）
- 売上の定義（`app/api/actuals/route.ts` から確認）：
  - **「売上」ではなく「手数料」**を中心指標として扱う（fee）
  - Kintone：`手数料金額` フィールドを **÷1000** して千円換算
  - CSV：`30%手数料` / `40%手数料` / `月合計` / `手数料合計` フィールドを **÷1000** して千円換算
  - Kintone のクエリ範囲：`葬儀日_法要日 >= 2026-04-01 and <= 2026-06-30`（Q3 ハードコード）
- 売上の単位：**千円**（CSV・Kintone とも内部で千円に正規化）
- 件数の定義：
  - **葬儀日／法要日ベース**で月次集計
  - 「葬儀のみ件数」（`category === "葬儀"`）を平均単価計算で別途使用
- 予算の管理方法：**コード内ハードコード**（`app/api/actuals/route.ts` 内 `BUDGET` 定数）
  - 月別予算が 10月〜6月の **9ヶ月分のみ**定義（**7〜9月が未設定**・要追加）
  - 例：10月 16,073千円、11月 17,408千円 ... 6月 15,923千円
  - 単位：千円、不均一（季節性あり）
- 予算データの期間：第30期 10月〜6月のみ（**未完成**）
- 独自集計軸：
  - **手数料率（30% / 40%）**：他DBにない、宗教者紹介事業特有の軸。CSV と Kintone 両方で `rate30` / `rate40` を分離保持
  - **宗派（宗教名）別**
  - **宗教者個人別**（Kintone のみ）
  - **葬法区分（葬儀／法要等）別**（Kintone のみ）
  - **施行会館別**（CSV + Kintone 合算）
  - **事業部別**（Kintone のみ）

## 実装済機能
- ページ一覧（`app/` 配下）：
  - `app/page.tsx` — トップ（KPI・月別グラフ・月別詳細表・手数料率ドーナツ・葬法区分別）
  - `app/hall/page.tsx` — 会館別／事業部別
  - `app/denomination/page.tsx` — 宗派別／宗教者別
  - `app/login/page.tsx` — ログイン
  - `components/Shell.tsx` — TopBar / PageHeader（共通レイアウト）
  - admin ページなし（**他 2DB と異なり管理者画面未実装**）
- API一覧：
  - `GET /api/actuals?type=summary` — 月別・手数料率・葬法区分
  - `GET /api/actuals?type=hall` — 会館別・事業部別
  - `GET /api/actuals?type=denomination` — 宗派別・宗教者別
  - `POST /api/auth`, `POST /api/auth/logout`
  - **`/api/budget`・`/api/access-logs` は未実装**（予算は actuals 内に内包・アクセスログ機能なし）
- KPI項目：累計手数料合計・累計予算達成率・累計件数（葬儀＋法要）・平均手数料単価（葬儀のみ・4〜6月）

## 未実装・既知の課題
- **予算データが 10月〜6月の 9ヶ月分のみ**（7〜9月未設定）
- **データソースが Kintone と CSV のハイブリッド**で、CSV は静的ファイル。月次集計の境目（4月）で取りこぼし・重複の可能性あり
- Kintone クエリが `2026-04-01〜2026-06-30` 固定で、**月をまたぐと自動更新されない**（Q4 になっても Q3 のままになる）
- 管理者画面・アクセスログ機能なし
- 他 2DB と異なり `lib/kintone.ts` でアプリID（1883）が**ハードコード**。環境変数経由ではない
- `data/` 配下の CSV が Git 管理されており、データ更新時に毎回 commit / deploy が必要

## 環境変数
- Vercel側に必要な環境変数（`lib/kintone.ts` から確認）：
  - `KINTONE_PROXY_URL`（= http://49.212.161.76）
  - `KINTONE_PROXY_SECRET`
  - `AUTH_USERS`
  - **`KINTONE_APP_ID` 不要**（コード内 `1883` ハードコード）
  - **`KINTONE_SUBDOMAIN` 不要**（VPS 側で処理）
  - **`ADMIN_USERS` 不要**（管理者機能なし）

## 直近の修正履歴
- ca07f30 デザインガイド完全準拠: アンバーテーマ・ピル型タブ・KPI左アクセント・CSS変数・ダークモード対応
- 9270930 UI改善: KPIカード明確化・月別詳細移動・区分別表形式・予算折れ線前面表示・平均単価を葬儀のみ
- 1c269df Initial commit: 宗教者紹介ダッシュボード

## 次のTODO
- 予算データに 7〜9月を追加（第30期通期化）
- Kintone クエリの期間を動的化（毎月の月初で `>= 2026-04-01 <= 今日` 形式に）
- 過去 CSV を全期間 Kintone に置き換え（CSV ハイブリッド解消）
- VPS プロキシの許可アプリ ID リストに 1883 を追加済みか確認（`context/proxy_architecture.md` には 313/496 のみ記載で**矛盾**）
- アプリID 1883 を環境変数化して他 DB と統一
- 管理者画面・アクセスログ機能の追加（他 2DB との機能パリティ）
- 統括DBで使う場合：「売上」ではなく「手数料」が指標になる点・手数料率（30%/40%）軸の継承可否を要設計
