import type { Match, Turn, Dart, GameMode, MatchType } from "@/types";
import {
  processTurn,
  processDartByDartTurn,
  createInitialMatchState,
  isDoubleTerritory,
} from "./dartLogic";

// Czyste funkcje stanu meczu — bez Reacta i Supabase, żeby dało się je testować.
// id i timestamp przychodzą z zewnątrz (react-hooks/purity + deterministyczne testy).

interface TurnOutcome {
  darts: Dart[];
  turnTotal: number;
  result: { newRemaining: number; isBust: boolean; isCheckout: boolean };
  dartsCount: number;
  doublesAttemptedDelta: number;
  doublesHitDelta: number;
}

function applyOutcome(match: Match, o: TurnOutcome, turnId: string, timestamp: number): Match {
  const playerId = match.playerIds[match.currentPlayerIndex];
  const state = match.scores[playerId];
  const { isBust, isCheckout, newRemaining } = o.result;

  const turn: Turn = {
    id: turnId,
    playerId,
    turnNumber: match.turns.length + 1,
    darts: o.darts,
    turnTotal: o.turnTotal,
    remainingAfter: newRemaining,
    isBust,
    isCheckout,
    timestamp,
    dartsCount: o.dartsCount,
    doublesAttemptedDelta: o.doublesAttemptedDelta,
    doublesHitDelta: o.doublesHitDelta,
  };

  const scored = !isBust;
  const scores = {
    ...match.scores,
    [playerId]: {
      ...state,
      remaining: newRemaining,
      dartsThrown: state.dartsThrown + o.dartsCount,
      pointsScored: scored ? state.pointsScored + o.turnTotal : state.pointsScored,
      oneEighties: scored && o.turnTotal === 180 ? state.oneEighties + 1 : state.oneEighties,
      tonPlus:
        scored && o.turnTotal >= 100 && o.turnTotal < 180 ? state.tonPlus + 1 : state.tonPlus,
      doublesAttempted: state.doublesAttempted + o.doublesAttemptedDelta,
      doublesHit: state.doublesHit + o.doublesHitDelta,
    },
  };

  if (isCheckout) {
    return {
      ...match,
      scores,
      turns: [...match.turns, turn],
      status: "completed",
      winnerId: playerId,
      winnerName: match.playerNames[match.currentPlayerIndex],
      completedAt: timestamp,
    };
  }
  return {
    ...match,
    scores,
    turns: [...match.turns, turn],
    currentPlayerIndex: (match.currentPlayerIndex + 1) % match.playerIds.length,
  };
}

/** Tryb szybki: wpisana suma tury. doublesAttempted — odpowiedź gracza z modala. */
export function applyQuickTurn(
  match: Match,
  score: number,
  isDoubleFinish: boolean,
  doublesAttempted: number,
  turnId: string,
  timestamp: number
): Match {
  const remaining = match.scores[match.playerIds[match.currentPlayerIndex]].remaining;
  const result = processTurn(remaining, score, isDoubleFinish);
  return applyOutcome(
    match,
    {
      darts: [],
      turnTotal: score,
      result,
      dartsCount: 3,
      // Trafiony double zawsze był co najmniej jedną próbą
      doublesAttemptedDelta: result.isCheckout ? Math.max(1, doublesAttempted) : doublesAttempted,
      doublesHitDelta: result.isCheckout ? 1 : 0,
    },
    turnId,
    timestamp
  );
}

/** Tryb szczegółowy: lotka po lotce, próby na double liczone z reszty przed każdą lotką. */
export function applyDetailedTurn(
  match: Match,
  darts: Dart[],
  turnId: string,
  timestamp: number
): Match {
  const remaining = match.scores[match.playerIds[match.currentPlayerIndex]].remaining;
  const result = processDartByDartTurn(remaining, darts);

  let attempted = 0;
  let hit = 0;
  let running = remaining;
  for (const dart of darts) {
    if (isDoubleTerritory(running)) {
      attempted++;
      if (running - dart.score === 0 && dart.multiplier === 2) hit++;
    }
    running -= dart.score;
    if (running <= 0) break;
  }

  return applyOutcome(
    match,
    {
      darts,
      turnTotal: darts.reduce((s, d) => s + d.score, 0),
      result,
      // Bust nie liczy lotki, którą spowodował
      dartsCount: result.validDarts,
      doublesAttemptedDelta: attempted,
      doublesHitDelta: hit,
    },
    turnId,
    timestamp
  );
}

/** Cofa ostatnią turę — także zwycięski checkout (mecz wraca do stanu aktywnego). */
export function undoLastTurn(match: Match): Match {
  const last = match.turns[match.turns.length - 1];
  if (!last) return match;
  const state = match.scores[last.playerId];
  if (!state) return match;

  // Fallback dla starych danych bez delt tury
  const darts = last.dartsCount ?? (last.darts.length > 0 ? last.darts.length : 3);
  const dA = last.doublesAttemptedDelta ?? 0;
  const dH = last.doublesHitDelta ?? (last.isCheckout ? 1 : 0);
  const scored = !last.isBust;

  return {
    ...match,
    scores: {
      ...match.scores,
      [last.playerId]: {
        ...state,
        remaining: scored ? last.remainingAfter + last.turnTotal : state.remaining,
        dartsThrown: Math.max(0, state.dartsThrown - darts),
        pointsScored: scored ? state.pointsScored - last.turnTotal : state.pointsScored,
        oneEighties: scored && last.turnTotal === 180 ? state.oneEighties - 1 : state.oneEighties,
        tonPlus:
          scored && last.turnTotal >= 100 && last.turnTotal < 180 ? state.tonPlus - 1 : state.tonPlus,
        doublesAttempted: Math.max(0, state.doublesAttempted - dA),
        doublesHit: Math.max(0, state.doublesHit - dH),
      },
    },
    turns: match.turns.slice(0, -1),
    currentPlayerIndex: match.playerIds.indexOf(last.playerId),
    status: "active",
    winnerId: null,
    winnerName: null,
    completedAt: null,
  };
}

/** Nowy mecz/leg z pustymi wynikami. */
export function createMatch(opts: {
  id: string;
  createdAt: number;
  gameMode: GameMode;
  startingScore: number;
  playerIds: string[];
  playerNames: string[];
  matchType: MatchType;
  currentPlayerIndex?: number;
  tournamentId?: string;
  duelId?: string;
  legsTarget?: number;
  bullWinnerId?: string | null;
}): Match {
  const scores: Match["scores"] = {};
  for (const pid of opts.playerIds) scores[pid] = createInitialMatchState(opts.startingScore);
  return {
    id: opts.id,
    gameMode: opts.gameMode,
    startingScore: opts.startingScore,
    playerIds: opts.playerIds,
    playerNames: opts.playerNames,
    status: "active",
    currentPlayerIndex: opts.currentPlayerIndex ?? 0,
    scores,
    winnerId: null,
    winnerName: null,
    createdAt: opts.createdAt,
    completedAt: null,
    turns: [],
    matchType: opts.matchType,
    tournamentId: opts.tournamentId,
    duelId: opts.duelId,
    legsTarget: opts.legsTarget,
    bullWinnerId: opts.bullWinnerId,
  };
}

/** Kto zaczyna leg N serii: leg 1 zwycięzca bulla, potem naprzemiennie. */
export function seriesStarterIndex(
  legNumber: number,
  playerIds: string[],
  bullWinnerId: string | null | undefined
): number {
  if (!bullWinnerId) return 0;
  const bullIdx = Math.max(0, playerIds.indexOf(bullWinnerId));
  return legNumber % 2 === 1 ? bullIdx : 1 - bullIdx;
}

/** Wygrane legi per gracz (tylko ukończone legi). */
export function countLegWins(legs: Match[]): Record<string, number> {
  const wins: Record<string, number> = {};
  for (const l of legs) {
    if (l.status === "completed" && l.winnerId) wins[l.winnerId] = (wins[l.winnerId] ?? 0) + 1;
  }
  return wins;
}
