"use client";

import { BookOpen, History, Mic2, SlidersHorizontal, Sparkles, Square, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TTS_PROVIDER_IDS, type TtsHistoryEntry, type TtsProviderId, type TtsSettingsByProvider } from "@/lib/shared/types";
import { DEFAULT_TTS_SETTINGS, TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { ApiClientError, apiRequest, createClientRequestId, jsonBody, showErrorToast } from "@/lib/client/api-client";
import { formatSeconds, formatTimer } from "@/lib/client/format";
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
import { TtsSettingsPanel } from "./settings/tts-settings-panel";
import { TtsAudioMonitor } from "./tts-audio-monitor";
import { TtsHistoryList } from "./tts-history-list";
import { TtsInsightsPanel } from "./tts-insights-panel";
import { TtsVoicePicker } from "./tts-voice-picker";
import { useTtsVoices } from "./use-tts-voices";

// SECTION: Atelier TTS : composition du texte, choix provider/voix/réglages, génération, écoute, comparaison.

const MAX_TEXT_LENGTH = 5000;
const DEFAULT_TEXT =
  "Le chat s'assit près du grand vieil arbre et observa les oiseaux exécuter leur ballet aérien. « Quelle heure est-il ? » demanda-t-elle en fronçant les sourcils, avant d'ajouter : « Nous avons rendez-vous à neuf heures et quart, pas à dix-neuf heures ! » Malgré la pluie battante et les rafales de vent, ils décidèrent de traverser les Champs-Élysées à pied, un peu essoufflés mais résolument heureux.";

const EMPTY_VOICE_HINTS: Record<TtsProviderId, string> = {
  "edge-tts": "Aucune voix Edge TTS pour cette langue.",
  piper: "Aucune voix Piper dans voices/. Lancez npm run setup.",
  kokoro: "Aucune voix Kokoro pour cette langue.",
  chatterbox: "Aucun échantillon de référence dans python/tts/references/.",
};

const DEFAULT_SELECTED_VOICES: Record<TtsProviderId, string | null> = { "edge-tts": null, piper: null, kokoro: null, chatterbox: null };

export function TtsWorkbench() {
  const { report, refresh: refreshHealth } = useHealth();
  const [provider, setProvider] = usePersistentState<TtsProviderId>("tts-provider", "piper");
  const [text, setText] = usePersistentState("tts-text", DEFAULT_TEXT);
  const [settings, setSettings] = usePersistentState<TtsSettingsByProvider>("tts-settings", DEFAULT_TTS_SETTINGS);
  const [selectedVoices, setSelectedVoices] = usePersistentState("tts-voices", DEFAULT_SELECTED_VOICES);

  const history = useHistoryCollection<TtsHistoryEntry>("/api/tts/history");
  const { voiceList, loading: voicesLoading, error: voicesError, retry: retryVoices } = useTtsVoices(provider);

  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const elapsedMs = useElapsedTime(generating);

  // NOTE: provider inconnu dans un ancien localStorage (ex. "edge"), on revient au défaut.
  const safeProvider: TtsProviderId = TTS_PROVIDER_IDS.includes(provider) ? provider : "piper";
  const providerSettings = { ...DEFAULT_TTS_SETTINGS, ...settings };
  const providerHealth = report?.tts[safeProvider];
  const currentEntry = history.items.find((item) => item.id === currentEntryId) ?? history.items[0] ?? null;

  // ANCHOR: voix sélectionnée = dernière voix choisie pour ce provider si elle existe encore, sinon la première.
  const voices = voiceList?.provider === safeProvider ? voiceList.voices : [];
  const rememberedVoiceId = selectedVoices[safeProvider];
  const selectedVoiceId = voices.some((v) => v.id === rememberedVoiceId) ? rememberedVoiceId : (voices[0]?.id ?? null);

  const trimmedLength = text.trim().length;
  const canGenerate = !generating && trimmedLength > 0 && text.length <= MAX_TEXT_LENGTH && Boolean(selectedVoiceId);

  const generate = useCallback(async () => {
    if (!canGenerate || !selectedVoiceId) return;
    const requestId = createClientRequestId();
    const controller = new AbortController();
    abortRef.current = controller;
    setActiveRequestId(requestId);
    setGenerating(true);
    try {
      const { entry } = await apiRequest<{ entry: TtsHistoryEntry }>("/api/tts", {
        method: "POST",
        signal: controller.signal,
        ...jsonBody({ provider: safeProvider, text, voiceId: selectedVoiceId, settings: providerSettings[safeProvider] }),
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
      });
      history.prepend(entry);
      setCurrentEntryId(entry.id);
      setAutoPlayToken((n) => n + 1);
      toast.success(`Audio généré en ${formatSeconds(entry.generationTimeMs)}`, { description: `${TTS_PROVIDER_CATALOG[entry.provider].label}, ${entry.voiceName}` });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "ABORTED") {
        toast.info("Génération annulée");
      } else {
        showErrorToast(err, "Génération impossible");
        if (err instanceof ApiClientError && ["PYTHON_SERVICE_DOWN", "ENGINE_UNAVAILABLE"].includes(err.code)) void refreshHealth();
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [canGenerate, selectedVoiceId, safeProvider, text, providerSettings, history, refreshHealth]);

  // NOTE: Échap annule une génération en cours.
  useEffect(() => {
    if (!generating) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && abortRef.current?.abort();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generating]);

  const updateSettings = <P extends TtsProviderId>(target: P, value: TtsSettingsByProvider[P]) =>
    setSettings((current) => ({ ...DEFAULT_TTS_SETTINGS, ...current, [target]: value }));

  const playEntry = (entry: TtsHistoryEntry) => {
    setCurrentEntryId(entry.id);
    setAutoPlayToken((n) => n + 1);
  };

  const reuseEntry = (entry: TtsHistoryEntry) => {
    setText(entry.text);
    setProvider(entry.provider);
    setSelectedVoices((current) => ({ ...current, [entry.provider]: entry.voiceId }));
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Texte et voix repris dans l'éditeur");
  };

  return (
    <div style={providerStyle(safeProvider)} className="space-y-5">
      <CollapsiblePanel storageKey="tts-specs" icon={<BookOpen size={16} />} title="Les quatre moteurs" summary="fiches techniques et état" defaultOpen={false}>
        <ProviderSpecCards catalog={TTS_PROVIDER_CATALOG} health={report?.tts} />
      </CollapsiblePanel>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel icon={<Sparkles size={16} />} title="Synthèse vocale" bodyClassName="space-y-5">
          <ProviderPicker
            label="Moteur de synthèse"
            providers={TTS_PROVIDER_IDS}
            catalog={TTS_PROVIDER_CATALOG}
            value={safeProvider}
            onChange={setProvider}
            health={report?.tts}
            disabled={generating}
          />

          {providerHealth && providerHealth.status !== "ok" && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>
                  {TTS_PROVIDER_CATALOG[safeProvider].label} : {providerHealth.reason ?? "fonctionnement dégradé."}
                </p>
                {providerHealth.hint && <p className="mt-0.5 text-xs"><HintText text={providerHealth.hint} /></p>}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <label htmlFor="tts-text" className="text-sm font-medium text-ink">
                Texte
              </label>
              <span className={text.length > MAX_TEXT_LENGTH ? "text-xs text-danger" : "text-xs text-muted"}>
                <span className="font-mono tabular-nums">{text.length}</span> / {MAX_TEXT_LENGTH}
              </span>
            </div>
            <textarea
              id="tts-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void generate();
                }
              }}
              rows={6}
              placeholder="Écrivez le texte à faire lire."
              className="w-full resize-y rounded-xl border border-line bg-sunken px-3.5 py-3 text-[0.95rem] leading-relaxed text-ink placeholder:text-muted focus:border-[var(--provider)] focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <Mic2 size={15} className="text-muted" /> Voix
            </p>
            <TtsVoicePicker
              voiceList={voiceList?.provider === safeProvider ? voiceList : null}
              loading={voicesLoading}
              error={voicesError}
              selectedVoiceId={selectedVoiceId}
              onSelect={(voiceId) => setSelectedVoices((current) => ({ ...current, [safeProvider]: voiceId }))}
              onRetry={retryVoices}
              emptyHint={EMPTY_VOICE_HINTS[safeProvider]}
            />
          </div>

          <div className="rounded-xl border border-line px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <SlidersHorizontal size={15} className="text-muted" /> Réglages {TTS_PROVIDER_CATALOG[safeProvider].label}
              <button
                type="button"
                className="ml-auto text-xs font-normal text-muted hover:text-ink"
                onClick={() => updateSettings(safeProvider, DEFAULT_TTS_SETTINGS[safeProvider])}
              >
                Valeurs par défaut
              </button>
            </div>
            <div className="pt-3 pb-1">
              <TtsSettingsPanel provider={safeProvider} settings={providerSettings} onChange={updateSettings} pythonServiceHealth={report?.pythonService} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {generating ? (
              <>
                <Button variant="secondary" size="lg" icon={<Square size={14} fill="currentColor" />} onClick={() => abortRef.current?.abort()}>
                  Annuler
                </Button>
                <span aria-live="polite" className="flex items-center gap-2 text-sm text-muted">
                  <span className="size-2 rounded-full bg-[var(--provider)] animate-pulse-dot" />
                  Génération {TTS_PROVIDER_CATALOG[safeProvider].label}
                  <span className="font-mono tabular-nums text-ink">{formatTimer(elapsedMs)}</span>
                </span>
              </>
            ) : (
              <>
                <Button variant="primary" size="lg" icon={<Sparkles size={16} />} onClick={() => void generate()} disabled={!canGenerate}>
                  Générer l'audio
                </Button>
                <span className="text-xs text-muted">
                  <kbd className="rounded border border-line px-1 font-mono">Ctrl</kbd> + <kbd className="rounded border border-line px-1 font-mono">Entrée</kbd>
                </span>
              </>
            )}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Écoute" icon={<Sparkles size={16} />}>
            <TtsAudioMonitor entry={currentEntry} autoPlayToken={autoPlayToken} onToggleFavorite={history.toggleFavorite} onScore={history.setScore} />
          </Panel>
          <ActivityPanel storageKey="tts-activity" sources={[...TTS_PROVIDER_IDS, "api"]} requestId={activeRequestId} />
        </div>
      </div>

      <TtsInsightsPanel
        items={history.items}
        onSelect={(id) => {
          const entry = history.items.find((item) => item.id === id);
          if (entry) playEntry(entry);
        }}
      />

      <Panel icon={<History size={16} />} title="Historique" actions={<span className="text-xs text-muted">{history.items.length} / 50</span>}>
        <TtsHistoryList
          items={history.items}
          loading={history.loading}
          loadError={history.loadError}
          activeEntryId={currentEntry?.id ?? null}
          onPlay={playEntry}
          onReuseText={reuseEntry}
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
