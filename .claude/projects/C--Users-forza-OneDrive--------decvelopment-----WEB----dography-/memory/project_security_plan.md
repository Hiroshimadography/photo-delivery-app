---
name: セキュリティ強化プラン（完了）
description: 写真納品アプリのセキュリティ強化プラン。全12ステップ完了済み。詳細はSECURITY_PLAN.md参照。
type: project
---

写真納品アプリ（dography）のセキュリティ強化を全12ステップで実施完了。

**計画ファイル**: プロジェクトルートの `SECURITY_PLAN.md` に全ステップと完了チェックリストあり。

**実施済み内容**:
- Phase 1: 認証ガード、パスワードAES暗号化、ファイル検証（MIME/マジックバイト）、URL有効期限1週間
- Phase 2: レート制限、セキュリティヘッダー7種（CSP等）、CSRF保護
- Phase 3: EXIF自動除去（sharp）、ダウンロード制御厳格化
- Phase 4: Cronフェイルセーフ、監査ログ、全API入力バリデーション

**デプロイ時の要注意事項**:
1. Vercelに環境変数を設定: `PASSWORD_ENCRYPTION_KEY`, `CRON_SECRET`
2. Supabaseで `scripts/create-audit-logs-table.sql` を実行
3. `npx tsx scripts/migrate-passwords.ts` で既存パスワードを暗号化
