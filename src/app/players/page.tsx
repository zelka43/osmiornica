"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Trophy,
  Target,
  Zap,
  TrendingUp,
  Award,
  Flame,
  X,
  Crown,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/ui/NavBar";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import DartboardHeatmap from "@/components/ui/DartboardHeatmap";
import { getPlayers, getMatches, getAppSetting } from "@/lib/store";
import {
  calculateThreeDartAvg,
  calculateCheckoutPercentage,
  computeT20T19Count,
  computeFavoriteDouble,
  computeHighestCheckout,
  computeWinStreak,
  computeAvgFirst9Avg,
  computeBestFirst9Avg,
  computePeriodTitles,
  computeAchievementLeaders,
  type AchievementKey,
  type AchievementEntry,
} from "@/lib/statsCalculator";
import type { Player, Match } from "@/types";
import { PLAYER_COLORS } from "@/types";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

type RankingMode = "winpct" | "points" | "rating";

function computeRatingValue(player: Player, matches: Match[], mode: RankingMode): number {
  const s = player.stats;
  if (s.matchesPlayed === 0) return 0;
  const winPct = s.matchesWon / s.matchesPlayed;
  if (mode === "winpct") return winPct;
  const completed = matches.filter(
    (m) => m.status === "completed" && m.playerIds.includes(player.id)
  );
  if (mode === "points") {
    const defeated = completed
      .filter((m) => m.winnerId === player.id)
      .reduce((sum, m) => sum + m.playerIds.length - 1, 0);
    return defeated * winPct;
  }
  // rating: W/E[W]
  const wins = completed.filter((m) => m.winnerId === player.id).length;
  const expected = completed.reduce((sum, m) => sum + 1 / m.playerIds.length, 0);
  return expected > 0 ? wins / expected : 0;
}

const RING_BY_RANK: Record<number, string> = {
  1: "ring-4 ring-yellow-400 shadow-[0_0_20px_6px_rgba(250,204,21,0.55)]",
  2: "ring-4 ring-gray-300 shadow-[0_0_16px_4px_rgba(209,213,219,0.4)]",
  3: "ring-4 ring-amber-600 shadow-[0_0_14px_4px_rgba(217,119,6,0.4)]",
};

const ACHIEVEMENT_META: Record<AchievementKey, { label: string; icon: React.ElementType; color: string; unit?: string }> = {
  mostMatches:     { label: "Najwięcej meczów",    icon: Target,    color: "text-neon-blue",   unit: "" },
  mostWins:        { label: "Najwięcej zwycięstw",  icon: Trophy,    color: "text-neon-green",  unit: "" },
  mostTonPlus:     { label: "Najwięcej 100+",       icon: Zap,       color: "text-neon-yellow", unit: "" },
  most180s:        { label: "Najwięcej 180",        icon: Star,      color: "text-neon-yellow", unit: "" },
  mostT20T19:      { label: "Najwięcej T20/T19",    icon: Flame,     color: "text-neon-red",    unit: "" },
  longestStreak:   { label: "Najdłuższa seria",     icon: Crown,     color: "text-neon-purple", unit: "" },
  bestFirst9:      { label: "Najlepszy First 9",    icon: TrendingUp, color: "text-neon-blue",  unit: "" },
  bestAvg:         { label: "Najlepsza średnia",    icon: BarChart,  color: "text-neon-green",  unit: "" },
  bestCheckoutPct: { label: "Najlepszy CO%",        icon: Award,     color: "text-neon-purple", unit: "%" },
};

// Placeholder component used in ACHIEVEMENT_META (replaced below)
function BarChart(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const s = props.size ?? 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

interface ModalData {
  key: AchievementKey;
  entry: AchievementEntry;
  players: Player[];
}

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rankingMode, setRankingMode] = useState<RankingMode>("winpct");
  const [modal, setModal] = useState<ModalData | null>(null);
  const [openTrophyPanel, setOpenTrophyPanel] = useState<"weekly" | "monthly" | "yearly" | null>(null);

  useEffect(() => {
    async function load() {
      const [p, m, mode] = await Promise.all([getPlayers(), getMatches(), getAppSetting("ranking_mode")]);
      setPlayers(p);
      setMatches(m);
      if (mode === "points" || mode === "winpct" || mode === "rating") setRankingMode(mode);
      if (p.length > 0) setSelectedId(p[0].id);
      setMounted(true);
    }
    load();
  }, []);

  // Rank players by current ranking mode
  const rankedPlayers = useMemo(
    () =>
      [...players]
        .filter((p) => p.stats.matchesPlayed > 0)
        .sort((a, b) => {
          const primary = computeRatingValue(b, matches, rankingMode) - computeRatingValue(a, matches, rankingMode);
          if (primary !== 0) return primary;
          const avgA = a.stats.totalDartsThrown > 0 ? (a.stats.totalPointsScored / a.stats.totalDartsThrown) * 3 : 0;
          const avgB = b.stats.totalDartsThrown > 0 ? (b.stats.totalPointsScored / b.stats.totalDartsThrown) * 3 : 0;
          if (avgB !== avgA) return avgB - avgA;
          const coA = a.stats.doublesAttempted > 0 ? a.stats.doublesHit / a.stats.doublesAttempted : 0;
          const coB = b.stats.doublesAttempted > 0 ? b.stats.doublesHit / b.stats.doublesAttempted : 0;
          if (coB !== coA) return coB - coA;
          return (b.stats.tonPlus + b.stats.oneEighties) - (a.stats.tonPlus + a.stats.oneEighties);
        })
        .concat(players.filter((p) => p.stats.matchesPlayed === 0)),
    [players, matches, rankingMode]
  );

  const rankMap = useMemo(() => {
    const map: Record<string, number> = {};
    rankedPlayers.forEach((p, i) => { map[p.id] = i + 1; });
    return map;
  }, [rankedPlayers]);

  const selected = players.find((p) => p.id === selectedId) ?? null;
  const completedMatches = useMemo(() => matches.filter((m) => m.status === "completed"), [matches]);

  // Per-player advanced stats (memoised)
  const advancedStats = useMemo(() => {
    if (!selected) return null;
    const id = selected.id;
    const t20t19 = computeT20T19Count(completedMatches, id);
    const hasDetailedData = completedMatches.some(
      (m) => m.playerIds.includes(id) && m.turns.some((t) => t.playerId === id && t.darts.length > 0)
    );
    return {
      t20t19: hasDetailedData ? t20t19 : null,
      favoriteDouble: computeFavoriteDouble(completedMatches, id),
      highestCheckout: computeHighestCheckout(completedMatches, id),
      winStreak: computeWinStreak(completedMatches, id),
      avgFirst9: computeAvgFirst9Avg(completedMatches, id),
    };
  }, [selected, completedMatches]);

  const periodTitles = useMemo(() => {
    if (!selected) return null;
    return computePeriodTitles(completedMatches, selected.id, players.map((p) => p.id));
  }, [selected, completedMatches, players]);

  const achievementLeaders = useMemo(
    () => computeAchievementLeaders(completedMatches, players),
    [completedMatches, players]
  );

  const nemesisOfiara = useMemo(() => {
    if (!selected) return null;
    const id = selected.id;
    // Compute head-to-head directly from match history (more reliable than h2h_records table)
    const h2h: Record<string, { myWins: number; oppWins: number }> = {};
    for (const match of completedMatches) {
      if (!match.playerIds.includes(id) || !match.winnerId) continue;
      if (match.winnerId === id) {
        // Player won — count win against each other participant
        for (const oppId of match.playerIds) {
          if (oppId === id) continue;
          if (!h2h[oppId]) h2h[oppId] = { myWins: 0, oppWins: 0 };
          h2h[oppId].myWins++;
        }
      } else {
        // Player lost — count loss to the winner
        const oppId = match.winnerId;
        if (!h2h[oppId]) h2h[oppId] = { myWins: 0, oppWins: 0 };
        h2h[oppId].oppWins++;
      }
    }
    const entries = Object.entries(h2h).map(([oppId, s]) => ({ oppId, ...s }));
    if (entries.length === 0) return null;
    const nemesis = [...entries].sort((a, b) => b.oppWins - a.oppWins)[0];
    const ofiara  = [...entries].sort((a, b) => b.myWins  - a.myWins )[0];
    return {
      nemesis: { ...nemesis, player: players.find((p) => p.id === nemesis.oppId) ?? null },
      ofiara:  { ...ofiara,  player: players.find((p) => p.id === ofiara.oppId)  ?? null },
    };
  }, [selected, completedMatches, players]);

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="skeleton h-8 w-40 mx-auto" />
            <div className="skeleton h-28 w-full rounded-2xl" />
            <div className="skeleton h-48 w-full rounded-2xl" />
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <Target size={40} className="text-muted mb-3 opacity-50" />
          <p className="text-muted text-sm text-center">Brak graczy.<br />Dodaj graczy w ustawieniach.</p>
          <button
            onClick={() => router.push("/players/manage")}
            className="mt-4 px-4 py-2 rounded-xl bg-neon-green/10 text-neon-green text-sm font-medium"
          >
            Zarządzaj graczami
          </button>
        </main>
        <NavBar />
      </div>
    );
  }

  const colorIndex = selected ? players.findIndex((p) => p.id === selected.id) % PLAYER_COLORS.length : 0;
  const rank = selected ? (rankMap[selected.id] ?? null) : null;
  const ringClass = rank && rank <= 3 ? RING_BY_RANK[rank] : "";
  const avg = selected
    ? calculateThreeDartAvg(selected.stats.totalPointsScored, selected.stats.totalDartsThrown)
    : 0;
  const coPct = selected
    ? calculateCheckoutPercentage(selected.stats.doublesHit, selected.stats.doublesAttempted)
    : 0;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div variants={container} initial="hidden" animate="show" className="max-w-lg mx-auto space-y-5">

          {/* Header */}
          <motion.div variants={item} className="flex items-center justify-between pt-2">
            <h1 className="text-xl font-bold text-foreground">Karty graczy</h1>
            <button
              onClick={() => router.push("/players/manage")}
              className="w-9 h-9 rounded-xl glass flex items-center justify-center"
            >
              <Settings size={16} className="text-muted" />
            </button>
          </motion.div>

          {/* Player selector + avatar */}
          <motion.div variants={item} className="flex flex-col items-center gap-3">
            {/* Big avatar */}
            {selected && (
              <div className={`rounded-full ${ringClass}`}>
                <PlayerAvatar
                  avatarUrl={selected.avatarUrl}
                  displayName={selected.displayName}
                  colorIndex={colorIndex}
                  size="xl"
                />
              </div>
            )}

            {/* Rank badge */}
            {rank && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                rank === 1 ? "bg-yellow-400/15 text-yellow-400" :
                rank === 2 ? "bg-gray-300/15 text-gray-300" :
                rank === 3 ? "bg-amber-600/15 text-amber-500" :
                "bg-surface text-muted"
              }`}>
                #{rank} all-time
              </span>
            )}

            {/* Dropdown */}
            <div className="relative w-full max-w-xs">
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full appearance-none bg-surface border border-white/10 rounded-xl px-4 py-3 pr-8 text-sm text-foreground focus:outline-none focus:border-neon-green/30"
              >
                {players.map((p) => {
                  const r = rankMap[p.id];
                  const medal = r === 1 ? "🥇 " : r === 2 ? "🥈 " : r === 3 ? "🥉 " : "";
                  return (
                    <option key={p.id} value={p.id}>
                      {medal}{p.displayName}
                    </option>
                  );
                })}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">▼</span>
            </div>
          </motion.div>

          {/* ── SECTION 1+2: Stats ── */}
          {selected && (
            <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Mecze" value={selected.stats.matchesPlayed} />
                <StatTile label="Zwycięstwa" value={selected.stats.matchesWon} highlight />
                <StatTile label="Średnia" value={avg.toFixed(1)} />
                <StatTile label="CO%" value={coPct > 0 ? `${coPct.toFixed(1)}%` : "—"} />
                <StatTile label="100+" value={selected.stats.tonPlus + selected.stats.oneEighties} />
                <StatTile label="180" value={selected.stats.oneEighties} />
                <StatTile
                  label="T20+T19"
                  value={advancedStats?.t20t19 !== null && advancedStats?.t20t19 !== undefined ? advancedStats.t20t19 : "—"}
                />
                <StatTile
                  label="Rekord CO"
                  value={
                    advancedStats && advancedStats.highestCheckout.value > 0
                      ? `${advancedStats.highestCheckout.value}${advancedStats.highestCheckout.count > 1 ? ` (×${advancedStats.highestCheckout.count})` : ""}`
                      : "—"
                  }
                />
                <StatTile
                  label="Ulubiony D"
                  value={advancedStats?.favoriteDouble ?? "—"}
                />
                <StatTile
                  label="Najl. seria"
                  value={advancedStats?.winStreak ?? "—"}
                />
                <StatTile
                  label="First 9 avg"
                  value={advancedStats && advancedStats.avgFirst9 > 0 ? advancedStats.avgFirst9.toFixed(1) : "—"}
                />
                <StatTile
                  label="Najl. śr."
                  value={selected.stats.bestThreeDartAvg > 0 ? selected.stats.bestThreeDartAvg.toFixed(1) : "—"}
                />
              </div>
            </motion.div>
          )}

          {/* ── SECTION: Heatmapa rzutów ── */}
          {selected && (
            <motion.div variants={item} className="glass rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Heatmapa rzutów</p>
              <DartboardHeatmap matches={completedMatches} playerId={selected.id} />
            </motion.div>
          )}

          {/* ── SECTION: Nemesis / Ofiara ── */}
          {selected && nemesisOfiara && (
            <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Pojedynki</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💀</span>
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wide">Nemesis</p>
                      <p className="text-sm font-semibold text-foreground">{nemesisOfiara.nemesis.player?.displayName ?? "?"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-neon-red">
                    {nemesisOfiara.nemesis.myWins}W – {nemesisOfiara.nemesis.oppWins}L
                  </span>
                </div>
                <div className="border-t border-white/5" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎯</span>
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wide">Ofiara</p>
                      <p className="text-sm font-semibold text-foreground">{nemesisOfiara.ofiara.player?.displayName ?? "?"}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-neon-green">
                    {nemesisOfiara.ofiara.myWins}W – {nemesisOfiara.ofiara.oppWins}L
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* separator */}
          <div className="border-t border-white/5" />

          {/* ── SECTION 3: Period trophies ── */}
          {selected && periodTitles && (
            <motion.div variants={item} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted px-1">Tytuły okresowe</p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { key: "weekly"  as const, label: "Tygodnia",  medals: periodTitles.weekly  },
                    { key: "monthly" as const, label: "Miesiąca",  medals: periodTitles.monthly },
                    { key: "yearly"  as const, label: "Roku",      medals: periodTitles.yearly  },
                  ]
                ).map(({ key, label, medals }) => {
                  const hasAny = medals.gold > 0 || medals.silver > 0 || medals.bronze > 0;
                  const topColor = medals.gold > 0 ? "text-yellow-400" : medals.silver > 0 ? "text-gray-300" : medals.bronze > 0 ? "text-amber-600" : "text-muted";
                  const topCount = medals.gold > 0 ? medals.gold : medals.silver > 0 ? medals.silver : medals.bronze;
                  const isOpen = openTrophyPanel === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setOpenTrophyPanel(isOpen ? null : key)}
                      className={`glass rounded-2xl p-3 flex flex-col items-center gap-1 transition-all active:scale-95 ${!hasAny ? "opacity-30" : ""}`}
                    >
                      <Trophy size={28} className={topColor} />
                      <span className="text-[10px] text-muted leading-tight text-center">Gracz<br />{label}</span>
                      {hasAny && <span className={`text-xs font-bold ${topColor}`}>×{topCount}</span>}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {openTrophyPanel && periodTitles[openTrophyPanel] && (() => {
                  const medals = periodTitles[openTrophyPanel];
                  const label = openTrophyPanel === "weekly" ? "Tygodnia" : openTrophyPanel === "monthly" ? "Miesiąca" : "Roku";
                  return (
                    <motion.div
                      key={openTrophyPanel}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="glass rounded-2xl p-4 space-y-2">
                        <p className="text-xs font-semibold text-muted">Gracz {label} — wszystkie medale</p>
                        {medals.gold > 0 && (
                          <div className="flex items-center gap-2">
                            <Trophy size={16} className="text-yellow-400" />
                            <span className="text-xs text-foreground">Złote: <span className="font-bold text-yellow-400">×{medals.gold}</span></span>
                          </div>
                        )}
                        {medals.silver > 0 && (
                          <div className="flex items-center gap-2">
                            <Trophy size={16} className="text-gray-300" />
                            <span className="text-xs text-foreground">Srebrne: <span className="font-bold text-gray-300">×{medals.silver}</span></span>
                          </div>
                        )}
                        {medals.bronze > 0 && (
                          <div className="flex items-center gap-2">
                            <Trophy size={16} className="text-amber-600" />
                            <span className="text-xs text-foreground">Brązowe: <span className="font-bold text-amber-600">×{medals.bronze}</span></span>
                          </div>
                        )}
                        {medals.gold === 0 && medals.silver === 0 && medals.bronze === 0 && (
                          <p className="text-xs text-muted">Brak tytułów w tym okresie</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </motion.div>
          )}

          {/* separator */}
          <div className="border-t border-white/5" />

          {/* ── SECTION 4: Achievement trophies ── */}
          {selected && (
            <motion.div variants={item} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted px-1">Osiągnięcia</p>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(ACHIEVEMENT_META) as AchievementKey[]).map((key) => {
                  const meta = ACHIEVEMENT_META[key];
                  const entry = achievementLeaders[key];
                  const isLeader = entry.leaderId === selected.id;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setModal({ key, entry, players })}
                      className={`glass rounded-2xl p-3 flex flex-col items-center gap-1 transition-all active:scale-95 ${
                        !isLeader ? "opacity-30" : ""
                      }`}
                    >
                      <Icon
                        size={24}
                        className={isLeader ? meta.color : "text-muted"}
                      />
                      <span className="text-[10px] text-muted leading-tight text-center">{meta.label}</span>
                      {isLeader && (
                        <span className={`text-xs font-bold font-mono ${meta.color}`}>
                          {key === "bestFirst9" || key === "bestAvg"
                            ? entry.value.toFixed(1)
                            : key === "bestCheckoutPct"
                            ? `${entry.value.toFixed(1)}%`
                            : entry.value}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted text-center px-2">Kliknij w pucharak, aby zobaczyć pełne zestawienie</p>
            </motion.div>
          )}
        </motion.div>
      </main>

      <NavBar />

      {/* Achievement modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-5 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">
                  {ACHIEVEMENT_META[modal.key].label}
                </h3>
                <button onClick={() => setModal(null)} className="text-muted">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {modal.entry.allRanked
                  .filter((r) => r.value > 0)
                  .map((r, idx) => {
                    const p = modal.players.find((pl) => pl.id === r.playerId);
                    if (!p) return null;
                    const pColorIdx = modal.players.findIndex((pl) => pl.id === r.playerId) % PLAYER_COLORS.length;
                    const isFirst = idx === 0;
                    const key = modal.key;
                    const displayValue =
                      key === "bestFirst9" || key === "bestAvg"
                        ? r.value.toFixed(1)
                        : key === "bestCheckoutPct"
                        ? `${r.value.toFixed(1)}%`
                        : r.value.toString();
                    return (
                      <div
                        key={r.playerId}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                          isFirst ? "bg-neon-green/[0.06] border border-neon-green/20" : "bg-surface/50"
                        }`}
                      >
                        <span className="text-xs font-mono text-muted w-5 text-center">{idx + 1}</span>
                        <PlayerAvatar
                          avatarUrl={p.avatarUrl}
                          displayName={p.displayName}
                          colorIndex={pColorIdx}
                          size="sm"
                        />
                        <span className={`flex-1 text-sm font-medium truncate ${isFirst ? "text-neon-green" : "text-foreground"}`}>
                          {p.displayName}
                        </span>
                        <span className={`font-mono text-sm font-bold ${isFirst ? "text-neon-green" : "text-muted"}`}>
                          {displayValue}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-surface/60 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[10px] text-muted uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-lg font-bold ${highlight ? "text-neon-green" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
