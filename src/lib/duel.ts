import type { Match, Player } from "@/types";
import { compareTiebreak, type TieStats } from "@/lib/statsCalculator";

export interface DuelSummary {
  duelId: string;
  p1Id: string;
  p2Id: string;
  p1Name: string;
  p2Name: string;
  w1: number;
  w2: number;
  target: number;
  winnerId: string | null; // null = w toku
  lastActivity: number;
}

/** Grupuje legi pojedynków (matchType "duel") w serie wg duel_id. */
export function groupDuels(duelLegs: Match[]): DuelSummary[] {
  const byDuel = new Map<string, Match[]>();
  for (const leg of duelLegs) {
    if (!leg.duelId) continue;
    const list = byDuel.get(leg.duelId) ?? [];
    list.push(leg);
    byDuel.set(leg.duelId, list);
  }

  const out: DuelSummary[] = [];
  for (const [duelId, legs] of byDuel) {
    legs.sort((a, b) => a.createdAt - b.createdAt);
    const first = legs[0];
    const p1Id = first.playerIds[0];
    const p2Id = first.playerIds[1];
    if (!p1Id || !p2Id) continue;

    const wins: Record<string, number> = {};
    for (const leg of legs) {
      if (leg.status === "completed" && leg.winnerId) {
        wins[leg.winnerId] = (wins[leg.winnerId] ?? 0) + 1;
      }
    }
    const target = Math.max(...legs.map((l) => l.legsTarget ?? 1));
    const w1 = wins[p1Id] ?? 0;
    const w2 = wins[p2Id] ?? 0;
    const winnerId =
      w1 >= target ? p1Id : w2 >= target ? p2Id : null;

    out.push({
      duelId,
      p1Id,
      p2Id,
      p1Name: first.playerNames[0] ?? "?",
      p2Name: first.playerNames[1] ?? "?",
      w1,
      w2,
      target,
      winnerId,
      lastActivity: Math.max(...legs.map((l) => l.completedAt ?? l.createdAt)),
    });
  }
  return out.sort((a, b) => b.lastActivity - a.lastActivity);
}

export interface DuelTableRow {
  playerId: string;
  duelsWon: number;
  duelsPlayed: number;
  legsWon: number;
  legsLost: number;
  avg: number;
  doublesPct: number;
  tie: TieStats;
}

/** Agregaty z wszystkich pojedynków (osobny zamknięty tryb). */
export function computeDuelTable(
  players: Player[],
  matches: Match[]
): DuelTableRow[] {
  const duelLegs = matches.filter((m) => m.matchType === "duel");
  const summaries = groupDuels(duelLegs);

  interface Acc {
    duelsWon: number;
    duelsPlayed: number;
    legsWon: number;
    legsLost: number;
    darts: number;
    pts: number;
    dA: number;
    dH: number;
    tons: number;
    oneEighties: number;
  }
  const acc = new Map<string, Acc>();
  const ensure = (pid: string): Acc | undefined => {
    if (!players.some((p) => p.id === pid)) return undefined;
    let a = acc.get(pid);
    if (!a) {
      a = {
        duelsWon: 0,
        duelsPlayed: 0,
        legsWon: 0,
        legsLost: 0,
        darts: 0,
        pts: 0,
        dA: 0,
        dH: 0,
        tons: 0,
        oneEighties: 0,
      };
      acc.set(pid, a);
    }
    return a;
  };

  for (const s of summaries) {
    const a1 = ensure(s.p1Id);
    const a2 = ensure(s.p2Id);
    if (a1 && a2) {
      a1.duelsPlayed++;
      a2.duelsPlayed++;
      if (s.winnerId === s.p1Id) a1.duelsWon++;
      else if (s.winnerId === s.p2Id) a2.duelsWon++;
    }
  }

  for (const leg of duelLegs) {
    if (leg.status !== "completed") continue;
    for (const pid of leg.playerIds) {
      const a = ensure(pid);
      const st = leg.scores[pid];
      if (!a || !st) continue;
      if (leg.winnerId === pid) a.legsWon++;
      else a.legsLost++;
      a.darts += st.dartsThrown;
      a.pts += st.pointsScored;
      a.dA += st.doublesAttempted;
      a.dH += st.doublesHit;
      a.tons += st.tonPlus;
      a.oneEighties += st.oneEighties;
    }
  }

  return [...acc.entries()]
    .map(([playerId, a]): DuelTableRow => ({
      playerId,
      duelsWon: a.duelsWon,
      duelsPlayed: a.duelsPlayed,
      legsWon: a.legsWon,
      legsLost: a.legsLost,
      avg: a.darts > 0 ? (a.pts / a.darts) * 3 : 0,
      doublesPct: a.dA > 0 ? (a.dH / a.dA) * 100 : 0,
      tie: {
        matchesWon: a.duelsWon,
        totalPointsScored: a.pts,
        totalDartsThrown: a.darts,
        doublesHit: a.dH,
        doublesAttempted: a.dA,
        tonPlus: a.tons,
        oneEighties: a.oneEighties,
      },
    }))
    .sort(
      (x, y) =>
        y.duelsWon - x.duelsWon ||
        y.legsWon - x.legsWon ||
        compareTiebreak(x.tie, y.tie)
    );
}
