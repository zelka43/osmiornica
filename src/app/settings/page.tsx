"use client";

import Link from "next/link";
import { ChevronLeft, Check } from "lucide-react";
import NavBar from "@/components/ui/NavBar";
import { setTheme, type Theme } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";

// Podgląd rysowany stałymi kolorami motywu — wygląda tak samo niezależnie od aktywnego
const OPTIONS: {
  id: Theme;
  name: string;
  description: string;
  preview: { bg: string; card: string; fg: string; muted: string; accent: string; onAccent: string; font: string };
}[] = [
  {
    id: "odswiezony",
    name: "Odświeżony",
    description: "Ciemny, zielony akcent. Dobry wieczorem i przy słabym świetle.",
    preview: {
      bg: "#0b0d10",
      card: "#13171b",
      fg: "#eceef0",
      muted: "#8b929a",
      accent: "#34e39a",
      onAccent: "#06140d",
      font: "var(--font-geist-mono), monospace",
    },
  },
  {
    id: "drogowskaz",
    name: "Drogowskaz",
    description: "Jasny, żółte pasy jak oznakowanie. Najczytelniejszy w dzień.",
    preview: {
      bg: "#f4f4f2",
      card: "#ffffff",
      fg: "#0b0b0b",
      muted: "#555555",
      accent: "#ffcc00",
      onAccent: "#0b0b0b",
      font: "var(--font-asap), sans-serif",
    },
  },
];

export default function SettingsPage() {
  const theme = useTheme();

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-24">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Wróć"
              className="w-11 h-11 rounded-xl glass flex items-center justify-center"
            >
              <ChevronLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold">Ustawienia</h1>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold mb-1">Wygląd</legend>
            <p className="text-sm text-muted">Zapisywany na tym telefonie — każdy może mieć swój.</p>

            {OPTIONS.map((opt) => {
              const selected = theme === opt.id;
              const p = opt.preview;
              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-4 p-3 rounded-2xl cursor-pointer border-2 transition-colors ${
                    selected ? "border-accent-ink bg-card" : "border-border bg-card hover:bg-card-hover"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={opt.id}
                    checked={selected}
                    onChange={() => setTheme(opt.id)}
                    className="sr-only"
                  />
                  <div
                    aria-hidden="true"
                    className="w-24 h-20 rounded-xl overflow-hidden shrink-0 flex flex-col"
                    style={{ background: p.bg, border: `1px solid ${p.muted}40` }}
                  >
                    <div className="h-4" style={{ background: opt.id === "drogowskaz" ? p.fg : "transparent" }} />
                    <div className="flex-1 flex items-end justify-between px-2 pb-1" style={{ background: opt.id === "drogowskaz" ? p.accent : p.card }}>
                      <span style={{ color: opt.id === "drogowskaz" ? p.onAccent : p.fg, fontFamily: p.font, fontWeight: 700, fontSize: 26, lineHeight: 1 }}>96</span>
                      <span className="w-2 h-2 rounded-full mb-1.5" style={{ background: opt.id === "drogowskaz" ? p.fg : p.accent }} />
                    </div>
                    <div className="h-4 mx-2 my-1 rounded-sm" style={{ background: opt.id === "drogowskaz" ? p.fg : p.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{opt.name}</p>
                    <p className="text-sm text-muted leading-snug">{opt.description}</p>
                  </div>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      selected ? "bg-accent text-on-accent" : "border-2 border-border-bright"
                    }`}
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </div>
      </main>
      <NavBar />
    </div>
  );
}
