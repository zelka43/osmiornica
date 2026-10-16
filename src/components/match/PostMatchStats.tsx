"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Trophy, Target, Zap, Shuffle } from "lucide-react";
import { calculateThreeDartAvg, calculateCheckoutPercentage } from "@/lib/statsCalculator";
import type { Match } from "@/types";
import { PLAYER_COLORS } from "@/types";

interface PostMatchStatsProps {
  match: Match;
  allPlayerIds?: string[];
  onClose?: () => void;
  onRematch?: () => void;
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function PostMatchStats({ match, allPlayerIds, onClose, onRematch }: PostMatchStatsProps) {
  const playerStats = useMemo(() => {
    return match.playerIds.map((playerId, idx) => {
      const state = match.scores[playerId];
      if (!state) return null;

      const threeDartAvg = calculateThreeDartAvg(state.pointsScored, state.dartsThrown);
      const checkoutPct = calculateCheckoutPercentage(state.doublesHit, state.doublesAttempted);

      // Find highest turn from match turns
      const playerTurns = match.turns.filter((t) => t.playerId === playerId && !t.isBust);
      const highestTurn = playerTurns.reduce((max, t) => Math.max(max, t.turnTotal), 0);

      // First 9 darts average (first 3 turns)
      const first3Turns = match.turns.filter((t) => t.playerId === playerId).slice(0, 3);
      const first9Points = first3Turns.reduce((sum, t) => sum + (t.isBust ? 0 : t.turnTotal), 0);
      // Tryb szybki nie zapisuje lotek — tura to 3 lotki
      const first9Darts = first3Turns.reduce((sum, t) => sum + (t.darts.length > 0 ? t.darts.length : 3), 0);
      const first9Avg = first9Darts > 0 ? (first9Points / first9Darts) * 3 : 0;

      const colorIdx = allPlayerIds
        ? allPlayerIds.indexOf(playerId) % PLAYER_COLORS.length
        : idx % PLAYER_COLORS.length;

      return {
        playerId,
        name: match.playerNames[idx],
        isWinner: match.winnerId === playerId,
        remaining: state.remaining,
        dartsThrown: state.dartsThrown,
        pointsScored: state.pointsScored,
        threeDartAvg,
        checkoutPct,
        doublesAttempted: state.doublesAttempted,
        doublesHit: state.doublesHit,
        oneEighties: state.oneEighties,
        tonPlus: state.tonPlus,
        highestTurn,
        first9Avg,
        colorIdx,
      };
    }).filter(Boolean);
  }, [match, allPlayerIds]);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={item} className="text-center">
        <h3 className="text-lg font-bold text-foreground mb-1">Statystyki meczu</h3>
        <p className="text-xs text-muted">{match.gameMode} · {match.playerNames.join(" vs ")}</p>
      </motion.div>

      {/* Player Cards */}
      {playerStats.map((ps) => {
        if (!ps) return null;
        return (
          <motion.div
            key={ps.playerId}
            variants={item}
            className={`rounded-2xl p-4 space-y-3 ${
              ps.isWinner
                ? "bg-accent/[0.06] border border-accent-ink/20"
                : "glass border border-foreground/5"
            }`}
          >
            {/* Player Name */}
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg ${PLAYER_COLORS[ps.colorIdx]} flex items-center justify-center`}
              >
                <span className="text-xs font-bold text-white">
                  {ps.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className={`text-sm font-bold ${ps.isWinner ? "text-accent-ink" : "text-foreground"}`}>
                {ps.name}
              </span>
              {ps.isWinner && <Trophy size={16} className="text-warn-ink" />}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Średnia" value={ps.threeDartAvg.toFixed(1)} color="text-info-ink" />
              <StatCell label="Pierwsze 9" value={ps.first9Avg.toFixed(1)} color="text-info-ink" />
              <StatCell label="Rzuty" value={`${ps.dartsThrown}`} color="text-foreground" />
              <StatCell label="Checkout%" value={`${ps.checkoutPct.toFixed(0)}%`} color="text-extra-ink" />
              <StatCell
                label="Double"
                value={`${ps.doublesHit}/${ps.doublesAttempted}`}
                color="text-extra-ink"
              />
              <StatCell label="Najw. tura" value={`${ps.highestTurn}`} color="text-warn-ink" />
              <StatCell label="180s" value={`${ps.oneEighties}`} color="text-warn-ink" icon={<Zap size={12} />} />
              <StatCell label="100+" value={`${ps.tonPlus}`} color="text-accent-ink" icon={<Target size={12} />} />
              <StatCell label="Pozostało" value={`${ps.remaining}`} color={ps.isWinner ? "text-accent-ink" : "text-danger-ink"} />
            </div>
          </motion.div>
        );
      })}

      {/* Buttons */}
      {onClose && (
        <motion.div variants={item} className="flex gap-2">
          {onRematch && (
            <button
              onClick={onRematch}
              className="flex-1 rounded-2xl p-4 glass border border-info-ink/30 text-info-ink font-bold hover:bg-info/10 transition-all flex items-center justify-center gap-2"
            >
              <Shuffle size={16} />
              Rewanż
            </button>
          )}
          <button
            onClick={onClose}
            className={`${onRematch ? "flex-1" : "w-full"} rounded-2xl p-4 bg-accent text-on-accent font-bold glow-green hover:bg-accent-dim transition-all`}
          >
            Zamknij
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

function StatCell({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface/50 rounded-xl p-2 text-center">
      <div className={`font-mono text-sm font-bold ${color} flex items-center justify-center gap-1`}>
        {icon}
        {value}
      </div>
      <div className="text-[9px] text-muted mt-0.5">{label}</div>
    </div>
  );
}
