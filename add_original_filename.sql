-- photos テーブルに original_filename カラムを追加
-- Supabase SQL Editor で実行してください
ALTER TABLE photos ADD COLUMN IF NOT EXISTS original_filename TEXT;
