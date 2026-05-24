"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Calendar } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { getMatchById } from "@/lib/store";
import PostMatchStats from "@/components/match/PostMatchStats";
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

function dartLabel(dart: { segment: number; multiplier: number; score: number }): string {
  if (dart.segment === 0) return "MISS";
  const prefix = dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S";
  if (dart.segment === 25 && dart.multiplier === 2) return "BULL";
  if (dart.segment === 25) return "S25";
  return `${prefix}${dart.segment}`;
}

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function load() {
      const m = await getMatchById(id);
      if (m) setMatch(m);
      setMounted(true);
    }
    load();
  }, [id]);

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="skeleton h-10 w-52 mx-auto" />
            <div className="skeleton h-64 w-full rounded-2xl" />
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto text-center pt-20">
            <p className="text-muted">Mecz nie został znaleziony.</p>
            <button
              onClick={() => router.push("/match/history")}
              className="mt-4 text-neon-blue text-sm"
            >
              Wróć do historii
            </button>
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  const dateTs = match.completedAt ?? match.createdAt;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="max-w-lg mx-auto space-y-6"
        >
          {/* Back button + header */}
          <motion.div variants={item} className="flex items-center gap-3 pt-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl glass flex items-center justify-center"
            >
              <ArrowLeft size={18} className="text-muted" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Szczegóły meczu</h1>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Calendar size={12} />
                <span>{formatDate(dateTs)}, {formatTime(dateTs)}</span>
                <span className="text-neon-blue font-bold">{match.gameMode}</span>
              </div>
            </div>
          </motion.div>

          {/* Winner banner */}
          {match.winnerName && (
            <motion.div
              variants={item}
              className="glass rounded-2xl p-4 flex items-center gap-3 border border-neon-green/20 bg-neon-green/[0.04]"
            >
              <Trophy size={24} className="text-neon-yellow" />
              <div>
                <span className="text-neon-green font-bold">{match.winnerName}</span>
                <span className="text-muted text-sm"> wygrał mecz</span>
              </div>
            </motion.div>
          )}

          {/* Post match stats */}
          <motion.div variants={item}>
            <PostMatchStats match={match} />
          </motion.div>

          {/* Turn-by-turn history */}
          {match.turns.length > 0 && (
            <motion.div variants={item} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Przebieg meczu
              </h3>
              <div className="glass rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2rem_1fr_5rem_4rem_4rem] gap-1 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-white/5">
                  <span className="text-center">#</span>
                  <span>Gracz</span>
                  <span className="text-center">Rzuty</span>
                  <span className="text-center">Wynik</span>
                  <span className="text-center">Poz.</span>
                </div>

                {/* Turns */}
                {match.turns.map((turn, idx) => {
                  const playerIdx = match.playerIds.indexOf(turn.playerId);
                  const playerName = match.playerNames[playerIdx] ?? "?";

                  return (
                    <div
                      key={turn.id}
                      className={`grid grid-cols-[2rem_1fr_5rem_4rem_4rem] gap-1 items-center px-3 py-2 text-sm ${
                        turn.isCheckout
                          ? "bg-neon-green/[0.06]"
                          : turn.isBust
                          ? "bg-neon-red/[0.04]"
                          : idx % 2 === 0
                          ? ""
                          : "bg-white/[0.01]"
                      } ${idx < match.turns.length - 1 ? "border-b border-white/5" : ""}`}
                    >
                      <span className="text-center text-[11px] text-muted font-mono">{turn.turnNumber}</span>
                      <span className="text-xs font-medium truncate">{playerName}</span>
                      <div className="flex gap-1 justify-center">
                        {turn.darts.map((d, di) => (
                          <span
                            key={di}
                            className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded ${
                              d.multiplier === 3
                                ? "text-neon-purple bg-neon-purple/10"
                                : d.multiplier === 2
                                ? "text-neon-red bg-neon-red/10"
                                : d.segment === 0
                                ? "text-muted"
                                : "text-foreground"
                            }`}
                          >
                            {dartLabel(d)}
                          </span>
                        ))}
                      </div>
                      <span
                        className={`text-center font-mono text-xs font-bold ${
                          turn.isBust
                            ? "text-neon-red"
                            : turn.isCheckout
                            ? "text-neon-green"
                            : "text-foreground"
                        }`}
                      >
                        {turn.isBust ? "BUST" : turn.turnTotal}
                      </span>
                      <span
                        className={`text-center font-mono text-xs ${
                          turn.isCheckout ? "text-neon-green font-bold" : "text-muted"
                        }`}
                      >
                        {turn.remainingAfter}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
