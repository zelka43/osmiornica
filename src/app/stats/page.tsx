"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Award, ChevronLeft, ChevronRight } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { getPlayers, getMatches, getAppSetting } from "@/lib/store";
import {
  calculateThreeDartAvg,
  calculateCheckoutPercentage,
  calculateStatsForRange,
  getPeriodRange,
  type TimePeriod,
} from "@/lib/statsCalculator";
import type { Player, Match, PlayerStats } from "@/types";
import { PLAYER_COLORS } from "@/types";

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

const PERIOD_LABELS: Record<TimePeriod, string> = {
  all: "Wszystko",
  yearly: "Rok",
  monthly: "Miesiąc",
  weekly: "Tydzień",
  daily: "Dzień",
};

interface RankedPlayer {
  player: Player;
  stats: PlayerStats;
  winPct: number;
  threeDartAvg: number;
  checkoutPct: number;
  colorIndex: number;
  points: number;
  rating: number;
}

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>("all");
  const [offset, setOffset] = useState(0);
  const [rankingMode, setRankingMode] = useState<"winpct" | "points" | "rating">("winpct");

  useEffect(() => {
    async function load() {
      const [p, m, savedMode] = await Promise.all([getPlayers(), getMatches(), getAppSetting("ranking_mode")]);
      setPlayers(p);
      setMatches(m);
      if (savedMode === "points" || savedMode === "winpct" || savedMode === "rating") {
        setRankingMode(savedMode);
      }
      setMounted(true);
    }
    load();
  }, []);

  const currentRange = useMemo(() => getPeriodRange(period, offset), [period, offset]);

  const ranked: RankedPlayer[] = useMemo(() => {
    return players
      .map((player) => {
        const stats =
          period === "all" && offset === 0
            ? player.stats
            : calculateStatsForRange(player.id, matches, currentRange);

        if (stats.matchesPlayed === 0) return null;

        const winPct = (stats.matchesWon / stats.matchesPlayed) * 100;
        const threeDartAvg = calculateThreeDartAvg(
          stats.totalPointsScored,
          stats.totalDartsThrown
        );
        const checkoutPct = calculateCheckoutPercentage(
          stats.doublesHit,
          stats.doublesAttempted
        );
        const colorIndex =
          players.findIndex((p) => p.id === player.id) %
          PLAYER_COLORS.length;

        const periodMatches = matches.filter(
          (m) =>
            m.status === "completed" &&
            m.playerIds.includes(player.id) &&
            m.createdAt >= currentRange.start &&
            m.createdAt < currentRange.end
        );

        // Mode 2: Points = total defeated players × win rate
        const playersDefeated = periodMatches
          .filter((m) => m.winnerId === player.id)
          .reduce((sum, m) => sum + m.playerIds.length - 1, 0);
        const points = playersDefeated * (winPct / 100);

        // Mode 3: Rating = actual wins / expected wins (Σ 1/n per match)
        const actualWins = periodMatches.filter((m) => m.winnerId === player.id).length;
        const expectedWins = periodMatches.reduce((sum, m) => sum + 1 / m.playerIds.length, 0);
        const rating = expectedWins > 0 ? actualWins / expectedWins : 0;

        return { player, stats, winPct, threeDartAvg, checkoutPct, colorIndex, points, rating };
      })
      .filter((r): r is RankedPlayer => r !== null)
      .sort((a, b) => {
        if (rankingMode === "points") {
          if (b.points !== a.points) return b.points - a.points;
          return b.threeDartAvg - a.threeDartAvg;
        }
        if (rankingMode === "rating") {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.threeDartAvg - a.threeDartAvg;
        }
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return b.threeDartAvg - a.threeDartAvg;
      });
  }, [players, matches, period, offset, currentRange, rankingMode]);

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="skeleton h-10 w-48 mx-auto" />
            <div className="skeleton h-8 w-full rounded-2xl" />
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  const completedMatches = matches.filter((m) => m.status === "completed");
  const hasData = players.length > 0 && completedMatches.length > 0;

  const handlePeriodChange = (p: TimePeriod) => {
    setPeriod(p);
    setOffset(0);
  };

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
              <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center">
                <BarChart3 size={22} className="text-neon-blue" />
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Statystyki
              </h1>
            </div>
            <p className="text-muted text-sm">
              Ranking i statystyki graczy
            </p>
          </motion.div>

          {/* Time Period Filter */}
          <motion.div variants={item} className="space-y-2">
            <div className="flex gap-1 p-1 glass rounded-2xl">
              {(Object.keys(PERIOD_LABELS) as TimePeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    period === p
                      ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/30"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>

            {/* Period navigation arrows */}
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

          {/* Empty State */}
          {(!hasData || ranked.length === 0) && (
            <motion.div
              variants={item}
              className="glass rounded-2xl p-10 text-center"
            >
              <TrendingUp
                size={40}
                className="text-muted mx-auto mb-4 opacity-50"
              />
              <p className="text-muted text-sm">
                Brak danych do wyświetlenia.
                <br />
                {period !== "all"
                  ? "Brak meczów w wybranym okresie."
                  : "Rozegraj pierwszy mecz, aby zobaczyć statystyki!"}
              </p>
            </motion.div>
          )}

          {/* Ranking Table */}
          {ranked.length > 0 && (
            <>
              {/* Table Header */}
              <motion.div variants={item}>
                <div className="overflow-x-auto -mx-4 px-4">
                <div className="glass rounded-2xl overflow-hidden min-w-[600px]">
                  <div className="grid grid-cols-[2rem_6rem_2.5rem_2.5rem_3rem_3.5rem_3rem_2.5rem] gap-1 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted border-b border-white/5">
                    <span className="text-center">#</span>
                    <span>Gracz</span>
                    <span className="text-center">M</span>
                    <span className="text-center">W</span>
                    <span className="text-center">{rankingMode === "points" ? "Pkt" : rankingMode === "rating" ? "Rtg" : "Win%"}</span>
                    <span className="text-center">Avg</span>
                    <span className="text-center">CO%</span>
                    <span className="text-center">100+</span>
                  </div>

                  {/* Table Rows */}
                  {ranked.map((r, idx) => {
                    const isTop = idx === 0;
                    return (
                      <motion.div
                        key={r.player.id}
                        variants={item}
                        className={`grid grid-cols-[2rem_6rem_2.5rem_2.5rem_3rem_3.5rem_3rem_2.5rem] gap-1 items-center px-3 py-3 transition-colors ${
                          isTop
                            ? "bg-neon-green/[0.04] glow-green"
                            : "hover:bg-white/[0.02]"
                        } ${
                          idx < ranked.length - 1
                            ? "border-b border-white/5"
                            : ""
                        }`}
                      >
                        {/* Position */}
                        <span
                          className={`text-center font-mono font-bold text-sm ${
                            isTop ? "text-neon-green" : "text-muted"
                          }`}
                        >
                          {idx + 1}
                        </span>

                        {/* Avatar + Name */}
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar
                            avatarUrl={r.player.avatarUrl}
                            displayName={r.player.displayName}
                            colorIndex={r.colorIndex}
                            size="sm"
                          />
                          <span
                            className={`text-sm font-medium truncate ${
                              isTop ? "text-neon-green" : "text-foreground"
                            }`}
                          >
                            {r.player.displayName}
                          </span>
                          {isTop && (
                            <Award
                              size={14}
                              className="text-neon-yellow shrink-0"
                            />
                          )}
                        </div>

                        {/* Matches Played */}
                        <span className="text-center font-mono text-sm text-muted">
                          {r.stats.matchesPlayed}
                        </span>

                        {/* Wins */}
                        <span className="text-center font-mono text-sm text-foreground">
                          {r.stats.matchesWon}
                        </span>

                        {/* Win % or Points */}
                        <span
                          className={`text-center font-mono text-sm font-semibold ${
                            isTop ? "text-neon-green" : "text-foreground"
                          }`}
                        >
                          {rankingMode === "points"
                            ? r.points.toFixed(1)
                            : rankingMode === "rating"
                            ? r.rating.toFixed(2)
                            : r.winPct.toFixed(0)}
                        </span>

                        {/* 3-dart avg */}
                        <span className="text-center font-mono text-sm text-neon-blue">
                          {r.threeDartAvg.toFixed(1)}
                        </span>

                        {/* Checkout % */}
                        <span className="text-center font-mono text-sm text-neon-purple">
                          {r.checkoutPct.toFixed(1)}
                        </span>

                        {/* 180s */}
                        <span className="text-center font-mono text-sm text-neon-yellow">
                          {r.stats.tonPlus + r.stats.oneEighties}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
                </div>
              </motion.div>

              {/* Legend */}
              <motion.div
                variants={item}
                className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted px-2"
              >
                <span>M = Mecze</span>
                <span>W = Wygrane</span>
                <span>Win% = Procent wygranych</span>
                <span>Avg = Średnia z 3 rzutów</span>
                <span>CO% = Checkout %</span>
                <span>100+ = Wyniki ≥100</span>
              </motion.div>
            </>
          )}
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
