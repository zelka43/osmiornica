"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Swords, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { getPlayers, getMatches, saveMatch, setActiveMatch } from "@/lib/store";
import { computeDuelTable, groupDuels } from "@/lib/duel";
import { createInitialMatchState } from "@/lib/dartLogic";
import type { Player, Match, GameMode } from "@/types";
import { PLAYER_COLORS } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Wrapper dla react-hooks/purity — znaczniki czasu powstają tylko w handlerach
const now = () => Date.now();

export default function DuelPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);

  // Formularz tworzenia
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("501");
  const [legsTarget, setLegsTarget] = useState(2);

  useEffect(() => {
    async function load() {
      const [p, m] = await Promise.all([
        getPlayers(),
        getMatches({ withTurns: false }),
      ]);
      setPlayers(p);
      setMatches(m);
      setMounted(true);
    }
    load();
  }, []);

  const duelTable = useMemo(
    () => computeDuelTable(players, matches),
    [players, matches]
  );
  const duelSummaries = useMemo(
    () => groupDuels(matches.filter((m) => m.matchType === "duel")),
    [matches]
  );

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const handleCreate = async () => {
    if (selectedIds.length !== 2) return;
    const nameById = (id: string) =>
      players.find((p) => p.id === id)?.displayName ?? "?";
    const startingScore = parseInt(gameMode);
    const scores: Match["scores"] = {};
    for (const pid of selectedIds) {
      scores[pid] = createInitialMatchState(startingScore);
    }
    const leg: Match = {
      id: uuidv4(),
      gameMode,
      startingScore,
      playerIds: selectedIds,
      playerNames: selectedIds.map(nameById),
      status: "active",
      currentPlayerIndex: 0,
      scores,
      winnerId: null,
      winnerName: null,
      createdAt: now(),
      completedAt: null,
      turns: [],
      matchType: "duel",
      duelId: uuidv4(),
      legsTarget,
      bullWinnerId: null,
    };
    await saveMatch(leg);
    await setActiveMatch(leg);
    router.push(`/match/${leg.id}`);
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
            <button onClick={() => router.push("/")} className="w-10 h-10 rounded-xl glass flex items-center justify-center">
              <ChevronLeft size={20} className="text-muted" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-neon-red/10 flex items-center justify-center">
              <Swords className="text-neon-red" size={20} />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">Pojedynki</h1>
              <p className="text-sm text-muted">1 vs 1 · osobny tryb</p>
            </div>
          </div>

          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="w-full glass glow-green border border-neon-green/30 rounded-2xl p-4 flex items-center gap-3 mb-6"
            >
              <Swords className="text-neon-green" size={20} />
              <span className="font-bold">Nowy pojedynek</span>
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
                  Do ilu wygranych legów (best-of {legsTarget * 2 - 1})
                </h2>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setLegsTarget(n)}
                      className={`rounded-xl py-2 font-bold transition-all ${
                        legsTarget === n
                          ? "glass glow-green border border-neon-green/30 text-neon-green"
                          : "glass border border-transparent text-muted"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wybór graczy */}
              <div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                  Gracze ({selectedIds.length}/2)
                </h2>
                <div className="space-y-2">
                  {players.map((p) => {
                    const idx = selectedIds.indexOf(p.id);
                    const selected = idx >= 0;
                    const colorIndex =
                      players.findIndex((x) => x.id === p.id) % PLAYER_COLORS.length;
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
                  disabled={selectedIds.length !== 2}
                  className="flex-1 rounded-2xl p-3 font-bold bg-neon-green text-background glow-green disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Start
                </button>
              </div>
            </div>
          )}

          {/* Tabela pojedynków */}
          {!creating && duelTable.length > 0 && (
            <div className="glass rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-neon-red" />
                <h2 className="text-sm font-bold">Tabela pojedynków</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[360px]">
                  <thead>
                    <tr className="text-muted uppercase tracking-wider text-[10px]">
                      <th className="text-left py-1 pr-2 font-semibold">Gracz</th>
                      <th className="text-center py-1 px-1 font-semibold">🏆</th>
                      <th className="text-center py-1 px-1 font-semibold">Starty</th>
                      <th className="text-center py-1 px-1 font-semibold">Legi W–P</th>
                      <th className="text-center py-1 px-1 font-semibold">Śr</th>
                      <th className="text-center py-1 pl-1 font-semibold">Dbl%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duelTable.map((row, i) => {
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
                              <span className="truncate max-w-[80px] font-medium">
                                {player?.displayName ?? "?"}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`text-center py-2 px-1 font-mono font-bold ${
                              row.duelsWon > 0 ? "text-neon-yellow" : "text-muted"
                            }`}
                          >
                            {row.duelsWon}
                          </td>
                          <td className="text-center py-2 px-1 font-mono text-muted">
                            {row.duelsPlayed}
                          </td>
                          <td className="text-center py-2 px-1 font-mono">
                            {row.legsWon}–{row.legsLost}
                          </td>
                          <td className="text-center py-2 px-1 font-mono">
                            {row.legsWon + row.legsLost > 0 ? row.avg.toFixed(1) : "—"}
                          </td>
                          <td className="text-center py-2 pl-1 font-mono">
                            {row.tie.doublesAttempted > 0 ? `${row.doublesPct.toFixed(0)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ostatnie pojedynki */}
          {!creating && duelSummaries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Rozegrane pojedynki</p>
              {duelSummaries.slice(0, 10).map((s) => (
                <div key={s.duelId} className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-sm truncate">
                      <span className={s.winnerId === s.p1Id ? "text-neon-green" : ""}>{s.p1Name}</span>
                      {" "}{"—"}{" "}
                      <span className={s.winnerId === s.p2Id ? "text-neon-green" : ""}>{s.p2Name}</span>
                    </p>
                    <p className="text-xs text-muted">
                      do {s.target} wygranych{new Date(s.lastActivity).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.winnerId ? (
                      <span className="font-mono text-lg font-bold">
                        <span className="text-neon-green">{Math.max(s.w1, s.w2)}</span>
                        <span className="text-muted">–{Math.min(s.w1, s.w2)}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-neon-yellow/10 text-neon-yellow px-2 py-0.5 rounded-full">
                        W toku
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!creating && duelSummaries.length === 0 && (
            <div className="glass rounded-2xl p-10 text-center">
              <Swords size={40} className="text-muted mx-auto mb-4 opacity-50" />
              <p className="text-muted text-sm">Brak pojedynków. Wyzwij kogoś!</p>
            </div>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
