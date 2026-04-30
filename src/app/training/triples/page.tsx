"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, ChevronLeft, RotateCcw, Check, X } from "lucide-react";
import NavBar from "@/components/ui/NavBar";

type Order = "random" | "asc" | "desc";
type Phase = "setup" | "playing" | "summary";

const ALL_TRIPLES = [...Array(20).keys()].map((i) => i + 1);

function buildSequence(order: Order): number[] {
  if (order === "asc") return [...Array(20).keys()].map((i) => i + 1);
  if (order === "desc") return [...Array(20).keys()].map((i) => 20 - i);
  const arr = [...ALL_TRIPLES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface TripleResult {
  target: number;
  hits: number;
  misses: number;
}

export default function TriplesTrainingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [order, setOrder] = useState<Order>("random");
  const [sequence, setSequence] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dartResults, setDartResults] = useState<boolean[]>([]);
  const [results, setResults] = useState<TripleResult[]>([]);

  const currentTarget = sequence[currentIdx];
  const totalHits = results.reduce((s, r) => s + r.hits, 0);
  const totalAttempts = results.reduce((s, r) => s + r.hits + r.misses, 0) + dartResults.length;

  const start = () => {
    setSequence(buildSequence(order));
    setCurrentIdx(0);
    setDartResults([]);
    setResults([]);
    setPhase("playing");
  };

  const recordDart = (hit: boolean) => {
    const newDarts = [...dartResults, hit];

    if (newDarts.length === 3) {
      const r: TripleResult = {
        target: currentTarget,
        hits: newDarts.filter(Boolean).length,
        misses: newDarts.filter((d) => !d).length,
      };
      const newResults = [...results, r];
      setResults(newResults);
      setDartResults([]);

      const nextIdx = currentIdx + 1;
      if (nextIdx >= sequence.length) {
        setPhase("summary");
      } else {
        setCurrentIdx(nextIdx);
      }
    } else {
      setDartResults(newDarts);
    }
  };

  const reset = () => {
    setPhase("setup");
    setSequence([]);
    setCurrentIdx(0);
    setDartResults([]);
    setResults([]);
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
            <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center">
              <CircleDot className="text-neon-blue" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Trening trójek</h1>
              <p className="text-sm text-muted">T1–T20 · 3 rzuty na każdy</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {phase === "setup" && (
              <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Kolejność</p>
                <div className="space-y-2 mb-8">
                  {([
                    { key: "random" as Order, label: "Losowe", desc: "Mieszana kolejność" },
                    { key: "asc" as Order, label: "Od najmniejszego", desc: "T1 → T20" },
                    { key: "desc" as Order, label: "Od największego", desc: "T20 → T1" },
                  ]).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => setOrder(key)}
                      className={`w-full rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 ${
                        order === key
                          ? "glass glow-green border border-neon-green/30"
                          : "glass border border-transparent hover:border-border-bright"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        order === key ? "border-neon-green" : "border-muted"
                      }`}>
                        {order === key && <div className="w-2 h-2 rounded-full bg-neon-green" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{label}</p>
                        <p className="text-xs text-muted">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={start}
                  className="w-full rounded-2xl p-4 bg-neon-green text-background font-bold text-lg glow-green"
                >
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
                  <div
                    className="h-full bg-neon-green rounded-full transition-all duration-300"
                    style={{ width: `${(currentIdx / sequence.length) * 100}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Trafione</p>
                    <p className="font-mono text-2xl font-bold text-neon-green">{totalHits}</p>
                  </div>
                  <div className="glass rounded-2xl p-4 text-center">
                    <p className="text-xs text-muted mb-1">Skuteczność</p>
                    <p className="font-mono text-2xl font-bold text-neon-blue">
                      {totalAttempts > 0 ? Math.round((totalHits / totalAttempts) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Current target */}
                <div className="glass rounded-2xl p-8 text-center mb-6">
                  <p className="text-xs text-muted mb-2 uppercase tracking-widest">Cel</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentTarget}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.2, opacity: 0 }}
                      className="font-mono text-6xl font-bold text-neon-blue"
                    >
                      T{currentTarget}
                    </motion.p>
                  </AnimatePresence>

                  <div className="flex justify-center gap-3 mt-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          i < dartResults.length
                            ? dartResults[i]
                              ? "border-neon-green bg-neon-green/20"
                              : "border-neon-red bg-neon-red/20"
                            : "border-border"
                        }`}
                      >
                        {i < dartResults.length && (
                          dartResults[i]
                            ? <Check size={14} className="text-neon-green" />
                            : <X size={14} className="text-neon-red" />
                        )}
                      </div>
                    ))}
                  </div>
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
              </motion.div>
            )}

            {phase === "summary" && (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="glass rounded-2xl p-5 text-center">
                    <p className="text-xs text-muted mb-1">Trafione</p>
                    <p className="font-mono text-3xl font-bold text-neon-green">
                      {results.reduce((s, r) => s + r.hits, 0)}
                      <span className="text-lg text-muted">/{results.reduce((s, r) => s + r.hits + r.misses, 0)}</span>
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-5 text-center">
                    <p className="text-xs text-muted mb-1">Skuteczność</p>
                    {(() => {
                      const h = results.reduce((s, r) => s + r.hits, 0);
                      const t = results.reduce((s, r) => s + r.hits + r.misses, 0);
                      return <p className="font-mono text-3xl font-bold text-neon-blue">{t > 0 ? Math.round((h / t) * 100) : 0}%</p>;
                    })()}
                  </div>
                </div>

                <div className="glass rounded-2xl p-4 mb-6 max-h-72 overflow-y-auto">
                  <p className="text-xs text-muted uppercase tracking-wider mb-3">Szczegóły</p>
                  <div className="space-y-1">
                    {results.map((r, i) => {
                      const pct = Math.round((r.hits / (r.hits + r.misses)) * 100);
                      return (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="font-mono font-bold w-10 text-neon-blue">T{r.target}</span>
                          <div className="flex gap-1">
                            {Array(r.hits).fill(null).map((_, j) => (
                              <div key={j} className="w-5 h-5 rounded-full bg-neon-green/20 border border-neon-green flex items-center justify-center">
                                <Check size={10} className="text-neon-green" />
                              </div>
                            ))}
                            {Array(r.misses).fill(null).map((_, j) => (
                              <div key={j} className="w-5 h-5 rounded-full bg-neon-red/20 border border-neon-red flex items-center justify-center">
                                <X size={10} className="text-neon-red" />
                              </div>
                            ))}
                          </div>
                          <span className="ml-auto text-muted font-mono text-xs">{pct}%</span>
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
