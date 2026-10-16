import type { PlayerMatchState, Dart } from "@/types";

export function createInitialMatchState(startingScore: number): PlayerMatchState {
  return {
    remaining: startingScore,
    dartsThrown: 0,
    doublesAttempted: 0,
    doublesHit: 0,
    pointsScored: 0,
    oneEighties: 0,
    tonPlus: 0,
  };
}

// Sumy 3 lotek niemożliwe do rzucenia
const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
// Reszty, których nie da się zamknąć 3 lotkami z doublem na końcu
const BOGEY_NUMBERS = new Set([159, 162, 163, 165, 166, 168, 169]);

export function validateScore(score: number): boolean {
  return Number.isInteger(score) && score >= 0 && score <= 180 && !IMPOSSIBLE_SCORES.has(score);
}

export function canCheckout(remaining: number): boolean {
  return remaining >= 2 && remaining <= 170 && !BOGEY_NUMBERS.has(remaining);
}

/** Reszta, przy której gracz celuje w double (≤40 parzyste lub bull 50) */
export function isDoubleTerritory(remaining: number): boolean {
  return (remaining <= 40 && remaining % 2 === 0 && remaining > 0) || remaining === 50;
}

export function processTurn(
  remaining: number,
  turnTotal: number,
  isDoubleFinish: boolean
): { newRemaining: number; isBust: boolean; isCheckout: boolean } {
  const newRemaining = remaining - turnTotal;

  // Bust conditions:
  // 1. Score goes below zero
  if (newRemaining < 0) {
    return { newRemaining: remaining, isBust: true, isCheckout: false };
  }

  // 2. Score reaches exactly 1 (impossible to finish — need a double)
  if (newRemaining === 1) {
    return { newRemaining: remaining, isBust: true, isCheckout: false };
  }

  // 3. Score reaches 0 but not on a double
  if (newRemaining === 0 && !isDoubleFinish) {
    return { newRemaining: remaining, isBust: true, isCheckout: false };
  }

  // Checkout: score reaches 0 on a double
  if (newRemaining === 0 && isDoubleFinish) {
    return { newRemaining: 0, isBust: false, isCheckout: true };
  }

  // Normal scoring — game continues
  return { newRemaining, isBust: false, isCheckout: false };
}

export function getMaxCheckout(): number {
  return 170;
}

export function validateDart(segment: number, multiplier: 1 | 2 | 3): boolean {
  if (segment === 0) return multiplier === 1; // miss
  if (segment === 25) return multiplier <= 2; // outer bull (S25) or bullseye (D25)
  if (segment >= 1 && segment <= 20) return true;
  return false;
}

export function calculateDartScore(segment: number, multiplier: 1 | 2 | 3): number {
  return segment * multiplier;
}

export function processDartByDartTurn(
  remaining: number,
  darts: Dart[]
): { newRemaining: number; isBust: boolean; isCheckout: boolean; validDarts: number } {
  let current = remaining;
  for (let i = 0; i < darts.length; i++) {
    current -= darts[i].score;
    if (current < 0 || current === 1) {
      return { newRemaining: remaining, isBust: true, isCheckout: false, validDarts: i };
    }
    if (current === 0) {
      if (darts[i].multiplier === 2) {
        return { newRemaining: 0, isBust: false, isCheckout: true, validDarts: i + 1 };
      }
      return { newRemaining: remaining, isBust: true, isCheckout: false, validDarts: i };
    }
  }
  return { newRemaining: current, isBust: false, isCheckout: false, validDarts: darts.length };
}
