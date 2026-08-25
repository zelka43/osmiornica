import { v4 as uuidv4 } from "uuid";
import type { Match, Tournament, TournamentMatch } from "@/types";

/** Najmniejsza potęga 2 ≥ n. */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standardowa kolejność seedów dla drabinki rozmiaru `size` (potęga 2).
 *  Pozycje 2i / 2i+1 tworzą pary pierwszej rundy. np. 4 → [1,4,2,3], 8 → [1,8,4,5,2,7,3,6]. */
export function seedOrder(size: number): number[] {
  let arr = [1];
  while (arr.length < size) {
    const len = arr.length * 2;
    const next: number[] = [];
    for (const x of arr) {
      next.push(x);
      next.push(len + 1 - x);
    }
    arr = next;
  }
  return arr;
}

/** Buduje drabinkę single-elimination dla graczy w kolejności seedów (S1 = najlepszy).
 *  Byes (gdy N nie jest potęgą 2) trafiają do najwyższych seedów: ich węzeł round-0
 *  ma p2Id = null i od razu ustawiony winnerId (propagowany przez applyLegResult). */
export function generateBracket(seedOrderedPlayerIds: string[]): TournamentMatch[] {
  const n = seedOrderedPlayerIds.length;
  const size = nextPow2(n);
  const order = seedOrder(size);
  const playerForSeed = (seed: number): string | null =>
    seed <= n ? seedOrderedPlayerIds[seed - 1] : null;

  const rounds = Math.log2(size); // liczba rund
  const nodesByRound: TournamentMatch[][] = [];

  // Round 0 — pary z seedOrder
  const round0: TournamentMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    const p1Id = playerForSeed(order[2 * i]);
    const p2Id = playerForSeed(order[2 * i + 1]);
    // bye: dokładnie jedna strona pusta → zwycięzca z góry
    const winnerId = p1Id && !p2Id ? p1Id : !p1Id && p2Id ? p2Id : null;
    round0.push({
      id: uuidv4(),
      round: 0,
      slot: i,
      p1Id,
      p2Id,
      legMatchIds: [],
      winnerId,
      nextMatchId: null,
      nextSlot: null,
    });
  }
  nodesByRound.push(round0);

  // Kolejne rundy — puste węzły (pIds wypełniane przez propagację)
  for (let r = 1; r < rounds; r++) {
    const count = size / Math.pow(2, r + 1);
    const round: TournamentMatch[] = [];
    for (let j = 0; j < count; j++) {
      round.push({
        id: uuidv4(),
        round: r,
        slot: j,
        p1Id: null,
        p2Id: null,
        legMatchIds: [],
        winnerId: null,
        nextMatchId: null,
        nextSlot: null,
      });
    }
    nodesByRound.push(round);
  }

  // Połączenia nextMatchId / nextSlot
  for (let r = 0; r < rounds - 1; r++) {
    for (const node of nodesByRound[r]) {
      const child = nodesByRound[r + 1][Math.floor(node.slot / 2)];
      node.nextMatchId = child.id;
      node.nextSlot = node.slot % 2 === 0 ? 1 : 2;
    }
  }

  const bracket = nodesByRound.flat();
  return resolve(bracket, {}, 1).bracket;
}

/** Przelicza stan drabinki od zera na podstawie rozegranych legów (idempotentnie).
 *  Zwraca nowy obiekt Tournament. */
export function applyLegResult(tournament: Tournament, legMatches: Match[]): Tournament {
  const byId: Record<string, Match> = {};
  for (const m of legMatches) byId[m.id] = m;

  const { bracket, championId } = resolve(
    tournament.bracket,
    byId,
    tournament.legsToWin
  );

  const completed = championId !== null;
  return {
    ...tournament,
    bracket,
    championId,
    status: completed ? "completed" : "active",
    completedAt: completed ? tournament.completedAt ?? Date.now() : null,
  };
}

/** Czy w węźle można rozegrać kolejny leg (obaj gracze znani, brak rozstrzygnięcia). */
export function isPlayable(node: TournamentMatch): boolean {
  return !!node.p1Id && !!node.p2Id && node.winnerId === null;
}

// ─── wewnętrzne ───

/** Rdzeń: ascending po rundach — wypełnia pIds z rodziców, rozstrzyga z legów, propaguje. */
function resolve(
  source: TournamentMatch[],
  legMatchesById: Record<string, Match>,
  legsToWin: number
): { bracket: TournamentMatch[]; championId: string | null } {
  const bracket = source.map((n) => ({ ...n }));
  const byId: Record<string, TournamentMatch> = {};
  for (const n of bracket) byId[n.id] = n;

  const maxRound = Math.max(...bracket.map((n) => n.round));
  let championId: string | null = null;

  // Reset pól wyprowadzanych co przeliczenie. Bazą pozostają: seedy round-0 (pIds)
  // oraz winnerId węzłów bye (p2Id === null). legMatchIds zachowujemy wszędzie.
  for (const n of bracket) {
    if (n.round > 0) {
      n.p1Id = null;
      n.p2Id = null;
      n.winnerId = null;
    } else if (n.p1Id && n.p2Id) {
      n.winnerId = null; // realny mecz round-0 — przeliczany z legów
    }
  }

  for (let r = 0; r <= maxRound; r++) {
    for (const node of bracket.filter((n) => n.round === r)) {
      // Rozstrzygnięcie: bye (round 0) ma już winnerId; realny mecz liczymy z legów
      if (node.winnerId === null && node.p1Id && node.p2Id) {
        node.winnerId = decideWinner(node, legMatchesById, legsToWin);
      }
      // Propagacja zwycięzcy do dziecka
      if (node.winnerId && node.nextMatchId && node.nextSlot) {
        const child = byId[node.nextMatchId];
        if (node.nextSlot === 1) child.p1Id = node.winnerId;
        else child.p2Id = node.winnerId;
      }
      // Finał
      if (node.nextMatchId === null && node.winnerId) {
        championId = node.winnerId;
      }
    }
  }

  return { bracket, championId };
}

function decideWinner(
  node: TournamentMatch,
  legMatchesById: Record<string, Match>,
  legsToWin: number
): string | null {
  const wins: Record<string, number> = {};
  for (const id of node.legMatchIds) {
    const m = legMatchesById[id];
    if (m && m.status === "completed" && m.winnerId) {
      wins[m.winnerId] = (wins[m.winnerId] ?? 0) + 1;
    }
  }
  if (node.p1Id && (wins[node.p1Id] ?? 0) >= legsToWin) return node.p1Id;
  if (node.p2Id && (wins[node.p2Id] ?? 0) >= legsToWin) return node.p2Id;
  return null;
}
