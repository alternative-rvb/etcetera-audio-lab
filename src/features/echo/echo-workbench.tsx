"use client";

import { useRef } from "react";
import { StarRating } from "@/components/ui/feedback-controls";
import { STT_PROVIDER_IDS, TTS_PROVIDER_IDS, type SttProviderId, type TtsProviderId, type TtsSettingsByProvider } from "@/lib/shared/types";
import { DEFAULT_TTS_SETTINGS, providerColorVar, STT_PROVIDER_CATALOG, TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { formatSeconds, formatTimer } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";
import { useHealth } from "@/components/layout/health-provider";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { SettingSlider, SettingSwitch } from "@/components/ui/form-controls";
import { ActivityPanel } from "@/components/shared/activity-panel";
import { ProviderHealthAlert } from "@/components/shared/provider-health-alert";
import { ProviderPicker } from "@/components/shared/provider-picker";
import { useMediaStreamSpectrum } from "@/hooks/use-audio-spectrum";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { DEFAULT_STT_SETTINGS, type SttSettingsByProvider } from "@/features/stt/stt-settings";
import { TtsVoicePicker } from "@/features/tts/tts-voice-picker";
import { useTtsVoices } from "@/features/tts/use-tts-voices";
import { EchoInsightsPanel } from "./echo-insights-panel";
import { EchoRoundsPanel } from "./echo-rounds-panel";
import { DEFAULT_ECHO_SETTINGS, MAX_ECHO_ROUNDS, type EchoPhase, type EchoRound, type EchoSettings } from "./echo-types";
import { useEchoLoop, type LiveRound } from "./use-echo-loop";

// SECTION: Atelier Écho : ce que vous dites est transcrit, puis relu par une voix après une pause, avec la mesure de chaque étape.
// NOTE: les réglages fins de chaque moteur et la voix choisie sont partagés avec les pages Synthèse et Transcription.

const DEFAULT_SELECTED_VOICES: Record<TtsProviderId, string | null> = { "edge-tts": null, piper: null, kokoro: null, chatterbox: null };

const PHASE_LABELS: Record<EchoPhase, string> = {
  idle: "Prêt",
  listening: "Je vous écoute",
  transcribing: "Transcription",
  waiting: "Pause avant la réponse",
  synthesizing: "Synthèse de la réponse",
  speaking: "Lecture de la réponse",
};

const STEPS: Array<{ phase: EchoPhase; label: string; value: (live: LiveRound) => string | null }> = [
  { phase: "listening", label: "Écoute", value: (live) => (live.times.speechSec !== undefined ? `${live.times.speechSec.toFixed(1)} s de parole` : null) },
  {
    phase: "transcribing",
    label: "Transcription",
    value: (live) =>
      live.times.sttMs !== undefined ? `${formatSeconds(live.times.sttMs)} (serveur ${formatSeconds(live.times.sttServerMs ?? 0)})` : null,
  },
  { phase: "waiting", label: "Pause", value: (live) => (live.times.delayMs !== undefined ? formatSeconds(live.times.delayMs, 1) : null) },
  {
    phase: "synthesizing",
    label: "Synthèse",
    value: (live) =>
      live.times.ttsMs !== undefined ? `${formatSeconds(live.times.ttsMs)} (serveur ${formatSeconds(live.times.ttsServerMs ?? 0)})` : null,
  },
  {
    phase: "speaking",
    label: "Lecture",
    value: (live) =>
      live.times.latencyMs === undefined
        ? null
        : `réponse après ${formatSeconds(live.times.latencyMs)}${live.times.playbackMs !== undefined ? `, ${formatSeconds(live.times.playbackMs, 1)} de lecture` : ""}`,
  },
];
const PHASE_ORDER: EchoPhase[] = ["listening", "transcribing", "waiting", "synthesizing", "speaking"];

export function EchoWorkbench() {
  const { report } = useHealth();
  const [sttProvider, setSttProvider] = usePersistentState<SttProviderId>("echo-stt-provider", "whisper");
  const [ttsProvider, setTtsProvider] = usePersistentState<TtsProviderId>("echo-tts-provider", "piper");
  const [sttSettings] = usePersistentState<SttSettingsByProvider>("stt-settings", DEFAULT_STT_SETTINGS);
  const [ttsSettings] = usePersistentState<TtsSettingsByProvider>("tts-settings", DEFAULT_TTS_SETTINGS);
  const [selectedVoices, setSelectedVoices] = usePersistentState("tts-voices", DEFAULT_SELECTED_VOICES);
  const [storedSettings, setSettings] = usePersistentState<EchoSettings>("echo-settings", DEFAULT_ECHO_SETTINGS);
  const [rounds, setRounds] = usePersistentState<EchoRound[]>("echo-rounds", []);

  const safeStt: SttProviderId = STT_PROVIDER_IDS.includes(sttProvider) ? sttProvider : "whisper";
  const safeTts: TtsProviderId = TTS_PROVIDER_IDS.includes(ttsProvider) ? ttsProvider : "piper";
  const settings: EchoSettings = { ...DEFAULT_ECHO_SETTINGS, ...storedSettings };
  const updateSettings = (patch: Partial<EchoSettings>) => setSettings((current) => ({ ...DEFAULT_ECHO_SETTINGS, ...current, ...patch }));

  const { voiceList, loading: voicesLoading, error: voicesError, retry: retryVoices } = useTtsVoices(safeTts);
  const voices = voiceList?.provider === safeTts ? voiceList.voices : [];
  const rememberedVoiceId = selectedVoices[safeTts];
  const voiceId = voices.some((voice) => voice.id === rememberedVoiceId) ? rememberedVoiceId : (voices[0]?.id ?? null);
  const voiceName = voices.find((voice) => voice.id === voiceId)?.name ?? "";

  const echo = useEchoLoop(
    {
      sttProvider: safeStt,
      sttSettings: { ...DEFAULT_STT_SETTINGS, ...sttSettings },
      ttsProvider: safeTts,
      ttsSettings: { ...DEFAULT_TTS_SETTINGS, ...ttsSettings },
      voiceId,
      voiceName,
      settings,
    },
    (round) => setRounds((current) => [round, ...current].slice(0, MAX_ECHO_ROUNDS))
  );

  const running = echo.phase !== "idle";
  // NOTE: dernier tour terminé, à noter tout de suite pour le placer sur la matrice.
  const lastRound = !running && echo.live?.times.totalMs !== undefined ? rounds[0] : undefined;
  const replayRef = useRef<HTMLAudioElement | null>(null);
  const replay = (url: string) => {
    replayRef.current?.pause();
    replayRef.current = new Audio(url);
    void replayRef.current.play();
  };
  const setScore = (id: string, score: number) => setRounds((current) => current.map((round) => (round.id === id ? { ...round, score } : round)));
  const listening = echo.phase === "listening";
  const elapsedMs = useElapsedTime(listening);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMediaStreamSpectrum(echo.stream, canvasRef, { color: providerColorVar(safeStt) });

  const sttHealth = report?.stt[safeStt];
  const ttsHealth = report?.tts[safeTts];
  const sttLabel = STT_PROVIDER_CATALOG[safeStt].label;
  const ttsLabel = TTS_PROVIDER_CATALOG[safeTts].label;

  // ANCHOR: une seule raison de blocage, affichée à côté du bouton principal.
  const blockedReason =
    sttHealth?.status === "down"
      ? `${sttLabel} est indisponible.`
      : ttsHealth?.status === "down"
        ? `${ttsLabel} est indisponible.`
        : safeStt === "web-speech" && !echo.webSpeechSupported
          ? "Web Speech n'est pas pris en charge par ce navigateur."
          : !voiceId
            ? "Choisissez une voix."
            : null;

  const activeIndex = PHASE_ORDER.indexOf(echo.phase);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-1">
          <Panel
            title="Écho"
            meta="Parlez, la voix répète"
            bodyClassName="space-y-4"
            actions={
              running ? (
                <IconButton label="Arrêter l'écho (Échap)" onClick={echo.cancel} className="text-danger hover:text-danger">
                  <Icon name="stop" size={22} />
                </IconButton>
              ) : (
                <IconButton
                  label={blockedReason ?? "Démarrer l'écho"}
                  disabled={Boolean(blockedReason)}
                  onClick={echo.start}
                  className="bg-accent text-accent-contrast hover:bg-[color-mix(in_srgb,var(--accent)_85%,black)] hover:text-accent-contrast"
                >
                  <Icon name="mic" size={20} />
                </IconButton>
              )
            }
          >
            <section aria-label="Reconnaissance vocale" style={providerStyle(safeStt)} className="space-y-2">
              <h3 className="text-sm font-medium text-ink">1. Ce que vous dites (STT)</h3>
              <ProviderPicker
                label="Moteur de transcription"
                providers={STT_PROVIDER_IDS}
                catalog={STT_PROVIDER_CATALOG}
                value={safeStt}
                onChange={setSttProvider}
                health={report?.stt}
                disabled={running}
              />
              <ProviderHealthAlert health={sttHealth} />
            </section>

            <section aria-label="Synthèse vocale" style={providerStyle(safeTts)} className="space-y-2">
              <h3 className="text-sm font-medium text-ink">2. La voix qui répète (TTS)</h3>
              <ProviderPicker
                label="Moteur de synthèse"
                providers={TTS_PROVIDER_IDS}
                catalog={TTS_PROVIDER_CATALOG}
                value={safeTts}
                onChange={setTtsProvider}
                health={report?.tts}
                disabled={running}
              />
              <ProviderHealthAlert health={ttsHealth} />
              <TtsVoicePicker
                voiceList={voiceList?.provider === safeTts ? voiceList : null}
                loading={voicesLoading}
                error={voicesError}
                selectedVoiceId={voiceId}
                onSelect={(id) => setSelectedVoices((current) => ({ ...current, [safeTts]: id }))}
                onRetry={retryVoices}
                emptyHint="Aucune voix disponible pour ce moteur."
                healthAlertShown={Boolean(ttsHealth && ttsHealth.status !== "ok")}
              />
            </section>

            <section aria-label="Réglages de l'écho" className="space-y-3">
              <h3 className="text-sm font-medium text-ink">3. Rythme de l&apos;échange</h3>
              <SettingSlider
                label="Pause avant la réponse"
                value={settings.delayMs / 1000}
                min={0}
                max={5}
                step={0.25}
                format={(value) => `${value.toFixed(2)} s`}
                onChange={(value) => updateSettings({ delayMs: Math.round(value * 1000) })}
                hint="Attente ajoutée entre le texte reconnu et la synthèse. Elle est retirée de la latence moteurs dans les mesures."
              />
              <SettingSwitch
                label="Arrêt automatique au silence"
                checked={settings.autoStop}
                onChange={(autoStop) => updateSettings({ autoStop })}
                hint="Sinon, cliquez sur J'ai fini pour lancer la transcription."
              />
              {settings.autoStop && (
                <>
                  <SettingSlider
                    label="Silence de fin de phrase"
                    value={settings.silenceMs / 1000}
                    min={0.4}
                    max={3}
                    step={0.1}
                    format={(value) => `${value.toFixed(1)} s`}
                    onChange={(value) => updateSettings({ silenceMs: Math.round(value * 1000) })}
                    hint="Plus court, la réponse arrive plus vite mais une hésitation peut couper la phrase. Ce temps compte dans la latence perçue."
                  />
                  <SettingSlider
                    label="Seuil de parole"
                    value={settings.threshold}
                    min={0.005}
                    max={0.1}
                    step={0.005}
                    format={(value) => value.toFixed(3)}
                    onChange={(threshold) => updateSettings({ threshold })}
                    hint="Niveau sonore à partir duquel on considère que vous parlez. Montez-le dans une pièce bruyante."
                  />
                </>
              )}
            </section>

            {/* ANCHOR: barre d'action collante, comme sur les pages Synthèse et Transcription. */}
            <div className="sticky bottom-0 z-10 -mx-3 -mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-b-2xl border-t border-line bg-surface px-3 py-2.5 sm:-mx-4 sm:-mb-4 sm:px-4">
              {running ? (
                <>
                  {listening && (
                    <Button variant="primary" size="lg" icon={<Icon name="check" size={20} />} onClick={echo.finishSpeaking}>
                      J&apos;ai fini
                    </Button>
                  )}
                  <Button variant="secondary" size="lg" icon={<Icon name="stop" />} tooltip="Échap" onClick={echo.cancel}>
                    Arrêter
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" size="lg" icon={<Icon name="mic" size={20} />} disabled={Boolean(blockedReason)} onClick={echo.start}>
                    {rounds.length > 0 ? "Nouvelle mesure" : "Démarrer une mesure"}
                  </Button>
                  {blockedReason && <span className="text-xs text-muted">{blockedReason}</span>}
                </>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:flex-1">
          <Panel title={`Mesure ${lastRound ? rounds.length : rounds.length + 1}`} meta={PHASE_LABELS[echo.phase]} bodyClassName="space-y-3">
            <div style={providerStyle(safeStt)} className="relative h-16 overflow-hidden rounded-xl border border-line bg-sunken">
              {listening ? (
                <>
                  <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
                  <span aria-live="polite" className="absolute top-1.5 left-2 flex items-center gap-1.5 rounded-md bg-surface/80 px-1.5 text-xs tabular-nums text-ink">
                    <span className="size-2 rounded-full bg-danger animate-pulse-dot" />
                    {formatTimer(elapsedMs)}
                  </span>
                </>
              ) : (
                <p className="flex h-full items-center justify-center px-3 text-center text-sm text-muted">
                  {running ? PHASE_LABELS[echo.phase] : "Cliquez sur Démarrer une mesure, puis dites une phrase. Chaque clic lance une nouvelle mesure."}
                </p>
              )}
            </div>

            {(echo.live?.text || (safeStt === "web-speech" && listening)) && (
              <p aria-live="polite" className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-ink">
                {echo.live?.text || echo.liveTranscript || <span className="text-muted">En écoute...</span>}
              </p>
            )}

            {echo.micError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{echo.micError}</p>}

            {echo.live && (
              <ol aria-label="Étapes de la mesure" className="space-y-1.5">
                {STEPS.map((step, index) => {
                  const value = step.value(echo.live as LiveRound);
                  const active = index === activeIndex;
                  const done = value !== null && !active;
                  return (
                    <li key={step.phase} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          active ? "bg-accent animate-pulse-dot" : done ? "bg-success" : "bg-line-strong"
                        )}
                      />
                      <span className={cn(active || done ? "text-ink" : "text-muted")}>{step.label}</span>
                      <span className="ml-auto tabular-nums text-muted">{value ?? (active ? "en cours" : "")}</span>
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 border-t border-line pt-1.5 text-sm font-medium text-ink">
                  Temps total
                  <span className="ml-auto tabular-nums">{echo.live.times.totalMs !== undefined ? formatSeconds(echo.live.times.totalMs) : "en cours"}</span>
                </li>
              </ol>
            )}

            {lastRound && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sunken px-3 py-2 text-sm">
                <span className="text-ink">Notez cette réponse pour la placer sur la matrice</span>
                <StarRating
                  value={lastRound.score}
                  onChange={(score) => setScore(lastRound.id, score === lastRound.score ? 0 : score)}
                  label="Note de la réponse"
                />
              </div>
            )}
          </Panel>

          <EchoInsightsPanel
            rounds={rounds}
            current={{ sttProvider: safeStt, ttsProvider: safeTts }}
            onSelect={(id) => {
              const round = rounds.find((item) => item.id === id);
              if (round) replay(round.audioUrl);
            }}
          />

          <EchoRoundsPanel rounds={rounds} onClear={() => setRounds([])} onScore={setScore} onReplay={replay} />
        </div>
      </div>

      {/* ANCHOR: journal d'activité pleine largeur, il suit la requête STT puis la requête TTS du tour. */}
      <ActivityPanel
        storageKey="echo-activity"
        sources={[...STT_PROVIDER_IDS, ...TTS_PROVIDER_IDS, "python-service", "api", "browser"]}
        requestId={echo.activeRequestId}
        live={running}
      />
    </div>
  );
}
