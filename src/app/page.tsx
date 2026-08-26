"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Target, Plus, Trophy, Users, Clock, Crown } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { getPlayers, getMatches, getActiveMatch } from "@/lib/store";
import type { Match } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTitleTap = () => {
    tapCountRef.current++;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      router.push("/dev");
      return;
    }
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);
  };

  useEffect(() => {
    async function load() {
      const [am, m, p] = await Promise.all([
        getActiveMatch(),
        getMatches({ withTurns: false }),
        getPlayers(),
      ]);
      setActiveMatch(am);
      setMatches(m);
      setPlayerCount(p.length);
      setMounted(true);
    }
    load();
  }, []);

  // Legi turniejowe i pojedynki to osobne tryby — nie pokazujemy ich na dashboardzie
  const nonTournamentMatches = matches.filter((m) => {
    const mt = m.matchType ?? "ranked";
    return mt !== "tournament" && mt !== "duel";
  });

  const recentMatches = [...nonTournamentMatches]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const completedCount = nonTournamentMatches.filter((m) => m.status === "completed").length;

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="space-y-6">
            <div className="skeleton h-12 w-56 mx-auto" />
            <div className="skeleton h-40 w-full rounded-2xl" />
            <div className="skeleton h-16 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <div className="skeleton h-24 rounded-2xl" />
              <div className="skeleton h-24 rounded-2xl" />
            </div>
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

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
            <h1
              onClick={handleTitleTap}
              className="text-3xl font-bold tracking-tight text-glow-green text-neon-green cursor-default select-none"
            >
              OŚMIORNICA
            </h1>
            <p className="text-muted text-sm mt-1">
              Profesjonalny licznik punktów
            </p>
          </motion.div>

          {/* Active Match Card */}
          {activeMatch && (
            <motion.div variants={item}>
              <Link href={`/match/${activeMatch.id}`}>
                <div className="glass rounded-2xl p-5 glow-green border border-neon-green/20 pulse-active transition-transform active:scale-[0.98]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center">
                      <Target size={20} className="text-neon-green" />
                    </div>
                    <div>
                      <p className="text-xs text-neon-green font-semibold uppercase tracking-wider">
                        Aktywny mecz
                      </p>
                      <p className="text-foreground font-medium">
                        {activeMatch.playerNames.join(" vs ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-sm">
                      {activeMatch.gameMode} &middot;{" "}
                      {formatDate(activeMatch.createdAt)}
                    </span>
                    <span className="text-neon-green text-sm font-semibold">
                      Kontynuuj mecz &rarr;
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* New Match Button */}
          <motion.div variants={item}>
            <Link href="/match/new">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neon-green/10 to-neon-blue/10 border border-neon-green/20 p-5 transition-all active:scale-[0.98] hover:border-neon-green/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-neon-green/15 flex items-center justify-center shrink-0">
                    <Plus size={24} className="text-neon-green" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      Nowy mecz
                    </p>
                    <p className="text-muted text-sm">
                      Rozpocznij nową rozgrywkę
                    </p>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-neon-green/5 blur-2xl" />
              </div>
            </Link>
          </motion.div>

          {/* Quick Stats */}
          <motion.div variants={item} className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4 text-center">
              <div className="w-9 h-9 rounded-xl bg-neon-blue/10 flex items-center justify-center mx-auto mb-2">
                <Trophy size={18} className="text-neon-blue" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {completedCount}
              </p>
              <p className="text-muted text-xs mt-0.5">Rozegrane mecze</p>
            </div>
            <div className="glass rounded-2xl p-4 text-center">
              <div className="w-9 h-9 rounded-xl bg-neon-purple/10 flex items-center justify-center mx-auto mb-2">
                <Users size={18} className="text-neon-purple" />
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">
                {playerCount}
              </p>
              <p className="text-muted text-xs mt-0.5">Graczy</p>
            </div>
          </motion.div>

          {/* Recent Matches */}
          {recentMatches.length > 0 && (
            <motion.div variants={item} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Clock size={14} className="text-muted" />
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                  Ostatnie mecze
                </h2>
              </div>

              <div className="space-y-2">
                {recentMatches.map((match) => (
                  <motion.div
                    key={match.id}
                    variants={item}
                    onClick={() => {
                      if (match.status === "completed") {
                        router.push(`/match/history/${match.id}`);
                      } else if (match.status === "active") {
                        router.push(`/match/${match.id}`);
                      }
                    }}
                    className="glass rounded-2xl p-4 transition-colors hover:bg-card-hover cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted font-mono">
                        {formatDate(match.createdAt)}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-light text-muted">
                        {match.gameMode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {match.playerNames.join(" vs ")}
                      </p>
                      {match.winnerName ? (
                        <div className="flex items-center gap-1">
                          <Crown size={12} className="text-neon-yellow" />
                          <span className="text-xs font-semibold text-neon-yellow">
                            {match.winnerName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted italic">
                          W trakcie
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {recentMatches.length === 0 && (
            <motion.div
              variants={item}
              className="glass rounded-2xl p-8 text-center"
            >
              <Target size={32} className="text-muted mx-auto mb-3" />
              <p className="text-muted text-sm">
                Brak rozegranych meczy.
                <br />
                Rozpocznij pierwszy mecz!
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
