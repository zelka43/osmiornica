"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Trophy,
  Dumbbell,
  ChevronRight,
  ChevronDown,
  Users,
  Shuffle,
  CircleDot,
  BarChart2,
} from "lucide-react";
import NavBar from "@/components/ui/NavBar";

export default function NewGamePage() {
  const router = useRouter();
  const [trainingOpen, setTrainingOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-neon-green/10 flex items-center justify-center">
              <Target className="text-neon-green" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Nowa gra</h1>
              <p className="text-sm text-muted">Wybierz tryb rozgrywki</p>
            </div>
          </div>

          {/* Mecz */}
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Mecz</p>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/match/new/ranked")}
            className="w-full glass border border-transparent hover:border-border-bright rounded-2xl p-4 flex items-center gap-4 mb-8 transition-all duration-200"
          >
            <div className="w-11 h-11 rounded-xl bg-neon-green/10 flex items-center justify-center shrink-0">
              <Trophy className="text-neon-green" size={22} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-base">Mecz rankingowy</p>
              <p className="text-sm text-muted">501 / 301 · liczy się do statystyk</p>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </motion.button>

          {/* Tryb treningowy */}
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Tryb treningowy</p>

          <button
            onClick={() => setTrainingOpen((o) => !o)}
            className="w-full glass border border-transparent hover:border-border-bright rounded-2xl p-4 flex items-center gap-4 transition-all duration-200"
          >
            <div className="w-11 h-11 rounded-xl bg-neon-blue/10 flex items-center justify-center shrink-0">
              <Dumbbell className="text-neon-blue" size={22} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-base">Tryb treningowy</p>
              <p className="text-sm text-muted">Nie liczy się do rankingu</p>
            </div>
            <motion.div
              animate={{ rotate: trainingOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={18} className="text-muted" />
            </motion.div>
          </button>

          <AnimatePresence>
            {trainingOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2 space-y-2">
                  <TrainingCard
                    icon={<Users size={20} className="text-neon-purple" />}
                    iconBg="bg-neon-purple/10"
                    label="Gra towarzyska"
                    desc="501 / 301 · można dodać gości"
                    onClick={() => router.push("/match/new/friendly")}
                  />
                  <TrainingCard
                    icon={<Shuffle size={20} className="text-neon-yellow" />}
                    iconBg="bg-neon-yellow/10"
                    label="Losowy checkout"
                    desc="Trening finiszowania"
                    onClick={() => router.push("/training/checkout")}
                  />
                  <TrainingCard
                    icon={<CircleDot size={20} className="text-neon-green" />}
                    iconBg="bg-neon-green/10"
                    label="Trening doubli"
                    desc="D1–D20 + Bull"
                    onClick={() => router.push("/training/doubles")}
                  />
                  <TrainingCard
                    icon={<CircleDot size={20} className="text-neon-blue" />}
                    iconBg="bg-neon-blue/10"
                    label="Trening trójek"
                    desc="T1–T20"
                    onClick={() => router.push("/training/triples")}
                  />
                  <TrainingCard
                    icon={<BarChart2 size={20} className="text-neon-red" />}
                    iconBg="bg-neon-red/10"
                    label="Trening punktowy"
                    desc="10 lub 20 rund"
                    onClick={() => router.push("/training/points")}
                  />
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

function TrainingCard({
  icon,
  iconBg,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full glass border border-transparent hover:border-border-bright rounded-2xl p-3.5 flex items-center gap-3 transition-all duration-200"
    >
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted">{desc}</p>
      </div>
      <ChevronRight size={16} className="text-muted" />
    </motion.button>
  );
}
