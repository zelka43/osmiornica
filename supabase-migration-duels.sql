-- ============================================
-- MIGRACJA: tryb Pojedynki (1v1)
-- Wklej CAŁY skrypt w Supabase SQL Editor i kliknij Run
-- ============================================

-- Nowe kolumny na legi pojedynków
ALTER TABLE matches ADD COLUMN IF NOT EXISTS duel_id TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS legs_target INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bull_winner TEXT;

CREATE INDEX IF NOT EXISTS idx_matches_duel ON matches(duel_id);

-- Odświeżenie cache API
NOTIFY pgrst, 'reload schema';
