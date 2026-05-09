"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, ChevronLeft, RotateCcw } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { CHECKOUTS } from "@/lib/checkouts";

type SelectMode = "random" | "custom" | "random100plus" | "randomBelow100";
type Phase = "setup" | "playing";
type TurnResult = "checkout" | "bust" | null;

const VALID_TARGETS = Object.keys(CHECKOUTS).map(Number);
const TARGETS_100PLUS = VALID_TARGETS.filter((n) => n >= 100);
const TARGETS_BELOW100 = VALID_TARGETS.filter((n) => n < 100);

const QUICK_SCORES = [0, 26, 41, 45, 60, 85, 100, 140, 180];

function pickRandom(pool: number[]): number {
  return pool[Math.floor(Math.random() * pool.length)];
}

function turnsLabel(n: number): string {
  if (n === 1) return "1 tura";
  if (n <= 4) return `${n} tury`;
  return `${n} tur`;
}

export default function CheckoutTrainingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectMode, setSelectMode] = useState<SelectMode>("random");
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState("");

  // Playing state
  const [target, setTarget] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [turnsPlayed, setTurnsPlayed] = useState(0);
  const [checkoutsAttempted, setCheckoutsAttempted] = useState(0);
  const [turnsThisCheckout, setTurnsThisCheckout] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [turnResult, setTurnResult] = useState<TurnResult>(null);
  const [roundScores, setRoundScores] = useState<number[]>([]);

  const getPool = useCallback(() => {
    if (selectMode === "random100plus") return TARGETS_100PLUS;
    if (selectMode === "randomBelow100") return TARGETS_BELOW100;
    return VALID_TARGETS;
  }, [selectMode]);

  const startWithTarget = (t: number) => {
    setTarget(t);
    setRemaining(t);
    setInputValue("");
    setTurnResult(null);
    setRoundScores([]);
    setTurnsThisCheckout(0);
    setCheckoutsAttempted((c) => c + 1);
  };

  const start = () => {
    if (selectMode === "custom") {
      const val = parseInt(customInput);
      if (!val || !CHECKOUTS[val]) {
        setCustomError("Niedostępny checkout");
        return;
      }
      setTurnsPlayed(0);
      setCheckoutsAttempted(0);
      setSuccesses(0);
      setPhase("playing");
      startWithTarget(val);
      return;
    }
    setTurnsPlayed(0);
    setCheckoutsAttempted(0);
    setSuccesses(0);
    setPhase("playing");
    startWithTarget(pickRandom(getPool()));
  };

  // Auto-reset remaining to target after bust
  useEffect(() => {
    if (turnResult !== "bust") return;
    const timer = setTimeout(() => {
      setRemaining(target);
      setRoundScores([]);
      setTurnResult(null);
    }, 1200);
    return () => clearTimeout(timer);
  }, [turnResult, target]);

  const handleKey = (key: string) => {
    if (key === "DEL") {
      setInputValue((v) => v.slice(0, -1));
      return;
    }
    const next = inputValue + key;
    const val = parseInt(next);
    if (val > Math.min(180, remaining)) return;
    setInputValue(next);
  };

  const confirmScore = () => {
    const score = parseInt(inputValue || "0");
    if (isNaN(score) || score < 0) return;

    const newRemaining = remaining - score;
    setRoundScores((prev) => [...prev, score]);
    setInputValue("");
    setTurnsPlayed((t) => t + 1);
    setTurnsThisCheckout((t) => t + 1);

    if (newRemaining < 0 || newRemaining === 1) {
      setTurnResult("bust");
    } else if (newRemaining === 0) {
      setSuccesses((s) => s + 1);
      setTurnResult("checkout");
    } else {
      setRemaining(newRemaining);
    }
  };

  const nextTarget = () => {
    if (selectMode === "custom") {
      startWithTarget(target);
    } else {
      startWithTarget(pickRandom(getPool()));
    }
  };

  const reset = () => {
    setPhase("setup");
    setTurnsPlayed(0);
    setCheckoutsAttempted(0);
    setSuccesses(0);
    setTurnResult(null);
  };

  const successRate = checkoutsAttempted > 0 ? Math.round((successes / checkoutsAttempted) * 100) : 0;
  const hint = CHECKOUTS[remaining] ?? null;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push("/match/new")}
              className="w-10 h-10 rounded-xl glass flex items-center justify-center"
            >
              <ChevronLeft size={20} className="text-muted" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-neon-yellow/10 flex items-center justify-center">
              <Shuffle className="text-neon-yellow" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Losowy checkout</h1>
              <p className="text-sm text-muted">Trening finiszowania</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {phase === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Zakres</p>
                <div className="space-y-2 mb-6">
                  {([
                    { key: "random" as SelectMode, label: "Losowy", desc: "Dowolny checkout (2–170)" },
                    { key: "random100plus" as SelectMode, label: "Losowy 100+", desc: "Tylko checkouty ≥ 100" },
                    { key: "randomBelow100" as SelectMode, label: "Losowy poniżej 100", desc: "Tylko checkouty < 100" },
                    { key: "custom" as SelectMode, label: "Wybierz", desc: "Sam ustawiasz cel" },
                  ]).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => { setSelectMode(key); setCustomError(""); }}
                      className={`w-full rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 ${
                        selectMode === key
                          ? "glass glow-green border border-neon-green/30"
                          : "glass border border-transparent hover:border-border-bright"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectMode === key ? "border-neon-green" : "border-muted"
                      }`}>
                        {selectMode === key && <div className="w-2 h-2 rounded-full bg-neon-green" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{label}</p>
                        <p className="text-xs text-muted">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {selectMode === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mb-6"
                  >
                    <input
                      type="number"
                      value={customInput}
                      onChange={(e) => { setCustomInput(e.target.value); setCustomError(""); }}
                      placeholder="Wpisz liczbę (np. 121)"
                      className="w-full glass rounded-xl px-4 py-3 text-sm bg-transparent outline-none border border-transparent focus:border-border-bright transition-colors font-mono"
                    />
                    {customError && <p className="text-neon-red text-xs mt-1">{customError}</p>}
                    {customInput && CHECKOUTS[parseInt(customInput)] && (
                      <p className="text-neon-green text-xs mt-1 font-mono">✓ {CHECKOUTS[parseInt(customInput)]}</p>
                    )}
                  </motion.div>
                )}

                <button
                  onClick={start}
                  className="w-full rounded-2xl p-4 bg-neon-green text-background font-bold text-lg glow-green"
                >
                  Rozpocznij
                </button>
              </motion.div>
            )}

            {phase === "playing" && (
              <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Rundy</p>
                    <p className="font-mono text-xl font-bold">{turnsPlayed}</p>
                  </div>
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Trafione</p>
                    <p className="font-mono text-xl font-bold text-neon-green">{successes}</p>
                  </div>
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Skutecz.</p>
                    <p className="font-mono text-xl font-bold text-neon-blue">{successRate}%</p>
                  </div>
                </div>

                {/* Remaining */}
                <div className={`glass rounded-2xl p-6 text-center mb-2 transition-all ${
                  turnResult === "checkout" ? "border border-neon-green/50 bg-neon-green/5" :
                  turnResult === "bust" ? "border border-neon-red/50 bg-neon-red/5" :
                  "border border-transparent"
                }`}>
                  <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">
                    Tura {turnsThisCheckout + (turnResult ? 0 : 1)}
                  </p>
                  <p className="text-xs text-muted mb-1 uppercase tracking-widest">Pozostało</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={String(remaining) + String(turnResult)}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`font-mono text-7xl font-bold ${
                        turnResult === "checkout" ? "text-neon-green text-glow-green" :
                        turnResult === "bust" ? "text-neon-red" :
                        "text-foreground"
                      }`}
                    >
                      {turnResult === "checkout" ? "✓" : turnResult === "bust" ? "BUST" : remaining}
                    </motion.p>
                  </AnimatePresence>

                  {!turnResult && hint && (
                    <p className="text-sm text-neon-yellow font-mono mt-2">{hint}</p>
                  )}
                  {turnResult === "checkout" && (
                    <p className="text-neon-green font-bold mt-1">Checkout! ({turnsLabel(turnsThisCheckout)})</p>
                  )}
                  {turnResult === "bust" && (
                    <p className="text-neon-red font-bold mt-1">Bust – próba od nowa</p>
                  )}
                </div>

                {/* Round scores */}
                {roundScores.length > 0 && turnResult !== "checkout" && (
                  <div className={`flex gap-2 mb-3 flex-wrap ${turnResult === "bust" ? "opacity-50" : ""}`}>
                    {roundScores.map((s, i) => (
                      <span key={i} className="glass-light rounded-lg px-3 py-1.5 font-mono text-sm">{s}</span>
                    ))}
                  </div>
                )}

                {/* After checkout: next button */}
                {turnResult === "checkout" && (
                  <div className="mb-4">
                    <button
                      onClick={nextTarget}
                      className="w-full rounded-2xl p-4 bg-neon-green text-background font-bold flex items-center justify-center gap-2 glow-green"
                    >
                      <Shuffle size={18} /> {selectMode === "custom" ? "Od nowa" : "Następny"}
                    </button>
                  </div>
                )}

                {/* Input (hidden during result) */}
                {!turnResult && (
                  <>
                    {/* Quick scores */}
                    <div className="flex flex-wrap gap-2 mb-3 justify-center">
                      {QUICK_SCORES.filter((s) => s <= remaining).map((s) => (
                        <button
                          key={s}
                          onClick={() => setInputValue(String(s))}
                          className="glass-light rounded-xl px-3 py-2 text-sm font-mono font-bold hover:border-border-bright transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Input display */}
                    <div className="glass rounded-2xl p-4 text-center mb-3">
                      <p className="font-mono text-4xl font-bold">{inputValue || "0"}</p>
                    </div>

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-2">
                      {["1","2","3","4","5","6","7","8","9","DEL","0","✓"].map((k) => (
                        <button
                          key={k}
                          onClick={() => {
                            if (k === "✓") confirmScore();
                            else handleKey(k);
                          }}
                          className={`rounded-xl py-4 font-mono font-bold text-xl transition-all active:scale-95 ${
                            k === "✓"
                              ? "bg-neon-green text-background glow-green"
                              : k === "DEL"
                              ? "glass text-neon-red"
                              : "glass hover:border-border-bright"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Reset */}
                <button
                  onClick={reset}
                  className="w-full mt-4 rounded-2xl p-3 glass border border-transparent hover:border-border-bright flex items-center justify-center gap-2 text-sm text-muted transition-all"
                >
                  <RotateCcw size={14} /> Zakończ trening
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
