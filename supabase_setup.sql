-- ============================================================
-- IBK COB File Vault - Supabase Setup SQL
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Create the storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ibk-cob-vault-x7q9m',
  'ibk-cob-vault-x7q9m',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'text/plain',
    'text/markdown'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 2. Create the metadata table with a unique name
CREATE TABLE IF NOT EXISTS ibk_cob_filemeta_z8r3v (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ibk_cob_filemeta_uploaded
  ON ibk_cob_filemeta_z8r3v (uploaded_at DESC);

-- 3. Storage policies - allow authenticated uploads & reads
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ibk-cob-vault-x7q9m');

CREATE POLICY "Allow authenticated reads"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ibk-cob-vault-x7q9m');

CREATE POLICY "Allow authenticated deletes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ibk-cob-vault-x7q9m');

-- 4. Also allow service_role (for backend) - these use anon/service key
CREATE POLICY "Allow service role uploads"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'ibk-cob-vault-x7q9m');

CREATE POLICY "Allow service role reads"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'ibk-cob-vault-x7q9m');

CREATE POLICY "Allow service role deletes"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'ibk-cob-vault-x7q9m');

-- 5. RLS policies for the metadata table
ALTER TABLE ibk_cob_filemeta_z8r3v ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for anon"
  ON ibk_cob_filemeta_z8r3v FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated"
  ON ibk_cob_filemeta_z8r3v FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
