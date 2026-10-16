export interface Player {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
  stats: PlayerStats;
}

export interface PlayerStats {
  matchesPlayed: number;
  matchesWon: number;
  totalDartsThrown: number;
  totalPointsScored: number;
  oneEighties: number;
  tonPlus: number;
  highestCheckout: number;
  doublesAttempted: number;
  doublesHit: number;
  bestThreeDartAvg: number;
}

export const emptyStats: PlayerStats = {
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

export type GameMode = "501" | "301";

export type MatchType = "ranked" | "friendly" | "tournament" | "duel";

export interface PlayerMatchState {
  remaining: number;
  dartsThrown: number;
  doublesAttempted: number;
  doublesHit: number;
  pointsScored: number;
  oneEighties: number;
  tonPlus: number;
}

export interface Dart {
  segment: number; // 0-20, 25 (outer bull), 50 (bullseye)
  multiplier: 1 | 2 | 3; // single, double, triple
  score: number; // segment * multiplier
}

export interface Turn {
  id: string;
  playerId: string;
  turnNumber: number;
  darts: Dart[];
  turnTotal: number;
  remainingAfter: number;
  isBust: boolean;
  isCheckout: boolean;
  timestamp: number;
  // Statystyki dodane przez tę turę — potrzebne do poprawnego undo
  dartsCount?: number; // ile lotek zaliczono do statystyk (bust nie liczy ostatniej)
  doublesAttemptedDelta?: number;
  doublesHitDelta?: number;
}

export interface Match {
  id: string;
  gameMode: GameMode;
  startingScore: number;
  playerIds: string[];
  playerNames: string[];
  status: "active" | "completed" | "abandoned";
  currentPlayerIndex: number;
  scores: Record<string, PlayerMatchState>;
  winnerId: string | null;
  winnerName: string | null;
  createdAt: number;
  completedAt: number | null;
  turns: Turn[];
  matchType: MatchType;
  tournamentId?: string;
  // Tryb pojedynków (1v1)
  duelId?: string;        // wspólny identyfikator serii legów
  legsTarget?: number;    // do ilu wygranych legów
  bullWinnerId?: string | null; // zwycięzca rzutu na bulla (1. leg)
}

export type SeedingMode = "rating" | "random";

export interface TournamentMatch {
  id: string;               // węzeł drabinki
  round: number;            // 0 = pierwsza runda
  slot: number;             // pozycja w rundzie
  p1Id: string | null;      // playerId | null (bye / TBD)
  p2Id: string | null;
  legMatchIds: string[];    // rozegrane legi (wiersze Match, matchType "tournament")
  winnerId: string | null;
  nextMatchId: string | null; // dokąd awansuje zwycięzca
  nextSlot: 1 | 2 | null;
  bullWinnerId?: string | null; // kto wygrał rzut na bulla (decyduje o kolejności startów)
}

export interface Tournament {
  id: string;
  name: string;
  gameMode: GameMode;       // "301" | "501"
  legsToWin: number;        // best-of: pierwszy do N legów
  seeding: SeedingMode;
  status: "active" | "completed";
  playerIds: string[];      // w kolejności seedów (S1..Sn)
  playerNames: string[];
  bracket: TournamentMatch[];
  championId: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface H2HRecord {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Wins: number;
  player2Wins: number;
  totalMatches: number;
  lastPlayed: number;
}

// Avatar colors for players (pełne wypełnienia, biały inicjał ≥3:1)
export const PLAYER_COLORS = [
  "bg-emerald-700",
  "bg-blue-600",
  "bg-violet-600",
  "bg-pink-700",
  "bg-orange-700",
  "bg-cyan-700",
  "bg-red-600",
  "bg-lime-700",
  "bg-fuchsia-700",
  "bg-amber-700",
] as const;
