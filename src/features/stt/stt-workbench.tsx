"use client";

import { cn } from "@/lib/client/cn";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { STT_PROVIDER_IDS, type SttHistoryEntry, type SttProviderId } from "@/lib/shared/types";
import { STT_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { ApiClientError, apiRequest, createClientRequestId, showErrorToast } from "@/lib/client/api-client";
import { reportBrowserLog } from "@/lib/client/browser-logger";
import { formatTimer } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { useHealth } from "@/components/layout/health-provider";
import { Button, IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { ActivityPanel } from "@/components/shared/activity-panel";
import { ProviderHealthAlert } from "@/components/shared/provider-health-alert";
import { ProviderPicker } from "@/components/shared/provider-picker";
import { ProviderSpecCards } from "@/components/shared/provider-spec-cards";
import { countModifiedSettings, SettingsDisclosure } from "@/components/shared/settings-disclosure";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { useHistoryCollection } from "@/hooks/use-history-collection";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { SttSettingsPanel } from "./settings/stt-settings-panel";
import { SttAudioSourcePanel, type SttAudioOrigin, type SttAudioSource } from "./stt-audio-source-panel";
import { SttHistoryList } from "./stt-history-list";
import { SttInsightsPanel } from "./stt-insights-panel";
import { buildSttFormFields, DEFAULT_STT_SETTINGS, type SttSettingsByProvider } from "./stt-settings";
import { useMicrophoneRecorder, type RecordedAudio } from "./use-microphone-recorder";
import { useWebSpeechRecognition } from "./use-web-speech-recognition";
import { SttTranscriptView, type TranscriptOrigin } from "./stt-transcript-view";

// SECTION: Atelier STT : source audio, moteur, réglages repliés et barre d'action à un seul bouton principal ; résultat et activité à droite.

interface TranscribeOptions {
  /** Texte déjà obtenu par Web Speech dans le navigateur. */
  browserTranscript?: string;
}

/** Sous `lg`, les colonnes s'empilent : on fait défiler jusqu'au résultat. */
function scrollToIfStacked(element: HTMLElement | null) {
  if (!element || window.matchMedia("(min-width: 1024px)").matches) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function SttWorkbench() {
  const { report, refresh: refreshHealth } = useHealth();
  const [provider, setProvider] = usePersistentState<SttProviderId>("stt-provider", "whisper");
  const [settings, setSettings] = usePersistentState<SttSettingsByProvider>("stt-settings", DEFAULT_STT_SETTINGS);
  const [tab, setTab] = usePersistentState<SttAudioOrigin>("stt-source-tab", "mic");
  const [specOpen, setSpecOpen] = useState(false);
  const history = useHistoryCollection<SttHistoryEntry>("/api/stt/history");
  const webSpeech = useWebSpeechRecognition();
  const webSpeechErrorRef = useRef<string | null>(null);
  webSpeechErrorRef.current = webSpeech.error;

  const [source, setSource] = useState<SttAudioSource | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [transcriptOrigin, setTranscriptOrigin] = useState<TranscriptOrigin>("latest");
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const elapsedMs = useElapsedTime(transcribing);

  const safeProvider: SttProviderId = STT_PROVIDER_IDS.includes(provider) ? provider : "whisper";
  const providerLabel = STT_PROVIDER_CATALOG[safeProvider].label;
  const providerSettings: SttSettingsByProvider = { ...DEFAULT_STT_SETTINGS, ...settings };
  const providerHealth = report?.stt[safeProvider];
  const selectedEntry = history.items.find((item) => item.id === currentEntryId);
  const currentEntry = selectedEntry ?? history.items[0] ?? null;
  const modifiedCount = countModifiedSettings(providerSettings[safeProvider], DEFAULT_STT_SETTINGS[safeProvider]);

  // ANCHOR: une seule raison de blocage, affichée à côté du bouton principal (seul endroit qui signale l'incompatibilité Web Speech).
  const blockedReason =
    providerHealth?.status === "down"
      ? `${providerLabel} est indisponible.`
      : safeProvider === "web-speech" && !webSpeech.supported
        ? "Web Speech n'est pas pris en charge par ce navigateur."
        : safeProvider === "web-speech" && tab !== "mic"
          ? "Web Speech ne transcrit que le micro : choisissez Whisper ou Sherpa."
          : null;
  const readySource = source?.origin === tab ? source : null;

  // NOTE: URL locale de l'audio choisi, révoquée quand la source change.
  useEffect(() => {
    if (!source) return setSourceUrl(null);
    const url = URL.createObjectURL(source.blob);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  // ANCHOR: analyse IA (Groq) après chaque transcription, en arrière-plan : un échec ne gêne jamais la transcription.
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [failedAnalysisIds, setFailedAnalysisIds] = useState<Set<string>>(new Set());
  const analyzeEntry = useCallback(
    async (id: string) => {
      const mark = (setter: typeof setAnalyzingIds, on: boolean) =>
        setter((current) => {
          const next = new Set(current);
          if (on) next.add(id);
          else next.delete(id);
          return next;
        });
      mark(setAnalyzingIds, true);
      mark(setFailedAnalysisIds, false);
      try {
        history.replaceItem(await apiRequest<SttHistoryEntry>(`/api/stt/history/${encodeURIComponent(id)}/analyze`, { method: "POST" }));
      } catch (err) {
        mark(setFailedAnalysisIds, true);
        reportBrowserLog("warn", "browser", "analysis.failed", err instanceof Error ? err.message : "Analyse impossible.", { meta: { entryId: id } });
      } finally {
        mark(setAnalyzingIds, false);
      }
    },
    [history]
  );

  const transcribe = useCallback(
    async (audio: SttAudioSource, options: TranscribeOptions = {}) => {
      if (transcribing) return;
      const requestId = createClientRequestId();
      const controller = new AbortController();
      abortRef.current = controller;
      setActiveRequestId(requestId);
      setTranscribing(true);

      const form = new FormData();
      for (const [key, value] of Object.entries(buildSttFormFields(safeProvider, providerSettings))) form.append(key, value);
      form.append("file", audio.blob, audio.fileName);
      if (safeProvider === "web-speech") {
        form.append("browserTranscript", options.browserTranscript ?? "");
        form.append("browserDurationSec", String(audio.durationSec ?? 0));
      }

      try {
        const { entry } = await apiRequest<{ entry: SttHistoryEntry }>("/api/stt/transcribe", {
          method: "POST",
          body: form,
          signal: controller.signal,
          headers: { "X-Request-Id": requestId },
        });
        // NOTE: pas de toast de succès, le panneau Résultat se met à jour.
        history.prepend(entry);
        if (entry.text.trim()) void analyzeEntry(entry.id);
        setCurrentEntryId(entry.id);
        setTranscriptOrigin("transcribed");
        scrollToIfStacked(resultRef.current);
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "ABORTED") toast.info("Transcription annulée");
        else {
          showErrorToast(err, "Transcription impossible");
          // NOTE: toute panne moteur ou réseau rafraîchit tout de suite l'état de santé, sans attendre le cycle de 15 s.
          if (!(err instanceof ApiClientError) || err.code !== "VALIDATION") void refreshHealth();
        }
      } finally {
        setTranscribing(false);
        abortRef.current = null;
      }
    },
    [transcribing, safeProvider, providerSettings, history, refreshHealth, analyzeEntry]
  );

  // ANCHOR: à l'arrêt du micro, la transcription part automatiquement, d'où le libellé « Arrêter et transcrire ».
  const handleRecorded = useCallback(
    async (recorded: RecordedAudio) => {
      const audio: SttAudioSource = { ...recorded, origin: "mic" };
      setSource(audio);
      const browserTranscript = safeProvider === "web-speech" ? await webSpeech.stop() : undefined;
      // ANCHOR: sans texte reconnu, inutile d'appeler le serveur : on explique tout de suite pourquoi.
      if (safeProvider === "web-speech" && !browserTranscript?.trim()) {
        toast.error("Aucune parole reconnue", {
          description: webSpeechErrorRef.current ?? "Parlez plus près du micro, ou choisissez Whisper ou Sherpa pour transcrire l'enregistrement.",
          duration: 9000,
        });
        return;
      }
      await transcribe(audio, { browserTranscript });
    },
    [safeProvider, webSpeech, transcribe]
  );

  // NOTE: une erreur Web Speech ne doit pas rester cachée dans le panneau source, qui disparaît à l'arrêt du micro.
  useEffect(() => {
    if (webSpeech.error) toast.warning(webSpeech.error, { id: "web-speech-error", duration: 7000 });
  }, [webSpeech.error]);

  const recorder = useMicrophoneRecorder((recorded) => void handleRecorded(recorded));

  const startRecording = async () => {
    setSource(null);
    const started = await recorder.start();
    if (started && safeProvider === "web-speech") webSpeech.start(providerSettings["web-speech"].language);
  };

  useEffect(() => {
    if (!transcribing) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && abortRef.current?.abort();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [transcribing]);

  const updateSettings = <P extends SttProviderId>(target: P, value: SttSettingsByProvider[P]) =>
    setSettings((current) => ({ ...DEFAULT_STT_SETTINGS, ...current, [target]: value }));

  const openEntry = (entry: SttHistoryEntry) => {
    setCurrentEntryId(entry.id);
    setTranscriptOrigin("history");
    setAutoPlayToken((n) => n + 1);
    scrollToIfStacked(resultRef.current);
  };

  // ANCHOR: une seule description de l'action principale, commune aux 4 moteurs : la barre du bas et le bouton du haut ne font que l'afficher.
  // Onglet Micro, pour les 4 moteurs : le bouton principal ENREGISTRE toujours (Enregistrer, Arrêter et transcrire, Annuler).
  // Avant, une fois un enregistrement fait, il devenait « Transcrire avec X » : un clic renvoyait en 0,3 s l'ancien audio,
  // d'où l'impression que « ça s'arrête tout seul » et que l'ancien texte se mélange au nouveau moteur.
  // Retranscrire le même enregistrement avec un autre moteur reste possible, en bouton secondaire nommé explicitement.
  // Onglets Fichier et Démo : le bouton principal transcrit l'audio choisi.
  type PrimaryAction =
    | { kind: "stop" }
    | { kind: "cancel" }
    | { kind: "record" | "transcribe" | "idle"; label: string; disabled: boolean; reason: string | null; run?: () => void };
  const primary: PrimaryAction = (() => {
    if (recorder.recording) return { kind: "stop" };
    if (transcribing) return { kind: "cancel" };
    if (tab === "mic") {
      return {
        kind: "record",
        label: readySource ? "Nouvel enregistrement" : "Enregistrer",
        disabled: Boolean(blockedReason),
        reason: blockedReason,
        run: () => void startRecording(),
      };
    }
    if (readySource) {
      return {
        kind: "transcribe",
        label: `Transcrire avec ${providerLabel}`,
        disabled: Boolean(blockedReason),
        reason: blockedReason,
        run: () => void transcribe(readySource),
      };
    }
    return {
      kind: "idle",
      label: tab === "upload" ? "Choisissez un fichier pour lancer la transcription." : "Choisissez un échantillon pour lancer la transcription.",
      disabled: true,
      reason: blockedReason,
    };
  })();

  // NOTE: comparer les moteurs sur le même enregistrement micro ; Web Speech en est exclu, il n'écoute qu'en direct.
  const retranscribe =
    primary.kind === "record" && readySource && safeProvider !== "web-speech" && !blockedReason ? () => void transcribe(readySource) : null;

  const actionBar = (() => {
    if (primary.kind === "stop") {
      return (
        <Button variant="danger" size="lg" className="border-danger/50 bg-danger/10" icon={<Icon name="stop" />} onClick={recorder.stop}>
          Arrêter et transcrire
        </Button>
      );
    }
    if (primary.kind === "cancel") {
      return (
        <>
          <Button variant="secondary" size="lg" icon={<Icon name="stop" />} tooltip="Échap" onClick={() => abortRef.current?.abort()}>
            Annuler
          </Button>
          <span aria-live="polite" className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span className="size-2 shrink-0 rounded-full bg-[var(--provider)] animate-pulse-dot" />
            <span className="truncate">Transcription {providerLabel}</span>
            <span className="tabular-nums text-ink">{formatTimer(elapsedMs)}</span>
            {elapsedMs > 4000 && safeProvider !== "web-speech" && <span className="hidden text-xs sm:inline">Chargement du modèle au premier appel, patientez.</span>}
          </span>
        </>
      );
    }
    if (primary.kind === "idle") return <p className="py-2 text-sm text-muted">{primary.reason ?? primary.label}</p>;
    return (
      <>
        <Button
          variant="primary"
          size="lg"
          icon={<Icon name={primary.kind === "record" ? "mic" : "stt"} size={20} />}
          disabled={primary.disabled}
          onClick={primary.run}
          className="min-w-0 max-w-full"
        >
          <span className="truncate">{primary.label}</span>
        </Button>
        {retranscribe && (
          <Button variant="secondary" size="lg" icon={<Icon name="stt" size={20} />} onClick={retranscribe} className="min-w-0 max-w-full">
            <span className="truncate">Retranscrire avec {providerLabel}</span>
          </Button>
        )}
        {primary.reason && <span className="min-w-0 text-xs text-muted">{primary.reason}</span>}
      </>
    );
  })();

  const quickAction = (() => {
    const filled = "bg-[var(--provider)] text-white hover:bg-[color-mix(in_srgb,var(--provider)_85%,black)] hover:text-white";
    const outlined = "text-[var(--provider)] hover:text-[var(--provider)]";
    if (primary.kind === "stop") {
      return (
        <IconButton label="Arrêter et transcrire" onClick={recorder.stop} className={outlined}>
          <Icon name="stop" size={22} />
        </IconButton>
      );
    }
    if (primary.kind === "cancel") {
      return (
        <IconButton label="Annuler la transcription (Échap)" onClick={() => abortRef.current?.abort()} className={outlined}>
          <Icon name="stop" size={22} />
        </IconButton>
      );
    }
    return (
      <IconButton label={primary.reason && primary.kind !== "record" ? primary.reason : primary.label} disabled={primary.disabled} onClick={primary.run} className={filled}>
        <Icon name={primary.kind === "record" ? "mic" : "stt"} size={20} />
      </IconButton>
    );
  })();

  return (
    <div style={providerStyle(safeProvider)} className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:flex-1">
          <div className="order-1 min-w-0 lg:order-none">
            <Panel
              title="Transcription"
              className="min-w-0"
              bodyClassName="space-y-3"
              actions={
                <>
                  <IconButton label={specOpen ? `Masquer la fiche ${providerLabel}` : `Fiche technique ${providerLabel}`} aria-pressed={specOpen} onClick={() => setSpecOpen(!specOpen)}>
                    <Icon name="info" />
                  </IconButton>
                  {quickAction}
                </>
              }
            >
              <SttAudioSourcePanel
                provider={safeProvider}
                tab={tab}
                onTabChange={setTab}
                source={source}
                sourceUrl={sourceUrl}
                onSourceChange={setSource}
                recorder={recorder}
                liveTranscript={webSpeech.transcript}
                liveError={webSpeech.error}
                disabled={transcribing}
              />

              <ProviderPicker
                label="Moteur de transcription"
                providers={STT_PROVIDER_IDS}
                catalog={STT_PROVIDER_CATALOG}
                value={safeProvider}
                onChange={(next) => {
                // ANCHOR: changer de moteur repart d'un état propre : le texte et l'erreur Web Speech d'avant ne doivent pas se mélanger au nouveau moteur.
                webSpeech.reset();
                toast.dismiss("web-speech-error");
                setProvider(next);
              }}
                health={report?.stt}
                disabled={transcribing || recorder.recording}
              />

              {specOpen && <ProviderSpecCards catalog={STT_PROVIDER_CATALOG} health={report?.stt} only={safeProvider} />}

              <ProviderHealthAlert health={providerHealth} />

              <SettingsDisclosure
                storageKey="stt"
                providerLabel={providerLabel}
                modifiedCount={modifiedCount}
                onReset={() => updateSettings(safeProvider, DEFAULT_STT_SETTINGS[safeProvider])}
              >
                <SttSettingsPanel
                  provider={safeProvider}
                  settings={providerSettings}
                  onChange={updateSettings}
                  pythonServiceHealth={report?.pythonService}
                  whisperNodeModels={report?.stt.whisper?.details?.nodeModels as string[] | undefined}
                  webSpeechSupported={webSpeech.supported}
                />
              </SettingsDisclosure>

              {/* ANCHOR: barre d'action collante en bas de l'écran tant que le panneau est visible ; les marges négatives annulent le padding du corps. */}
              <div className="sticky bottom-0 z-10 -mx-3 -mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-b-2xl border-t border-line bg-surface px-3 py-2.5 sm:-mx-4 sm:-mb-4 sm:px-4">
                {actionBar}
              </div>
            </Panel>
          </div>
          <div className="order-4 min-w-0 lg:order-none lg:flex lg:flex-1 lg:flex-col lg:[&>section]:flex-1">
          <SttInsightsPanel
            items={history.items}
            onSelect={(id) => {
              const entry = history.items.find((item) => item.id === id);
              if (entry) openEntry(entry);
            }}
          />
          </div>
        </div>
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4 lg:flex-1">
          <div ref={resultRef} className="order-2 min-w-0 scroll-mt-20 lg:order-none">
            <SttTranscriptView
              key={currentEntry?.id ?? "none"}
              entry={currentEntry}
              peers={history.items}
              origin={selectedEntry ? transcriptOrigin : "latest"}
              autoPlayToken={autoPlayToken}
              onToggleFavorite={history.toggleFavorite}
              onScore={history.setScore}
              analyzing={currentEntry ? analyzingIds.has(currentEntry.id) : false}
              analysisFailed={currentEntry ? failedAnalysisIds.has(currentEntry.id) : false}
              onAnalyze={(id) => void analyzeEntry(id)}
            />
          </div>
          <div className="order-5 min-w-0 lg:order-none lg:flex lg:flex-1 lg:flex-col lg:[&>section]:flex-1">
          <SttHistoryList
            items={history.items}
            loading={history.loading}
            loadError={history.loadError}
            activeEntryId={currentEntry?.id ?? null}
            onOpen={openEntry}
            onToggleFavorite={history.toggleFavorite}
            onScore={history.setScore}
            onDelete={(id) => {
              void history.remove(id);
              if (id === currentEntryId) setCurrentEntryId(null);
            }}
            onClear={() => void history.clear()}
            onRetry={() => void history.reload()}
          />
          </div>
        </div>
      </div>

      {/* ANCHOR: journal d'activité en dernier, pleine largeur sous les deux colonnes. */}
      <ActivityPanel storageKey="stt-activity" sources={[...STT_PROVIDER_IDS, "python-service", "api"]} requestId={activeRequestId} live={transcribing} />
    </div>
  );
}
