"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, BarChart3, Users, Swords, History, Maximize2, Minimize2 } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { label: "Start", icon: Home, href: "/" },
  { label: "Nowy mecz", icon: Target, href: "/match/new" },
  { label: "Historia", icon: History, href: "/match/history" },
  { label: "Statystyki", icon: BarChart3, href: "/stats" },
  { label: "H2H", icon: Swords, href: "/stats/h2h" },
  { label: "Gracze", icon: Users, href: "/players/manage" },
] as const;

export default function NavBar() {
  const pathname = usePathname();
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/stats") return pathname === "/stats";
    if (href === "/match/new") return pathname === "/match/new";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
            >
              <Icon
                size={22}
                className={
                  active
                    ? "text-neon-green drop-shadow-[0_0_8px_#00ff88] transition-colors duration-200"
                    : "text-muted transition-colors duration-200"
                }
              />
              <span
                className={`text-[10px] leading-none ${
                  active
                    ? "text-neon-green text-glow-green"
                    : "text-muted"
                } transition-colors duration-200`}
              >
                {tab.label}
              </span>

              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-neon-green glow-green"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="flex flex-col items-center justify-center w-10 h-full gap-1 transition-colors"
        >
          {isFullscreen ? (
            <Minimize2 size={18} className="text-muted" />
          ) : (
            <Maximize2 size={18} className="text-muted" />
          )}
        </button>
      </div>
    </nav>
  );
}
