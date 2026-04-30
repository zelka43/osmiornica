"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart2, ChevronLeft, RotateCcw } from "lucide-react";
import NavBar from "@/components/ui/NavBar";

type Phase = "setup" | "playing" | "summary";

const QUICK_SCORES = [0, 26, 41, 45, 60, 85, 100, 140, 180];

export default function PointsTrainingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [roundCount, setRoundCount] = useState<10 | 20>(10);
  const [scores, setScores] = useState<number[]>([]);
  const [inputValue, setInputValue] = useState("");

  const currentRound = scores.length + 1;
  const total = scores.reduce((s, v) => s + v, 0);
  const avg = scores.length > 0 ? (total / (scores.length * 3)) * 3 : 0;

  const handleKey = (key: string) => {
    if (key === "DEL") {
      setInputValue((v) => v.slice(0, -1));
      return;
    }
    const next = inputValue + key;
    if (parseInt(next) > 180) return;
    setInputValue(next);
  };

  const confirmScore = () => {
    const val = parseInt(inputValue || "0");
    if (isNaN(val) || val < 0 || val > 180) return;
    const newScores = [...scores, val];
    setScores(newScores);
    setInputValue("");
    if (newScores.length >= roundCount) {
      setPhase("summary");
    }
  };

  const reset = () => {
    setScores([]);
    setInputValue("");
    setPhase("setup");
  };

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
            <div className="w-10 h-10 rounded-xl bg-neon-red/10 flex items-center justify-center">
              <BarChart2 className="text-neon-red" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Trening punktowy</h1>
              <p className="text-sm text-muted">Maksymalizuj wynik w rundach</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {phase === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Liczba rund</p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {([10, 20] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setRoundCount(n)}
                      className={`rounded-2xl p-6 text-center transition-all duration-200 ${
                        roundCount === n
                          ? "glass glow-green border border-neon-green/30"
                          : "glass border border-transparent hover:border-border-bright"
                      }`}
                    >
                      <span className={`font-mono text-4xl font-bold ${roundCount === n ? "text-neon-green text-glow-green" : ""}`}>
                        {n}
                      </span>
                      <p className="text-sm text-muted mt-1">rund</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPhase("playing")}
                  className="w-full rounded-2xl p-4 bg-neon-green text-background font-bold text-lg glow-green"
                >
                  Rozpocznij
                </button>
              </motion.div>
            )}

            {phase === "playing" && (
              <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Progress */}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted">Runda</span>
                  <span className="font-mono font-bold text-neon-green">{currentRound} / {roundCount}</span>
                </div>
                <div className="w-full h-1.5 bg-surface rounded-full mb-6">
                  <div
                    className="h-full bg-neon-green rounded-full transition-all duration-300"
                    style={{ width: `${(scores.length / roundCount) * 100}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Suma</p>
                    <p className="font-mono text-2xl font-bold text-neon-green">{total}</p>
                  </div>
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Średnia</p>
                    <p className="font-mono text-2xl font-bold text-neon-blue">{avg.toFixed(1)}</p>
                  </div>
                </div>

                {/* Input display */}
                <div className="glass rounded-2xl p-5 text-center mb-4">
                  <p className="text-xs text-muted mb-1">Wynik rundy</p>
                  <p className="font-mono text-5xl font-bold text-foreground min-h-[3.5rem]">
                    {inputValue || "0"}
                  </p>
                </div>

                {/* Quick scores */}
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                  {QUICK_SCORES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInputValue(String(s))}
                      className="glass-light rounded-xl px-3 py-2 text-sm font-mono font-bold hover:border-border-bright transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2 mb-4">
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

                {/* Last scores */}
                {scores.length > 0 && (
                  <div className="glass rounded-2xl p-4">
                    <p className="text-xs text-muted mb-2 uppercase tracking-wider">Ostatnie rundy</p>
                    <div className="flex flex-wrap gap-2">
                      {[...scores].reverse().slice(0, 8).map((s, i) => (
                        <span key={i} className="glass-light rounded-lg px-3 py-1.5 font-mono text-sm">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {phase === "summary" && (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {/* Results */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="glass rounded-2xl p-5 text-center">
                    <p className="text-xs text-muted mb-1">Suma</p>
                    <p className="font-mono text-3xl font-bold text-neon-green">{total}</p>
                  </div>
                  <div className="glass rounded-2xl p-5 text-center">
                    <p className="text-xs text-muted mb-1">Średnia/3</p>
                    <p className="font-mono text-3xl font-bold text-neon-blue">{avg.toFixed(1)}</p>
                  </div>
                </div>

                {/* Rounds table */}
                <div className="glass rounded-2xl p-4 mb-6">
                  <p className="text-xs text-muted uppercase tracking-wider mb-3">Rundy</p>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {scores.map((s, i) => {
                      const runningAvg = (scores.slice(0, i + 1).reduce((a, b) => a + b, 0) / ((i + 1) * 3)) * 3;
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-muted w-6 text-right font-mono">{i + 1}.</span>
                          <span className="flex-1 font-mono font-bold">{s}</span>
                          <span className="text-muted font-mono text-xs">avg {runningAvg.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={reset}
                  className="w-full rounded-2xl p-4 glass border border-transparent hover:border-border-bright flex items-center justify-center gap-2 font-bold transition-all"
                >
                  <RotateCcw size={18} />
                  Jeszcze raz
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
