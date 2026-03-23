-- Run this in Supabase SQL Editor to add avatar support

-- Add avatar_url column to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to avatars
CREATE POLICY "Public read access to avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Allow anonymous upload/update/delete of avatars
CREATE POLICY "Allow upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow update avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "Allow delete avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars');
