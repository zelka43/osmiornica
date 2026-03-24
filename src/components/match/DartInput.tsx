"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Undo2 } from "lucide-react";
import type { Dart } from "@/types";
import { processDartByDartTurn } from "@/lib/dartLogic";
import { getCheckout } from "@/lib/checkouts";

interface DartInputProps {
  remaining: number;
  onConfirm: (darts: Dart[], turnTotal: number) => void;
}

type Multiplier = 1 | 2 | 3;

const SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];

function dartLabel(dart: Dart): string {
  if (dart.segment === 0) return "MISS";
  const prefix = dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S";
  if (dart.segment === 25 && dart.multiplier === 2) return "BULL";
  if (dart.segment === 25) return "S25";
  return `${prefix}${dart.segment}`;
}

export default function DartInput({ remaining, onConfirm }: DartInputProps) {
  const [darts, setDarts] = useState<Dart[]>([]);
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  const preview = useMemo(() => {
    if (darts.length === 0)
      return { newRemaining: remaining, isBust: false, isCheckout: false, validDarts: 0 };
    return processDartByDartTurn(remaining, darts);
  }, [darts, remaining]);

  const turnTotal = darts.reduce((sum, d) => sum + d.score, 0);
  const previewRemaining = preview.isBust ? remaining : preview.newRemaining;

  const addDart = (segment: number, mult: Multiplier) => {
    if (darts.length >= 3) return;
    const score = segment * mult;
    const newDart: Dart = { segment, multiplier: mult, score };
    const newDarts = [...darts, newDart];

    // Check if this causes a bust or checkout immediately
    const result = processDartByDartTurn(remaining, newDarts);

    setDarts(newDarts);

    // Reset multiplier to Single after a Double or Triple throw
    if (mult === 2 || mult === 3) {
      setMultiplier(1);
    }

    // Auto-confirm on checkout
    if (result.isCheckout) {
      setTimeout(() => {
        onConfirm(newDarts, newDarts.reduce((s, d) => s + d.score, 0));
        setDarts([]);
        setMultiplier(1);
      }, 300);
    }
  };

  const undoLastDart = () => {
    setDarts((prev) => prev.slice(0, -1));
  };

  const handleConfirm = () => {
    if (darts.length === 0) return;
    // Pad remaining dart slots as misses for stats
    const actualDarts = [...darts];
    while (actualDarts.length < 3 && !preview.isBust && !preview.isCheckout) {
      actualDarts.push({ segment: 0, multiplier: 1, score: 0 });
    }
    onConfirm(actualDarts, turnTotal);
    setDarts([]);
    setMultiplier(1);
  };

  const handleNoScore = () => {
    const missDarts: Dart[] = [
      { segment: 0, multiplier: 1, score: 0 },
      { segment: 0, multiplier: 1, score: 0 },
      { segment: 0, multiplier: 1, score: 0 },
    ];
    onConfirm(missDarts, 0);
    setDarts([]);
    setMultiplier(1);
  };

  const canAddMore = darts.length < 3 && !preview.isBust && !preview.isCheckout;

  return (
    <div className="space-y-3">
      {/* Dart slots */}
      <div className="flex gap-2 justify-center">
        {[0, 1, 2].map((i) => {
          const dart = darts[i];
          const isActive = i === darts.length && canAddMore;
          return (
            <div
              key={i}
              className={`flex-1 max-w-[100px] h-12 rounded-xl flex items-center justify-center font-mono text-sm font-bold transition-all ${
                dart
                  ? dart.multiplier === 3
                    ? "bg-neon-purple/15 text-neon-purple border border-neon-purple/30"
                    : dart.multiplier === 2
                    ? "bg-neon-red/15 text-neon-red border border-neon-red/30"
                    : dart.segment === 0
                    ? "bg-surface text-muted border border-border"
                    : "bg-neon-green/10 text-neon-green border border-neon-green/20"
                  : isActive
                  ? "bg-surface-light border-2 border-neon-green/40 text-muted"
                  : "bg-surface border border-border text-muted/30"
              }`}
            >
              {dart ? dartLabel(dart) : isActive ? "?" : "-"}
            </div>
          );
        })}
      </div>

      {/* Running total */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Suma:</span>
          <span
            className={`font-mono text-lg font-bold ${
              preview.isBust ? "text-neon-red" : "text-foreground"
            }`}
          >
            {preview.isBust ? "BUST" : turnTotal}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">Pozostanie:</span>
          <span
            className={`font-mono text-lg font-bold ${
              preview.isCheckout
                ? "text-neon-green text-glow-green"
                : preview.isBust
                ? "text-neon-red"
                : "text-foreground"
            }`}
          >
            {preview.isCheckout ? "0!" : previewRemaining}
          </span>
        </div>
      </div>

      {/* Live checkout hint */}
      {canAddMore && !preview.isBust && previewRemaining <= 170 && previewRemaining > 1 && getCheckout(previewRemaining) && (
        <div className="glass-light rounded-xl px-4 py-1.5 text-center">
          <span className="text-xs text-muted">Zamknięcie: </span>
          <span className="font-mono text-sm text-neon-yellow font-medium">
            {getCheckout(previewRemaining)}
          </span>
        </div>
      )}

      {/* Multiplier toggle */}
      {canAddMore && (
        <div className="flex gap-2">
          {(
            [
              { m: 1 as Multiplier, label: "Single", color: "neon-green" },
              { m: 2 as Multiplier, label: "Double", color: "neon-red" },
              { m: 3 as Multiplier, label: "Triple", color: "neon-purple" },
            ] as const
          ).map(({ m, label, color }) => (
            <button
              key={m}
              onClick={() => setMultiplier(m)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                multiplier === m
                  ? `bg-${color}/15 text-${color} border border-${color}/30`
                  : "bg-surface text-muted border border-transparent hover:bg-surface-light"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Segment grid */}
      {canAddMore && (
        <div className="grid grid-cols-5 gap-1.5">
          {SEGMENTS.map((seg) => (
            <motion.button
              key={seg}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                addDart(seg, multiplier);
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                  navigator.vibrate(10);
                }
              }}
              className={`h-11 rounded-xl font-mono text-sm font-bold transition-all ${
                multiplier === 3
                  ? "bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 border border-neon-purple/20"
                  : multiplier === 2
                  ? "bg-neon-red/10 text-neon-red hover:bg-neon-red/20 border border-neon-red/20"
                  : "bg-surface text-foreground hover:bg-surface-light border border-border"
              }`}
            >
              {multiplier === 3 ? "T" : multiplier === 2 ? "D" : ""}
              {seg}
            </motion.button>
          ))}

          {/* 25 (outer bull) */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              const m = multiplier === 3 ? 1 : multiplier; // no triple on 25
              addDart(25, m as Multiplier);
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(10);
              }
            }}
            className={`h-11 rounded-xl font-mono text-sm font-bold transition-all ${
              multiplier === 2
                ? "bg-neon-red/10 text-neon-red hover:bg-neon-red/20 border border-neon-red/20"
                : "bg-surface text-foreground hover:bg-surface-light border border-border"
            }`}
          >
            {multiplier === 2 ? "D25" : "S25"}
          </motion.button>

          {/* BULL (= D25) */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              addDart(25, 2);
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(15);
              }
            }}
            className="h-11 rounded-xl font-mono text-xs font-bold bg-neon-yellow/10 text-neon-yellow hover:bg-neon-yellow/20 border border-neon-yellow/20 transition-all"
          >
            BULL
          </motion.button>

          {/* MISS */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              addDart(0, 1);
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(10);
              }
            }}
            className="h-11 rounded-xl font-mono text-xs font-bold bg-surface text-muted hover:bg-surface-light border border-border transition-all"
          >
            MISS
          </motion.button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {darts.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={undoLastDart}
            className="flex-1 h-12 rounded-xl font-bold text-sm bg-surface-light text-muted hover:bg-surface flex items-center justify-center gap-2 transition-all"
          >
            <Undo2 size={16} />
            Cofnij
          </motion.button>
        )}
        {darts.length === 0 ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleNoScore}
            className="flex-1 h-12 rounded-xl font-bold text-sm bg-surface-light text-neon-red hover:bg-neon-red/10 transition-all"
          >
            NO SCORE
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleConfirm}
            disabled={preview.isCheckout} // auto-confirmed
            className="flex-1 h-12 rounded-xl font-bold text-base bg-neon-green text-background glow-green hover:bg-neon-green-dim transition-all disabled:opacity-50"
          >
            {preview.isBust ? "Potwierdź (Bust)" : "Potwierdź"}
          </motion.button>
        )}
      </div>
    </div>
  );
}
