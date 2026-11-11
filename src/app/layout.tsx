import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { HealthProvider } from "@/components/layout/health-provider";
import { THEME_INIT_SCRIPT } from "@/components/layout/theme-toggle";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: { default: "Etcetera Audio Lab", template: "%s | Etcetera Audio Lab" },
  description: "Banc d'essai de moteurs de synthèse vocale et de transcription.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${plexSans.variable} ${plexMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <HealthProvider>
          <AppHeader />
          <main className="mx-auto max-w-[1400px] px-4 pt-4 pb-10 sm:px-6">{children}</main>
        </HealthProvider>
        <Toaster position="bottom-right" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
