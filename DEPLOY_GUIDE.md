# セキュリティ強化のデプロイ手順

セキュリティ強化のコードをデプロイする前に、以下の3つの作業が必要です。
**順番通りに進めてください。**

---

## 作業1: Vercel に環境変数を追加する

今回のセキュリティ強化で、2つの新しい環境変数が必要になりました。
これらを Vercel のダッシュボードに設定します。

### 手順

1. [Vercel ダッシュボード](https://vercel.com) にログイン
2. 該当プロジェクトを選択
3. **Settings** タブ → **Environment Variables** を開く
4. 以下の2つを追加する:

| Name | Value | 用途 |
|------|-------|------|
| `PASSWORD_ENCRYPTION_KEY` | `f218c88da522835a7a4dbb5c091705ede6fa19ea7e48602dd052592e909d1ab7` | パスワードの暗号化に使用 |
| `CRON_SECRET` | `eaf05798754aa6e2578567e6b7f8eeace3ed7b4ab70e264015093254e9e8a35b` | 期限切れ自動削除の認証に使用 |

### 設定画面での操作
- **Name** に変数名を入力
- **Value** に上記の値を貼り付け
- **Environment** は `Production`, `Preview`, `Development` の全てにチェック
- **Add** をクリック

> **注意:** これらの値は秘密情報です。他の人に共有しないでください。

---

## 作業2: Supabase にテーブルを追加する

管理操作の履歴を記録する「監査ログ」テーブルを作成します。

### 手順

1. [Supabase ダッシュボード](https://supabase.com/dashboard) にログイン
2. 該当プロジェクト（`uwadqjgipiqrgavyqinb`）を選択
3. 左メニューの **SQL Editor** をクリック
4. 以下の SQL を **コピーして貼り付け**、**Run** をクリック

```sql
-- 監査ログテーブルの作成
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    user_id UUID,
    ip_address TEXT,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- セキュリティ設定
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit logs" ON audit_logs
    FOR SELECT TO authenticated USING (true);
```

5. 「Success」と表示されれば完了

### 確認方法
- 左メニューの **Table Editor** を開く
- テーブル一覧に `audit_logs` が表示されていればOK

---

## 作業3: 既存パスワードを暗号化する

現在データベースに保存されている平文パスワードを暗号化します。
**この作業はデプロイ後に1回だけ実行します。**

### 手順

1. プロジェクトのフォルダでターミナルを開く
2. 以下のコマンドを実行:

```bash
npx tsx scripts/migrate-passwords.ts
```

3. 以下のような結果が表示されれば成功:

```
Migrated project xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Migrated project xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

Migration complete: 2 migrated, 0 already encrypted, 2 total
```

> **注意:**
> - `.env.local` に `PASSWORD_ENCRYPTION_KEY` が設定済みであることを確認してください
> - パスワードが設定されていないプロジェクトはスキップされます
> - 2回実行しても安全です（暗号化済みのものは自動でスキップされます）

---

## デプロイの流れ（まとめ）

```
1. Vercel に環境変数を追加     ← デプロイ前
2. Supabase にテーブルを追加   ← デプロイ前
3. git push でデプロイ         ← 通常通り
4. パスワード暗号化を実行      ← デプロイ後に1回だけ
```

---

## トラブルシューティング

### 「PASSWORD_ENCRYPTION_KEY must be set」エラーが出る
→ 作業1 の環境変数が正しく設定されていません。Vercel ダッシュボードで確認してください。

### Cron ジョブが 500 エラーを返す
→ `CRON_SECRET` が Vercel に設定されていません。作業1 を確認してください。

### パスワードマイグレーションで「Missing PASSWORD_ENCRYPTION_KEY」と出る
→ `.env.local` に `PASSWORD_ENCRYPTION_KEY` が記載されているか確認してください。

### 管理画面のサムネイルが表示されない
→ 署名付きURLの有効期限を1週間に短縮したため、古いURLは期限切れの可能性があります。プロジェクト詳細ページを開き直すと、新しいURLが自動生成されます。
