import { describe, it, expect } from "vitest";
import {
  applyQuickTurn,
  applyDetailedTurn,
  undoLastTurn,
  createMatch,
  seriesStarterIndex,
  countLegWins,
} from "./matchEngine";
import { validateScore, canCheckout, processDartByDartTurn } from "./dartLogic";
import type { Dart, Match } from "@/types";

const d = (segment: number, multiplier: 1 | 2 | 3): Dart => ({
  segment,
  multiplier,
  score: segment * multiplier,
});

function newMatch(startingScore = 501): Match {
  return createMatch({
    id: "m1",
    createdAt: 0,
    gameMode: "501",
    startingScore,
    playerIds: ["a", "b"],
    playerNames: ["Ala", "Bob"],
    matchType: "ranked",
  });
}

/** Ustawia resztę gracza bez historii (do testów końcówek) */
function withRemaining(m: Match, pid: string, remaining: number): Match {
  return { ...m, scores: { ...m.scores, [pid]: { ...m.scores[pid], remaining } } };
}

describe("dartLogic", () => {
  it("odrzuca sumy niemożliwe do rzucenia", () => {
    for (const s of [163, 166, 169, 172, 173, 175, 176, 178, 179]) {
      expect(validateScore(s)).toBe(false);
    }
    for (const s of [0, 26, 140, 171, 174, 177, 180]) expect(validateScore(s)).toBe(true);
    expect(validateScore(181)).toBe(false);
  });

  it("rozpoznaje bogey numbers", () => {
    expect(canCheckout(170)).toBe(true);
    expect(canCheckout(169)).toBe(false);
    expect(canCheckout(159)).toBe(false);
    expect(canCheckout(1)).toBe(false);
    expect(canCheckout(2)).toBe(true);
  });

  it("bust na 1 i na zero bez doubla", () => {
    expect(processDartByDartTurn(3, [d(2, 1)]).isBust).toBe(true);
    expect(processDartByDartTurn(20, [d(20, 1)]).isBust).toBe(true);
    expect(processDartByDartTurn(40, [d(20, 2)]).isCheckout).toBe(true);
  });
});

describe("applyQuickTurn", () => {
  it("zwykła tura przesuwa gracza i liczy punkty", () => {
    const m = applyQuickTurn(newMatch(), 140, false, 0, "t1", 1);
    expect(m.scores.a.remaining).toBe(361);
    expect(m.scores.a.tonPlus).toBe(1);
    expect(m.scores.a.dartsThrown).toBe(3);
    expect(m.currentPlayerIndex).toBe(1);
  });

  it("checkout spoza strefy doubli liczy co najmniej 1 próbę (CO% ≤ 100%)", () => {
    const m = applyQuickTurn(withRemaining(newMatch(), "a", 100), 100, true, 0, "t1", 1);
    expect(m.status).toBe("completed");
    expect(m.winnerId).toBe("a");
    expect(m.scores.a.doublesHit).toBe(1);
    expect(m.scores.a.doublesAttempted).toBe(1);
  });

  it("bust nie dolicza punktów", () => {
    const m = applyQuickTurn(withRemaining(newMatch(), "a", 40), 60, false, 2, "t1", 1);
    expect(m.scores.a.remaining).toBe(40);
    expect(m.scores.a.pointsScored).toBe(0);
    expect(m.scores.a.doublesAttempted).toBe(2);
    expect(m.turns[0].isBust).toBe(true);
  });
});

describe("applyDetailedTurn", () => {
  it("liczy próby na double lotka po lotce", () => {
    // 40: pudło w D20 (S20 -> 20), potem D10
    const m = applyDetailedTurn(withRemaining(newMatch(), "a", 40), [d(20, 1), d(10, 2)], "t1", 1);
    expect(m.status).toBe("completed");
    expect(m.scores.a.doublesAttempted).toBe(2);
    expect(m.scores.a.doublesHit).toBe(1);
    expect(m.scores.a.dartsThrown).toBe(2);
  });

  it("bust nie liczy lotki, która go spowodowała", () => {
    const m = applyDetailedTurn(withRemaining(newMatch(), "a", 32), [d(20, 1), d(20, 1)], "t1", 1);
    expect(m.scores.a.remaining).toBe(32);
    expect(m.scores.a.dartsThrown).toBe(1);
  });
});

describe("undoLastTurn", () => {
  it("przywraca dokładnie stan sprzed tury", () => {
    const start = newMatch();
    const after = applyDetailedTurn(start, [d(20, 3), d(20, 3), d(20, 3)], "t1", 1);
    expect(after.scores.a.oneEighties).toBe(1);
    expect(undoLastTurn(after)).toEqual({ ...start, winnerId: null, winnerName: null, completedAt: null });
  });

  it("cofa zwycięski checkout — mecz znów aktywny", () => {
    const start = withRemaining(newMatch(), "a", 100);
    const won = applyQuickTurn(start, 100, true, 1, "t1", 5);
    const undone = undoLastTurn(won);
    expect(undone.status).toBe("active");
    expect(undone.winnerId).toBeNull();
    expect(undone.completedAt).toBeNull();
    expect(undone.scores).toEqual(start.scores);
    expect(undone.currentPlayerIndex).toBe(0);
  });

  it("cofa bust bez zmiany reszty", () => {
    const start = withRemaining(newMatch(), "a", 40);
    const busted = applyQuickTurn(start, 60, false, 1, "t1", 1);
    expect(undoLastTurn(busted).scores).toEqual(start.scores);
  });
});

describe("serie legów", () => {
  it("naprzemienny start względem zwycięzcy bulla", () => {
    const ids = ["a", "b"];
    expect(seriesStarterIndex(1, ids, "b")).toBe(1);
    expect(seriesStarterIndex(2, ids, "b")).toBe(0);
    expect(seriesStarterIndex(3, ids, "b")).toBe(1);
    expect(seriesStarterIndex(2, ids, null)).toBe(0);
  });

  it("liczy tylko ukończone legi", () => {
    const leg = (winnerId: string | null, status: Match["status"]) => ({ ...newMatch(), winnerId, status });
    expect(countLegWins([leg("a", "completed"), leg("a", "completed"), leg("b", "active")])).toEqual({ a: 2 });
  });
});
