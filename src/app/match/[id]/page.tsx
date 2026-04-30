"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  VolumeX,
  Undo2,
  Trophy,
  Home,
  BarChart3,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getMatchById, saveMatch, setActiveMatch, getPlayers, updatePlayer } from "@/lib/store";
import { updateH2H } from "@/lib/store";
import { validateScore, processTurn } from "@/lib/dartLogic";
import { getCheckout } from "@/lib/checkouts";
import {
  initVoice,
  isEnabled as isVoiceEnabled,
  setEnabled as setVoiceEnabled,
  announceScore,
  announceBust,
  announceCheckout,
  announceGameOn,
  getLanguage,
  setLanguage,
} from "@/lib/voice";
import { updatePlayerStatsAfterMatch, calculateThreeDartAvg } from "@/lib/statsCalculator";
import { processDartByDartTurn } from "@/lib/dartLogic";
import DartInput from "@/components/match/DartInput";
import PostMatchStats from "@/components/match/PostMatchStats";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import type { Match, Turn, Dart, Player } from "@/types";
import { v4 as uuidv4 } from "uuid";

const COLORS = [
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
];

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [showDoubleConfirm, setShowDoubleConfirm] = useState(false);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [lastAction, setLastAction] = useState<"score" | "bust" | "checkout" | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en" | "pl">("en");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputMode, setInputMode] = useState<"quick" | "detailed">("detailed");
  const [playersData, setPlayersData] = useState<Player[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showDoublesModal, setShowDoublesModal] = useState(false);
  const [pendingQuickTurn, setPendingQuickTurn] = useState<{
    score: number;
    isDoubleFinish: boolean;
    result: { newRemaining: number; isBust: boolean; isCheckout: boolean };
    currentPlayerId: string;
    currentPlayerName: string;
    currentState: import("@/types").PlayerMatchState;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const [m, allPlayers] = await Promise.all([getMatchById(id), getPlayers()]);
      if (m) {
        setMatch(m);
      }
      setPlayersData(allPlayers);
      setVoiceOn(isVoiceEnabled());
      setVoiceLang(getLanguage());
      try {
        const savedMode = localStorage.getItem("dart_input_mode");
        if (savedMode === "quick" || savedMode === "detailed") setInputMode(savedMode);
      } catch {}
      setMounted(true);
    }
    load();

    // Live sync: poll for changes every 3 seconds so other devices see updates
    const pollInterval = setInterval(async () => {
      if (document.hidden) return;
      const latest = await getMatchById(id);
      if (!latest) return;
      setMatch((prev) => {
        if (!prev) return latest;
        if (
          latest.turns.length !== prev.turns.length ||
          latest.status !== prev.status ||
          latest.currentPlayerIndex !== prev.currentPlayerIndex
        ) {
          return latest;
        }
        return prev;
      });
    }, 3000);

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [id]);

  const persistMatch = useCallback(
    async (updated: Match) => {
      setMatch(updated);
      await saveMatch(updated);
      if (updated.status === "active") {
        await setActiveMatch(updated);
      } else {
        await setActiveMatch(null);
      }
    },
    []
  );

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const abandonMatch = async () => {
    if (!match) return;
    const updated: Match = {
      ...match,
      status: "abandoned",
    };
    await persistMatch(updated);
    await setActiveMatch(null);
    router.push("/");
  };

  const toggleVoice = () => {
    if (!isVoiceEnabled()) {
      initVoice();
      setVoiceEnabled(true);
      setVoiceOn(true);
      announceGameOn();
    } else {
      setVoiceEnabled(false);
      setVoiceOn(false);
    }
  };

  const handleNumpad = (key: string) => {
    if (!match || match.status === "completed") return;

    if (key === "C") {
      setInputValue("");
      return;
    }

    if (key === "⌫") {
      setInputValue((prev) => prev.slice(0, -1));
      return;
    }

    if (key === "OK") {
      submitScore();
      return;
    }

    // Digit
    const newValue = inputValue + key;
    const num = parseInt(newValue);
    if (num <= 180) {
      setInputValue(newValue);
    }
  };

  const submitScore = async () => {
    if (!match || match.status === "completed") return;
    const score = inputValue === "" ? 0 : parseInt(inputValue);

    if (!validateScore(score)) return;

    const currentPlayerId = match.playerIds[match.currentPlayerIndex];
    const currentState = match.scores[currentPlayerId];
    const remaining = currentState.remaining;

    // Check if this score would reach exactly 0 — ask about double
    if (remaining - score === 0) {
      setPendingScore(score);
      setShowDoubleConfirm(true);
      return;
    }

    // Process as non-double finish
    await applyTurn(score, false);
  };

  const confirmDouble = async (isDouble: boolean) => {
    if (pendingScore !== null) {
      await applyTurn(pendingScore, isDouble);
    }
    setShowDoubleConfirm(false);
    setPendingScore(null);
  };

  // Returns true when a score counts as "in double territory" (player should aim at a double)
  const isDoubleTerritory = (remaining: number): boolean =>
    (remaining <= 40 && remaining % 2 === 0 && remaining > 0) || remaining === 50;

  const applyTurnDetailed = async (darts: Dart[], turnTotal: number) => {
    if (!match) return;

    const currentPlayerId = match.playerIds[match.currentPlayerIndex];
    const currentPlayerName = match.playerNames[match.currentPlayerIndex];
    const currentState = match.scores[currentPlayerId];

    const result = processDartByDartTurn(currentState.remaining, darts);
    const actualDartsThrown = darts.filter((d) => d.segment !== 0 || d.score === 0).length;

    // Count doubles attempted/hit based on remaining BEFORE each dart
    let newDoublesAttempted = currentState.doublesAttempted;
    let newDoublesHit = currentState.doublesHit;
    let runningRemaining = currentState.remaining;
    for (const dart of darts) {
      if (isDoubleTerritory(runningRemaining)) {
        newDoublesAttempted++;
        if (runningRemaining - dart.score === 0) {
          newDoublesHit++;
        }
      }
      runningRemaining -= dart.score;
      if (runningRemaining <= 0) break;
    }

    const turn: Turn = {
      id: uuidv4(),
      playerId: currentPlayerId,
      turnNumber: match.turns.length + 1,
      darts,
      turnTotal,
      remainingAfter: result.newRemaining,
      isBust: result.isBust,
      isCheckout: result.isCheckout,
      timestamp: Date.now(),
    };

    const updatedScores = { ...match.scores };
    updatedScores[currentPlayerId] = {
      ...currentState,
      remaining: result.newRemaining,
      dartsThrown: currentState.dartsThrown + darts.length,
      pointsScored: result.isBust
        ? currentState.pointsScored
        : currentState.pointsScored + turnTotal,
      oneEighties: turnTotal === 180 ? currentState.oneEighties + 1 : currentState.oneEighties,
      tonPlus: turnTotal >= 100 && turnTotal < 180 ? currentState.tonPlus + 1 : currentState.tonPlus,
      doublesAttempted: newDoublesAttempted,
      doublesHit: newDoublesHit,
    };

    let nextPlayerIndex = (match.currentPlayerIndex + 1) % match.playerIds.length;
    let status = match.status;
    let winnerId = match.winnerId;
    let winnerName = match.winnerName;
    let completedAt = match.completedAt;

    if (result.isCheckout) {
      status = "completed";
      winnerId = currentPlayerId;
      winnerName = currentPlayerName;
      completedAt = Date.now();
      nextPlayerIndex = match.currentPlayerIndex;
    }

    const updated: Match = {
      ...match,
      scores: updatedScores,
      turns: [...match.turns, turn],
      currentPlayerIndex: nextPlayerIndex,
      status: status as "active" | "completed",
      winnerId,
      winnerName,
      completedAt,
    };

    await persistMatch(updated);

    // Voice & animations
    if (result.isCheckout) {
      setLastAction("checkout");
      announceCheckout(currentPlayerName);
      await finalizeMatch(updated);
      setTimeout(() => setShowWinModal(true), 500);
    } else if (result.isBust) {
      setLastAction("bust");
      announceBust(currentPlayerName);
    } else {
      setLastAction("score");
      announceScore(currentPlayerName, turnTotal, result.newRemaining);
    }

    setTimeout(() => setLastAction(null), 1500);
  };

  const applyTurn = async (score: number, isDoubleFinish: boolean) => {
    if (!match) return;

    const currentPlayerId = match.playerIds[match.currentPlayerIndex];
    const currentPlayerName = match.playerNames[match.currentPlayerIndex];
    const currentState = match.scores[currentPlayerId];

    const result = processTurn(currentState.remaining, score, isDoubleFinish);

    // In quick mode, if player was in double territory (≤40 even, or 50), ask about doubles (including busts)
    if (
      inputMode === "quick" &&
      isDoubleTerritory(currentState.remaining)
    ) {
      setPendingQuickTurn({
        score,
        isDoubleFinish,
        result,
        currentPlayerId,
        currentPlayerName,
        currentState,
      });
      setShowDoublesModal(true);
      setInputValue("");
      return;
    }

    // Otherwise proceed directly (bust, or not in checkout range, or detailed mode)
    await finalizeQuickTurn(score, isDoubleFinish, result, currentPlayerId, currentPlayerName, currentState, 0);
  };

  const finalizeQuickTurn = async (
    score: number,
    isDoubleFinish: boolean,
    result: { newRemaining: number; isBust: boolean; isCheckout: boolean },
    currentPlayerId: string,
    currentPlayerName: string,
    currentState: import("@/types").PlayerMatchState,
    doublesAttemptedCount: number
  ) => {
    if (!match) return;

    const turn: Turn = {
      id: uuidv4(),
      playerId: currentPlayerId,
      turnNumber: match.turns.length + 1,
      darts: [],
      turnTotal: score,
      remainingAfter: result.newRemaining,
      isBust: result.isBust,
      isCheckout: result.isCheckout,
      timestamp: Date.now(),
    };

    const updatedScores = { ...match.scores };
    updatedScores[currentPlayerId] = {
      ...currentState,
      remaining: result.newRemaining,
      dartsThrown: currentState.dartsThrown + 3,
      pointsScored: result.isBust
        ? currentState.pointsScored
        : currentState.pointsScored + score,
      oneEighties: score === 180 ? currentState.oneEighties + 1 : currentState.oneEighties,
      tonPlus: score >= 100 && score < 180 ? currentState.tonPlus + 1 : currentState.tonPlus,
      doublesAttempted: currentState.doublesAttempted + doublesAttemptedCount,
      doublesHit: result.isCheckout
        ? currentState.doublesHit + 1
        : currentState.doublesHit,
    };

    let nextPlayerIndex = (match.currentPlayerIndex + 1) % match.playerIds.length;
    let status = match.status;
    let winnerId = match.winnerId;
    let winnerName = match.winnerName;
    let completedAt = match.completedAt;

    if (result.isCheckout) {
      status = "completed";
      winnerId = currentPlayerId;
      winnerName = currentPlayerName;
      completedAt = Date.now();
      nextPlayerIndex = match.currentPlayerIndex;
    }

    const updated: Match = {
      ...match,
      scores: updatedScores,
      turns: [...match.turns, turn],
      currentPlayerIndex: nextPlayerIndex,
      status: status as "active" | "completed",
      winnerId,
      winnerName,
      completedAt,
    };

    await persistMatch(updated);
    setInputValue("");

    // Voice & animations
    if (result.isCheckout) {
      setLastAction("checkout");
      announceCheckout(currentPlayerName);
      await finalizeMatch(updated);
      setTimeout(() => setShowWinModal(true), 500);
    } else if (result.isBust) {
      setLastAction("bust");
      announceBust(currentPlayerName);
    } else {
      setLastAction("score");
      announceScore(currentPlayerName, score, result.newRemaining);
    }

    setTimeout(() => setLastAction(null), 1500);
  };

  const handleDoublesAnswer = async (count: number) => {
    if (!pendingQuickTurn) return;
    setShowDoublesModal(false);
    const { score, isDoubleFinish, result, currentPlayerId, currentPlayerName, currentState } = pendingQuickTurn;
    setPendingQuickTurn(null);
    await finalizeQuickTurn(score, isDoubleFinish, result, currentPlayerId, currentPlayerName, currentState, count);
  };

  const finalizeMatch = async (completedMatch: Match) => {
    if (completedMatch.matchType === "friendly") return;

    const allPlayers = await getPlayers();

    for (const playerId of completedMatch.playerIds) {
      if (playerId.startsWith("guest_")) continue;
      const player = allPlayers.find((p) => p.id === playerId);
      if (!player) continue;

      const matchState = completedMatch.scores[playerId];
      const isWinner = playerId === completedMatch.winnerId;

      const updatedStats = updatePlayerStatsAfterMatch(
        player.stats,
        matchState,
        isWinner,
        matchState.dartsThrown
      );

      await updatePlayer({ ...player, stats: updatedStats });

      if (
        completedMatch.winnerId &&
        playerId !== completedMatch.winnerId &&
        !completedMatch.winnerId.startsWith("guest_")
      ) {
        await updateH2H(completedMatch.winnerId, playerId);
      }
    }
  };

  const handleRematch = async () => {
    if (!match) return;
    const ids = [...match.playerIds];
    const names = [...match.playerNames];
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
      [names[i], names[j]] = [names[j], names[i]];
    }
    const scores: Match["scores"] = {};
    for (const pid of ids) {
      scores[pid] = {
        remaining: match.startingScore,
        dartsThrown: 0,
        doublesAttempted: 0,
        doublesHit: 0,
        pointsScored: 0,
        oneEighties: 0,
        tonPlus: 0,
      };
    }
    const newMatch: Match = {
      id: uuidv4(),
      gameMode: match.gameMode,
      startingScore: match.startingScore,
      playerIds: ids,
      playerNames: names,
      status: "active",
      currentPlayerIndex: 0,
      scores,
      winnerId: null,
      winnerName: null,
      createdAt: Date.now(),
      completedAt: null,
      turns: [],
      matchType: match.matchType,
    };
    await saveMatch(newMatch);
    await setActiveMatch(newMatch);
    router.push(`/match/${newMatch.id}`);
  };

  const undoLastTurn = async () => {
    if (!match || match.turns.length === 0 || match.status === "completed") return;

    const lastTurn = match.turns[match.turns.length - 1];
    const prevState = match.scores[lastTurn.playerId];

    const restoredRemaining = lastTurn.isBust
      ? prevState.remaining
      : prevState.remaining + lastTurn.turnTotal;

    const updatedScores = { ...match.scores };
    updatedScores[lastTurn.playerId] = {
      ...prevState,
      remaining: lastTurn.remainingAfter + lastTurn.turnTotal,
      dartsThrown: Math.max(0, prevState.dartsThrown - 3),
      pointsScored: lastTurn.isBust
        ? prevState.pointsScored
        : prevState.pointsScored - lastTurn.turnTotal,
      oneEighties:
        lastTurn.turnTotal === 180
          ? prevState.oneEighties - 1
          : prevState.oneEighties,
      tonPlus:
        lastTurn.turnTotal >= 100 && lastTurn.turnTotal < 180
          ? prevState.tonPlus - 1
          : prevState.tonPlus,
    };

    // Restore remaining correctly for bust
    if (lastTurn.isBust) {
      // remaining didn't change on bust, so just keep it
    } else {
      updatedScores[lastTurn.playerId].remaining = lastTurn.remainingAfter + lastTurn.turnTotal;
    }

    // Find previous player index
    const prevPlayerIdx = match.playerIds.indexOf(lastTurn.playerId);

    const updated: Match = {
      ...match,
      scores: updatedScores,
      turns: match.turns.slice(0, -1),
      currentPlayerIndex: prevPlayerIdx,
    };

    await persistMatch(updated);
  };

  if (!mounted || !match) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center">
        <div className="skeleton h-6 w-32 mb-4" />
        <div className="skeleton h-40 w-full max-w-md mx-4" />
      </div>
    );
  }

  const currentPlayerId = match.playerIds[match.currentPlayerIndex];
  const currentPlayerName = match.playerNames[match.currentPlayerIndex];
  const currentRemaining = match.scores[currentPlayerId]?.remaining ?? 0;
  const checkoutHint = currentRemaining <= 170 ? getCheckout(currentRemaining) : null;

  // Get last few turns for history
  const recentTurns = match.turns.slice(-6).reverse();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-neon-green">
            {match.gameMode}
          </span>
          <span className="text-muted text-sm">
            Runda {Math.floor(match.turns.length / match.playerIds.length) + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl hover:bg-surface transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {isFullscreen ? (
              <Minimize2 size={18} className="text-muted" />
            ) : (
              <Maximize2 size={18} className="text-muted" />
            )}
          </button>
          <button
            onClick={undoLastTurn}
            disabled={match.turns.length === 0 || match.status === "completed"}
            className="p-2 rounded-xl hover:bg-surface transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Undo2 size={18} className="text-muted" />
          </button>
          <button
            onClick={toggleVoice}
            className="p-2 rounded-xl hover:bg-surface transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {voiceOn ? (
              <Volume2 size={18} className="text-neon-green" />
            ) : (
              <VolumeX size={18} className="text-muted" />
            )}
          </button>
          {voiceOn && (
            <button
              onClick={() => {
                const next = voiceLang === "en" ? "pl" : "en";
                setLanguage(next);
                setVoiceLang(next);
              }}
              className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-surface hover:bg-surface-light transition-colors text-muted"
            >
              {voiceLang === "en" ? "EN" : "PL"}
            </button>
          )}
          {match.status === "active" && (
            <button
              onClick={() => setShowExitConfirm(true)}
              className="p-2 rounded-xl hover:bg-neon-red/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X size={18} className="text-muted hover:text-neon-red" />
            </button>
          )}
        </div>
      </div>

      {/* Scoreboard */}
      <div className="px-3 py-2">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(match.playerIds.length, 3)}, minmax(0, 1fr))`,
          }}
        >
          {match.playerIds.map((playerId, idx) => {
            const state = match.scores[playerId];
            const name = match.playerNames[idx];
            const isActive = idx === match.currentPlayerIndex && match.status === "active";
            const isWinner = playerId === match.winnerId;
            const avg = state.dartsThrown > 0
              ? calculateThreeDartAvg(state.pointsScored, state.dartsThrown)
              : 0;
            const progress = ((match.startingScore - state.remaining) / match.startingScore) * 100;

            return (
              <motion.div
                key={playerId}
                layout
                animate={isActive ? { scale: 1.05 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`relative rounded-2xl p-3 transition-all duration-300 ${
                  isActive
                    ? "glass border-2 border-neon-green bg-neon-green/[0.08] pulse-active"
                    : isWinner
                    ? "glass glow-green border border-neon-green/50"
                    : "glass border border-transparent player-inactive"
                }`}
              >
                {/* RZUCA label for active player */}
                {isActive && (
                  <motion.div
                    layoutId="rzuca-label"
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon-green text-background text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full z-10"
                  >
                    RZUCA
                  </motion.div>
                )}

                {/* Player avatar & name */}
                <div className="flex items-center gap-2 mb-2">
                  <PlayerAvatar
                    avatarUrl={playersData.find((p) => p.id === playerId)?.avatarUrl}
                    displayName={name}
                    colorIndex={idx}
                    size="sm"
                  />
                  <span className={`text-xs font-medium truncate ${isActive ? "text-neon-green font-bold" : "text-foreground"}`}>
                    {name}
                  </span>
                  {isWinner && <Trophy size={14} className="text-neon-yellow shrink-0" />}
                </div>

                {/* Remaining score */}
                <div className="text-center">
                  <motion.span
                    key={state.remaining}
                    initial={{ scale: 1.15, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`font-mono text-3xl font-bold block ${
                      isWinner
                        ? "text-neon-green text-glow-green"
                        : isActive
                        ? "text-foreground"
                        : "text-foreground/70"
                    }`}
                  >
                    {state.remaining}
                  </motion.span>
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-neon-green/50 to-neon-green"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Stats */}
                <div className="flex justify-center mt-2">
                  <span className="text-xs font-bold font-mono text-muted">
                    Śr: {avg.toFixed(1)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Checkout suggestion */}
      <AnimatePresence>
        {checkoutHint && match.status === "active" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2"
          >
            <div className="glass-light rounded-xl px-4 py-2 text-center">
              <span className="text-xs text-muted">Zamknięcie: </span>
              <span className="font-mono text-sm text-neon-yellow font-medium">
                {checkoutHint}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn history */}
      {recentTurns.length > 0 && (
        <div className="px-4 py-1">
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {recentTurns.map((turn, i) => {
              const pIdx = match.playerIds.indexOf(turn.playerId);
              const pName = match.playerNames[pIdx] || "?";
              return (
                <motion.div
                  key={turn.id}
                  initial={i === 0 ? { opacity: 0, x: -10 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="text-muted w-16 truncate">{pName}</span>
                  <span
                    className={`font-mono font-medium ${
                      turn.isBust
                        ? "text-neon-red"
                        : turn.isCheckout
                        ? "text-neon-green"
                        : turn.turnTotal === 180
                        ? "text-neon-yellow"
                        : turn.turnTotal >= 100
                        ? "text-neon-blue"
                        : "text-foreground/70"
                    }`}
                  >
                    {turn.isBust ? "BUST" : turn.turnTotal}
                  </span>
                  <span className="text-muted">→</span>
                  <span className="font-mono text-muted">{turn.remainingAfter}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action feedback */}
      <AnimatePresence>
        {lastAction === "bust" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="px-4 py-2"
          >
            <div className="bg-neon-red/10 border border-neon-red/30 rounded-xl px-4 py-2 text-center">
              <span className="text-neon-red font-bold text-sm">BUST! Brak punktów</span>
            </div>
          </motion.div>
        )}
        {lastAction === "score" && match.turns.length > 0 && match.turns[match.turns.length - 1].turnTotal === 180 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-2"
          >
            <div className="bg-neon-yellow/10 border border-neon-yellow/30 rounded-xl px-4 py-3 text-center">
              <span className="text-neon-yellow font-bold text-lg">🎯 180!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer to push numpad to bottom */}
      <div className="flex-1" />

      {/* Score input */}
      {match.status === "active" ? (
        <div className="px-4 pb-4 safe-bottom">
          {/* Mode toggle + current player */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs text-muted">Rzuca: </span>
              <span className="text-sm font-medium text-neon-green">{currentPlayerName}</span>
            </div>
            <div className="flex gap-1 p-0.5 bg-surface rounded-lg">
              <button
                onClick={() => {
                  setInputMode("quick");
                  try { localStorage.setItem("dart_input_mode", "quick"); } catch {}
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                  inputMode === "quick"
                    ? "bg-neon-green/15 text-neon-green"
                    : "text-muted"
                }`}
              >
                Szybki
              </button>
              <button
                onClick={() => {
                  setInputMode("detailed");
                  try { localStorage.setItem("dart_input_mode", "detailed"); } catch {}
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                  inputMode === "detailed"
                    ? "bg-neon-purple/15 text-neon-purple"
                    : "text-muted"
                }`}
              >
                Szczegółowy
              </button>
            </div>
          </div>

          {inputMode === "quick" ? (
            <>
              {/* Input display */}
              <div className="glass rounded-2xl px-6 py-4 mb-3 text-center">
                <span className="font-mono text-4xl font-bold text-foreground">
                  {inputValue || "0"}
                </span>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-4 gap-2">
                {["1", "2", "3", "⌫", "4", "5", "6", "C", "7", "8", "9", "0"].map(
                  (key) => (
                    <motion.button
                      key={key}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        handleNumpad(key);
                        if (typeof navigator !== "undefined" && navigator.vibrate) {
                          navigator.vibrate(10);
                        }
                      }}
                      className={`h-14 sm:h-16 rounded-xl font-mono text-xl font-bold transition-all duration-100 ${
                        key === "⌫"
                          ? "bg-surface-light text-neon-red hover:bg-neon-red/10"
                          : key === "C"
                          ? "bg-surface-light text-muted hover:bg-surface"
                          : "bg-surface hover:bg-surface-light text-foreground active:bg-card-hover"
                      }`}
                    >
                      {key}
                    </motion.button>
                  )
                )}

                {/* Bottom row: NO SCORE and OK */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setInputValue("0");
                    handleNumpad("OK");
                  }}
                  className="col-span-2 h-14 sm:h-16 rounded-xl font-bold text-sm bg-surface-light text-neon-red hover:bg-neon-red/10 transition-all"
                >
                  NO SCORE
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleNumpad("OK")}
                  className="col-span-2 h-14 sm:h-16 rounded-xl font-bold text-lg bg-neon-green text-background hover:bg-neon-green-dim glow-green transition-all"
                >
                  OK
                </motion.button>
              </div>
            </>
          ) : (
            <DartInput
              remaining={currentRemaining}
              onConfirm={(darts, turnTotal) => {
                applyTurnDetailed(darts, turnTotal);
              }}
            />
          )}
        </div>
      ) : (
        /* Match completed */
        <div className="px-4 pb-8 safe-bottom space-y-3">
          <button
            onClick={() => setShowWinModal(true)}
            className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-neon-blue"
          >
            <BarChart3 size={18} />
            Statystyki meczu
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex-1 glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Home size={18} />
              Strona główna
            </button>
            <button
              onClick={() => router.push("/stats")}
              className="flex-1 glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-neon-green"
            >
              <BarChart3 size={18} />
              Statystyki
            </button>
          </div>
        </div>
      )}

      {/* Double confirm modal */}
      <AnimatePresence>
        {showDoubleConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-sm text-center"
            >
              <h3 className="text-lg font-bold mb-2">Zamknięcie doublem?</h3>
              <p className="text-sm text-muted mb-6">
                Czy ostatni rzut był doublem?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => confirmDouble(false)}
                  className="rounded-xl p-3 bg-surface text-neon-red font-medium hover:bg-neon-red/10 transition-all"
                >
                  Nie (Bust)
                </button>
                <button
                  onClick={() => confirmDouble(true)}
                  className="rounded-xl p-3 bg-neon-green text-background font-bold glow-green hover:bg-neon-green-dim transition-all"
                >
                  Tak! ✓
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win modal with post-match stats */}
      <AnimatePresence>
        {showWinModal && match.winnerName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-6 overflow-y-auto py-8"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="glass rounded-3xl p-6 w-full max-w-sm glow-green"
            >
              {/* Winner announcement */}
              <div className="text-center mb-4">
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <Trophy size={48} className="text-neon-yellow mx-auto mb-3" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-1 text-neon-green text-glow-green">
                  {match.winnerName}
                </h2>
                <p className="text-muted text-sm">wygrywa mecz!</p>
              </div>

              {/* Full post-match stats */}
              <PostMatchStats
                match={match}
                onClose={() => setShowWinModal(false)}
                onRematch={handleRematch}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit confirm modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-sm text-center"
            >
              <h3 className="text-lg font-bold mb-2">Opuścić mecz?</h3>
              <p className="text-sm text-muted mb-6">
                Czy na pewno chcesz opuścić mecz? Mecz nie zostanie zaliczony do statystyk.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="rounded-xl p-3 bg-surface text-foreground font-medium hover:bg-surface-light transition-all"
                >
                  Anuluj
                </button>
                <button
                  onClick={abandonMatch}
                  className="rounded-xl p-3 bg-neon-red/15 text-neon-red font-bold border border-neon-red/30 hover:bg-neon-red/25 transition-all"
                >
                  Opuść mecz
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Doubles tracking modal (quick mode) */}
      <AnimatePresence>
        {showDoublesModal && pendingQuickTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-sm text-center"
            >
              <h3 className="text-lg font-bold mb-2">
                {pendingQuickTurn.result.isCheckout
                  ? "Ile prób na dable?"
                  : "Ile lotek celowane w dable?"}
              </h3>
              <p className="text-sm text-muted mb-4">
                {pendingQuickTurn.result.isCheckout
                  ? "Ile lotek celowałeś w dable zanim trafiłeś?"
                  : "Ile z 3 lotek celowałeś w dable?"}
              </p>
              <div className={`grid ${pendingQuickTurn.result.isCheckout ? "grid-cols-3" : "grid-cols-4"} gap-3`}>
                {(pendingQuickTurn.result.isCheckout ? [1, 2, 3] : [0, 1, 2, 3]).map((n) => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDoublesAnswer(n)}
                    className="rounded-xl p-4 bg-surface hover:bg-surface-light text-foreground font-mono text-2xl font-bold transition-all border border-border"
                  >
                    {n}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
