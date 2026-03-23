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

// Avatar colors for players
export const PLAYER_COLORS = [
  "from-emerald-500 to-teal-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-violet-600",
  "from-pink-500 to-rose-600",
  "from-orange-500 to-amber-600",
  "from-cyan-500 to-sky-600",
  "from-red-500 to-pink-600",
  "from-lime-500 to-green-600",
  "from-fuchsia-500 to-purple-600",
  "from-yellow-500 to-orange-600",
] as const;
