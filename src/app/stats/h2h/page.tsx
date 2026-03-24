"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Swords, ChevronDown, ChevronLeft, ChevronRight, Target } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { getPlayers, getMatchesBetweenPlayers } from "@/lib/store";
import {
  calculateThreeDartAvg,
  calculateCheckoutPercentage,
  getPeriodRange,
  type TimePeriod,
} from "@/lib/statsCalculator";
import type { Player, Match } from "@/types";
import { PLAYER_COLORS } from "@/types";

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

const PERIOD_LABELS: Record<TimePeriod, string> = {
  all: "Wszystko",
  yearly: "Rok",
  monthly: "Miesiąc",
  weekly: "Tydzień",
  daily: "Dzień",
};

interface H2HStats {
  wins: number;
  dartsThrown: number;
  pointsScored: number;
  oneEighties: number;
  tonPlus: number;
  doublesAttempted: number;
  doublesHit: number;
  highestCheckout: number;
  bestAvg: number;
}

function emptyH2HStats(): H2HStats {
  return {
    wins: 0,
    dartsThrown: 0,
    pointsScored: 0,
    oneEighties: 0,
    tonPlus: 0,
    doublesAttempted: 0,
    doublesHit: 0,
    highestCheckout: 0,
    bestAvg: 0,
  };
}

function computeH2HStats(
  playerId: string,
  matches: Match[]
): H2HStats {
  const stats = emptyH2HStats();
  for (const m of matches) {
    const state = m.scores[playerId];
    if (!state) continue;
    if (m.winnerId === playerId) stats.wins++;
    stats.dartsThrown += state.dartsThrown;
    stats.pointsScored += state.pointsScored;
    stats.oneEighties += state.oneEighties;
    stats.tonPlus += state.tonPlus;
    stats.doublesAttempted += state.doublesAttempted;
    stats.doublesHit += state.doublesHit;
    const matchAvg = calculateThreeDartAvg(state.pointsScored, state.dartsThrown);
    if (matchAvg > stats.bestAvg) stats.bestAvg = matchAvg;
  }
  return stats;
}

export default function H2HPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mounted, setMounted] = useState(false);
  const [player1Id, setPlayer1Id] = useState<string>("");
  const [player2Id, setPlayer2Id] = useState<string>("");
  const [period, setPeriod] = useState<TimePeriod>("all");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function load() {
      setPlayers(await getPlayers());
      setMounted(true);
    }
    load();
  }, []);

  const currentRange = useMemo(() => getPeriodRange(period, offset), [period, offset]);

  const [allSharedMatches, setAllSharedMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!player1Id || !player2Id || player1Id === player2Id) {
      setAllSharedMatches([]);
      return;
    }
    getMatchesBetweenPlayers(player1Id, player2Id).then(setAllSharedMatches);
  }, [player1Id, player2Id]);

  const filteredMatches = useMemo(() => {
    if (period === "all") return allSharedMatches;
    return allSharedMatches.filter((m) => m.createdAt >= currentRange.start && m.createdAt < currentRange.end);
  }, [allSharedMatches, period, currentRange]);

  const p1Stats = useMemo(
    () => (player1Id ? computeH2HStats(player1Id, filteredMatches) : null),
    [player1Id, filteredMatches]
  );
  const p2Stats = useMemo(
    () => (player2Id ? computeH2HStats(player2Id, filteredMatches) : null),
    [player2Id, filteredMatches]
  );

  const getPlayer = (id: string): Player | undefined =>
    players.find((p) => p.id === id);

  const getColorIndex = (id: string): number => {
    const idx = players.findIndex((p) => p.id === id);
    return idx >= 0 ? idx % PLAYER_COLORS.length : 0;
  };

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="skeleton h-10 w-48 mx-auto" />
            <div className="skeleton h-14 w-full rounded-2xl" />
            <div className="skeleton h-14 w-full rounded-2xl" />
            <div className="skeleton h-48 w-full rounded-2xl" />
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  const p1 = player1Id ? getPlayer(player1Id) : undefined;
  const p2 = player2Id ? getPlayer(player2Id) : undefined;
  const hasSelection = player1Id && player2Id && player1Id !== player2Id;
  const totalMatches = filteredMatches.length;
  const totalBar = Math.max((p1Stats?.wins ?? 0) + (p2Stats?.wins ?? 0), 1);

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
              <div className="w-10 h-10 rounded-xl bg-neon-red/10 flex items-center justify-center">
                <Swords size={22} className="text-neon-red" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Head-to-Head
              </h1>
            </div>
            <p className="text-muted text-sm">
              Porównanie bezpośrednie graczy
            </p>
          </motion.div>

          {/* Player Selectors */}
          <motion.div variants={item} className="space-y-3">
            {/* Player 1 Select */}
            <div className="relative">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
                Gracz 1
              </label>
              <div className="relative">
                <select
                  value={player1Id}
                  onChange={(e) => setPlayer1Id(e.target.value)}
                  className="w-full appearance-none glass rounded-2xl px-4 py-3.5 pr-10 text-sm font-medium text-foreground bg-transparent border border-white/10 focus:border-neon-green/40 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="" className="bg-card text-muted">
                    Wybierz gracza...
                  </option>
                  {players
                    .filter((p) => p.id !== player2Id)
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-card text-foreground">
                        {p.displayName}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
              </div>
            </div>

            {/* VS Divider */}
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-surface-light flex items-center justify-center border border-white/10">
                <span className="text-xs font-bold text-muted">VS</span>
              </div>
            </div>

            {/* Player 2 Select */}
            <div className="relative">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5 px-1">
                Gracz 2
              </label>
              <div className="relative">
                <select
                  value={player2Id}
                  onChange={(e) => setPlayer2Id(e.target.value)}
                  className="w-full appearance-none glass rounded-2xl px-4 py-3.5 pr-10 text-sm font-medium text-foreground bg-transparent border border-white/10 focus:border-neon-red/40 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="" className="bg-card text-muted">
                    Wybierz gracza...
                  </option>
                  {players
                    .filter((p) => p.id !== player1Id)
                    .map((p) => (
                      <option key={p.id} value={p.id} className="bg-card text-foreground">
                        {p.displayName}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
              </div>
            </div>
          </motion.div>

          {/* Time Period Filter */}
          {hasSelection && (
            <motion.div variants={item} className="space-y-2">
              <div className="flex gap-1 p-1 glass rounded-2xl">
                {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setOffset(0); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                      period === p
                        ? "bg-neon-green/15 text-neon-green border border-neon-green/30"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>

              {period !== "all" && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setOffset(offset - 1)}
                    className="w-9 h-9 rounded-xl glass flex items-center justify-center hover:bg-surface-light transition-all"
                  >
                    <ChevronLeft size={18} className="text-muted" />
                  </button>
                  <span className="text-sm font-medium text-foreground min-w-[160px] text-center">
                    {currentRange.label}
                  </span>
                  <button
                    onClick={() => setOffset(offset + 1)}
                    disabled={offset >= 0}
                    className="w-9 h-9 rounded-xl glass flex items-center justify-center hover:bg-surface-light transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} className="text-muted" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* H2H Result */}
          {hasSelection && (
            <>
              {totalMatches === 0 ? (
                <motion.div
                  variants={item}
                  className="glass rounded-2xl p-8 text-center"
                >
                  <Swords size={36} className="text-muted mx-auto mb-3 opacity-40" />
                  <p className="text-muted text-sm">
                    Brak meczów między tymi graczami
                    {period !== "all" && " w wybranym okresie"}
                  </p>
                </motion.div>
              ) : p1Stats && p2Stats ? (
                <motion.div variants={item} className="space-y-4">
                  {/* VS Display with Wins */}
                  <div className="glass rounded-2xl p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      {/* Player 1 */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <PlayerAvatar
                          avatarUrl={p1?.avatarUrl}
                          displayName={p1?.displayName ?? "?"}
                          colorIndex={getColorIndex(player1Id)}
                          size="lg"
                        />
                        <span className="text-sm font-semibold text-foreground text-center truncate max-w-[100px]">
                          {p1?.displayName}
                        </span>
                        <span className="text-3xl font-bold font-mono text-neon-green">
                          {p1Stats.wins}
                        </span>
                      </div>

                      {/* VS */}
                      <div className="flex flex-col items-center gap-1 px-3">
                        <div className="w-12 h-12 rounded-full bg-surface-light border border-white/10 flex items-center justify-center">
                          <Swords size={20} className="text-muted" />
                        </div>
                        <span className="text-xs font-bold text-muted uppercase">
                          VS
                        </span>
                      </div>

                      {/* Player 2 */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <PlayerAvatar
                          avatarUrl={p2?.avatarUrl}
                          displayName={p2?.displayName ?? "?"}
                          colorIndex={getColorIndex(player2Id)}
                          size="lg"
                        />
                        <span className="text-sm font-semibold text-foreground text-center truncate max-w-[100px]">
                          {p2?.displayName}
                        </span>
                        <span className="text-3xl font-bold font-mono text-neon-red">
                          {p2Stats.wins}
                        </span>
                      </div>
                    </div>

                    {/* Win Bar */}
                    <div className="space-y-2">
                      <div className="h-3 rounded-full bg-surface-light overflow-hidden flex">
                        <motion.div
                          className="h-full bg-gradient-to-r from-neon-green to-emerald-400 rounded-l-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(p1Stats.wins / totalBar) * 100}%`,
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" as const, delay: 0.3 }}
                        />
                        <motion.div
                          className="h-full bg-gradient-to-r from-rose-400 to-neon-red rounded-r-full"
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(p2Stats.wins / totalBar) * 100}%`,
                          }}
                          transition={{ duration: 0.8, ease: "easeOut" as const, delay: 0.3 }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted font-mono">
                        <span>{((p1Stats.wins / totalBar) * 100).toFixed(0)}%</span>
                        <span>{((p2Stats.wins / totalBar) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Stats Comparison */}
                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wider text-center">
                        Statystyki ze wspólnych meczów ({totalMatches})
                      </p>
                    </div>
                    <div className="divide-y divide-white/5">
                      <StatRow
                        label="Średnia 3 rzuty"
                        v1={calculateThreeDartAvg(p1Stats.pointsScored, p1Stats.dartsThrown).toFixed(1)}
                        v2={calculateThreeDartAvg(p2Stats.pointsScored, p2Stats.dartsThrown).toFixed(1)}
                        better={
                          calculateThreeDartAvg(p1Stats.pointsScored, p1Stats.dartsThrown) >
                          calculateThreeDartAvg(p2Stats.pointsScored, p2Stats.dartsThrown)
                            ? 1
                            : calculateThreeDartAvg(p1Stats.pointsScored, p1Stats.dartsThrown) <
                              calculateThreeDartAvg(p2Stats.pointsScored, p2Stats.dartsThrown)
                            ? 2
                            : 0
                        }
                      />
                      <StatRow
                        label="Checkout %"
                        v1={calculateCheckoutPercentage(p1Stats.doublesHit, p1Stats.doublesAttempted).toFixed(0) + "%"}
                        v2={calculateCheckoutPercentage(p2Stats.doublesHit, p2Stats.doublesAttempted).toFixed(0) + "%"}
                        better={
                          calculateCheckoutPercentage(p1Stats.doublesHit, p1Stats.doublesAttempted) >
                          calculateCheckoutPercentage(p2Stats.doublesHit, p2Stats.doublesAttempted)
                            ? 1
                            : calculateCheckoutPercentage(p1Stats.doublesHit, p1Stats.doublesAttempted) <
                              calculateCheckoutPercentage(p2Stats.doublesHit, p2Stats.doublesAttempted)
                            ? 2
                            : 0
                        }
                      />
                      <StatRow
                        label="180s"
                        v1={String(p1Stats.oneEighties)}
                        v2={String(p2Stats.oneEighties)}
                        better={p1Stats.oneEighties > p2Stats.oneEighties ? 1 : p1Stats.oneEighties < p2Stats.oneEighties ? 2 : 0}
                      />
                      <StatRow
                        label="100+"
                        v1={String(p1Stats.tonPlus + p1Stats.oneEighties)}
                        v2={String(p2Stats.tonPlus + p2Stats.oneEighties)}
                        better={
                          p1Stats.tonPlus + p1Stats.oneEighties > p2Stats.tonPlus + p2Stats.oneEighties
                            ? 1
                            : p1Stats.tonPlus + p1Stats.oneEighties < p2Stats.tonPlus + p2Stats.oneEighties
                            ? 2
                            : 0
                        }
                      />
                      <StatRow
                        label="Rzuty łącznie"
                        v1={String(p1Stats.dartsThrown)}
                        v2={String(p2Stats.dartsThrown)}
                        better={p1Stats.dartsThrown < p2Stats.dartsThrown ? 1 : p1Stats.dartsThrown > p2Stats.dartsThrown ? 2 : 0}
                      />
                      <StatRow
                        label="Najlepsza średnia"
                        v1={p1Stats.bestAvg.toFixed(1)}
                        v2={p2Stats.bestAvg.toFixed(1)}
                        better={p1Stats.bestAvg > p2Stats.bestAvg ? 1 : p1Stats.bestAvg < p2Stats.bestAvg ? 2 : 0}
                      />
                    </div>
                  </div>

                  {/* Summary card */}
                  <div className="glass rounded-2xl p-4 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Target size={10} className="text-muted" />
                      <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                        Razem meczów
                      </p>
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">
                      {totalMatches}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}

function StatRow({
  label,
  v1,
  v2,
  better,
}: {
  label: string;
  v1: string;
  v2: string;
  better: 0 | 1 | 2;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
      <span
        className={`font-mono text-sm text-right pr-3 ${
          better === 1 ? "text-neon-green font-bold" : "text-foreground"
        }`}
      >
        {v1}
      </span>
      <span className="text-[10px] text-muted uppercase tracking-wider font-semibold text-center min-w-[80px]">
        {label}
      </span>
      <span
        className={`font-mono text-sm pl-3 ${
          better === 2 ? "text-neon-red font-bold" : "text-foreground"
        }`}
      >
        {v2}
      </span>
    </div>
  );
}
