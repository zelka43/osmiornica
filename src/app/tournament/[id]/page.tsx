"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Trophy, ChevronLeft, Play } from "lucide-react";

import NavBar from "@/components/ui/NavBar";
import { getTournamentById, getMatches, saveTournament, saveMatch, setActiveMatch } from "@/lib/store";
import { applyLegResult, isPlayable } from "@/lib/tournament";
import { createInitialMatchState } from "@/lib/dartLogic";
import type { Match, Tournament, TournamentMatch } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Wrapper dla react-hooks/purity — znaczniki czasu powstają tylko w handlerach
const now = () => Date.now();

export default function TournamentBracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [legMatches, setLegMatches] = useState<Match[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    void (async () => {
      const t = await getTournamentById(id);
      if (!t) {
        setTournament(null);
        setMounted(true);
        return;
      }
      const legs = (await getMatches({ withTurns: false })).filter((m) => m.tournamentId === id);
      // Przelicz stan drabinki z wyników legów; zapisz jeśli się zmienił
      const recomputed = applyLegResult(t, legs);
      if (JSON.stringify(recomputed) !== JSON.stringify(t)) {
        await saveTournament(recomputed);
      }
      setTournament(recomputed);
      setLegMatches(legs);
      setMounted(true);
    })();
  }, [id]);

  const nameOf = (pid: string | null): string => {
    if (!pid || !tournament) return "—";
    const i = tournament.playerIds.indexOf(pid);
    return i >= 0 ? tournament.playerNames[i] : "?";
  };

  // Wygrane legi w danym węźle, per gracz
  const legsWonIn = (node: TournamentMatch): Record<string, number> => {
    const w: Record<string, number> = {};
    for (const lid of node.legMatchIds) {
      const m = legMatches.find((x) => x.id === lid);
      if (m && m.status === "completed" && m.winnerId) w[m.winnerId] = (w[m.winnerId] ?? 0) + 1;
    }
    return w;
  };

  const handlePlay = async (node: TournamentMatch) => {
    if (!tournament || !node.p1Id || !node.p2Id) return;

    // Wznów istniejący niezakończony leg tego węzła, jeśli jest
    const existing = node.legMatchIds
      .map((lid) => legMatches.find((m) => m.id === lid))
      .find((m) => m && m.status !== "completed");
    if (existing) {
      await setActiveMatch(existing);
      router.push(`/match/${existing.id}`);
      return;
    }

    const startingScore = parseInt(tournament.gameMode);
    const ids = [node.p1Id, node.p2Id];
    const scores: Match["scores"] = {};
    ids.forEach((pid) => { scores[pid] = createInitialMatchState(startingScore); });

    const leg: Match = {
      id: uuidv4(),
      gameMode: tournament.gameMode,
      startingScore,
      playerIds: ids,
      playerNames: ids.map(nameOf),
      status: "active",
      currentPlayerIndex: 0,
      scores,
      winnerId: null,
      winnerName: null,
      createdAt: now(),
      completedAt: null,
      turns: [],
      matchType: "tournament",
      tournamentId: tournament.id,
    };

    // KOLEJNOŚĆ KRYTYCZNA: dopisz leg do węzła i zapisz turniej PRZED nawigacją
    const updated: Tournament = {
      ...tournament,
      bracket: tournament.bracket.map((n) =>
        n.id === node.id ? { ...n, legMatchIds: [...n.legMatchIds, leg.id] } : n
      ),
    };
    await saveTournament(updated);
    await saveMatch(leg);
    await setActiveMatch(leg);
    router.push(`/match/${leg.id}`);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 px-4 pt-6 pb-24">
          <div className="skeleton h-8 w-48 mb-6" />
          <div className="skeleton h-24 w-full mb-4" />
        </main>
        <NavBar />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 px-4 pt-6 pb-24">
          <p className="text-muted text-center py-10">Nie znaleziono turnieju.</p>
          <button onClick={() => router.push("/tournament")} className="mx-auto flex items-center gap-1 text-sm text-muted">
            <ChevronLeft size={16} /> Turnieje
          </button>
        </main>
        <NavBar />
      </div>
    );
  }

  const maxRound = Math.max(...tournament.bracket.map((n) => n.round));
  const roundLabel = (r: number): string => {
    const fromEnd = maxRound - r;
    if (fromEnd === 0) return "Finał";
    if (fromEnd === 1) return "Półfinał";
    if (fromEnd === 2) return "Ćwierćfinał";
    return `Runda ${r + 1}`;
  };

  const champName = tournament.championId ? nameOf(tournament.championId) : null;

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => router.push("/tournament")} className="w-10 h-10 rounded-xl glass flex items-center justify-center">
              <ChevronLeft size={20} className="text-muted" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-neon-yellow/10 flex items-center justify-center">
              <Trophy className="text-neon-yellow" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{tournament.name}</h1>
              <p className="text-xs text-muted">{tournament.gameMode} · do {tournament.legsToWin} legów</p>
            </div>
          </div>

          {/* Baner mistrza */}
          {champName && (
            <div className="glass glow-green rounded-2xl p-5 mb-5 text-center border border-neon-yellow/30">
              <Trophy size={36} className="text-neon-yellow mx-auto mb-2" />
              <p className="text-xs text-muted uppercase tracking-wider">Zwycięzca</p>
              <p className="text-2xl font-bold text-neon-green text-glow-green">{champName}</p>
            </div>
          )}

          {/* Rundy */}
          <div className="space-y-6">
            {Array.from({ length: maxRound + 1 }, (_, r) => r).map((r) => (
              <div key={r}>
                <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">{roundLabel(r)}</p>
                <div className="space-y-2">
                  {tournament.bracket
                    .filter((n) => n.round === r)
                    .sort((a, b) => a.slot - b.slot)
                    .map((node) => {
                      const isBye = node.round === 0 && (!node.p1Id || !node.p2Id) && node.winnerId !== null;
                      const wins = legsWonIn(node);
                      const playable = isPlayable(node);
                      const decided = !!node.winnerId;
                      const nodeLegs = node.legMatchIds
                        .map((lid) => legMatches.find((m) => m.id === lid))
                        .filter((m): m is Match => !!m);
                      const unfinishedLeg = nodeLegs.some((m) => m.status !== "completed");
                      const completedCount = nodeLegs.filter((m) => m.status === "completed").length;
                      const w1 = node.p1Id ? wins[node.p1Id] ?? 0 : 0;
                      const w2 = node.p2Id ? wins[node.p2Id] ?? 0 : 0;
                      return (
                        <div
                          key={node.id}
                          className={`glass rounded-2xl p-3 transition-all ${
                            playable
                              ? "border-2 border-neon-green/40 glow-green"
                              : isBye
                              ? "border border-neon-yellow/20"
                              : decided
                              ? "border border-white/5 opacity-75"
                              : "border border-transparent"
                          }`}
                        >
                          {isBye ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm">{nameOf(node.winnerId)}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest bg-neon-yellow/10 text-neon-yellow px-2 py-0.5 rounded-full shrink-0">
                                Wolny los
                              </span>
                            </div>
                          ) : (
                            <>
                              <PlayerRow
                                name={nameOf(node.p1Id)}
                                known={!!node.p1Id}
                                legs={w1}
                                target={tournament.legsToWin}
                                isWinner={decided && node.winnerId === node.p1Id}
                              />
                              <div className="flex items-center gap-2 my-1.5">
                                <div className="h-px bg-white/5 flex-1" />
                                {(node.p1Id || node.p2Id) && (
                                  <span className="font-mono text-[11px] font-bold text-muted">
                                    {w1}:{w2}
                                  </span>
                                )}
                                <div className="h-px bg-white/5 flex-1" />
                              </div>
                              <PlayerRow
                                name={nameOf(node.p2Id)}
                                known={!!node.p2Id}
                                legs={w2}
                                target={tournament.legsToWin}
                                isWinner={decided && node.winnerId === node.p2Id}
                              />
                              {playable && (
                                <button
                                  onClick={() => handlePlay(node)}
                                  className="w-full mt-3 rounded-xl py-2.5 font-bold bg-neon-green text-background glow-green flex items-center justify-center gap-2"
                                >
                                  <Play size={16} />
                                  {unfinishedLeg
                                    ? "Wznów mecz"
                                    : completedCount > 0
                                    ? `Graj — leg ${completedCount + 1}`
                                    : "Graj"}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
      <NavBar />
    </div>
  );
}

function PlayerRow({
  name,
  legs,
  target,
  isWinner,
  known,
}: {
  name: string;
  legs: number;
  target: number;
  isWinner: boolean;
  known: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`text-sm truncate flex items-center gap-1.5 ${
          isWinner
            ? "font-bold text-neon-green"
            : known
            ? "font-medium"
            : "italic text-muted/60"
        }`}
      >
        {isWinner && <Trophy size={13} className="text-neon-yellow shrink-0" />}
        {known ? name : "Czeka…"}
      </span>
      <span
        className={`font-mono text-sm font-bold shrink-0 px-1.5 rounded-md ${
          isWinner ? "text-neon-green bg-neon-green/10" : legs > 0 ? "text-muted" : "text-muted/50"
        }`}
      >
        {legs}
        <span className="text-[10px] font-normal text-muted/60">/{target}</span>
      </span>
    </div>
  );
}
