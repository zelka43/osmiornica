"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, ChevronLeft, RotateCcw, Check, X } from "lucide-react";
import NavBar from "@/components/ui/NavBar";

type Order = "random" | "asc" | "desc";
type Phase = "setup" | "playing" | "summary";

const ALL_DOUBLES = [...Array(20).keys()].map((i) => i + 1).concat([25]);

function buildSequence(order: Order): number[] {
  if (order === "asc") return [...Array(20).keys()].map((i) => i + 1).concat([25]);
  if (order === "desc") return [...Array(20).keys()].map((i) => 20 - i).concat([25]);
  const arr = [...ALL_DOUBLES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function doubleLabel(n: number) {
  return n === 25 ? "BULL" : `D${n}`;
}

interface TargetResult {
  target: number;
  attempts: number;
}

export default function DoublesTrainingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [order, setOrder] = useState<Order>("random");
  const [sequence, setSequence] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [results, setResults] = useState<TargetResult[]>([]);
  const [lastHit, setLastHit] = useState(false);

  const totalAttempts = results.reduce((s, r) => s + r.attempts, 0) + currentAttempts;
  const totalHits = results.length;

  const start = () => {
    setSequence(buildSequence(order));
    setCurrentIdx(0);
    setCurrentAttempts(0);
    setResults([]);
    setLastHit(false);
    setPhase("playing");
  };

  const recordDart = (hit: boolean) => {
    setLastHit(hit);
    const newAttempts = currentAttempts + 1;

    if (hit) {
      const r: TargetResult = { target: sequence[currentIdx], attempts: newAttempts };
      const newResults = [...results, r];
      setResults(newResults);
      setCurrentAttempts(0);

      const nextIdx = currentIdx + 1;
      if (nextIdx >= sequence.length) {
        setPhase("summary");
      } else {
        setCurrentIdx(nextIdx);
      }
    } else {
      setCurrentAttempts(newAttempts);
    }
  };

  const reset = () => {
    setPhase("setup");
    setSequence([]);
    setCurrentIdx(0);
    setCurrentAttempts(0);
    setResults([]);
    setLastHit(false);
  };

  const avgAttempts = results.length > 0
    ? (results.reduce((s, r) => s + r.attempts, 0) / results.length).toFixed(1)
    : "—";

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push("/match/new")} className="w-10 h-10 rounded-xl glass flex items-center justify-center">
              <ChevronLeft size={20} className="text-muted" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center">
              <CircleDot className="text-neon-green" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Trening doubli</h1>
              <p className="text-sm text-muted">D1–D20 + Bull · do skutku</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {phase === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Kolejność</p>
                <div className="space-y-2 mb-8">
                  {([
                    { key: "random" as Order, label: "Losowe", desc: "Mieszana kolejność" },
                    { key: "asc" as Order, label: "Od najmniejszego", desc: "D1 → D20 → Bull" },
                    { key: "desc" as Order, label: "Od największego", desc: "D20 → D1 → Bull" },
                  ]).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => setOrder(key)}
                      className={`w-full rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 ${
                        order === key ? "glass glow-green border border-neon-green/30" : "glass border border-transparent hover:border-border-bright"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${order === key ? "border-neon-green" : "border-muted"}`}>
                        {order === key && <div className="w-2 h-2 rounded-full bg-neon-green" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{label}</p>
                        <p className="text-xs text-muted">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={start} className="w-full rounded-2xl p-4 bg-neon-green text-background font-bold text-lg glow-green">
                  Rozpocznij
                </button>
              </motion.div>
            )}

            {phase === "playing" && (
              <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Progress */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted">Postęp</span>
                  <span className="font-mono font-bold text-neon-green">{currentIdx + 1} / {sequence.length}</span>
                </div>
                <div className="w-full h-1.5 bg-surface rounded-full mb-6">
                  <div className="h-full bg-neon-green rounded-full transition-all duration-300" style={{ width: `${(currentIdx / sequence.length) * 100}%` }} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Trafione</p>
                    <p className="font-mono text-xl font-bold text-neon-green">{totalHits}</p>
                  </div>
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Rzuty</p>
                    <p className="font-mono text-xl font-bold">{totalAttempts}</p>
                  </div>
                  <div className="glass rounded-2xl p-3 text-center">
                    <p className="text-[10px] text-muted mb-1">Skutecz.</p>
                    <p className="font-mono text-xl font-bold text-neon-blue">
                      {totalAttempts > 0 ? Math.round((totalHits / totalAttempts) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Target */}
                <div className={`glass rounded-2xl p-8 text-center mb-6 transition-all ${
                  lastHit ? "border border-neon-green/30" : currentAttempts > 0 ? "border border-neon-red/20" : "border border-transparent"
                }`}>
                  <p className="text-xs text-muted mb-2 uppercase tracking-widest">Cel</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={sequence[currentIdx]}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      className="font-mono text-6xl font-bold text-neon-green text-glow-green"
                    >
                      {doubleLabel(sequence[currentIdx])}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-sm text-muted mt-3">
                    {currentAttempts === 0 ? "Rzuć" : `${currentAttempts} ${currentAttempts === 1 ? "pudło" : "pudła"}`}
                  </p>
                </div>

                {/* Hit / Miss buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => recordDart(false)}
                    className="rounded-2xl p-5 glass border border-neon-red/30 text-neon-red font-bold text-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    <X size={22} /> Pudło
                  </button>
                  <button
                    onClick={() => recordDart(true)}
                    className="rounded-2xl p-5 glass border border-neon-green/30 text-neon-green font-bold text-xl flex items-center justify-center gap-2 active:scale-95 transition-all glow-green"
                  >
                    <Check size={22} /> Trafił
                  </button>
                </div>

                <button onClick={reset} className="w-full mt-4 rounded-2xl p-3 glass border border-transparent hover:border-border-bright flex items-center justify-center gap-2 text-sm text-muted transition-all">
                  <RotateCcw size={14} /> Zakończ
                </button>
              </motion.div>
            )}

            {phase === "summary" && (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Rzuty</p>
                    <p className="font-mono text-2xl font-bold">{results.reduce((s, r) => s + r.attempts, 0)}</p>
                  </div>
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Skutecz.</p>
                    <p className="font-mono text-2xl font-bold text-neon-blue">
                      {Math.round((results.length / results.reduce((s, r) => s + r.attempts, 0)) * 100)}%
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Śr. rzutów</p>
                    <p className="font-mono text-2xl font-bold text-neon-yellow">{avgAttempts}</p>
                  </div>
                </div>

                <div className="glass rounded-2xl p-4 mb-6 max-h-72 overflow-y-auto">
                  <p className="text-xs text-muted uppercase tracking-wider mb-3">Szczegóły (rzutów do trafienia)</p>
                  <div className="space-y-1">
                    {results.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="font-mono font-bold w-12 text-neon-green">{doubleLabel(r.target)}</span>
                        <div className="flex-1 h-1.5 bg-surface rounded-full">
                          <div
                            className="h-full bg-neon-green rounded-full"
                            style={{ width: `${Math.min(100, (1 / r.attempts) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-muted w-12 text-right">
                          {r.attempts === 1 ? "1 rzut" : `${r.attempts} rzuty`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={reset} className="w-full rounded-2xl p-4 glass border border-transparent hover:border-border-bright flex items-center justify-center gap-2 font-bold transition-all">
                  <RotateCcw size={18} /> Jeszcze raz
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
