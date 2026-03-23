"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, ChevronRight, Shuffle } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { getPlayers } from "@/lib/store";
import { Player, GameMode, PLAYER_COLORS } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { createInitialMatchState } from "@/lib/dartLogic";
import { setActiveMatch, saveMatch } from "@/lib/store";
import type { Match } from "@/types";

export default function NewMatchPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("501");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function load() {
      setPlayers(await getPlayers());
      setMounted(true);
    }
    load();
  }, []);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const shuffleOrder = () => {
    setSelectedIds((prev) => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const startMatch = async () => {
    if (selectedIds.length < 2) return;

    const startingScore = parseInt(gameMode);
    const selectedPlayers = selectedIds
      .map((id) => players.find((p) => p.id === id)!)
      .filter(Boolean);

    const scores: Record<string, ReturnType<typeof createInitialMatchState>> = {};
    selectedPlayers.forEach((p) => {
      scores[p.id] = createInitialMatchState(startingScore);
    });

    const match: Match = {
      id: uuidv4(),
      gameMode,
      startingScore,
      playerIds: selectedPlayers.map((p) => p.id),
      playerNames: selectedPlayers.map((p) => p.displayName),
      status: "active",
      currentPlayerIndex: 0,
      scores,
      winnerId: null,
      winnerName: null,
      createdAt: Date.now(),
      completedAt: null,
      turns: [],
    };

    await saveMatch(match);
    await setActiveMatch(match);
    router.push(`/match/${match.id}`);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 px-4 pt-6 pb-24">
          <div className="skeleton h-8 w-48 mb-6" />
          <div className="skeleton h-20 w-full mb-4" />
          <div className="skeleton h-20 w-full mb-4" />
        </main>
        <NavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center">
              <Target className="text-neon-green" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Nowy mecz</h1>
              <p className="text-sm text-muted">Wybierz graczy i tryb gry</p>
            </div>
          </div>

          {/* Game Mode */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">
              Tryb gry
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {(["501", "301"] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGameMode(mode)}
                  className={`relative rounded-2xl p-4 text-center transition-all duration-200 ${
                    gameMode === mode
                      ? "glass glow-green border border-neon-green/30"
                      : "glass border border-transparent hover:border-border-bright"
                  }`}
                >
                  <span
                    className={`font-mono text-3xl font-bold ${
                      gameMode === mode ? "text-neon-green text-glow-green" : "text-foreground"
                    }`}
                  >
                    {mode}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Player Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
                Gracze ({selectedIds.length} wybranych)
              </h2>
              {selectedIds.length > 1 && (
                <button
                  onClick={shuffleOrder}
                  className="flex items-center gap-1.5 text-xs text-neon-blue hover:text-neon-blue/80 transition-colors"
                >
                  <Shuffle size={14} />
                  Losuj kolejność
                </button>
              )}
            </div>

            {players.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-muted mb-2">Brak graczy</p>
                <button
                  onClick={() => router.push("/players/manage")}
                  className="text-neon-green text-sm hover:underline"
                >
                  Dodaj graczy →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((player, index) => {
                  const isSelected = selectedIds.includes(player.id);
                  const orderIndex = selectedIds.indexOf(player.id);
                  const colorClass = PLAYER_COLORS[index % PLAYER_COLORS.length];

                  return (
                    <motion.button
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 ${
                        isSelected
                          ? "glass glow-green border border-neon-green/20"
                          : "glass border border-transparent hover:border-border-bright"
                      }`}
                    >
                      {/* Avatar */}
                      <PlayerAvatar
                        avatarUrl={player.avatarUrl}
                        displayName={player.displayName}
                        colorIndex={index}
                        size="md"
                      />

                      {/* Name */}
                      <span className="flex-1 text-left font-medium">
                        {player.displayName}
                      </span>

                      {/* Order number */}
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full bg-neon-green flex items-center justify-center"
                        >
                          <span className="text-background font-bold text-xs">
                            {orderIndex + 1}
                          </span>
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected order */}
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6"
            >
              <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">
                Kolejność gry
              </h2>
              <div className="flex flex-wrap gap-2">
                {selectedIds.map((id, i) => {
                  const p = players.find((pl) => pl.id === id);
                  if (!p) return null;
                  return (
                    <span
                      key={id}
                      className="glass-light rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5"
                    >
                      <span className="text-neon-green font-mono text-xs">
                        {i + 1}.
                      </span>
                      {p.displayName}
                    </span>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Start button */}
          <motion.button
            onClick={startMatch}
            disabled={selectedIds.length < 2}
            whileTap={selectedIds.length >= 2 ? { scale: 0.97 } : undefined}
            className={`w-full rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-lg transition-all duration-200 ${
              selectedIds.length >= 2
                ? "bg-neon-green text-background glow-green hover:bg-neon-green-dim active:bg-neon-green-dim"
                : "bg-surface text-muted cursor-not-allowed"
            }`}
          >
            <Target size={22} />
            Rozpocznij mecz
            <ChevronRight size={20} />
          </motion.button>

          {selectedIds.length < 2 && (
            <p className="text-center text-muted text-sm mt-3">
              Wybierz minimum 2 graczy
            </p>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
