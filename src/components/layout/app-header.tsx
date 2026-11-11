"use client";

import { AudioLines, FileAudio, Mic, ScrollText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";
import { HealthDot } from "@/components/ui/health-dot";
import { useHealth } from "./health-provider";
import { ThemeToggle } from "./theme-toggle";

// SECTION: En-tête : marque Etcetera Audio Lab, navigation, état du service Python, thème.

const NAV_ITEMS = [
  { href: "/tts", label: "Synthèse vocale", shortLabel: "TTS", icon: FileAudio },
  { href: "/stt", label: "Transcription", shortLabel: "STT", icon: Mic },
  { href: "/logs", label: "Logs", shortLabel: "Logs", icon: ScrollText },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const { report } = useHealth();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/tts" className="flex items-center gap-2.5" aria-label="Etcetera Audio Lab, accueil">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-contrast retro:shadow-[0_0_16px_var(--glow)]">
            <AudioLines size={19} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-semibold tracking-tight text-ink retro:font-mono">Etcetera Audio Lab</span>
            <span className="mt-0.5 text-xs text-muted">Laboratoire TTS et STT</span>
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {NAV_ITEMS.map(({ href, label, shortLabel, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none",
                  active ? "bg-accent/12 text-accent" : "text-muted hover:bg-sunken hover:text-ink"
                )}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-muted sm:flex" title={report?.pythonService.reason ?? "Service Python (Chatterbox, Whisper)"}>
            <HealthDot health={report?.pythonService} />
            Service Python
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
