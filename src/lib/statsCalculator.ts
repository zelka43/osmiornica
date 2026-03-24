import type { PlayerStats, PlayerMatchState, Match } from "@/types";

export type TimePeriod = "all" | "yearly" | "monthly" | "weekly" | "daily";

export interface PeriodRange {
  label: string;
  start: number;
  end: number;
}

const MONTH_NAMES_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

export function getPeriodRange(period: TimePeriod, offset: number): PeriodRange {
  const now = new Date();

  if (period === "all") {
    return { label: "Wszystko", start: 0, end: Date.now() + 86400000 };
  }

  if (period === "yearly") {
    const year = now.getFullYear() + offset;
    return {
      label: `${year}`,
      start: new Date(year, 0, 1).getTime(),
      end: new Date(year + 1, 0, 1).getTime(),
    };
  }

  if (period === "monthly") {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return {
      label: `${MONTH_NAMES_PL[d.getMonth()]} ${d.getFullYear()}`,
      start: d.getTime(),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
    };
  }

  if (period === "daily") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {
      label: d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }),
      start: d.getTime(),
      end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(),
    };
  }

  // weekly
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const fmtDay = (d: Date) =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  const endDay = new Date(sunday.getTime() - 1);

  return {
    label: `${fmtDay(monday)} – ${fmtDay(endDay)} ${endDay.getFullYear()}`,
    start: monday.getTime(),
    end: sunday.getTime(),
  };
}

// Keep old API for backward compat (H2H page uses it)
export function getTimePeriodStart(period: "all" | "monthly" | "weekly" | "daily"): number {
  if (period === "all") return 0;
  const now = new Date();
  switch (period) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case "weekly": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
    }
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
}

export function calculateStatsForRange(
  playerId: string,
  matches: Match[],
  range: PeriodRange
): PlayerStats {
  const filtered = matches.filter(
    (m) =>
      m.status === "completed" &&
      m.playerIds.includes(playerId) &&
      m.createdAt >= range.start &&
      m.createdAt < range.end
  );

  const stats: PlayerStats = {
    matchesPlayed: 0,
    matchesWon: 0,
    totalDartsThrown: 0,
    totalPointsScored: 0,
    oneEighties: 0,
    tonPlus: 0,
    highestCheckout: 0,
    doublesAttempted: 0,
    doublesHit: 0,
    bestThreeDartAvg: 0,
  };

  for (const m of filtered) {
    const state = m.scores[playerId];
    if (!state) continue;

    stats.matchesPlayed++;
    if (m.winnerId === playerId) stats.matchesWon++;
    stats.totalDartsThrown += state.dartsThrown;
    stats.totalPointsScored += state.pointsScored;
    stats.oneEighties += state.oneEighties;
    stats.tonPlus += state.tonPlus;
    stats.doublesAttempted += state.doublesAttempted;
    stats.doublesHit += state.doublesHit;

    const matchAvg = calculateThreeDartAvg(state.pointsScored, state.dartsThrown);
    if (matchAvg > stats.bestThreeDartAvg) stats.bestThreeDartAvg = matchAvg;
  }

  return stats;
}

// Old API kept for H2H page compatibility
export function calculateStatsFromMatches(
  playerId: string,
  matches: Match[],
  period: "all" | "monthly" | "weekly" | "daily"
): PlayerStats {
  const periodStart = getTimePeriodStart(period);
  return calculateStatsForRange(playerId, matches, {
    label: "",
    start: periodStart,
    end: Date.now() + 86400000,
  });
}

export function calculateThreeDartAvg(
  pointsScored: number,
  dartsThrown: number
): number {
  if (dartsThrown === 0) return 0;
  return (pointsScored / dartsThrown) * 3;
}

export function calculateCheckoutPercentage(
  doublesHit: number,
  doublesAttempted: number
): number {
  if (doublesAttempted === 0) return 0;
  return (doublesHit / doublesAttempted) * 100;
}

export function updatePlayerStatsAfterMatch(
  currentStats: PlayerStats,
  matchState: PlayerMatchState,
  isWinner: boolean,
  matchDartsThrown: number
): PlayerStats {
  const matchAvg = calculateThreeDartAvg(
    matchState.pointsScored,
    matchDartsThrown
  );

  return {
    matchesPlayed: currentStats.matchesPlayed + 1,
    matchesWon: currentStats.matchesWon + (isWinner ? 1 : 0),
    totalDartsThrown: currentStats.totalDartsThrown + matchDartsThrown,
    totalPointsScored: currentStats.totalPointsScored + matchState.pointsScored,
    oneEighties: currentStats.oneEighties + matchState.oneEighties,
    tonPlus: currentStats.tonPlus + matchState.tonPlus,
    highestCheckout: isWinner
      ? Math.max(currentStats.highestCheckout, matchState.pointsScored > 0 ? matchState.remaining : 0)
      : currentStats.highestCheckout,
    doublesAttempted:
      currentStats.doublesAttempted + matchState.doublesAttempted,
    doublesHit: currentStats.doublesHit + matchState.doublesHit,
    bestThreeDartAvg: Math.max(currentStats.bestThreeDartAvg, matchAvg),
  };
}
