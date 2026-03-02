-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ★ 新しく追加：既存のテーブルがあれば一度削除して作り直す設定 ★
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS projects;
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
  '"{{customer_name}} 様\n先日は撮影会にお越しいただき、本当にありがとうございました。\n当日の温かい空気感や、皆様の素敵な表情を思い出しながら、心を込めてお写真を仕上げさせていただきました。\n\n下記の専用ページより、大切なお写真をお受け取りください。\n\n■お写真の確認・保存はこちら\n{{url}}\nパスワード：{{password}}\n保存期限：{{expiry_date}} まで\n\n■ダウンロード方法について\nページ内の『一括保存』または、お好きな写真を選んで保存いただけます。\n※スマホ・パソコンどちらからでも操作可能です。\n\nこのお写真が、皆様にとってかけがえのない宝物になりますように。\nまたお会いできる日を楽しみにしております。"'
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
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

-- Note: In a real production environment, you should restrict SELECT to only people who have the password/valid access token.
-- For now, allowing read access. Operations like INSERT/UPDATE/DELETE should be restricted to authenticated admin users.
CREATE POLICY "Allow public read of projects" on projects FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on projects FOR ALL USING (true); -- 開発環境用簡易設定 

CREATE POLICY "Allow public read of photos" on photos FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on photos FOR ALL USING (true);

CREATE POLICY "Allow public read of settings" on settings FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on settings FOR ALL USING (true);

CREATE POLICY "Allow public read of brand" on brand_settings FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users" on brand_settings FOR ALL USING (true);

-- APIアクセス用の設定
-- この設定はテスト用です。本番環境では必ず Auth による RLS を設定してください。


-- ==========================================
-- Storage Buckets Configuration
-- ==========================================

-- 1. Create the 'photos' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the 'brand' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand', 'brand', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage RLS Policies
-- Allow public access to read files from 'photos' and 'brand' buckets
CREATE POLICY "Public Access photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Public Access brand" ON storage.objects FOR SELECT USING (bucket_id = 'brand');

-- Allow anon access to Upload files (Development Only)
CREATE POLICY "Anon Upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Anon Upload brand" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'brand');

-- Allow anon access to Update files (Development Only)
CREATE POLICY "Anon Update photos" ON storage.objects FOR UPDATE USING (bucket_id = 'photos');
CREATE POLICY "Anon Update brand" ON storage.objects FOR UPDATE USING (bucket_id = 'brand');

-- Allow anon access to Delete files (Development Only)
CREATE POLICY "Anon Delete photos" ON storage.objects FOR DELETE USING (bucket_id = 'photos');
CREATE POLICY "Anon Delete brand" ON storage.objects FOR DELETE USING (bucket_id = 'brand');
