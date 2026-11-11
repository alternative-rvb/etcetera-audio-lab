"use client";

import { AudioWaveform, BookOpen, FileText, History, SlidersHorizontal, Square, TriangleAlert, Wand2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { STT_PROVIDER_IDS, type SttHistoryEntry, type SttProviderId } from "@/lib/shared/types";
import { STT_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { ApiClientError, apiRequest, createClientRequestId, showErrorToast } from "@/lib/client/api-client";
import { formatTimer } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { useHealth } from "@/components/layout/health-provider";
import { Button } from "@/components/ui/button";
import { HintText } from "@/components/ui/hint-text";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { Panel } from "@/components/ui/panel";
import { ActivityPanel } from "@/components/shared/activity-panel";
import { ProviderPicker } from "@/components/shared/provider-picker";
import { ProviderSpecCards } from "@/components/shared/provider-spec-cards";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
import { useHistoryCollection } from "@/hooks/use-history-collection";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { SttSettingsPanel } from "./settings/stt-settings-panel";
import { SttAudioSourcePanel, type SttAudioSource } from "./stt-audio-source-panel";
import { SttHistoryList } from "./stt-history-list";
import { SttInsightsPanel } from "./stt-insights-panel";
import { buildSttFormFields, DEFAULT_STT_SETTINGS, type SttSettingsByProvider } from "./stt-settings";
import { useMicrophoneRecorder, type RecordedAudio } from "./use-microphone-recorder";
import { useWebSpeechRecognition } from "./use-web-speech-recognition";
import { SttTranscriptView } from "./stt-transcript-view";

// SECTION: Atelier STT : source audio, choix provider/réglages, transcription, lecture par segments, comparaison.

interface TranscribeOptions {
  /** Texte déjà obtenu par Web Speech dans le navigateur. */
  browserTranscript?: string;
}

export function SttWorkbench() {
  const { report, refresh: refreshHealth } = useHealth();
  const [provider, setProvider] = usePersistentState<SttProviderId>("stt-provider", "whisper");
  const [settings, setSettings] = usePersistentState<SttSettingsByProvider>("stt-settings", DEFAULT_STT_SETTINGS);
  const history = useHistoryCollection<SttHistoryEntry>("/api/stt/history");
  const webSpeech = useWebSpeechRecognition();

  const [source, setSource] = useState<SttAudioSource | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [showSourcePreview, setShowSourcePreview] = useState(false);
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const elapsedMs = useElapsedTime(transcribing);

  const safeProvider: SttProviderId = STT_PROVIDER_IDS.includes(provider) ? provider : "whisper";
  const providerSettings: SttSettingsByProvider = { ...DEFAULT_STT_SETTINGS, ...settings };
  const providerHealth = report?.stt[safeProvider];
  const currentEntry = showSourcePreview ? null : (history.items.find((item) => item.id === currentEntryId) ?? history.items[0] ?? null);
  const sourceIsMic = source?.origin === "mic";
  const canTranscribe = !transcribing && source !== null && (safeProvider !== "web-speech" || sourceIsMic);

  // NOTE: URL locale de l'audio choisi, révoquée quand la source change.
  useEffect(() => {
    if (!source) return setSourceUrl(null);
    const url = URL.createObjectURL(source.blob);
    setSourceUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

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
        history.prepend(entry);
        setCurrentEntryId(entry.id);
        setShowSourcePreview(false);
        toast.success("Transcription terminée", {
          description: entry.rtf ? `${STT_PROVIDER_CATALOG[entry.provider].label}, RTF ${entry.rtf.toFixed(3)}` : STT_PROVIDER_CATALOG[entry.provider].label,
        });
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "ABORTED") toast.info("Transcription annulée");
        else {
          showErrorToast(err, "Transcription impossible");
          if (err instanceof ApiClientError && err.code === "PYTHON_SERVICE_DOWN") void refreshHealth();
        }
      } finally {
        setTranscribing(false);
        abortRef.current = null;
      }
    },
    [transcribing, safeProvider, providerSettings, history, refreshHealth]
  );

  // ANCHOR: à l'arrêt du micro, la transcription part automatiquement (comportement de l'ancienne interface).
  const handleRecorded = useCallback(
    async (recorded: RecordedAudio) => {
      const audio: SttAudioSource = { ...recorded, origin: "mic" };
      setSource(audio);
      setShowSourcePreview(true);
      const browserTranscript = safeProvider === "web-speech" ? await webSpeech.stop() : undefined;
      await transcribe(audio, { browserTranscript });
    },
    [safeProvider, webSpeech, transcribe]
  );

  const recorder = useMicrophoneRecorder((recorded) => void handleRecorded(recorded));

  const startRecording = async () => {
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
    setShowSourcePreview(false);
    setAutoPlayToken((n) => n + 1);
  };

  return (
    <div style={providerStyle(safeProvider)} className="space-y-5">
      <CollapsiblePanel storageKey="stt-specs" icon={<BookOpen size={16} />} title="Les trois moteurs" summary="fiches techniques et état" defaultOpen={false}>
        <ProviderSpecCards catalog={STT_PROVIDER_CATALOG} health={report?.stt} />
      </CollapsiblePanel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel icon={<AudioWaveform size={16} />} title="Transcription" bodyClassName="space-y-5">
          <ProviderPicker
            label="Moteur de transcription"
            providers={STT_PROVIDER_IDS}
            catalog={STT_PROVIDER_CATALOG}
            value={safeProvider}
            onChange={setProvider}
            health={report?.stt}
            disabled={transcribing || recorder.recording}
          />

          {providerHealth && providerHealth.status !== "ok" && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>
                  {STT_PROVIDER_CATALOG[safeProvider].label} : {providerHealth.reason ?? "fonctionnement dégradé."}
                </p>
                {providerHealth.hint && <p className="mt-0.5 text-xs"><HintText text={providerHealth.hint} /></p>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-line px-3.5 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <SlidersHorizontal size={15} className="text-muted" /> Réglages {STT_PROVIDER_CATALOG[safeProvider].label}
            </p>
            <div className="pt-3 pb-1">
              <SttSettingsPanel
                provider={safeProvider}
                settings={providerSettings}
                onChange={updateSettings}
                pythonServiceHealth={report?.pythonService}
                webSpeechSupported={webSpeech.supported}
              />
            </div>
          </div>

          <SttAudioSourcePanel
            provider={safeProvider}
            source={source}
            onSourceChange={(next) => {
              setSource(next);
              setShowSourcePreview(true);
            }}
            recorder={{ ...recorder, start: () => void startRecording() }}
            liveTranscript={webSpeech.transcript}
            liveError={webSpeech.error}
            disabled={transcribing}
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {transcribing ? (
              <>
                <Button variant="secondary" size="lg" icon={<Square size={14} fill="currentColor" />} onClick={() => abortRef.current?.abort()}>
                  Annuler
                </Button>
                <span aria-live="polite" className="flex items-center gap-2 text-sm text-muted">
                  <span className="size-2 rounded-full bg-[var(--provider)] animate-pulse-dot" />
                  Transcription {STT_PROVIDER_CATALOG[safeProvider].label}
                  <span className="font-mono tabular-nums text-ink">{formatTimer(elapsedMs)}</span>
                </span>
              </>
            ) : (
              <>
                <Button variant="primary" size="lg" icon={<Wand2 size={16} />} disabled={!canTranscribe} onClick={() => source && void transcribe(source, { browserTranscript: webSpeech.transcript })}>
                  {source ? "Transcrire" : "Choisissez d'abord un audio"}
                </Button>
                {source && (
                  <span className="min-w-0 truncate text-xs text-muted" title={source.fileName}>
                    {source.fileName}
                  </span>
                )}
              </>
            )}
          </div>
          {safeProvider === "web-speech" && source && !sourceIsMic && (
            <p className="-mt-3 text-xs text-warning">Web Speech ne transcrit que le micro en direct : choisissez Whisper ou Sherpa pour cet audio.</p>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Résultat" icon={<FileText size={16} />}>
            <SttTranscriptView
              entry={currentEntry}
              sourceUrl={showSourcePreview ? sourceUrl : null}
              autoPlayToken={autoPlayToken}
              onToggleFavorite={history.toggleFavorite}
              onScore={history.setScore}
            />
          </Panel>
          <ActivityPanel storageKey="stt-activity" sources={[...STT_PROVIDER_IDS, "python-service", "api"]} requestId={activeRequestId} />
        </div>
      </div>

      <SttInsightsPanel
        items={history.items}
        onSelect={(id) => {
          const entry = history.items.find((item) => item.id === id);
          if (entry) openEntry(entry);
        }}
      />

      <Panel icon={<History size={16} />} title="Historique" actions={<span className="text-xs text-muted">{history.items.length} / 100</span>}>
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
      </Panel>
    </div>
  );
}
