-- ============================================
-- KOMPLETNY SETUP BAZY - Ośmiorniczka
-- Wklej CAŁY ten skrypt w Supabase SQL Editor i kliknij Run
-- ============================================

-- 1. TABELE

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at BIGINT NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  game_mode TEXT NOT NULL,
  starting_score INTEGER NOT NULL,
  player_ids TEXT[] NOT NULL,
  player_names TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_player_index INTEGER NOT NULL DEFAULT 0,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_id TEXT,
  winner_name TEXT,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  turns JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_type TEXT NOT NULL DEFAULT 'ranked'
);

CREATE TABLE IF NOT EXISTS h2h_records (
  id TEXT PRIMARY KEY,
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  player1_wins INTEGER NOT NULL DEFAULT 0,
  player2_wins INTEGER NOT NULL DEFAULT 0,
  total_matches INTEGER NOT NULL DEFAULT 0,
  last_played BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Domyślny stan aktywnego meczu
INSERT INTO app_state (key, value) VALUES ('active_match_id', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Dodaj avatar_url jeśli tabela już istniała bez tej kolumny
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. INDEKSY

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at);
CREATE INDEX IF NOT EXISTS idx_h2h_players ON h2h_records(player1_id, player2_id);

-- 3. ROW LEVEL SECURITY (publiczny dostęp bez logowania)

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE h2h_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to players') THEN
    CREATE POLICY "Allow all access to players" ON players FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to matches') THEN
    CREATE POLICY "Allow all access to matches" ON matches FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to h2h_records') THEN
    CREATE POLICY "Allow all access to h2h_records" ON h2h_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to app_state') THEN
    CREATE POLICY "Allow all access to app_state" ON app_state FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. STORAGE DLA AVATARÓW

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read access to avatars') THEN
    CREATE POLICY "Public read access to avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow upload avatars') THEN
    CREATE POLICY "Allow upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow update avatars') THEN
    CREATE POLICY "Allow update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete avatars') THEN
    CREATE POLICY "Allow delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');
  END IF;
END $$;
