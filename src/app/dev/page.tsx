"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Trash2, Calendar, Download, Upload, AlertTriangle, ArrowLeft, Target, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  deleteMatchesSince,
  recalculateAllPlayerStats,
  recalculateDoublesFromHistory,
  clearAllData,
  exportAllData,
  importAllData,
  getMatches,
  deleteMatch,
  getAppSetting,
  setAppSetting,
} from "@/lib/store";
import type { Match } from "@/types";

const DEV_PASSWORD = "dart2024";

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function DevPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [deleteDate, setDeleteDate] = useState("");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rankingMode, setRankingMode] = useState<"winpct" | "points" | "rating">("winpct");
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      const saved = await getAppSetting("ranking_mode");
      if (saved === "points" || saved === "winpct" || saved === "rating") setRankingMode(saved);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (authenticated) {
      getMatches().then((m) =>
        setAllMatches(
          m
            .filter((x) => x.status === "completed")
            .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt))
        )
      );
    }
  }, [authenticated]);

  const handleDeleteMatch = async (id: string) => {
    await deleteMatch(id);
    await recalculateAllPlayerStats();
    setAllMatches((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeleteMatchId(null);
    showMessage("Mecz usunięty i statystyki przeliczone.");
  };

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLogin = () => {
    if (password === DEV_PASSWORD) {
      setAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const handleDeleteSince = async () => {
    if (!deleteDate) return;
    const timestamp = new Date(deleteDate).getTime();
    const matchesBefore = (await getMatches()).length;
    await deleteMatchesSince(timestamp);
    await recalculateAllPlayerStats();
    const matchesAfter = (await getMatches()).length;
    const deleted = matchesBefore - matchesAfter;
    showMessage(`Usunięto ${deleted} meczów i przeliczono statystyki.`);
    setConfirmAction(null);
    setDeleteDate("");
  };

  const handleClearAll = async () => {
    await clearAllData();
    showMessage("Wszystkie dane zostały usunięte.");
    setConfirmAction(null);
  };

  const handleRecalculate = async () => {
    await recalculateAllPlayerStats();
    showMessage("Statystyki zostały przeliczone.");
    setConfirmAction(null);
  };

  const handleRecalculateDoubles = async () => {
    const fixed = await recalculateDoublesFromHistory();
    showMessage(`Przeliczono double w ${fixed} meczu/${fixed === 1 ? "" : "ach"} (tryb szczegółowy).`);
    setConfirmAction(null);
  };

  const handleRankingModeChange = async (mode: "winpct" | "points" | "rating") => {
    setRankingMode(mode);
    await setAppSetting("ranking_mode", mode);
    const labels = { winpct: "% zwycięstw", points: "Pokonani × Win%", rating: "W/E[W]" };
    showMessage(`Tryb rankingu: ${labels[mode]}`);
  };

  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dart-scorer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage("Dane wyeksportowane.");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await importAllData(ev.target?.result as string);
        showMessage("Dane zaimportowane pomyślnie.");
      } catch {
        showMessage("Błąd importu — nieprawidłowy format pliku.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  if (!authenticated) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-8 w-full max-w-sm text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-neon-red/10 flex items-center justify-center mx-auto">
            <Shield size={32} className="text-neon-red" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-1">Tryb developera</h1>
            <p className="text-xs text-muted">Wprowadź hasło, aby kontynuować</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Hasło"
              className={`w-full bg-surface rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/50 border ${
                passwordError ? "border-neon-red/50" : "border-white/5"
              } focus:outline-none focus:border-neon-blue/30`}
            />
            {passwordError && (
              <p className="text-neon-red text-xs">Nieprawidłowe hasło</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full rounded-xl py-3 bg-neon-red/15 text-neon-red font-bold text-sm hover:bg-neon-red/25 transition-all"
            >
              Zaloguj
            </button>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            ← Wróć
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.08 } } }}
          className="max-w-lg mx-auto space-y-4"
        >
          {/* Header */}
          <motion.div variants={item} className="flex items-center gap-3 pt-4">
            <button
              onClick={() => router.push("/")}
              className="w-10 h-10 rounded-xl glass flex items-center justify-center"
            >
              <ArrowLeft size={18} className="text-muted" />
            </button>
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-neon-red" />
              <h1 className="text-lg font-bold text-foreground">Tryb developera</h1>
            </div>
          </motion.div>

          {/* Message toast */}
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                message.type === "success"
                  ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                  : "bg-neon-red/10 text-neon-red border border-neon-red/20"
              }`}
            >
              {message.text}
            </motion.div>
          )}

          {/* Delete stats from date */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-neon-yellow" />
              <h2 className="text-sm font-bold text-foreground">Usuń mecze od daty</h2>
            </div>
            <p className="text-xs text-muted">
              Usuwa wszystkie mecze od wybranej daty i przelicza statystyki graczy.
            </p>
            <input
              type="date"
              value={deleteDate}
              onChange={(e) => setDeleteDate(e.target.value)}
              className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-foreground border border-white/5 focus:outline-none focus:border-neon-blue/30"
            />
            {confirmAction === "deleteSince" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteSince}
                  className="flex-1 rounded-xl py-2.5 bg-neon-red/15 text-neon-red font-bold text-xs hover:bg-neon-red/25 transition-all"
                >
                  Potwierdź usunięcie
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-xl py-2.5 bg-surface text-muted font-bold text-xs hover:bg-surface-light transition-all"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => deleteDate && setConfirmAction("deleteSince")}
                disabled={!deleteDate}
                className="w-full rounded-xl py-2.5 bg-neon-yellow/10 text-neon-yellow font-bold text-xs hover:bg-neon-yellow/20 transition-all disabled:opacity-30"
              >
                Usuń mecze
              </button>
            )}
          </motion.div>

          {/* Recalculate stats */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-neon-blue" />
              <h2 className="text-sm font-bold text-foreground">Przelicz statystyki</h2>
            </div>
            <p className="text-xs text-muted">
              Przelicza statystyki wszystkich graczy i rekordy H2H na podstawie istniejących meczów.
            </p>
            {confirmAction === "recalculate" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleRecalculate}
                  className="flex-1 rounded-xl py-2.5 bg-neon-blue/15 text-neon-blue font-bold text-xs hover:bg-neon-blue/25 transition-all"
                >
                  Potwierdź
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-xl py-2.5 bg-surface text-muted font-bold text-xs hover:bg-surface-light transition-all"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("recalculate")}
                className="w-full rounded-xl py-2.5 bg-neon-blue/10 text-neon-blue font-bold text-xs hover:bg-neon-blue/20 transition-all"
              >
                Przelicz
              </button>
            )}
          </motion.div>

          {/* Export / Import */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Download size={18} className="text-neon-purple" />
              <h2 className="text-sm font-bold text-foreground">Backup danych</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 rounded-xl py-2.5 bg-neon-purple/10 text-neon-purple font-bold text-xs hover:bg-neon-purple/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Download size={14} />
                Eksport
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 rounded-xl py-2.5 bg-neon-green/10 text-neon-green font-bold text-xs hover:bg-neon-green/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Upload size={14} />
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </motion.div>

          {/* Ranking mode */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy size={18} className="text-neon-yellow" />
              <h2 className="text-sm font-bold text-foreground">Tryb rankingu (tabela)</h2>
            </div>
            <p className="text-xs text-muted">
              Sposób sortowania graczy w tabeli statystyk.
            </p>
            <div className="flex gap-1 p-1 bg-surface rounded-xl">
              <button
                onClick={() => handleRankingModeChange("winpct")}
                className={`flex-1 rounded-lg py-2 text-[10px] font-bold transition-all ${
                  rankingMode === "winpct"
                    ? "bg-neon-green/15 text-neon-green"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Win%
              </button>
              <button
                onClick={() => handleRankingModeChange("points")}
                className={`flex-1 rounded-lg py-2 text-[10px] font-bold transition-all ${
                  rankingMode === "points"
                    ? "bg-neon-yellow/15 text-neon-yellow"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Pkt
              </button>
              <button
                onClick={() => handleRankingModeChange("rating")}
                className={`flex-1 rounded-lg py-2 text-[10px] font-bold transition-all ${
                  rankingMode === "rating"
                    ? "bg-neon-blue/15 text-neon-blue"
                    : "text-muted hover:text-foreground"
                }`}
              >
                W/E[W]
              </button>
            </div>
            <p className="text-xs text-muted">
              {rankingMode === "winpct" && "Klasyczny ranking: % wygranych meczów."}
              {rankingMode === "points" && "Pkt = Pokonani gracze × Win%. Nagradza wygrywanie z większymi grupami."}
              {rankingMode === "rating" && "W/E[W]: wygrane / oczekiwane wygrane (Σ 1/n). Wygrana z 6 osobami = 6× trudniejsza niż z 2."}
            </p>
          </motion.div>

          {/* Recalculate doubles */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-neon-purple" />
              <h2 className="text-sm font-bold text-foreground">Przelicz double z historii</h2>
            </div>
            <p className="text-xs text-muted">
              Naprawia statystyki doubli dla meczów w trybie szczegółowym (dart po darcie), na podstawie zapisanych rzutów.
            </p>
            {confirmAction === "recalcDoubles" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleRecalculateDoubles}
                  className="flex-1 rounded-xl py-2.5 bg-neon-purple/15 text-neon-purple font-bold text-xs hover:bg-neon-purple/25 transition-all"
                >
                  Potwierdź
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-xl py-2.5 bg-surface text-muted font-bold text-xs hover:bg-surface-light transition-all"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("recalcDoubles")}
                className="w-full rounded-xl py-2.5 bg-neon-purple/10 text-neon-purple font-bold text-xs hover:bg-neon-purple/20 transition-all"
              >
                Przelicz double
              </button>
            )}
          </motion.div>

          {/* Delete individual match */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 size={18} className="text-neon-red" />
              <h2 className="text-sm font-bold text-foreground">Usuń pojedynczy mecz</h2>
            </div>
            <p className="text-xs text-muted">
              Usuwa wybrany mecz i przelicza statystyki wszystkich graczy.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allMatches.length === 0 && (
                <p className="text-xs text-muted text-center py-2">Brak meczów</p>
              )}
              {allMatches.map((m) => {
                const ts = m.completedAt ?? m.createdAt;
                const dateStr = new Date(ts).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
                const timeStr = new Date(ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
                const winner = m.playerNames[m.playerIds.indexOf(m.winnerId ?? "")];
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 bg-surface rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted font-mono">{dateStr}, {timeStr}</p>
                      <p className="text-xs text-foreground truncate">{m.playerNames.join(" vs ")}</p>
                      {winner && <p className="text-[10px] text-neon-green">🏆 {winner}</p>}
                    </div>
                    {confirmDeleteMatchId === m.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleDeleteMatch(m.id)}
                          className="rounded-lg px-2 py-1 bg-neon-red/15 text-neon-red font-bold text-[10px] hover:bg-neon-red/25 transition-all"
                        >
                          Usuń
                        </button>
                        <button
                          onClick={() => setConfirmDeleteMatchId(null)}
                          className="rounded-lg px-2 py-1 bg-surface-light text-muted font-bold text-[10px] hover:bg-surface-light transition-all"
                        >
                          Anuluj
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteMatchId(m.id)}
                        className="shrink-0 p-1.5 rounded-lg hover:bg-neon-red/10 transition-all"
                      >
                        <Trash2 size={13} className="text-muted hover:text-neon-red" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Clear all data */}
          <motion.div variants={item} className="glass rounded-2xl p-4 space-y-3 border border-neon-red/10">
            <div className="flex items-center gap-2">
              <Trash2 size={18} className="text-neon-red" />
              <h2 className="text-sm font-bold text-neon-red">Wyczyść wszystkie dane</h2>
            </div>
            <p className="text-xs text-muted">
              Usuwa wszystkich graczy, mecze, rekordy H2H i aktywny mecz. Tej operacji nie można cofnąć!
            </p>
            {confirmAction === "clearAll" ? (
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="flex-1 rounded-xl py-2.5 bg-neon-red text-background font-bold text-xs hover:bg-neon-red/80 transition-all"
                >
                  Tak, wyczyść wszystko
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 rounded-xl py-2.5 bg-surface text-muted font-bold text-xs hover:bg-surface-light transition-all"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmAction("clearAll")}
                className="w-full rounded-xl py-2.5 bg-neon-red/10 text-neon-red font-bold text-xs hover:bg-neon-red/20 transition-all"
              >
                Wyczyść dane
              </button>
            )}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
