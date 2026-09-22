# Support you — 病児保育予約サイト

病児保育室の予約サイトです。保護者はスマートフォンから利用登録・申込み・書類（医師連絡票）の提出・予約状況の確認ができ、職員は審査・確定・当日の入退室・休園設定・実績CSV出力ができます。

Google ドライブの試験版「Support you」（ChatGPT Sites 上の第18版）の業務ロジックを引き継ぎ、実運用できる形（Vercel + Supabase）に作り直したものです。

## 画面

| URL | 用途 |
|---|---|
| `/` | 保護者：アカウント作成・ログイン、利用登録、申込み、書類提出、履歴、利用案内 |
| `/staff` | 職員：予約の審査・確定、入退室、休園・定員、CSV出力、職員招待、全データ書き出し |
| `/line?view=reserve` / `history` / `guide` | LINE公式アカウントのリッチメニュー用入口（保護者） |
| `/line/staff` | 職員用入口 |
| `/reset` | パスワード再設定（メールのリンクから） |
| `/terms` | 利用規約・個人情報の取扱い |

## 業務ルール（`lib/rules.mjs` の `RULES`）

試験版の仮ルールを採用しています。施設の正式ルールが決まったらここを変更してください。

- 開所：平日 9:00〜17:00。土日・祝日・年末年始（12/29〜1/3）と、職員が設定した休園日は休園
- 申込み受付：利用日の前日12:00から、当日の最後の来園予定時刻まで
- 来園予定 9:00 / 9:30 / 10:00、お迎え予定 12:00〜17:00（毎正時）
- 定員：1日6名（日ごとに0〜6名へ変更可）、保育室A・B 各3名、同室は同じ感染区分（呼吸器・消化器・その他）
- 満員時はキャンセル待ち。空きが出たら職員が期限付きで繰上げの意思確認 → 保護者が返答 → 職員が確定
- 当日8:30以降の確定済み予約のキャンセルは「取消し申出」となり、職員の確認で完了
- 入室は来園予定の30分前から可能
- 料金（減免前）：実際の入室〜退室が4時間以内 1,000円、超過 2,000円（請求・決済機能はありません）

## 構成

- Next.js 16（App Router）を Vercel で配信
- Supabase：Auth（メール＋パスワード）、PostgreSQL、非公開 Storage（書類）
- ブラウザから Supabase へは直接アクセスしません。すべて `/api/{parent|staff}/{操作}` を通り、サーバーが本人・所属・状態を確認します（`lib/server/api.mjs`）。ログイン情報は HttpOnly Cookie のみに保存します。
- 施設データは1行のJSONを版番号付きで保存（compare-and-swap）し、同時操作でも定員を超えません。終了から45日経った予約は履歴テーブルへ移します。
- メール通知（任意）：Resend。本文に氏名・症状は含めず、日付と状態、サイトへのリンクだけを送ります。

## 公開手順

### 1. Supabase

1. プロジェクトを作成（リージョンは Tokyo 推奨）。
2. SQL Editor で `supabase/migrations/20260923000000_support_you.sql` を実行（テーブル・関数・非公開バケットを作成）。
3. Authentication > URL Configuration
   - Site URL：公開URL（例 `https://support-you.vercel.app`）
   - Redirect URLs：`https://公開URL/auth/confirm`
4. Authentication > Email Templates（リンクをサーバー側で確認する形式に変更）
   - Confirm signup：リンクを `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - Reset Password：リンクを `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
5. 本番では Authentication > SMTP Settings で独自のメール送信（Resend等）を設定してください。Supabase標準の送信は1時間あたりの件数制限があります。
6. 有料プランでは自動バックアップが有効になります。無料プランの場合は、職員画面「職員・設定 > 全データを書き出す」で定期的に保存してください。

### 2. Vercel

1. このリポジトリを Vercel にインポート（Framework: Next.js）。
2. `.env.example` の項目を Environment Variables に設定。
3. デプロイ後、`/staff` を開き「初期管理者の登録」で `SUPPORTYOU_SETUP_CODE` を入力して管理者を作成。
4. 職員は「職員・設定 > 職員を招待」で招待コードを発行し、各職員が `/staff` の「招待を受けた方」から登録。

### 3. LINE公式アカウント（任意）

職員画面「職員・設定」の「LINE公式アカウントからの入口」に、リッチメニュー用のリンク・画像・設定JSONがあります。

## 公開前の確認事項（施設で決めること）

- 業務ルール（上記）が施設・自治体の実施要綱と一致しているか
- `/terms` の利用規約・個人情報の取扱いの文面（運営者名・保存期間・問い合わせ先）
- 施設の電話番号・住所（`NEXT_PUBLIC_FACILITY_PHONE` / `_ADDRESS`）
- 実データを扱う前に、職員2名・保護者2家庭程度で一連の操作（登録→申込み→書類→確定→入退室）を試すこと

## 開発

```bash
npm install
npm run dev:mock   # Supabaseなしで起動（メモリ上の仮データ・仮ログイン。本番では起動不可）
npm test           # 業務ロジック・API境界の自動テスト
npm run check      # 型検査 + テスト + 本番ビルド
```

`dev:mock` の初期設定コードは `.env.local` の `SUPPORTYOU_SETUP_CODE` で指定します。`SUPPORTYOU_MOCK_NOW=2026-09-24T08:40:00+09:00` のように開始時刻を指定すると、受付時間外でも動作を確認できます。
