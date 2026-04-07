-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ★ 新しく追加：既存のテーブルがあれば一度削除して作り直す設定 ★
-- 依存関係があるため、削除する順番が重要です
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS download_logs;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS brand_settings;

-- Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  folder_name TEXT UNIQUE,
  password TEXT,
  memo TEXT,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  max_downloads INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Photos Table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Download Logs Table
CREATE TABLE download_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    ip_address TEXT,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings Table (for templates)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brand Settings Table
CREATE TABLE brand_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default templates and settings
INSERT INTO settings (key, value) VALUES (
  'delivery_template', 
  '"{{customer_name}} 様\n先日は撮影にお越しいただき、本当にありがとうございました。\n当日の素敵な表情を思い出しながら、心を込めてお写真を仕上げさせていただきました。\n\n下記の専用ページより、お写真をお受け取りください。\n\n■お写真の確認・保存はこちら\n{{url}}\nパスワード：{{password}}\n保存期限：{{expiry_date}} まで\n\n■ダウンロードについて\nセキュリティ保護のため、本URLからのダウンロード回数は最大【 {{max_downloads}}回 】までとさせていただいております。\n\nもし上限を超えてしまい、再度ダウンロードが必要になった場合は、いつでもお気軽にご連絡ください。何度でも再送させていただきますので、どうぞご安心くださいね。\n\nこのお写真が、皆様にとってかけがえのない宝物になりますように。"'
);

INSERT INTO brand_settings (brand_name) VALUES ('Lumière Photography');

-- Functions to increment counts
CREATE OR REPLACE FUNCTION increment_view_count(p_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE projects SET view_count = view_count + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_download_count(p_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE projects SET download_count = download_count + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS (Row Level Security)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

-- Note: In a real production environment, you should restrict SELECT to only people who have the password/valid access token.
-- For now, allowing read access. Operations like INSERT/UPDATE/DELETE should be restricted to authenticated admin users.
CREATE POLICY "Allow public read of projects" on projects FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on projects FOR ALL USING (true); 

CREATE POLICY "Allow public read of photos" on photos FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on photos FOR ALL USING (true);

CREATE POLICY "Allow authenticated full access to logs" on download_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow anonymous insert to logs" on download_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public read of logs" on download_logs FOR SELECT USING (true);
-- Insert into logs is needed from the server (which might use service role, completely bypassing RLS)

CREATE POLICY "Allow public read of settings" on settings FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on settings FOR ALL USING (true);

CREATE POLICY "Allow public read of brand" on brand_settings FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on brand_settings FOR ALL USING (true);


-- ==========================================
-- Storage Buckets Configuration
-- ==========================================

-- 1. Create the 'photos' bucket if it doesn't exist
-- SET public TO false FOR SECURITY
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Create the 'brand' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand', 'brand', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage RLS Policies
-- 古いポリシーや既存のポリシーを一度削除してエラーを防ぐ
DROP POLICY IF EXISTS "Public Access photos" ON storage.objects;
DROP POLICY IF EXISTS "Public Access brand" ON storage.objects;
DROP POLICY IF EXISTS "Anon Upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon Upload brand" ON storage.objects;
DROP POLICY IF EXISTS "Anon Update photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon Update brand" ON storage.objects;
DROP POLICY IF EXISTS "Anon Delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon Delete brand" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Select photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin Upload brand" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update brand" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete brand" ON storage.objects;

-- Allow public access to read files from 'brand' bucket ONLY
CREATE POLICY "Public Access brand" ON storage.objects FOR SELECT USING (bucket_id = 'brand');

-- Allow authenticated users (Admin) full access to photos and brand buckets
CREATE POLICY "Admin Upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Admin Select photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos');
CREATE POLICY "Admin Update photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'photos');
CREATE POLICY "Admin Delete photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos');

CREATE POLICY "Admin Upload brand" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand');
CREATE POLICY "Admin Update brand" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand');
CREATE POLICY "Admin Delete brand" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand');
