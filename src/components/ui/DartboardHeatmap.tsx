"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Match } from "@/types";

interface DartboardHeatmapProps {
  matches: Match[];
  playerId: string;
}

// Clockwise order of segments starting from top (segment 20 is at the top)
const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Dartboard radii (in SVG units, centre at 150,150, total r=150)
const R_BULL_INNER = 9;
const R_BULL_OUTER = 22;
const R_SINGLE_INNER = 95;
const R_TRIPLE_OUTER = 108;
const R_DOUBLE_INNER = 143;
const R_DOUBLE_OUTER = 150;

const CX = 150;
const CY = 150;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function annularSectorPath(
  cx: number, cy: number,
  r1: number, r2: number,
  startAngle: number, endAngle: number
): string {
  const p1 = polarToCartesian(cx, cy, r1, startAngle);
  const p2 = polarToCartesian(cx, cy, r1, endAngle);
  const p3 = polarToCartesian(cx, cy, r2, endAngle);
  const p4 = polarToCartesian(cx, cy, r2, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function neonColor(hex: string, intensity: number): string {
  const alpha = 0.08 + intensity * 0.77;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

const COLOR_SINGLE = "#3b82f6";
const COLOR_TRIPLE = "#a855f7";
const COLOR_DOUBLE = "#22c55e";
const COLOR_BULL   = "#ef4444";

/** Same logic as dartLogic.ts isDoubleTerritory */
function isDoubleTerritory(remaining: number): boolean {
  return (remaining <= 40 && remaining % 2 === 0 && remaining > 0) || remaining === 50;
}

export default function DartboardHeatmap({ matches, playerId }: DartboardHeatmapProps) {
  const [showDoubleStats, setShowDoubleStats] = useState(false);

  // ── Raw hit counts for heatmap colouring (where darts actually landed) ──
  type HitKey = `${number}_${1 | 2 | 3}`;
  const hits: Partial<Record<HitKey, number>> = {};

  // ── Double accuracy: attempts & hits per TARGET double ──
  // Target is determined by runningRemaining when dart is thrown in double territory.
  // remaining=40 → target D20; remaining=50 → target Bull (50); etc.
  const doubleAttempts: Partial<Record<number, number>> = {}; // segment → attempts
  const doubleHits: Partial<Record<number, number>> = {};     // segment → hits

  let hasDetailedData = false;

  for (const match of matches) {
    if (!match.playerIds.includes(playerId)) continue;
    for (const turn of match.turns) {
      if (turn.playerId !== playerId || turn.darts.length === 0) continue;
      hasDetailedData = true;

      // Reconstruct remaining before this turn
      const remainingBefore = turn.isBust
        ? turn.remainingAfter
        : turn.remainingAfter + turn.turnTotal;

      let runningRemaining = remainingBefore;

      for (const dart of turn.darts) {
        // Raw hit for heatmap colouring
        if (dart.segment !== 0) {
          const key: HitKey = `${dart.segment}_${dart.multiplier}`;
          hits[key] = (hits[key] ?? 0) + 1;
        }

        // Double accuracy tracking
        if (isDoubleTerritory(runningRemaining)) {
          // Target double is the segment corresponding to runningRemaining
          const targetSeg = runningRemaining === 50 ? 50 : runningRemaining / 2;
          doubleAttempts[targetSeg] = (doubleAttempts[targetSeg] ?? 0) + 1;
          // Hit = dart scored exactly the remaining, on a double
          if (dart.score === runningRemaining && dart.multiplier === 2) {
            doubleHits[targetSeg] = (doubleHits[targetSeg] ?? 0) + 1;
          }
        }

        runningRemaining -= dart.score;
        if (runningRemaining <= 0) break;
      }
    }
  }

  if (!hasDetailedData) {
    return (
      <div className="flex items-center justify-center h-24 text-muted text-xs text-center opacity-60">
        Brak danych<br />(tylko tryb detailed rejestruje rzuty)
      </div>
    );
  }

  // Normalise for heatmap colouring
  let maxSingle = 1, maxTriple = 1, maxDouble = 1;
  for (const seg of SEGMENT_ORDER) {
    maxSingle = Math.max(maxSingle, hits[`${seg}_1`] ?? 0);
    maxTriple = Math.max(maxTriple, hits[`${seg}_3`] ?? 0);
    maxDouble = Math.max(maxDouble, hits[`${seg}_2`] ?? 0);
  }
  const bullHits      = hits[`50_2`] ?? 0;
  const outerBullHits = hits[`25_1`] ?? 0;
  const maxBull = Math.max(1, bullHits, outerBullHits);

  const segments = SEGMENT_ORDER.map((seg, i) => {
    const startAngle = i * 18 - 9;
    const endAngle   = startAngle + 18;
    return {
      seg, startAngle, endAngle,
      singleHits: hits[`${seg}_1`] ?? 0,
      tripleHits: hits[`${seg}_3`] ?? 0,
      doubleHits: hits[`${seg}_2`] ?? 0,
    };
  });

  // Double breakdown sorted by attempts
  const allDoubleSegments = [...SEGMENT_ORDER.map(s => s), 50]; // 1-20 + Bull
  const doubleBreakdown = allDoubleSegments
    .map((seg) => ({
      label: seg === 50 ? "Bull" : `D${seg}`,
      seg,
      attempts: doubleAttempts[seg] ?? 0,
      hits: doubleHits[seg] ?? 0,
    }))
    .filter((d) => d.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts);

  const maxAttempts = Math.max(1, ...doubleBreakdown.map((d) => d.attempts));

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 300 300"
        width="100%"
        style={{ maxWidth: 300 }}
        className="overflow-visible"
      >
        <circle cx={CX} cy={CY} r={R_DOUBLE_OUTER} fill="rgba(0,0,0,0.6)" />

        {segments.map(({ seg, startAngle, endAngle, singleHits, tripleHits, doubleHits: dh }) => (
          <g key={seg}>
            <path
              d={annularSectorPath(CX, CY, R_BULL_OUTER, R_SINGLE_INNER, startAngle, endAngle)}
              fill={neonColor(COLOR_SINGLE, singleHits / maxSingle)}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
            ><title>{seg} (single): {singleHits}</title></path>
            <path
              d={annularSectorPath(CX, CY, R_SINGLE_INNER, R_TRIPLE_OUTER, startAngle, endAngle)}
              fill={neonColor(COLOR_TRIPLE, tripleHits / maxTriple)}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
            ><title>T{seg}: {tripleHits}</title></path>
            <path
              d={annularSectorPath(CX, CY, R_TRIPLE_OUTER, R_DOUBLE_INNER, startAngle, endAngle)}
              fill={neonColor(COLOR_SINGLE, singleHits / maxSingle)}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
            ><title>{seg} (single): {singleHits}</title></path>
            <path
              d={annularSectorPath(CX, CY, R_DOUBLE_INNER, R_DOUBLE_OUTER, startAngle, endAngle)}
              fill={neonColor(COLOR_DOUBLE, dh / maxDouble)}
              stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}
            ><title>D{seg}: {dh}</title></path>
            {(() => {
              const midAngle = (startAngle + endAngle) / 2;
              const pos = polarToCartesian(CX, CY, R_DOUBLE_OUTER + 10, midAngle);
              return (
                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={8} fill="rgba(255,255,255,0.45)" fontFamily="monospace">
                  {seg}
                </text>
              );
            })()}
          </g>
        ))}

        <circle cx={CX} cy={CY} r={R_BULL_OUTER}
          fill={neonColor(COLOR_BULL, outerBullHits / maxBull)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}>
          <title>25 (outer bull): {outerBullHits}</title>
        </circle>
        <circle cx={CX} cy={CY} r={R_BULL_INNER}
          fill={neonColor(COLOR_BULL, bullHits / maxBull)}
          stroke="rgba(255,255,255,0.06)" strokeWidth={0.5}>
          <title>Bull (50): {bullHits}</title>
        </circle>
      </svg>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-muted flex-wrap justify-center">
        {[
          { color: COLOR_DOUBLE, label: "Double" },
          { color: COLOR_TRIPLE, label: "Triple" },
          { color: COLOR_SINGLE, label: "Single" },
          { color: COLOR_BULL,   label: "Bull" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color, opacity: 0.8 }} />
            {label}
          </span>
        ))}
      </div>

      {/* Double accuracy toggle */}
      {doubleBreakdown.length > 0 && (
        <button
          onClick={() => setShowDoubleStats((v) => !v)}
          className="text-xs text-muted underline underline-offset-2 opacity-70 active:opacity-50"
        >
          {showDoubleStats ? "Ukryj szczegóły doubli ▲" : "Szczegóły doubli ▼"}
        </button>
      )}

      <AnimatePresence>
        {showDoubleStats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden w-full"
          >
            <div className="space-y-1.5 w-full pt-1">
              {/* Header */}
              <div className="grid grid-cols-[3rem_1fr_5rem_4rem] gap-x-2 text-[10px] text-muted px-1 mb-2">
                <span>Double</span>
                <span>Próby</span>
                <span className="text-right">Traf/Próby</span>
                <span className="text-right">%</span>
              </div>
              {doubleBreakdown.map((d) => {
                const pct = d.attempts > 0 ? (d.hits / d.attempts) * 100 : 0;
                return (
                  <div key={d.label} className="grid grid-cols-[3rem_1fr_5rem_4rem] gap-x-2 items-center px-1">
                    <span className="text-xs font-mono font-semibold text-accent-ink">{d.label}</span>
                    <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.attempts / maxAttempts) * 100}%`, background: COLOR_DOUBLE, opacity: 0.6 }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-right text-foreground">
                      {d.hits}/{d.attempts}
                    </span>
                    <span className="text-[11px] font-mono text-right text-extra-ink">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted text-center pt-1 opacity-60">
                Próby liczone gdy remaining = wartość danego doubla
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
