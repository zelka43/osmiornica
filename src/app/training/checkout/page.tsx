"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, ChevronLeft, RotateCcw, Check, X } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { CHECKOUTS } from "@/lib/checkouts";

type SelectMode = "random" | "custom" | "random100plus" | "randomBelow100";
type Phase = "setup" | "playing";

const VALID_TARGETS = Object.keys(CHECKOUTS).map(Number);
const TARGETS_100PLUS = VALID_TARGETS.filter((n) => n >= 100);
const TARGETS_BELOW100 = VALID_TARGETS.filter((n) => n < 100);

function pickRandom(pool: number[]): number {
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CheckoutTrainingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectMode, setSelectMode] = useState<SelectMode>("random");
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState("");

  const [target, setTarget] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [lastResult, setLastResult] = useState<"hit" | "miss" | null>(null);

  const nextTarget = useCallback(() => {
    setLastResult(null);
    if (selectMode === "random") return pickRandom(VALID_TARGETS);
    if (selectMode === "random100plus") return pickRandom(TARGETS_100PLUS);
    if (selectMode === "randomBelow100") return pickRandom(TARGETS_BELOW100);
    return parseInt(customInput);
  }, [selectMode, customInput]);

  const start = () => {
    if (selectMode === "custom") {
      const val = parseInt(customInput);
      if (!val || !CHECKOUTS[val]) {
        setCustomError("Niedostępny checkout");
        return;
      }
    }
    setAttempts(0);
    setSuccesses(0);
    setLastResult(null);
    setTarget(nextTarget());
    setPhase("playing");
  };

  const record = (hit: boolean) => {
    setAttempts((a) => a + 1);
    if (hit) setSuccesses((s) => s + 1);
    setLastResult(hit ? "hit" : "miss");
  };

  const next = () => {
    setLastResult(null);
    if (selectMode === "custom") return; // custom: same target
    const pool =
      selectMode === "random100plus" ? TARGETS_100PLUS
      : selectMode === "randomBelow100" ? TARGETS_BELOW100
      : VALID_TARGETS;
    setTarget(pickRandom(pool));
  };

  const reset = () => {
    setPhase("setup");
    setTarget(null);
    setAttempts(0);
    setSuccesses(0);
    setLastResult(null);
  };

  const hint = target ? CHECKOUTS[target] : null;
  const successRate = attempts > 0 ? Math.round((successes / attempts) * 100) : 0;

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
                    {customError && (
                      <p className="text-neon-red text-xs mt-1">{customError}</p>
                    )}
                    {customInput && CHECKOUTS[parseInt(customInput)] && (
                      <p className="text-neon-green text-xs mt-1 font-mono">
                        ✓ {CHECKOUTS[parseInt(customInput)]}
                      </p>
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

            {phase === "playing" && target !== null && (
              <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Próby</p>
                    <p className="font-mono text-xl font-bold">{attempts}</p>
                  </div>
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Trafione</p>
                    <p className="font-mono text-xl font-bold text-neon-green">{successes}</p>
                  </div>
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Skuteczność</p>
                    <p className="font-mono text-xl font-bold text-neon-blue">{successRate}%</p>
                  </div>
                </div>

                {/* Target */}
                <div className="glass rounded-2xl p-8 text-center mb-4">
                  <p className="text-xs text-muted mb-2 uppercase tracking-widest">Checkout</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={target}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      className="font-mono text-7xl font-bold text-neon-yellow"
                    >
                      {target}
                    </motion.p>
                  </AnimatePresence>
                  {hint && (
                    <p className="text-sm text-muted mt-3 font-mono">{hint}</p>
                  )}
                </div>

                {/* Last result feedback */}
                <AnimatePresence>
                  {lastResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`rounded-2xl p-3 text-center mb-4 ${
                        lastResult === "hit" ? "bg-neon-green/10 border border-neon-green/30" : "bg-neon-red/10 border border-neon-red/30"
                      }`}
                    >
                      <p className={`font-bold ${lastResult === "hit" ? "text-neon-green" : "text-neon-red"}`}>
                        {lastResult === "hit" ? "✓ Checkout!" : "✗ Pudło"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Hit / Miss */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={() => record(false)}
                    className="rounded-2xl p-5 glass border border-neon-red/30 text-neon-red font-bold text-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <X size={22} /> Pudło
                  </button>
                  <button
                    onClick={() => record(true)}
                    className="rounded-2xl p-5 glass border border-neon-green/30 text-neon-green font-bold text-xl flex items-center justify-center gap-2 active:scale-95 transition-all glow-green"
                  >
                    <Check size={22} /> Checkout!
                  </button>
                </div>

                {/* Next / Reset row */}
                <div className="grid grid-cols-2 gap-3">
                  {selectMode !== "custom" && (
                    <button
                      onClick={next}
                      className="rounded-2xl p-3 glass border border-transparent hover:border-border-bright flex items-center justify-center gap-2 text-sm font-medium transition-all"
                    >
                      <Shuffle size={16} /> Następny
                    </button>
                  )}
                  <button
                    onClick={reset}
                    className={`rounded-2xl p-3 glass border border-transparent hover:border-border-bright flex items-center justify-center gap-2 text-sm font-medium transition-all ${selectMode === "custom" ? "col-span-2" : ""}`}
                  >
                    <RotateCcw size={16} /> Reset
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}
