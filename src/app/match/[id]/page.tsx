"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
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
  Target,
  Swords,
  WifiOff,
} from "lucide-react";
import {
  getMatchById,
  saveMatch,
  setActiveMatch,
  getPlayers,
  updatePlayer,
  subscribeToMatch,
  getTournamentById,
  getSeriesLegs,
  saveTournament,
  updateH2H,
  recalculateAllPlayerStats,
} from "@/lib/store";
import {
  validateScore,
  processTurn,
  canCheckout,
  isDoubleTerritory,
} from "@/lib/dartLogic";
import {
  applyQuickTurn,
  applyDetailedTurn,
  undoLastTurn as undoTurn,
  createMatch,
  seriesStarterIndex,
  countLegWins,
} from "@/lib/matchEngine";
import { applyLegResult } from "@/lib/tournament";
import { getCheckout } from "@/lib/checkouts";
import { useWakeLock } from "@/lib/useWakeLock";
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
import DartInput from "@/components/match/DartInput";
import PostMatchStats from "@/components/match/PostMatchStats";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import type { Match, Dart, Player } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Wrapper dla react-hooks/purity — znaczniki czasu powstają tylko w handlerach
const now = () => Date.now();

// Niezapisany stan meczu (brak sieci) — przetrwa odświeżenie strony
const UNSAVED_KEY = "dart_unsaved_match";

// Odcisk stanu meczu: odróżnia echo własnego zapisu od zmian z innego urządzenia
const signature = (m: Match) =>
  `${m.turns.length}|${m.turns[m.turns.length - 1]?.id ?? ""}|${m.status}|${m.currentPlayerIndex}`;

const isSeries = (m: Match) =>
  (m.matchType === "tournament" && !!m.tournamentId) || m.matchType === "duel";

// Checkout czekający na doliczenie statystyk graczy (id meczu). Statystyki liczymy
// dopiero po udanym zapisie meczu — także gdy zapis przejdzie później (brak sieci).
const PENDING_FINALIZE_KEY = "dart_pending_finalize";

async function finalizeMatch(completedMatch: Match) {
  // Tylko mecze rankingowe wpływają na statystyki/H2H (friendly i turniejowe — nie).
  if (completedMatch.matchType !== "ranked") return;

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
}

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
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [inputMode, setInputMode] = useState<"quick" | "detailed">("detailed");
  const [playersData, setPlayersData] = useState<Player[]>([]);
  const [mounted, setMounted] = useState(false);
  const [pendingQuickTurn, setPendingQuickTurn] = useState<{
    score: number;
    isDoubleFinish: boolean;
    isCheckout: boolean;
  } | null>(null);
  const [bull, setBull] = useState<{ p1Name: string; p2Name: string; scoreLine: string | null } | null>(null);
  const [bullDoneFor, setBullDoneFor] = useState<string | null>(null);
  const [legInfo, setLegInfo] = useState<{ mid: string; legNo: number; scoreLine: string; target: number } | null>(null);
  const [invalidScore, setInvalidScore] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [seriesLegDone, setSeriesLegDone] = useState(false);
  // Checkout wpisany w tej sesji — tylko taki można cofnąć (nie stary mecz z historii)
  const [checkoutUndoable, setCheckoutUndoable] = useState(false);
  const [busy, setBusy] = useState(false);

  // Zapisy idą po kolei (kolejność w bazie = kolejność tur)
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const latestRef = useRef<Match | null>(null);
  const ownWrites = useRef(new Map<string, number>());
  const lastSubmitAt = useRef(0);

  useWakeLock(match?.status === "active");

  // Dane meczu turniejowego/pojedynku: numer lega + stan serii + ewentualny rzut na bulla
  // (bull rozstrzyga tylko 1. lega — kolejne startują na przemian).
  // Celowo raz na leg (id), a nie przy każdej turze.
  useEffect(() => {
    const m = match;
    if (!m || (m.matchType !== "tournament" && m.matchType !== "duel")) return;
    let cancelled = false;
    void (async () => {
      let legs: Match[] = [];
      let legNo = 1;
      let target = 1;
      let bullDecided = true;
      if (m.matchType === "tournament" && m.tournamentId) {
        const [t, allLegs] = await Promise.all([
          getTournamentById(m.tournamentId),
          getSeriesLegs({ tournamentId: m.tournamentId }),
        ]);
        const node = t?.bracket.find((n) => n.legMatchIds.includes(m.id));
        if (!t || !node || cancelled) return;
        legNo = node.legMatchIds.length;
        target = t.legsToWin;
        bullDecided = node.bullWinnerId != null;
        legs = allLegs.filter((l) => node.legMatchIds.includes(l.id));
      } else if (m.duelId) {
        legs = await getSeriesLegs({ duelId: m.duelId });
        legNo = legs.length;
        target = m.legsTarget ?? 1;
        bullDecided = legs.some((l) => l.bullWinnerId != null);
      }
      if (cancelled) return;
      const wins = countLegWins(legs);
      const scoreLine = m.playerIds.map((pid) => wins[pid] ?? 0).join("–");
      setLegInfo({ mid: m.id, legNo, scoreLine, target });

      if (
        m.status === "active" &&
        m.turns.length === 0 &&
        bullDoneFor !== m.id &&
        !bullDecided
      ) {
        setBull({
          p1Name: m.playerNames[0],
          p2Name: m.playerNames[1],
          scoreLine,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id, bullDoneFor]);

  // Zapis w kolejce; przy braku sieci stan ląduje w localStorage i jest ponawiany
  const persistMatch = useCallback((updated: Match): Promise<void> => {
    setMatch(updated);
    latestRef.current = updated;
    ownWrites.current.set(signature(updated), now());
    const job = saveChain.current.then(async () => {
      const [ok] = await Promise.all([
        saveMatch(updated),
        setActiveMatch(updated.status === "active" ? updated : null),
      ]);
      // Liczy się tylko wynik najnowszego zapisu — zawiera wszystkie wcześniejsze tury
      if (latestRef.current !== updated) return;
      let finalize = false;
      try {
        if (ok) localStorage.removeItem(UNSAVED_KEY);
        else localStorage.setItem(UNSAVED_KEY, JSON.stringify(updated));
        finalize =
          ok &&
          updated.status === "completed" &&
          localStorage.getItem(PENDING_FINALIZE_KEY) === updated.id;
        if (finalize) localStorage.removeItem(PENDING_FINALIZE_KEY);
      } catch {}
      setSaveFailed(!ok);
      if (finalize) await finalizeMatch(updated);
    });
    saveChain.current = job;
    return job;
  }, []);

  // Ponawianie niezapisanego stanu: co 5 s i po odzyskaniu sieci
  useEffect(() => {
    if (!saveFailed) return;
    const retry = () => {
      if (latestRef.current) void persistMatch(latestRef.current);
    };
    const t = setInterval(retry, 5000);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", retry);
    };
  }, [saveFailed, persistMatch]);

  useEffect(() => {
    // Zmiana z innego urządzenia (Realtime/polling). Ignorujemy echo własnych zapisów
    // i wszystko, gdy lokalnie czeka niezapisany stan — inaczej starsza wersja nadpisałaby nowszą.
    const acceptRemote = (latest: Match) => {
      try {
        const raw = localStorage.getItem(UNSAVED_KEY);
        if (raw && (JSON.parse(raw) as Match).id === id) return;
      } catch {}
      const sig = signature(latest);
      const writtenAt = ownWrites.current.get(sig);
      if (writtenAt !== undefined && now() - writtenAt < 15000) return;
      latestRef.current = latest;
      setMatch((prev) => (!prev || signature(prev) !== sig ? latest : prev));
    };

    async function load() {
      const [m0, allPlayers] = await Promise.all([getMatchById(id), getPlayers()]);
      setPlayersData(allPlayers);
      let unsaved: Match | null = null;
      try {
        const raw = localStorage.getItem(UNSAVED_KEY);
        if (raw) unsaved = JSON.parse(raw) as Match;
      } catch {}
      if (unsaved && unsaved.id === id) {
        // Postęp, który nie dotarł do bazy przed odświeżeniem — wysyłamy ponownie
        void persistMatch(unsaved);
      } else if (m0) {
        let m = m0;
        // Wznowienie: porzucony mecz otwarty w widoku gry wraca do stanu aktywnego
        if (m.status === "abandoned") {
          m = { ...m, status: "active" };
          await saveMatch(m);
          await setActiveMatch(m);
        }
        latestRef.current = m;
        setMatch(m);
      }
      setVoiceOn(isVoiceEnabled());
      setVoiceLang(getLanguage());
      setCanFullscreen(!!document.fullscreenEnabled);
      try {
        const savedMode = localStorage.getItem("dart_input_mode");
        if (savedMode === "quick" || savedMode === "detailed") setInputMode(savedMode);
      } catch {}
      setMounted(true);
    }
    load();

    // Live sync: Supabase Realtime + wolny fallback polling
    const unsubscribe = subscribeToMatch(id, acceptRemote);
    const pollInterval = setInterval(async () => {
      if (document.hidden) return;
      const latest = await getMatchById(id);
      if (latest) acceptRemote(latest);
    }, 30000);

    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      unsubscribe();
      clearInterval(pollInterval);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [id, persistMatch]);

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
    await persistMatch({ ...match, status: "abandoned" });
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

  // Blokada podwójnego tapnięcia: druga tura w ciągu 600 ms to prawie na pewno pomyłka
  const acceptSubmit = (): boolean => {
    const t = now();
    if (t - lastSubmitAt.current < 600) return false;
    lastSubmitAt.current = t;
    return true;
  };

  const handleNumpad = (key: string) => {
    if (!match || match.status !== "active") return;

    if (key === "C") {
      setInputValue("");
      return;
    }

    if (key === "⌫") {
      setInputValue((prev) => prev.slice(0, -1));
      return;
    }

    if (key === "OK") {
      // Pusty wynik nie jest zerem — do tego służy NO SCORE
      if (inputValue !== "") submitScore(parseInt(inputValue));
      return;
    }

    // Digit
    const newValue = inputValue + key;
    if (parseInt(newValue) <= 180) {
      setInputValue(newValue);
    }
  };

  const submitScore = (score: number) => {
    if (!match || match.status !== "active") return;

    if (!validateScore(score)) {
      setInvalidScore(true);
      setTimeout(() => setInvalidScore(false), 1200);
      return;
    }
    if (!acceptSubmit()) return;
    setInputValue("");

    const remaining = match.scores[match.playerIds[match.currentPlayerIndex]].remaining;
    // Wynik zeruje resztę — pytamy o double, chyba że tej reszty nie da się zamknąć (bogey)
    if (remaining - score === 0 && canCheckout(remaining)) {
      setPendingScore(score);
      setShowDoubleConfirm(true);
      return;
    }
    applyTurn(score, false);
  };

  const confirmDouble = (isDouble: boolean) => {
    if (pendingScore !== null) applyTurn(pendingScore, isDouble);
    setShowDoubleConfirm(false);
    setPendingScore(null);
  };

  const applyTurn = (score: number, isDoubleFinish: boolean) => {
    if (!match) return;
    const remaining = match.scores[match.playerIds[match.currentPlayerIndex]].remaining;
    const { isCheckout } = processTurn(remaining, score, isDoubleFinish);

    // W strefie doubli (≤40 parzyste lub 50) i przy każdym checkoucie pytamy o próby na double
    if (isDoubleTerritory(remaining) || isCheckout) {
      setPendingQuickTurn({ score, isDoubleFinish, isCheckout });
      return;
    }
    void commitTurn(applyQuickTurn(match, score, isDoubleFinish, 0, uuidv4(), now()));
  };

  const handleDoublesAnswer = (count: number) => {
    if (!pendingQuickTurn || !match) return;
    const { score, isDoubleFinish } = pendingQuickTurn;
    setPendingQuickTurn(null);
    void commitTurn(applyQuickTurn(match, score, isDoubleFinish, count, uuidv4(), now()));
  };

  const applyTurnDetailed = (darts: Dart[]) => {
    if (!match || match.status !== "active" || !acceptSubmit()) return;
    void commitTurn(applyDetailedTurn(match, darts, uuidv4(), now()));
  };

  // Wspólny koniec tury: zapis, głos/animacja, a po checkoucie statystyki i seria
  const commitTurn = async (updated: Match) => {
    const turn = updated.turns[updated.turns.length - 1];
    const name = updated.playerNames[updated.playerIds.indexOf(turn.playerId)];
    if (turn.isCheckout) {
      try {
        localStorage.setItem(PENDING_FINALIZE_KEY, updated.id);
      } catch {}
    }
    // Przy checkoucie zapis kończy się doliczeniem statystyk (finalizeMatch)
    const saved = persistMatch(updated);

    if (turn.isCheckout) {
      setLastAction("checkout");
      announceCheckout(name);
      setBusy(true);
      await saved;
      setBusy(false);
      setCheckoutUndoable(true);
      // Seria: chwila na cofnięcie pomyłki, zanim powstanie kolejny leg
      if (isSeries(updated)) setSeriesLegDone(true);
      else setTimeout(() => setShowWinModal(true), 500);
    } else if (turn.isBust) {
      setLastAction("bust");
      announceBust(name);
    } else {
      setLastAction("score");
      announceScore(name, turn.turnTotal, turn.remainingAfter);
    }

    setTimeout(() => setLastAction(null), 1500);
  };

  const pickBullWinner = async (playerIndex: number) => {
    if (!match) return;
    const pid = match.playerIds[playerIndex];
    setBullDoneFor(match.id);
    setBull(null);
    const updated = { ...match, currentPlayerIndex: playerIndex };
    if (match.matchType === "duel") {
      // Pojedynki: bull zapisany bezpośrednio na legu
      updated.bullWinnerId = pid;
      await persistMatch(updated);
    } else {
      await persistMatch(updated);
      // Turnieje: bull zapamiętywany w węźle drabinki
      if (!match.tournamentId) return;
      const t = await getTournamentById(match.tournamentId);
      if (!t) return;
      const updatedBracket = t.bracket.map((n) =>
        n.legMatchIds.includes(match.id) ? { ...n, bullWinnerId: pid } : n
      );
      await saveTournament({ ...t, bracket: updatedBracket });
    }
  };

  // Po zatwierdzonym legu serii (turniej/pojedynek): albo seria rozstrzygnięta
  // (powrót), albo automatyczny kolejny leg w tym samym widoku.
  const continueSeries = async () => {
    if (!match) return;
    setBusy(true);
    const chained =
      match.matchType === "duel" ? await chainDuel(match) : await chainTournament(match);
    setBusy(false);
    setSeriesLegDone(false);
    setCheckoutUndoable(false);
    if (!chained) setShowWinModal(true);
  };

  const chainTournament = async (completedLeg: Match): Promise<boolean> => {
    const tid = completedLeg.tournamentId;
    if (!tid) return false;
    const [t, allLegs] = await Promise.all([
      getTournamentById(tid),
      getSeriesLegs({ tournamentId: tid }),
    ]);
    if (!t) return false;

    const recomputed = applyLegResult(t, allLegs);
    const node = recomputed.bracket.find((n) => n.legMatchIds.includes(completedLeg.id));
    if (!node || node.winnerId) {
      await saveTournament(recomputed);
      return false;
    }
    // Kolejny leg już istnieje (np. powrót do starego lega) — nie twórz drugiego
    const lastLegId = node.legMatchIds[node.legMatchIds.length - 1];
    if (lastLegId !== completedLeg.id) {
      router.replace(`/match/${lastLegId}`);
      return true;
    }

    const nextLeg = createMatch({
      id: uuidv4(),
      createdAt: now(),
      gameMode: completedLeg.gameMode,
      startingScore: completedLeg.startingScore,
      playerIds: completedLeg.playerIds,
      playerNames: completedLeg.playerNames,
      matchType: "tournament",
      tournamentId: tid,
      currentPlayerIndex: seriesStarterIndex(
        node.legMatchIds.length + 1,
        completedLeg.playerIds,
        node.bullWinnerId
      ),
    });
    const updatedBracket = recomputed.bracket.map((n) =>
      n.id === node.id ? { ...n, legMatchIds: [...n.legMatchIds, nextLeg.id] } : n
    );
    await Promise.all([
      saveTournament({ ...recomputed, bracket: updatedBracket }),
      saveMatch(nextLeg),
      setActiveMatch(nextLeg),
    ]);
    router.replace(`/match/${nextLeg.id}`);
    return true;
  };

  // Pojedynek: kolejny leg dopóki nikt nie osiągnął legsTarget
  const chainDuel = async (completedLeg: Match): Promise<boolean> => {
    const duelId = completedLeg.duelId;
    if (!duelId) return false;
    const target = completedLeg.legsTarget ?? 1;

    const allLegs = await getSeriesLegs({ duelId });
    const wins = countLegWins(allLegs);
    if (completedLeg.playerIds.some((pid) => (wins[pid] ?? 0) >= target)) return false;
    const laterLeg = allLegs.find((l) => l.createdAt > completedLeg.createdAt);
    if (laterLeg) {
      router.replace(`/match/${laterLeg.id}`);
      return true;
    }

    const bullWinner =
      completedLeg.bullWinnerId ?? allLegs.find((l) => l.bullWinnerId)?.bullWinnerId ?? null;
    const nextLeg = createMatch({
      id: uuidv4(),
      createdAt: now(),
      gameMode: completedLeg.gameMode,
      startingScore: completedLeg.startingScore,
      playerIds: completedLeg.playerIds,
      playerNames: completedLeg.playerNames,
      matchType: "duel",
      duelId,
      legsTarget: target,
      bullWinnerId: bullWinner,
      currentPlayerIndex: seriesStarterIndex(allLegs.length + 1, completedLeg.playerIds, bullWinner),
    });
    await Promise.all([saveMatch(nextLeg), setActiveMatch(nextLeg)]);
    router.replace(`/match/${nextLeg.id}`);
    return true;
  };

  const handleRematch = async () => {
    if (!match) return;
    const order = match.playerIds.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const newMatch = createMatch({
      id: uuidv4(),
      createdAt: now(),
      gameMode: match.gameMode,
      startingScore: match.startingScore,
      playerIds: order.map((i) => match.playerIds[i]),
      playerNames: order.map((i) => match.playerNames[i]),
      matchType: match.matchType,
    });
    await saveMatch(newMatch);
    await setActiveMatch(newMatch);
    router.push(`/match/${newMatch.id}`);
  };

  // Rewanż w pojedynku: nowa seria, bull od nowa
  const handleDuelRematch = async () => {
    if (!match) return;
    const nextLeg = createMatch({
      id: uuidv4(),
      createdAt: now(),
      gameMode: match.gameMode,
      startingScore: match.startingScore,
      playerIds: match.playerIds,
      playerNames: match.playerNames,
      matchType: "duel",
      duelId: uuidv4(),
      legsTarget: match.legsTarget ?? 1,
      bullWinnerId: null,
    });
    await saveMatch(nextLeg);
    await setActiveMatch(nextLeg);
    router.replace(`/match/${nextLeg.id}`);
  };

  // Cofnięcie tury. Cofnięty checkout meczu rankingowego wymaga przeliczenia statystyk
  // graczy i H2H (zostały już zapisane). Leg serii można cofnąć tylko przed „Dalej”.
  const canUndo =
    !!match &&
    match.turns.length > 0 &&
    !busy &&
    (match.status === "active" || (match.status === "completed" && checkoutUndoable));

  const undoLastTurn = async () => {
    if (!match || !canUndo) return;
    const wasCompleted = match.status === "completed";
    setShowWinModal(false);
    setSeriesLegDone(false);
    setCheckoutUndoable(false);
    try {
      localStorage.removeItem(PENDING_FINALIZE_KEY);
    } catch {}
    if (!wasCompleted) {
      void persistMatch(undoTurn(match));
      return;
    }
    setBusy(true);
    await persistMatch(undoTurn(match));
    if (match.matchType === "ranked") await recalculateAllPlayerStats();
    setBusy(false);
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

  // W turnieju/pojedynku: "Leg 2 · 1–0 · do 2" zamiast numeru rundy
  const legBadge =
    match.matchType === "tournament" || match.matchType === "duel"
      ? legInfo && legInfo.mid === match.id
        ? `Leg ${legInfo.legNo}${
            legInfo.scoreLine !== "0–0" ? ` · ${legInfo.scoreLine}` : ""
          } · do ${legInfo.target}`
        : null
      : null;

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
            {legBadge ?? `Runda ${Math.floor(match.turns.length / match.playerIds.length) + 1}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canFullscreen && (
            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}
              className="p-2 rounded-xl hover:bg-surface transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {isFullscreen ? (
                <Minimize2 size={18} className="text-muted" />
              ) : (
                <Maximize2 size={18} className="text-muted" />
              )}
            </button>
          )}
          <button
            onClick={undoLastTurn}
            disabled={!canUndo}
            aria-label="Cofnij ostatnią turę"
            className="p-2 rounded-xl hover:bg-surface transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Undo2 size={18} className="text-muted" />
          </button>
          <button
            onClick={toggleVoice}
            aria-label={voiceOn ? "Wyłącz głos" : "Włącz głos"}
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
              aria-label="Opuść mecz"
              className="p-2 rounded-xl hover:bg-neon-red/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X size={18} className="text-muted hover:text-neon-red" />
            </button>
          )}
        </div>
      </div>

      {saveFailed && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-neon-yellow/10 border-b border-neon-yellow/20 text-neon-yellow text-xs font-medium">
          <WifiOff size={14} />
          Brak połączenia — wynik zapisany na tym telefonie, wyślę go automatycznie
        </div>
      )}

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
              <motion.div
                animate={invalidScore ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                transition={{ duration: 0.35 }}
                className={`glass rounded-2xl px-6 py-4 mb-3 text-center border ${
                  invalidScore ? "border-neon-red/50" : "border-transparent"
                }`}
              >
                <span
                  className={`font-mono text-4xl font-bold ${
                    invalidScore ? "text-neon-red" : "text-foreground"
                  }`}
                >
                  {inputValue || "0"}
                </span>
                {invalidScore && (
                  <span className="block text-xs text-neon-red mt-1">
                    Tego wyniku nie da się rzucić 3 lotkami
                  </span>
                )}
              </motion.div>

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
                  onClick={() => submitScore(0)}
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
              onConfirm={(darts) => applyTurnDetailed(darts)}
            />
          )}
        </div>
      ) : (
        /* Match completed */
        <div className="px-4 pb-8 safe-bottom space-y-3">
          {canUndo && !seriesLegDone && (
            <button
              onClick={undoLastTurn}
              className="w-full rounded-2xl p-3 flex items-center justify-center gap-2 text-sm font-medium text-muted bg-surface hover:bg-surface-light transition-colors"
            >
              <Undo2 size={16} />
              Pomyłka? Cofnij zamknięcie
            </button>
          )}
          <button
            onClick={() => setShowWinModal(true)}
            className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-neon-blue"
          >
            <BarChart3 size={18} />
            Statystyki meczu
          </button>
          {isSeries(match) && !seriesLegDone && (
            <button
              onClick={continueSeries}
              disabled={busy}
              className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-neon-green disabled:opacity-40"
            >
              <Target size={18} />
              Kontynuuj serię
            </button>
          )}
          {match.tournamentId ? (
            <button
              onClick={async () => {
                await setActiveMatch(null);
                router.push(`/tournament/${match.tournamentId}`);
              }}
              className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-neon-green glow-green"
            >
              <Trophy size={18} />
              Powrót do turnieju
            </button>
          ) : match.matchType === "duel" ? (
            <button
              onClick={async () => {
                await setActiveMatch(null);
                router.push("/duel");
              }}
              className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-medium text-neon-red"
            >
              <Swords size={18} />
              Powrót do pojedynków
            </button>
          ) : (
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
          )}
        </div>
      )}

      {/* Koniec lega w serii: potwierdzenie przed kolejnym legiem (można cofnąć pomyłkę) */}
      <AnimatePresence>
        {seriesLegDone && match.status === "completed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-sm text-center"
            >
              <Trophy size={32} className="text-neon-yellow mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">
                Leg dla <span className="text-neon-green">{match.winnerName}</span>
              </h3>
              <p className="text-sm text-muted mb-5">
                Zamknięcie {match.turns[match.turns.length - 1]?.turnTotal}. Wszystko się zgadza?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={undoLastTurn}
                  disabled={busy}
                  className="rounded-xl p-3 bg-surface text-foreground font-medium hover:bg-surface-light transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <Undo2 size={16} />
                  Cofnij
                </button>
                <button
                  onClick={continueSeries}
                  disabled={busy}
                  className="rounded-xl p-3 bg-neon-green text-background font-bold glow-green hover:bg-neon-green-dim transition-all disabled:opacity-40"
                >
                  {busy ? "Chwila…" : "Dalej"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bull-off: kto zaczyna lega (turnieje) */}
      <AnimatePresence>
        {bull && match.status === "active" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-sm text-center"
            >
              <Target size={32} className="text-neon-red mx-auto mb-3" />
              <h3 className="text-lg font-bold mb-1">Rzut na bulla</h3>
              <p className="text-sm text-muted mb-5">
                Kto trafił bliżej środka? Ten gracz zaczyna.
                {bull.scoreLine && bull.scoreLine !== "0–0" && (
                  <> Stan w meczu: <span className="font-mono font-bold text-foreground">{bull.scoreLine}</span></>
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((i) => {
                  const pid = match.playerIds[i];
                  const player = playersData.find((p) => p.id === pid);
                  return (
                    <button
                      key={pid}
                      onClick={() => pickBullWinner(i)}
                      className={`glass rounded-xl p-4 flex flex-col items-center gap-2 transition-all border ${
                        i === 0 ? "border-neon-green/30 hover:border-neon-green/60" : "border-blue-500/30 hover:border-blue-400/60"
                      }`}
                    >
                      <PlayerAvatar
                        avatarUrl={player?.avatarUrl}
                        displayName={match.playerNames[i]}
                        colorIndex={i}
                        size="md"
                      />
                      <span className="font-bold text-sm truncate max-w-full">{match.playerNames[i]}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                onRematch={
                  match.tournamentId
                    ? undefined
                    : match.matchType === "duel"
                    ? handleDuelRematch
                    : handleRematch
                }
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
        {pendingQuickTurn && (
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
                {pendingQuickTurn.isCheckout
                  ? "Ile prób na dable?"
                  : "Ile lotek celowane w dable?"}
              </h3>
              <p className="text-sm text-muted mb-4">
                {pendingQuickTurn.isCheckout
                  ? "Ile lotek celowałeś w dable zanim trafiłeś?"
                  : "Ile z 3 lotek celowałeś w dable?"}
              </p>
              <div className={`grid ${pendingQuickTurn.isCheckout ? "grid-cols-3" : "grid-cols-4"} gap-3`}>
                {(pendingQuickTurn.isCheckout ? [1, 2, 3] : [0, 1, 2, 3]).map((n) => (
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
