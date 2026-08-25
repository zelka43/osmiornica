"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, ChevronLeft, ChevronRight, Shuffle, BarChart3, Trash2 } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { getPlayers, getMatches, getTournaments, saveTournament, deleteTournament } from "@/lib/store";
import { computeRtg, computeTournamentTable } from "@/lib/statsCalculator";
import { generateBracket } from "@/lib/tournament";
import { Player, Match, Tournament, GameMode, SeedingMode, PLAYER_COLORS } from "@/types";
import { v4 as uuidv4 } from "uuid";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8;

export default function TournamentListPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);

  // Formularz tworzenia
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("501");
  const [legsToWin, setLegsToWin] = useState(2);
  const [seeding, setSeeding] = useState<SeedingMode>("rating");

  useEffect(() => {
    async function load() {
      const [p, m, t] = await Promise.all([
        getPlayers(),
        getMatches({ withTurns: false }),
        getTournaments(),
      ]);
      setPlayers(p);
      setMatches(m);
      setTournaments(t);
      setMounted(true);
    }
    load();
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PLAYERS) return prev;
      return [...prev, id];
    });
  };

  const tournamentTable = useMemo(
    () => computeTournamentTable(players, tournaments, matches),
    [players, tournaments, matches]
  );

  const handleCreate = async () => {
    if (selectedIds.length < MIN_PLAYERS) return;

    // Kolejność seedów
    let seedOrder: string[];
    if (seeding === "random") {
      seedOrder = [...selectedIds];
      for (let i = seedOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seedOrder[i], seedOrder[j]] = [seedOrder[j], seedOrder[i]];
      }
    } else {
      seedOrder = [...selectedIds].sort((a, b) => computeRtg(b, matches) - computeRtg(a, matches));
    }

    const nameById = (id: string) => players.find((p) => p.id === id)?.displayName ?? "?";
    const now = new Date();
    const tournament: Tournament = {
      id: uuidv4(),
      name: `Turniej ${now.toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}`,
      gameMode,
      legsToWin,
      seeding,
      status: "active",
      playerIds: seedOrder,
      playerNames: seedOrder.map(nameById),
      bracket: generateBracket(seedOrder),
      championId: null,
      createdAt: Date.now(),
      completedAt: null,
    };
    await saveTournament(tournament);
    router.push(`/tournament/${tournament.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć turniej i wszystkie jego mecze?")) return;
    await deleteTournament(id);
    setTournaments((prev) => prev.filter((t) => t.id !== id));
  };

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 px-4 pt-6 pb-24">
          <div className="skeleton h-8 w-48 mb-6" />
          <div className="skeleton h-20 w-full mb-4" />
        </main>
        <NavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-neon-yellow/10 flex items-center justify-center">
              <Trophy className="text-neon-yellow" size={20} />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Turnieje</h1>
              <p className="text-sm text-muted">Pucharowy, {MIN_PLAYERS}–{MAX_PLAYERS} graczy · osobny tryb</p>
            </div>
          </div>

          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="w-full glass glow-green border border-neon-green/30 rounded-2xl p-4 flex items-center gap-3 mb-6"
            >
              <Trophy className="text-neon-green" size={20} />
              <span className="font-bold">Nowy turniej</span>
              <ChevronRight size={18} className="text-muted ml-auto" />
            </button>
          )}

          {/* Formularz tworzenia */}
          {creating && (
            <div className="glass rounded-2xl p-4 mb-6 space-y-5">
              {/* Tryb gry */}
              <div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Tryb gry</h2>
                <div className="grid grid-cols-2 gap-3">
                  {(["501", "301"] as GameMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setGameMode(mode)}
                      className={`rounded-2xl p-3 text-center font-bold transition-all ${
                        gameMode === mode
                          ? "glass glow-green border border-neon-green/30 text-neon-green"
                          : "glass border border-transparent text-muted"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Do ilu wygranych legów */}
              <div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Do ilu wygranych legów (best-of {legsToWin * 2 - 1})
                </h2>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setLegsToWin(n)}
                      className={`rounded-xl py-2 font-bold transition-all ${
                        legsToWin === n
                          ? "glass glow-green border border-neon-green/30 text-neon-green"
                          : "glass border border-transparent text-muted"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rozstawienie */}
              <div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Rozstawienie</h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSeeding("rating")}
                    className={`rounded-2xl p-3 flex items-center justify-center gap-2 font-semibold transition-all ${
                      seeding === "rating"
                        ? "glass glow-green border border-neon-green/30 text-neon-green"
                        : "glass border border-transparent text-muted"
                    }`}
                  >
                    <BarChart3 size={16} /> Wg RTG
                  </button>
                  <button
                    onClick={() => setSeeding("random")}
                    className={`rounded-2xl p-3 flex items-center justify-center gap-2 font-semibold transition-all ${
                      seeding === "random"
                        ? "glass glow-green border border-neon-green/30 text-neon-green"
                        : "glass border border-transparent text-muted"
                    }`}
                  >
                    <Shuffle size={16} /> Losowo
                  </button>
                </div>
              </div>

              {/* Wybór graczy */}
              <div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Gracze ({selectedIds.length}/{MAX_PLAYERS})
                </h2>
                <div className="space-y-2">
                  {players.map((p) => {
                    const idx = selectedIds.indexOf(p.id);
                    const selected = idx >= 0;
                    const colorIndex = players.findIndex((x) => x.id === p.id) % PLAYER_COLORS.length;
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePlayer(p.id)}
                        className={`w-full glass rounded-2xl p-3 flex items-center gap-3 transition-all ${
                          selected ? "border border-neon-green/40 glow-green" : "border border-transparent"
                        }`}
                      >
                        <PlayerAvatar avatarUrl={p.avatarUrl} displayName={p.displayName} colorIndex={colorIndex} size="sm" />
                        <span className="font-medium flex-1 text-left">{p.displayName}</span>
                        {selected && (
                          <span className="w-6 h-6 rounded-full bg-neon-green text-background text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {players.length === 0 && (
                    <p className="text-sm text-muted text-center py-4">Brak graczy. Dodaj ich w zakładce Karty.</p>
                  )}
                </div>
              </div>

              {/* Akcje */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setCreating(false); setSelectedIds([]); }}
                  className="flex-1 glass rounded-2xl p-3 font-medium text-muted"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreate}
                  disabled={selectedIds.length < MIN_PLAYERS}
                  className="flex-1 rounded-2xl p-3 font-bold bg-neon-green text-background glow-green disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Start ({selectedIds.length})
                </button>
              </div>
            </div>
          )}

          {/* Tabela turniejowa */}
          {!creating && tournamentTable.length > 0 && (
            <div className="glass rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-neon-yellow" />
                <h2 className="text-sm font-bold">Tabela turniejowa</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[340px]">
                  <thead>
                    <tr className="text-muted uppercase tracking-wider text-[10px]">
                      <th className="text-left py-1 pr-2 font-semibold">Gracz</th>
                      <th className="text-center py-1 px-1 font-semibold">🏆</th>
                      <th className="text-center py-1 px-1 font-semibold">Starty</th>
                      <th className="text-center py-1 px-1 font-semibold">W–P</th>
                      <th className="text-center py-1 px-1 font-semibold">Śr</th>
                      <th className="text-center py-1 pl-1 font-semibold">Dbl%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentTable.map((row, i) => {
                      const player = players.find((p) => p.id === row.playerId);
                      const colorIndex =
                        players.findIndex((p) => p.id === row.playerId) % PLAYER_COLORS.length;
                      return (
                        <tr key={row.playerId} className="border-t border-border/50">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 text-center font-mono font-bold shrink-0 ${
                                  i === 0 ? "text-neon-yellow" : "text-muted"
                                }`}
                              >
                                {i + 1}
                              </span>
                              {player && (
                                <PlayerAvatar
                                  avatarUrl={player.avatarUrl}
                                  displayName={player.displayName}
                                  colorIndex={colorIndex}
                                  size="sm"
                                />
                              )}
                              <span className="truncate max-w-[90px] font-medium">
                                {player?.displayName ?? "?"}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`text-center py-2 px-1 font-mono font-bold ${
                              row.titles > 0 ? "text-neon-yellow" : "text-muted"
                            }`}
                          >
                            {row.titles}
                          </td>
                          <td className="text-center py-2 px-1 font-mono text-muted">
                            {row.starts}
                          </td>
                          <td className="text-center py-2 px-1 font-mono">
                            {row.matchesWon}–{row.matchesPlayed - row.matchesWon}
                          </td>
                          <td className="text-center py-2 px-1 font-mono">
                            {row.matchesPlayed > 0 ? row.avg.toFixed(1) : "—"}
                          </td>
                          <td className="text-center py-2 pl-1 font-mono">
                            {row.tie.doublesAttempted > 0
                              ? `${row.doublesPct.toFixed(0)}%`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista turniejów */}
          {tournaments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Twoje turnieje</p>
              {tournaments.map((t) => {
                const champ = t.championId ? t.playerNames[t.playerIds.indexOf(t.championId)] : null;
                return (
                  <div
                    key={t.id}
                    className="w-full glass rounded-2xl p-4 flex items-center gap-3"
                  >
                    <button onClick={() => router.push(`/tournament/${t.id}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.status === "completed" ? "bg-neon-yellow/10" : "bg-neon-green/10"}`}>
                        <Trophy className={t.status === "completed" ? "text-neon-yellow" : "text-neon-green"} size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{t.name}</p>
                        <p className="text-xs text-muted truncate">
                          {t.playerIds.length} graczy · {t.gameMode} · do {t.legsToWin}{" "}
                          {champ ? `· 🏆 ${champ}` : t.status === "active" ? "· w toku" : ""}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-muted shrink-0" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="text-muted hover:text-neon-red p-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!creating && tournaments.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center">
              <Trophy size={40} className="text-muted mx-auto mb-4 opacity-50" />
              <p className="text-muted text-sm">Brak turniejów. Utwórz pierwszy!</p>
            </div>
          )}

          <button onClick={() => router.push("/")} className="mt-6 flex items-center gap-1 text-sm text-muted">
            <ChevronLeft size={16} /> Strona główna
          </button>
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
