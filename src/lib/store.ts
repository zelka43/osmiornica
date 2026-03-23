import { Player, Match, H2HRecord, PlayerStats, emptyStats } from "@/types";
import { supabase } from "./supabase";
import { v4 as uuidv4 } from "uuid";

// ─── Players ───

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getPlayers error:", error);
    return [];
  }
  return (data ?? []).map(mapPlayer);
}

export async function addPlayer(name: string): Promise<Player> {
  const player: Player = {
    id: uuidv4(),
    displayName: name.trim(),
    avatarUrl: null,
    createdAt: Date.now(),
    stats: { ...emptyStats },
  };
  const { error } = await supabase.from("players").insert(toPlayerRow(player));
  if (error) console.error("addPlayer error:", error);
  return player;
}

export async function removePlayer(id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) console.error("removePlayer error:", error);
}

export async function updatePlayer(player: Player): Promise<void> {
  const { error } = await supabase
    .from("players")
    .update(toPlayerRow(player))
    .eq("id", player.id);
  if (error) console.error("updatePlayer error:", error);
}

export async function getPlayerById(id: string): Promise<Player | undefined> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return mapPlayer(data);
}

// ─── Matches ───

export async function getMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getMatches error:", error);
    return [];
  }
  return (data ?? []).map(mapMatch);
}

export async function saveMatch(match: Match): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .upsert(toMatchRow(match), { onConflict: "id" });
  if (error) console.error("saveMatch error:", error);
}

export async function getMatchById(id: string): Promise<Match | undefined> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return mapMatch(data);
}

export async function deleteMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) console.error("deleteMatch error:", error);
}

export async function getActiveMatch(): Promise<Match | null> {
  const { data, error } = await supabase
    .from("app_state")
    .select("value")
    .eq("key", "active_match_id")
    .single();
  if (error || !data || data.value === null) return null;
  const matchId = data.value as string;
  if (!matchId) return null;
  const match = await getMatchById(matchId);
  return match ?? null;
}

export async function setActiveMatch(match: Match | null): Promise<void> {
  const { error } = await supabase
    .from("app_state")
    .upsert({ key: "active_match_id", value: match ? match.id : null });
  if (error) console.error("setActiveMatch error:", error);
}

// ─── H2H ───

function getH2HKey(p1: string, p2: string): string {
  return [p1, p2].sort().join("_");
}

export async function getH2HRecords(): Promise<H2HRecord[]> {
  const { data, error } = await supabase.from("h2h_records").select("*");
  if (error) {
    console.error("getH2HRecords error:", error);
    return [];
  }
  return (data ?? []).map(mapH2H);
}

export async function getH2H(
  player1Id: string,
  player2Id: string
): Promise<H2HRecord | null> {
  const key = getH2HKey(player1Id, player2Id);
  const { data, error } = await supabase
    .from("h2h_records")
    .select("*")
    .eq("id", key)
    .single();
  if (error || !data) return null;
  return mapH2H(data);
}

export async function getMatchesBetweenPlayers(
  p1Id: string,
  p2Id: string
): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "completed")
    .contains("player_ids", [p1Id])
    .contains("player_ids", [p2Id]);
  if (error) {
    console.error("getMatchesBetweenPlayers error:", error);
    return [];
  }
  return (data ?? []).map(mapMatch);
}

export async function updateH2H(
  winnerId: string,
  loserId: string
): Promise<void> {
  const key = getH2HKey(winnerId, loserId);
  const existing = await getH2H(winnerId, loserId);

  if (existing) {
    const updates: Partial<H2HRecord> = {
      totalMatches: existing.totalMatches + 1,
      lastPlayed: Date.now(),
      player1Wins:
        existing.player1Id === winnerId
          ? existing.player1Wins + 1
          : existing.player1Wins,
      player2Wins:
        existing.player2Id === winnerId
          ? existing.player2Wins + 1
          : existing.player2Wins,
    };
    const { error } = await supabase
      .from("h2h_records")
      .update({
        player1_wins: updates.player1Wins,
        player2_wins: updates.player2Wins,
        total_matches: updates.totalMatches,
        last_played: updates.lastPlayed,
      })
      .eq("id", key);
    if (error) console.error("updateH2H error:", error);
  } else {
    const [p1, p2] = [winnerId, loserId].sort();
    const record: H2HRecord = {
      id: key,
      player1Id: p1,
      player2Id: p2,
      player1Wins: p1 === winnerId ? 1 : 0,
      player2Wins: p2 === winnerId ? 1 : 0,
      totalMatches: 1,
      lastPlayed: Date.now(),
    };
    const { error } = await supabase
      .from("h2h_records")
      .insert(toH2HRow(record));
    if (error) console.error("updateH2H insert error:", error);
  }
}

// ─── Admin / Dev ───

export async function deleteMatchesSince(sinceTimestamp: number): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .delete()
    .gte("created_at", sinceTimestamp);
  if (error) console.error("deleteMatchesSince error:", error);
}

export async function recalculateAllPlayerStats(): Promise<void> {
  const players = await getPlayers();
  const matches = (await getMatches()).filter((m) => m.status === "completed");

  for (const player of players) {
    const stats: PlayerStats = { ...emptyStats };

    for (const m of matches) {
      const state = m.scores[player.id];
      if (!state) continue;

      stats.matchesPlayed++;
      if (m.winnerId === player.id) stats.matchesWon++;
      stats.totalDartsThrown += state.dartsThrown;
      stats.totalPointsScored += state.pointsScored;
      stats.oneEighties += state.oneEighties;
      stats.tonPlus += state.tonPlus;
      stats.doublesAttempted += state.doublesAttempted;
      stats.doublesHit += state.doublesHit;

      const matchAvg =
        state.dartsThrown > 0
          ? (state.pointsScored / state.dartsThrown) * 3
          : 0;
      if (matchAvg > stats.bestThreeDartAvg) stats.bestThreeDartAvg = matchAvg;
    }

    await updatePlayer({ ...player, stats });
  }

  // Recalculate H2H records
  await supabase.from("h2h_records").delete().neq("id", "");
  const h2hMap = new Map<string, H2HRecord>();
  for (const m of matches) {
    if (m.playerIds.length !== 2 || !m.winnerId) continue;
    const [p1, p2] = [...m.playerIds].sort();
    const key = `${p1}_${p2}`;
    const existing = h2hMap.get(key);
    if (existing) {
      existing.totalMatches++;
      if (existing.player1Id === m.winnerId) existing.player1Wins++;
      else existing.player2Wins++;
      existing.lastPlayed = Math.max(existing.lastPlayed, m.createdAt);
    } else {
      h2hMap.set(key, {
        id: key,
        player1Id: p1,
        player2Id: p2,
        player1Wins: m.winnerId === p1 ? 1 : 0,
        player2Wins: m.winnerId === p2 ? 1 : 0,
        totalMatches: 1,
        lastPlayed: m.createdAt,
      });
    }
  }
  for (const record of h2hMap.values()) {
    await supabase.from("h2h_records").insert(toH2HRow(record));
  }
}

export async function clearAllData(): Promise<void> {
  await supabase.from("matches").delete().neq("id", "");
  await supabase.from("players").delete().neq("id", "");
  await supabase.from("h2h_records").delete().neq("id", "");
  await supabase
    .from("app_state")
    .update({ value: null })
    .eq("key", "active_match_id");
}

export async function exportAllData(): Promise<string> {
  const players = await getPlayers();
  const matches = await getMatches();
  const h2h = await getH2HRecords();
  const activeMatch = await getActiveMatch();
  return JSON.stringify({ players, matches, h2h, activeMatch });
}

export async function importAllData(json: string): Promise<void> {
  const data = JSON.parse(json);

  // Clear existing data
  await clearAllData();

  // Insert players
  if (data.players?.length) {
    const rows = data.players.map((p: Player) => toPlayerRow(p));
    await supabase.from("players").insert(rows);
  }

  // Insert matches
  if (data.matches?.length) {
    const rows = data.matches.map((m: Match) => toMatchRow(m));
    await supabase.from("matches").insert(rows);
  }

  // Insert h2h
  if (data.h2h?.length) {
    const rows = data.h2h.map((r: H2HRecord) => toH2HRow(r));
    await supabase.from("h2h_records").insert(rows);
  }

  // Set active match
  if (data.activeMatch) {
    await setActiveMatch(data.activeMatch);
  }
}

// ─── Avatar Upload ───

export async function uploadAvatar(
  playerId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${playerId}.${ext}`;

  // Delete old avatar if exists
  await supabase.storage.from("avatars").remove([path]);

  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (error) {
    console.error("uploadAvatar error:", error);
    return null;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Add cache buster to force refresh
  return data.publicUrl + "?t=" + Date.now();
}

export async function deleteAvatar(playerId: string): Promise<void> {
  // Try common extensions
  const extensions = ["jpg", "jpeg", "png", "gif", "webp"];
  const paths = extensions.map((ext) => `${playerId}.${ext}`);
  await supabase.storage.from("avatars").remove(paths);
}

// ─── Row mapping helpers ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPlayer(row: any): Player {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.created_at,
    stats: row.stats ?? { ...emptyStats },
  };
}

function toPlayerRow(player: Player) {
  return {
    id: player.id,
    display_name: player.displayName,
    avatar_url: player.avatarUrl,
    created_at: player.createdAt,
    stats: player.stats,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMatch(row: any): Match {
  return {
    id: row.id,
    gameMode: row.game_mode,
    startingScore: row.starting_score,
    playerIds: row.player_ids,
    playerNames: row.player_names,
    status: row.status,
    currentPlayerIndex: row.current_player_index,
    scores: row.scores ?? {},
    winnerId: row.winner_id,
    winnerName: row.winner_name,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    turns: row.turns ?? [],
  };
}

function toMatchRow(match: Match) {
  return {
    id: match.id,
    game_mode: match.gameMode,
    starting_score: match.startingScore,
    player_ids: match.playerIds,
    player_names: match.playerNames,
    status: match.status,
    current_player_index: match.currentPlayerIndex,
    scores: match.scores,
    winner_id: match.winnerId,
    winner_name: match.winnerName,
    created_at: match.createdAt,
    completed_at: match.completedAt,
    turns: match.turns,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapH2H(row: any): H2HRecord {
  return {
    id: row.id,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    player1Wins: row.player1_wins,
    player2Wins: row.player2_wins,
    totalMatches: row.total_matches,
    lastPlayed: row.last_played,
  };
}

function toH2HRow(record: H2HRecord) {
  return {
    id: record.id,
    player1_id: record.player1Id,
    player2_id: record.player2Id,
    player1_wins: record.player1Wins,
    player2_wins: record.player2Wins,
    total_matches: record.totalMatches,
    last_played: record.lastPlayed,
  };
}
