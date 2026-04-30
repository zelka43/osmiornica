"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { History, Trophy, Target, Trash2, X } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { getMatches, deleteMatch, saveMatch, getActiveMatch, setActiveMatch } from "@/lib/store";
import type { Match } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MatchHistoryPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [mounted, setMounted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setMatches(await getMatches());
      setMounted(true);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteMatch(id);
    setMatches((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeleteId(null);
  };

  const handleAbandon = async (match: Match) => {
    const updated: Match = { ...match, status: "abandoned" };
    await saveMatch(updated);
    // Clear active match if this was it
    const active = await getActiveMatch();
    if (active && active.id === match.id) {
      await setActiveMatch(null);
    }
    setMatches((prev) => prev.map((m) => (m.id === match.id ? updated : m)));
  };

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="skeleton h-10 w-52 mx-auto" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-28 w-full rounded-2xl" />
            ))}
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  const completedMatches = [...matches]
    .filter((m) => m.status === "completed")
    .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));

  const unfinishedMatches = [...matches]
    .filter((m) => m.status === "active" || m.status === "abandoned")
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-lg mx-auto space-y-6"
        >
          {/* Title */}
          <motion.div variants={item} className="text-center pt-4 pb-2">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center">
                <History size={22} className="text-neon-purple" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Historia meczów
              </h1>
            </div>
            <p className="text-muted text-sm">
              Wszystkie rozgrywki
            </p>
          </motion.div>

          {/* Empty State */}
          {completedMatches.length === 0 && unfinishedMatches.length === 0 && (
            <motion.div
              variants={item}
              className="glass rounded-2xl p-10 text-center"
            >
              <Target
                size={40}
                className="text-muted mx-auto mb-4 opacity-50"
              />
              <p className="text-muted text-sm">
                Brak meczów w historii.
                <br />
                Rozegraj pierwszy mecz, aby zobaczyć historię!
              </p>
            </motion.div>
          )}

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <div className="space-y-3">
              {completedMatches.map((match) => {
                const dateTs = match.completedAt ?? match.createdAt;

                return (
                  <motion.div
                    key={match.id}
                    variants={item}
                    onClick={() => router.push(`/match/history/${match.id}`)}
                    className="glass rounded-2xl p-4 space-y-3 border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
                  >
                    {/* Top Row: Date + Game Mode */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted font-mono">
                        {formatDate(dateTs)}, {formatTime(dateTs)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(match.matchType ?? "ranked") === "friendly" && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-light text-neon-purple border border-neon-purple/20">
                            Towarzyski
                          </span>
                        )}
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-light text-neon-blue border border-neon-blue/20">
                          {match.gameMode}
                        </span>
                      </div>
                    </div>

                    {/* Players and Scores */}
                    <div className="space-y-2">
                      {match.playerIds.map((playerId, idx) => {
                        const playerName = match.playerNames[idx];
                        const isWinner = match.winnerId === playerId;
                        const playerScore = match.scores[playerId];
                        const remaining = playerScore
                          ? playerScore.remaining
                          : null;

                        return (
                          <div
                            key={playerId}
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors ${
                              isWinner
                                ? "bg-neon-green/[0.06] border border-neon-green/15"
                                : "bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {isWinner && (
                                <Trophy
                                  size={14}
                                  className="text-neon-green shrink-0"
                                />
                              )}
                              <span
                                className={`text-sm font-medium ${
                                  isWinner
                                    ? "text-neon-green"
                                    : "text-foreground"
                                }`}
                              >
                                {playerName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {remaining !== null && (
                                <span
                                  className={`font-mono text-sm font-bold ${
                                    isWinner
                                      ? "text-neon-green"
                                      : "text-muted"
                                  }`}
                                >
                                  {remaining}
                                </span>
                              )}
                              {isWinner && (
                                <span className="text-[10px] font-semibold text-neon-green uppercase tracking-wider">
                                  Zwycięzca
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Unfinished / Abandoned Matches */}
          {unfinishedMatches.length > 0 && (
            <>
              <motion.div variants={item} className="pt-2">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                  Niedokończone / porzucone mecze
                </h2>
              </motion.div>
              <div className="space-y-3">
                {unfinishedMatches.map((match) => {
                  const isActive = match.status === "active";
                  return (
                    <motion.div
                      key={match.id}
                      variants={item}
                      className={`glass rounded-2xl p-4 space-y-3 border ${
                        isActive ? "border-neon-yellow/15" : "border-neon-red/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted font-mono">
                          {formatDate(match.createdAt)}, {formatTime(match.createdAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full bg-surface-light border ${
                              isActive
                                ? "text-neon-yellow border-neon-yellow/20"
                                : "text-neon-red border-neon-red/20"
                            }`}
                          >
                            {isActive ? "W trakcie" : "Porzucony"}
                          </span>

                          {/* Abandon button for active matches */}
                          {isActive && confirmDeleteId !== match.id && (
                            <button
                              onClick={() => handleAbandon(match)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neon-yellow/10 text-neon-yellow hover:bg-neon-yellow/20 transition-all"
                            >
                              Porzuć
                            </button>
                          )}

                          {/* Delete button */}
                          {confirmDeleteId === match.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(match.id)}
                                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-neon-red/15 text-neon-red hover:bg-neon-red/25 transition-all"
                              >
                                Usuń
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1 rounded-lg hover:bg-surface-light transition-all"
                              >
                                <X size={14} className="text-muted" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(match.id)}
                              className="p-1.5 rounded-lg hover:bg-neon-red/10 transition-all"
                            >
                              <Trash2 size={14} className="text-muted hover:text-neon-red" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {match.playerIds.map((playerId, idx) => (
                          <div
                            key={playerId}
                            className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/[0.02]"
                          >
                            <span className="text-sm text-muted">
                              {match.playerNames[idx]}
                            </span>
                            <span className="font-mono text-sm text-muted">
                              {match.scores[playerId]?.remaining ?? "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Match Count Footer */}
          {(completedMatches.length > 0 || unfinishedMatches.length > 0) && (
            <motion.div
              variants={item}
              className="text-center text-xs text-muted pb-4"
            >
              Łącznie {completedMatches.length}{" "}
              {completedMatches.length === 1
                ? "mecz"
                : completedMatches.length < 5
                ? "mecze"
                : "meczów"}
              {unfinishedMatches.length > 0 && (
                <span> · {unfinishedMatches.length} niedokończonych</span>
              )}
            </motion.div>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
