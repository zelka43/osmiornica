"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, ChevronRight, ChevronLeft, UserPlus, X } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { getPlayers } from "@/lib/store";
import { Player, GameMode, PLAYER_COLORS } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { createInitialMatchState } from "@/lib/dartLogic";
import { setActiveMatch, saveMatch } from "@/lib/store";
import type { Match } from "@/types";

type OrderMode = "ranking" | "manual" | "random";

interface GuestPlayer {
  id: string;
  displayName: string;
  avatarUrl: null;
  isGuest: true;
}

export default function FriendlyMatchPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [guests, setGuests] = useState<GuestPlayer[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("501");
  const [orderMode, setOrderMode] = useState<OrderMode>("manual");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function load() {
      setPlayers(await getPlayers());
      setMounted(true);
    }
    load();
  }, []);

  const allEntries = [
    ...players.map((p) => ({ ...p, isGuest: false as const })),
    ...guests,
  ];

  const sortByRanking = useCallback(
    (ids: string[]): string[] => {
      return [...ids].sort((a, b) => {
        const pa = players.find((p) => p.id === a);
        const pb = players.find((p) => p.id === b);
        const winPctA =
          pa && pa.stats.matchesPlayed > 0
            ? (pa.stats.matchesWon / pa.stats.matchesPlayed) * 100
            : 0;
        const winPctB =
          pb && pb.stats.matchesPlayed > 0
            ? (pb.stats.matchesWon / pb.stats.matchesPlayed) * 100
            : 0;
        return winPctA - winPctB;
      });
    },
    [players]
  );

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      if (orderMode === "ranking") return sortByRanking(next);
      return next;
    });
  };

  const removeGuest = (id: string) => {
    setGuests((prev) => prev.filter((g) => g.id !== id));
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  };

  const addGuest = () => {
    const name = guestInput.trim();
    if (!name) return;
    const guest: GuestPlayer = {
      id: "guest_" + uuidv4(),
      displayName: name,
      avatarUrl: null,
      isGuest: true,
    };
    setGuests((prev) => [...prev, guest]);
    setSelectedIds((prev) => [...prev, guest.id]);
    setGuestInput("");
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

  const handleOrderModeChange = (mode: OrderMode) => {
    setOrderMode(mode);
    if (mode === "random") shuffleOrder();
    if (mode === "ranking") setSelectedIds((prev) => sortByRanking(prev));
  };

  const startMatch = async () => {
    if (selectedIds.length < 2) return;

    const startingScore = parseInt(gameMode);
    const scores: Record<string, ReturnType<typeof createInitialMatchState>> = {};
    const playerNames: string[] = [];

    for (const id of selectedIds) {
      scores[id] = createInitialMatchState(startingScore);
      const entry = allEntries.find((e) => e.id === id);
      playerNames.push(entry?.displayName ?? "?");
    }

    const match: Match = {
      id: uuidv4(),
      gameMode,
      startingScore,
      playerIds: selectedIds,
      playerNames,
      status: "active",
      currentPlayerIndex: 0,
      scores,
      winnerId: null,
      winnerName: null,
      createdAt: Date.now(),
      completedAt: null,
      turns: [],
      matchType: "friendly",
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
            <button
              onClick={() => router.push("/match/new")}
              className="w-10 h-10 rounded-xl glass flex items-center justify-center"
            >
              <ChevronLeft size={20} className="text-muted" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center">
              <Users className="text-neon-purple" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Gra towarzyska</h1>
              <p className="text-sm text-muted">Nie liczy się do rankingu</p>
            </div>
          </div>

          {/* Game Mode */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">Tryb gry</h2>
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

          {/* Players */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
                Gracze ({selectedIds.length} wybranych)
              </h2>
              {selectedIds.length > 1 && (
                <div className="flex gap-1 p-0.5 bg-surface rounded-lg">
                  {([
                    { mode: "ranking" as OrderMode, label: "Ranking" },
                    { mode: "manual" as OrderMode, label: "Ręczna" },
                    { mode: "random" as OrderMode, label: "Losowa" },
                  ]).map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => handleOrderModeChange(mode)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                        orderMode === mode ? "bg-neon-blue/15 text-neon-blue" : "text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {players.map((player, index) => {
                const isSelected = selectedIds.includes(player.id);
                const orderIndex = selectedIds.indexOf(player.id);

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
                    <PlayerAvatar
                      avatarUrl={player.avatarUrl}
                      displayName={player.displayName}
                      colorIndex={index}
                      size="md"
                    />
                    <span className="flex-1 text-left font-medium">{player.displayName}</span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-7 h-7 rounded-full bg-neon-green flex items-center justify-center"
                      >
                        <span className="text-background font-bold text-xs">{orderIndex + 1}</span>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}

              {/* Guests */}
              {guests.map((guest, index) => {
                const isSelected = selectedIds.includes(guest.id);
                const orderIndex = selectedIds.indexOf(guest.id);
                const colorIndex = players.length + index;

                return (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 ${
                      isSelected
                        ? "glass glow-green border border-neon-green/20"
                        : "glass border border-transparent"
                    }`}
                  >
                    <button onClick={() => togglePlayer(guest.id)} className="flex items-center gap-3 flex-1">
                      <PlayerAvatar
                        avatarUrl={null}
                        displayName={guest.displayName}
                        colorIndex={colorIndex}
                        size="md"
                      />
                      <span className="flex-1 text-left font-medium">{guest.displayName}</span>
                      <span className="text-xs text-muted px-2 py-0.5 bg-surface rounded-full">gość</span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-7 h-7 rounded-full bg-neon-green flex items-center justify-center"
                        >
                          <span className="text-background font-bold text-xs">{orderIndex + 1}</span>
                        </motion.div>
                      )}
                    </button>
                    <button
                      onClick={() => removeGuest(guest.id)}
                      className="w-7 h-7 rounded-full glass flex items-center justify-center"
                    >
                      <X size={14} className="text-muted" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Add guest */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">Dodaj gościa</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGuest()}
                placeholder="Imię gościa..."
                className="flex-1 glass rounded-xl px-4 py-3 text-sm bg-transparent outline-none border border-transparent focus:border-border-bright transition-colors"
              />
              <button
                onClick={addGuest}
                disabled={!guestInput.trim()}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  guestInput.trim()
                    ? "bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30"
                    : "bg-surface text-muted cursor-not-allowed"
                }`}
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>

          {/* Selected order */}
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6"
            >
              <h2 className="text-sm font-medium text-muted mb-2 uppercase tracking-wider">Kolejność gry</h2>
              <div className="flex flex-wrap gap-2">
                {selectedIds.map((id, i) => {
                  const entry = allEntries.find((e) => e.id === id);
                  if (!entry) return null;
                  return (
                    <span
                      key={id}
                      className="glass-light rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5"
                    >
                      <span className="text-neon-green font-mono text-xs">{i + 1}.</span>
                      {entry.displayName}
                      {entry.isGuest && (
                        <span className="text-[10px] text-muted">(gość)</span>
                      )}
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
            <Users size={22} />
            Rozpocznij grę towarzyską
            <ChevronRight size={20} />
          </motion.button>

          {selectedIds.length < 2 && (
            <p className="text-center text-muted text-sm mt-3">
              Wybierz minimum 2 graczy / gości
            </p>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
