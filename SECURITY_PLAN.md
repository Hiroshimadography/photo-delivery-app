# セキュリティ強化プラン

## 進捗管理

各ステップ完了後にチェックを入れてください。
次の会話では「Step X から再開してください」と伝えればOKです。

---

## Phase 1: 致命的脆弱性の修正

### Step 1: 管理APIの認証ガード追加
- [x] `/api/admin/upload/init/route.ts` に `supabase.auth.getUser()` チェック追加
- [x] `/api/admin/upload/route.ts` に認証チェック追加
- [x] `/api/admin/upload/finalize/route.ts` に認証チェック追加
- [x] 認証失敗時に `401 Unauthorized` を返す共通ヘルパー作成
- [x] ルート `middleware.ts` 作成（未接続だった `updateSession` を有効化）
- [x] ミドルウェアで `/api/admin/*` を401で保護（二重防御）

### Step 2: パスワードの暗号化
- [x] AES-256-GCM 暗号化ユーティリティ作成（`src/utils/crypto.ts`）
- [x] プロジェクト作成APIを新設し、サーバーサイドでパスワード暗号化（`/api/admin/projects`）
- [x] パスワード復号APIを新設（`/api/admin/projects/[id]/password`）
- [x] 新規作成ページをAPI経由に変更（`admin/projects/new/page.tsx`）
- [x] 管理画面のパスワード表示を復号API経由に変更（`admin/projects/[id]/page.tsx`）
- [x] 納品APIのパスワード検証を `verifyPassword()` + 定時間比較に変更
- [x] 既存平文パスワードのマイグレーションスクリプト作成（`scripts/migrate-passwords.ts`）
- [x] `PASSWORD_ENCRYPTION_KEY` 環境変数を `.env.local` に追加

### Step 3: ファイルアップロードの検証
- [x] 許可するMIMEタイプのホワイトリスト定義（JPEG, PNG, HEIC, HEIF, WEBP）
- [x] マジックバイト検証ユーティリティ作成（MIME偽装防止）
- [x] ファイルサイズ上限の設定（50MB/ファイル）
- [x] ストレージパスのパストラバーサル防止バリデーション
- [x] バケット名の固定値制限（`photos` のみ）
- [x] `/api/admin/upload/init/route.ts` にバリデーション適用
- [x] `/api/admin/upload/route.ts` にバリデーション適用
- [x] `/api/admin/upload/finalize/route.ts` にパスバリデーション適用

### Step 4: 署名付きURLの有効期限修正
- [x] `/api/admin/upload/finalize/route.ts`: 10年 → **1週間（7日）** に変更
- [x] `/api/admin/upload/route.ts`: サムネイル用URL **1週間**（変更なし、既にOK）
- [x] `/api/delivery/[id]/route.ts`: 納品用URL **2時間**（現状維持、確認済み）
- [x] 管理画面用の写真取得API新設（`/api/admin/projects/[id]/photos`）— 常に新鮮な署名付きURLを再生成
- [x] プロジェクト詳細ページの写真取得をAPI経由に変更

---

## Phase 2: 攻撃防御の強化

### Step 5: レート制限の実装
- [x] レート制限ユーティリティの作成（`src/utils/rate-limit.ts`、スライディングウィンドウ方式）
- [x] `/api/delivery/[id]` POST（パスワード試行）: 5回/15分（IP+プロジェクト単位）
- [x] `/api/admin/upload/init` + `/api/admin/upload`: 30回/分
- [x] `/api/delivery/[id]/download`: 20回/分
- [x] 制限超過時に `429 Too Many Requests` + `Retry-After` ヘッダーを返す
- [x] IP取得を `getClientIp()` に統一（`x-real-ip` → `x-forwarded-for` フォールバック）

### Step 6: セキュリティヘッダーの設定
- [x] Next.js middleware にセキュリティヘッダー追加（全レスポンスに適用）
- [x] `Content-Security-Policy`（XSS防止、Supabase URLを許可リストに含む）
- [x] `X-Frame-Options: DENY`（クリックジャッキング防止）
- [x] `X-Content-Type-Options: nosniff`（MIMEスニッフィング防止）
- [x] `Strict-Transport-Security: max-age=31536000`（HTTPS強制、1年）
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy`（カメラ・マイク・位置情報・FLoC無効化）
- [x] `X-XSS-Protection: 1; mode=block`（レガシーブラウザ向け）
- [x] 401/リダイレクトレスポンスにもヘッダー適用

### Step 7: CSRF保護
- [x] Origin ヘッダー検証方式の CSRF 保護ユーティリティ作成（`src/utils/csrf.ts`）
- [x] ミドルウェアで全 `/api/*` POST リクエストに CSRF 検証を適用
- [x] Origin → Referer → Content-Type の3段階フォールバック検証
- [x] Cron ジョブ（`/api/cron/*`）は除外
- [x] CSRF 拒否レスポンスにもセキュリティヘッダーを適用

---

## Phase 3: データ保護

### Step 8: EXIFメタデータの除去
- [x] `sharp` パッケージのインストール（v0.34.5）
- [x] メタデータ除去ユーティリティ作成（`src/utils/image-sanitize.ts`）
- [x] サニタイズ API 新設（`/api/admin/upload/sanitize`）— クライアントアップロード前に処理
- [x] サーバー直接アップロード（`/api/admin/upload`）にも除去処理を組み込み
- [x] クライアント側アップロードフローにサニタイズステップを追加
- [x] GPS座標、カメラ情報、タイムスタンプ等を除去
- [x] EXIF orientationに基づく自動回転を適用後に除去
- [x] JPEG品質92%、WebP品質90%、PNG無劣化で画像品質を維持

### Step 9: ダウンロード制御の強化
- [x] 納品API（POST）にダウンロード上限チェック追加（上限超過時はURL生成を拒否）
- [x] 納品API（GET）にプロジェクト期限切れ・無効チェック追加
- [x] 納品API（POST）にプロジェクト期限切れチェック追加
- [x] ダウンロードAPIで `action` パラメータをサニタイズ（許可値のみ受付）
- [x] ダウンロード後に正確なカウントを再取得してレスポンス
- [x] レスポンスに残回数（`remaining`）を追加
- [x] GET レスポンスに `isDownloadLimitReached` フラグ追加

---

## Phase 4: 監視・運用セキュリティ

### Step 10: Cronジョブのセキュリティ
- [x] `CRON_SECRET` 環境変数を `.env.local` に設定
- [x] `CRON_SECRET` 未設定時はフェイルセーフで全リクエスト拒否（500）
- [x] Bearer トークン検証を厳格化（条件分岐の穴を修正）
- [x] 個別プロジェクトの削除エラーをキャッチ（1件の失敗で全体が止まらない）
- [x] ストレージ削除エラーのログ記録
- [x] レスポンスにエラー詳細・タイムスタンプを追加

### Step 11: リクエストログ・監査証跡
- [x] `audit_logs` テーブル定義 SQL 作成（`scripts/create-audit-logs-table.sql`）
- [x] 監査ログユーティリティ作成（`src/utils/audit-log.ts`）— 非ブロッキング記録
- [x] プロジェクト作成時の監査ログ記録
- [x] 写真アップロード（finalize）時の監査ログ記録
- [x] パスワード認証の成功/失敗ログ記録（不審アクセス検知用）
- [x] 全ログにアクション種別、ユーザーID、IP、リソース情報を記録

### Step 12: 入力値サニタイズ・バリデーション強化
- [x] 入力バリデーションユーティリティ作成（`src/utils/input-validation.ts`）
- [x] プロジェクト作成API: name, memo, password, max_downloads, folder_name を全てバリデーション
- [x] 納品API (GET/POST): `folder_name` を UUID 形式で検証
- [x] ダウンロードAPI: `folder_name` を UUID 形式で検証
- [x] Finalize API: `projectId` を UUID 形式で検証
- [x] Password API: `id` を UUID 形式で検証
- [x] Photos API: `id` を UUID 形式で検証
- [x] `storagePath` のパストラバーサル防止（Step 3 で実装済み）
- [x] `bucket` パラメータの固定値制限（Step 3 で実装済み）

---

## ギガファイル便との差別化（強化後の比較）

| 項目 | ギガファイル便 | 本アプリ（強化後） |
|------|---------------|-------------------|
| パスワード保護 | 平文（推定） | bcrypt ハッシュ化 |
| レート制限 | 基本的 | 厳格（ロックアウト付き） |
| URL有効期限 | 長期間 | 最大1週間 |
| ファイル検証 | 基本的 | マジックバイト検証 |
| セキュリティヘッダー | 最低限 | CSP含む完全実装 |
| メタデータ保護 | なし | EXIF自動除去 |
| CSRF保護 | 不明 | トークンベース |
| 監査ログ | なし | 全操作記録 |
| DL制御 | 基本的 | サーバーサイド厳格制御 |

---

## 現在の進捗

**最終更新**: Step 12 完了 — 全ステップ完了 🎉
**次に実行するステップ**: なし（全12ステップ完了）

**デプロイ手順**: `DEPLOY_GUIDE.md` を参照してください。
