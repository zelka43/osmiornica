import type { PlayerStats, PlayerMatchState, Match, Player } from "@/types";

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

// ─── Advanced per-player stats (computed from full match history) ───

/** T20 + T19 throws counted from darts array (detailed mode only) */
export function computeT20T19Count(matches: Match[], playerId: string): number {
  let count = 0;
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const t of m.turns) {
      if (t.playerId !== playerId || t.darts.length === 0) continue;
      for (const d of t.darts) {
        if (d.multiplier === 3 && (d.segment === 20 || d.segment === 19)) count++;
      }
    }
  }
  return count;
}

/** Most frequently hit finishing double (detailed mode only). Returns e.g. "D16", "Bull" or null */
export function computeFavoriteDouble(matches: Match[], playerId: string): string | null {
  const freq: Record<string, number> = {};
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const t of m.turns) {
      if (t.playerId !== playerId || t.darts.length === 0 || !t.isCheckout) continue;
      const lastDart = t.darts[t.darts.length - 1];
      if (lastDart.multiplier === 2 && lastDart.segment > 0) {
        const label = lastDart.segment === 25 ? "Bull" : `D${lastDart.segment}`;
        freq[label] = (freq[label] ?? 0) + 1;
      }
    }
  }
  const entries = Object.entries(freq);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

/** Highest checkout value + how many times achieved */
export function computeHighestCheckout(
  matches: Match[],
  playerId: string
): { value: number; count: number } {
  let highest = 0;
  let count = 0;
  for (const m of matches) {
    if (m.status !== "completed" || m.winnerId !== playerId) continue;
    const checkoutTurn = m.turns.find((t) => t.playerId === playerId && t.isCheckout);
    if (!checkoutTurn) continue;
    const val = checkoutTurn.turnTotal;
    if (val > highest) { highest = val; count = 1; }
    else if (val === highest) count++;
  }
  return { value: highest, count };
}

/** Longest all-time win streak */
export function computeWinStreak(matches: Match[], playerId: string): number {
  const completed = matches
    .filter((m) => m.status === "completed" && m.playerIds.includes(playerId))
    .sort((a, b) => a.createdAt - b.createdAt);
  let max = 0;
  let cur = 0;
  for (const m of completed) {
    if (m.winnerId === playerId) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

/** Average first-9 average across all matches (for stat tile) */
export function computeAvgFirst9Avg(matches: Match[], playerId: string): number {
  const avgs: number[] = [];
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const playerTurns = m.turns.filter((t) => t.playerId === playerId).slice(0, 3);
    if (playerTurns.length === 0) continue;
    const points = playerTurns.reduce((s, t) => s + (t.isBust ? 0 : t.turnTotal), 0);
    const darts = playerTurns.reduce((s, t) => s + (t.darts.length > 0 ? t.darts.length : 3), 0);
    if (darts > 0) avgs.push((points / darts) * 3);
  }
  if (avgs.length === 0) return 0;
  return avgs.reduce((s, v) => s + v, 0) / avgs.length;
}

/** Best first-9 average (first 3 turns) across all matches */
export function computeBestFirst9Avg(matches: Match[], playerId: string): number {
  let best = 0;
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const playerTurns = m.turns.filter((t) => t.playerId === playerId).slice(0, 3);
    if (playerTurns.length === 0) continue;
    const points = playerTurns.reduce((s, t) => s + (t.isBust ? 0 : t.turnTotal), 0);
    const darts = playerTurns.reduce((s, t) => s + (t.darts.length > 0 ? t.darts.length : 3), 0);
    const avg = darts > 0 ? (points / darts) * 3 : 0;
    if (avg > best) best = avg;
  }
  return best;
}

export interface PeriodMedals { gold: number; silver: number; bronze: number }

/** How many period titles (weekly/monthly/yearly) a player has won, split by medal level.
 *  A title is awarded for the best RTG (W/E[W]) in a completed period,
 *  subject to minimum match counts: weekly=5, monthly=10, yearly=20. */
export function computePeriodTitles(
  matches: Match[],
  playerId: string,
  allPlayerIds: string[]
): { weekly: PeriodMedals; monthly: PeriodMedals; yearly: PeriodMedals } {
  const empty: PeriodMedals = { gold: 0, silver: 0, bronze: 0 };
  const completed = matches.filter((m) => m.status === "completed");
  if (completed.length === 0) return { weekly: { ...empty }, monthly: { ...empty }, yearly: { ...empty } };

  const earliest = Math.min(...completed.map((m) => m.createdAt));
  const now = new Date();

  function rtgInRange(pid: string, start: number, end: number): { rtg: number; count: number } {
    const inRange = completed.filter((m) => m.playerIds.includes(pid) && m.createdAt >= start && m.createdAt < end);
    const count = inRange.length;
    if (count === 0) return { rtg: 0, count: 0 };
    const wins = inRange.filter((m) => m.winnerId === pid).length;
    const expected = inRange.reduce((s, m) => s + 1 / m.playerIds.length, 0);
    return { rtg: expected > 0 ? wins / expected : 0, count };
  }

  function getPeriodMedals(periods: { start: number; end: number }[], minMatches: number): PeriodMedals {
    let gold = 0, silver = 0, bronze = 0;
    for (const { start, end } of periods) {
      if (end > Date.now()) continue; // skip current/future period
      const ranked = allPlayerIds
        .map((pid) => ({ pid, ...rtgInRange(pid, start, end) }))
        .filter((r) => r.count >= minMatches)
        .sort((a, b) => b.rtg - a.rtg);
      const rank = ranked.findIndex((r) => r.pid === playerId) + 1;
      if (rank === 1) gold++;
      else if (rank === 2) silver++;
      else if (rank === 3) bronze++;
    }
    return { gold, silver, bronze };
  }

  // Build list of all past weeks (Mon–Sun)
  const weeks: { start: number; end: number }[] = [];
  const d = new Date(earliest);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < now.getTime()) {
    const start = d.getTime();
    d.setDate(d.getDate() + 7);
    weeks.push({ start, end: d.getTime() });
  }

  // Build list of all past months
  const months: { start: number; end: number }[] = [];
  const dm = new Date(new Date(earliest).getFullYear(), new Date(earliest).getMonth(), 1);
  while (dm.getTime() < now.getTime()) {
    const start = dm.getTime();
    dm.setMonth(dm.getMonth() + 1);
    months.push({ start, end: dm.getTime() });
  }

  // Build list of all past years
  const years: { start: number; end: number }[] = [];
  let yr = new Date(earliest).getFullYear();
  while (yr <= now.getFullYear()) {
    years.push({ start: new Date(yr, 0, 1).getTime(), end: new Date(yr + 1, 0, 1).getTime() });
    yr++;
  }

  return {
    weekly:  getPeriodMedals(weeks,  5),
    monthly: getPeriodMedals(months, 15),
    yearly:  getPeriodMedals(years,  50),
  };
}

export type AchievementKey =
  | "mostMatches"
  | "mostWins"
  | "mostTonPlus"
  | "most180s"
  | "mostT20T19"
  | "longestStreak"
  | "bestFirst9"
  | "bestAvg"
  | "bestCheckoutPct"
  | "most26s";

export interface AchievementEntry {
  leaderId: string | null;
  value: number;
  allRanked: { playerId: string; value: number }[];
}

/** Liczba tur gdzie turnTotal === 26 (nie bust) */
export function computeMost26Count(matches: Match[], playerId: string): number {
  let count = 0;
  for (const m of matches) {
    if (m.status !== "completed") continue;
    for (const t of m.turns) {
      if (t.playerId === playerId && t.turnTotal === 26 && !t.isBust) count++;
    }
  }
  return count;
}

/** Compute all-time achievement leaders */
export function computeAchievementLeaders(
  matches: Match[],
  players: Player[]
): Record<AchievementKey, AchievementEntry> {
  function makeEntry(values: { playerId: string; value: number }[], minThreshold = 1): AchievementEntry {
    const sorted = [...values].sort((a, b) => b.value - a.value);
    const top = sorted[0]?.value ?? 0;
    const leaderId = top >= minThreshold ? (sorted[0]?.playerId ?? null) : null;
    return { leaderId, value: top, allRanked: sorted };
  }

  const mostMatches = players.map((p) => ({ playerId: p.id, value: p.stats.matchesPlayed }));
  const mostWins = players.map((p) => ({ playerId: p.id, value: p.stats.matchesWon }));
  const mostTonPlus = players.map((p) => ({ playerId: p.id, value: p.stats.tonPlus + p.stats.oneEighties }));
  const most180s = players.map((p) => ({ playerId: p.id, value: p.stats.oneEighties }));
  const bestAvg = players.map((p) => ({ playerId: p.id, value: p.stats.bestThreeDartAvg }));
  const bestCheckoutPct = players.map((p) => ({
    playerId: p.id,
    value: p.stats.doublesAttempted > 0
      ? (p.stats.doublesHit / p.stats.doublesAttempted) * 100
      : 0,
  }));
  const mostT20T19 = players.map((p) => ({ playerId: p.id, value: computeT20T19Count(matches, p.id) }));
  const longestStreak = players.map((p) => ({ playerId: p.id, value: computeWinStreak(matches, p.id) }));
  const bestFirst9 = players.map((p) => ({ playerId: p.id, value: computeBestFirst9Avg(matches, p.id) }));
  const most26s = players.map((p) => ({ playerId: p.id, value: computeMost26Count(matches, p.id) }));

  return {
    mostMatches: makeEntry(mostMatches),
    mostWins: makeEntry(mostWins),
    mostTonPlus: makeEntry(mostTonPlus),
    most180s: makeEntry(most180s),
    mostT20T19: makeEntry(mostT20T19),
    longestStreak: makeEntry(longestStreak, 3),
    bestFirst9: makeEntry(bestFirst9),
    bestAvg: makeEntry(bestAvg),
    bestCheckoutPct: makeEntry(bestCheckoutPct),
    most26s: makeEntry(most26s),
  };
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
