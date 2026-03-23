"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, UserPlus, Users, Pencil, Camera, X, Check } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { getPlayers, addPlayer, removePlayer, updatePlayer, uploadAvatar, deleteAvatar } from "@/lib/store";
import type { Player } from "@/types";
import { PLAYER_COLORS } from "@/types";

export default function PlayersManagePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setPlayers(await getPlayers());
      setMounted(true);
    }
    load();
  }, []);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const player = await addPlayer(trimmed);
    setPlayers((prev) => [...prev, player]);
    setName("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const handleDelete = async (id: string) => {
    if (confirmId === id) {
      await deleteAvatar(id);
      await removePlayer(id);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId(null), 3000);
    }
  };

  const openEdit = (player: Player) => {
    setEditingPlayer(player);
    setEditName(player.displayName);
  };

  const handleSaveName = async () => {
    if (!editingPlayer || !editName.trim()) return;
    const updated = { ...editingPlayer, displayName: editName.trim() };
    await updatePlayer(updated);
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPlayer(updated);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingPlayer) return;

    setUploading(true);
    const url = await uploadAvatar(editingPlayer.id, file);
    if (url) {
      const updated = { ...editingPlayer, avatarUrl: url };
      await updatePlayer(updated);
      setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPlayer(updated);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    if (!editingPlayer) return;
    setUploading(true);
    await deleteAvatar(editingPlayer.id);
    const updated = { ...editingPlayer, avatarUrl: null };
    await updatePlayer(updated);
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPlayer(updated);
    setUploading(false);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="skeleton h-10 w-32" />
            <div className="skeleton h-14 w-full rounded-2xl" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-16 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        </main>
        <NavBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-lg mx-auto space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Gracze</h1>
              <p className="text-muted text-sm mt-0.5">
                {players.length === 0
                  ? "Dodaj graczy, aby rozpocząć"
                  : `${players.length} ${players.length === 1 ? "gracz" : players.length < 5 ? "graczy" : "graczy"}`}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center">
              <Users size={20} className="text-neon-purple" />
            </div>
          </div>

          {/* Add Player */}
          <div className="glass rounded-2xl p-4">
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Imię gracza..."
                maxLength={20}
                className="flex-1 bg-surface rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted border border-border focus:border-neon-green/40 focus:outline-none focus:ring-1 focus:ring-neon-green/20 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={!name.trim()}
                className="px-5 py-3 rounded-xl bg-neon-green/15 text-neon-green font-semibold text-sm border border-neon-green/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neon-green/25"
              >
                <span className="hidden sm:inline">Dodaj</span>
                <UserPlus size={18} className="sm:hidden" />
              </button>
            </div>
          </div>

          {/* Player List */}
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {players.map((player, index) => {
                const colorClass =
                  PLAYER_COLORS[index % PLAYER_COLORS.length];
                const initial = player.displayName.charAt(0).toUpperCase();
                const isConfirming = confirmId === player.id;

                return (
                  <motion.div
                    key={player.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -60 }}
                    transition={{ duration: 0.25, ease: "easeOut" as const }}
                    className="glass rounded-2xl p-4 flex items-center gap-4"
                  >
                    {/* Avatar */}
                    {player.avatarUrl ? (
                      <img
                        src={player.avatarUrl}
                        alt={player.displayName}
                        className="w-11 h-11 rounded-full object-cover shrink-0 shadow-lg"
                      />
                    ) : (
                      <div
                        className={`w-11 h-11 rounded-full bg-gradient-to-br ${colorClass} flex items-center justify-center shrink-0 shadow-lg`}
                      >
                        <span className="text-white font-bold text-base drop-shadow">
                          {initial}
                        </span>
                      </div>
                    )}

                    {/* Name & stats */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {player.displayName}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {player.stats.matchesPlayed} mecz
                        {player.stats.matchesPlayed === 1
                          ? ""
                          : player.stats.matchesPlayed < 5
                            ? "e"
                            : "y"}{" "}
                        &middot; {player.stats.matchesWon} wygran
                        {player.stats.matchesWon === 1
                          ? "a"
                          : player.stats.matchesWon < 5
                            ? "e"
                            : "ych"}
                      </p>
                    </div>

                    {/* Edit button */}
                    <button
                      onClick={() => openEdit(player)}
                      className="p-2.5 rounded-xl bg-surface text-muted hover:text-neon-blue hover:bg-neon-blue/10 border border-transparent transition-all active:scale-90"
                      title="Edytuj gracza"
                    >
                      <Pencil size={16} />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(player.id)}
                      className={`p-2.5 rounded-xl transition-all active:scale-90 ${
                        isConfirming
                          ? "bg-neon-red/20 text-neon-red border border-neon-red/30"
                          : "bg-surface text-muted hover:text-neon-red hover:bg-neon-red/10 border border-transparent"
                      }`}
                      title={
                        isConfirming
                          ? "Kliknij ponownie, aby usunąć"
                          : "Usuń gracza"
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Empty state */}
          {players.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-10 text-center"
            >
              <Users size={36} className="text-muted mx-auto mb-3" />
              <p className="text-muted text-sm">
                Brak graczy. Dodaj pierwszego gracza
                <br />
                używając pola powyżej.
              </p>
            </motion.div>
          )}
        </motion.div>
      </main>
      <NavBar />

      {/* Edit Player Modal */}
      <AnimatePresence>
        {editingPlayer && (
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
              className="glass rounded-3xl p-6 w-full max-w-sm space-y-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Edytuj profil</h3>
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="p-2 rounded-xl hover:bg-surface transition-colors"
                >
                  <X size={18} className="text-muted" />
                </button>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {editingPlayer.avatarUrl ? (
                    <img
                      src={editingPlayer.avatarUrl}
                      alt={editingPlayer.displayName}
                      className="w-24 h-24 rounded-full object-cover shadow-xl border-2 border-white/10"
                    />
                  ) : (
                    <div
                      className={`w-24 h-24 rounded-full bg-gradient-to-br ${
                        PLAYER_COLORS[
                          players.findIndex((p) => p.id === editingPlayer.id) %
                            PLAYER_COLORS.length
                        ]
                      } flex items-center justify-center shadow-xl border-2 border-white/10`}
                    >
                      <span className="text-white font-bold text-3xl drop-shadow">
                        {editingPlayer.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Camera overlay button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-neon-blue flex items-center justify-center shadow-lg hover:bg-neon-blue/80 transition-all disabled:opacity-50"
                  >
                    <Camera size={16} className="text-white" />
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />

                {uploading && (
                  <p className="text-xs text-neon-blue animate-pulse">Przesyłanie...</p>
                )}

                {editingPlayer.avatarUrl && !uploading && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-xs text-neon-red hover:text-neon-red/80 transition-colors"
                  >
                    Usuń zdjęcie
                  </button>
                )}
              </div>

              {/* Name edit */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Nazwa gracza
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    maxLength={20}
                    className="flex-1 bg-surface rounded-xl px-4 py-3 text-sm text-foreground border border-border focus:border-neon-green/40 focus:outline-none focus:ring-1 focus:ring-neon-green/20 transition-colors"
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={!editName.trim() || editName.trim() === editingPlayer.displayName}
                    className="px-4 py-3 rounded-xl bg-neon-green/15 text-neon-green font-semibold text-sm border border-neon-green/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Check size={18} />
                  </button>
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setEditingPlayer(null)}
                className="w-full rounded-xl py-3 bg-surface text-foreground font-medium text-sm hover:bg-surface-light transition-all"
              >
                Zamknij
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
