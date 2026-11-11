"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TTS_PROVIDER_IDS, type TtsHistoryEntry, type TtsProviderId, type TtsSettingsByProvider } from "@/lib/shared/types";
import { DEFAULT_TTS_SETTINGS, TTS_PROVIDER_CATALOG } from "@/lib/shared/provider-catalog";
import { ApiClientError, apiRequest, createClientRequestId, jsonBody, showErrorToast } from "@/lib/client/api-client";
import { formatTimer } from "@/lib/client/format";
import { providerStyle } from "@/lib/client/provider-style";
import { cn } from "@/lib/client/cn";
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
import { TtsSettingsPanel } from "./settings/tts-settings-panel";
import { TtsAudioMonitor, type ListenOrigin } from "./tts-audio-monitor";
import { TtsHistoryList } from "./tts-history-list";
import { TtsInsightsPanel } from "./tts-insights-panel";
import { TtsVoicePicker } from "./tts-voice-picker";
import { useTtsVoices } from "./use-tts-voices";

// SECTION: Atelier TTS : moteur, voix, texte, réglages repliés et barre d'action collante à gauche ; écoute et activité à droite.

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

/** Sous `lg`, les colonnes s'empilent : on fait défiler jusqu'au panneau Écoute pour montrer le résultat. */
function scrollToIfStacked(element: HTMLElement | null) {
  if (!element || window.matchMedia("(min-width: 1024px)").matches) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function TtsWorkbench() {
  const { report, refresh: refreshHealth } = useHealth();
  const [provider, setProvider] = usePersistentState<TtsProviderId>("tts-provider", "piper");
  const [text, setText] = usePersistentState("tts-text", DEFAULT_TEXT);
  const [settings, setSettings] = usePersistentState<TtsSettingsByProvider>("tts-settings", DEFAULT_TTS_SETTINGS);
  const [selectedVoices, setSelectedVoices] = usePersistentState("tts-voices", DEFAULT_SELECTED_VOICES);
  const [specOpen, setSpecOpen] = useState(false);

  const history = useHistoryCollection<TtsHistoryEntry>("/api/tts/history");
  const { voiceList, loading: voicesLoading, error: voicesError, retry: retryVoices } = useTtsVoices(provider);

  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [listenOrigin, setListenOrigin] = useState<ListenOrigin>("latest");
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listenRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const elapsedMs = useElapsedTime(generating);

  // NOTE: provider inconnu dans un ancien localStorage (ex. "edge"), on revient au défaut.
  const safeProvider: TtsProviderId = TTS_PROVIDER_IDS.includes(provider) ? provider : "piper";
  const providerLabel = TTS_PROVIDER_CATALOG[safeProvider].label;
  const providerSettings = { ...DEFAULT_TTS_SETTINGS, ...settings };
  const providerHealth = report?.tts[safeProvider];
  const selectedEntry = history.items.find((item) => item.id === currentEntryId);
  const currentEntry = selectedEntry ?? history.items[0] ?? null;
  const effectiveOrigin: ListenOrigin = selectedEntry ? listenOrigin : "latest";

  // ANCHOR: voix sélectionnée = dernière voix choisie pour ce provider si elle existe encore, sinon la première.
  const voices = voiceList?.provider === safeProvider ? voiceList.voices : [];
  const rememberedVoiceId = selectedVoices[safeProvider];
  const selectedVoiceId = voices.some((v) => v.id === rememberedVoiceId) ? rememberedVoiceId : (voices[0]?.id ?? null);
  const selectedVoiceName = voices.find((v) => v.id === selectedVoiceId)?.name;

  const tooLong = text.length > MAX_TEXT_LENGTH;
  const providerDown = providerHealth?.status === "down";
  const canGenerate = !generating && !providerDown && text.trim().length > 0 && !tooLong && Boolean(selectedVoiceId);
  const disabledReason = providerDown ? `${providerLabel} est indisponible` : !selectedVoiceId ? "Choisissez une voix" : text.trim().length === 0 ? "Écrivez un texte" : tooLong ? "Texte trop long" : null;
  const modifiedCount = countModifiedSettings(providerSettings[safeProvider], DEFAULT_TTS_SETTINGS[safeProvider]);

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
      // NOTE: pas de toast de succès, le panneau Écoute se met à jour et lit l'audio.
      history.prepend(entry);
      setCurrentEntryId(entry.id);
      setListenOrigin("generated");
      setAutoPlayToken((n) => n + 1);
      scrollToIfStacked(listenRef.current);
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
    setListenOrigin("history");
    setAutoPlayToken((n) => n + 1);
    scrollToIfStacked(listenRef.current);
  };

  const reuseEntry = (entry: TtsHistoryEntry) => {
    setText(entry.text);
    setProvider(entry.provider);
    setSelectedVoices((current) => ({ ...current, [entry.provider]: entry.voiceId }));
    textRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Texte et voix repris dans l'éditeur");
  };

  return (
    <div style={providerStyle(safeProvider)} className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel
          title="Synthèse vocale"
          className="min-w-0"
          bodyClassName="space-y-3"
          actions={
            <>
              <IconButton label={specOpen ? `Masquer la fiche ${providerLabel}` : `Fiche technique ${providerLabel}`} aria-pressed={specOpen} onClick={() => setSpecOpen(!specOpen)}>
                <Icon name="info" />
              </IconButton>
              {/* ANCHOR: action rapide en haut du panneau, même effet que le bouton de la barre du bas, sans défiler. */}
              {generating ? (
                <IconButton label="Annuler la génération (Échap)" onClick={() => abortRef.current?.abort()} className="text-[var(--provider)] hover:text-[var(--provider)]">
                  <Icon name="stop" size={22} />
                </IconButton>
              ) : (
                <IconButton
                  label={disabledReason ?? `Générer avec ${providerLabel}${selectedVoiceName ? `, ${selectedVoiceName}` : ""} (Ctrl + Entrée)`}
                  onClick={() => void generate()}
                  disabled={!canGenerate}
                  className="bg-[var(--provider)] text-white hover:bg-[color-mix(in_srgb,var(--provider)_85%,black)] hover:text-white"
                >
                  <Icon name="tts" size={20} />
                </IconButton>
              )}
            </>
          }
        >
          <ProviderPicker label="Moteur de synthèse" providers={TTS_PROVIDER_IDS} catalog={TTS_PROVIDER_CATALOG} value={safeProvider} onChange={setProvider} health={report?.tts} disabled={generating} />

          {specOpen && <ProviderSpecCards catalog={TTS_PROVIDER_CATALOG} health={report?.tts} only={safeProvider} />}

          <ProviderHealthAlert health={providerHealth} />

          <section aria-label="Voix">
            <TtsVoicePicker
              voiceList={voiceList?.provider === safeProvider ? voiceList : null}
              loading={voicesLoading}
              error={voicesError}
              selectedVoiceId={selectedVoiceId}
              onSelect={(voiceId) => setSelectedVoices((current) => ({ ...current, [safeProvider]: voiceId }))}
              onRetry={retryVoices}
              emptyHint={EMPTY_VOICE_HINTS[safeProvider]}
              healthAlertShown={Boolean(providerHealth && providerHealth.status !== "ok")}
            />
          </section>

          <div>
            <label htmlFor="tts-text" className="sr-only">
              Texte à lire
            </label>
            <textarea
              ref={textRef}
              id="tts-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void generate();
                }
              }}
              rows={5}
              placeholder="Écrivez le texte à faire lire."
              className="block w-full resize-y rounded-xl border border-line bg-sunken px-3 py-2.5 text-[0.95rem] leading-relaxed text-ink placeholder:text-muted focus:border-[var(--provider)] focus:outline-none"
            />
          </div>

          <SettingsDisclosure
            storageKey="tts"
            providerLabel={providerLabel}
            modifiedCount={modifiedCount}
            onReset={() => updateSettings(safeProvider, DEFAULT_TTS_SETTINGS[safeProvider])}
          >
            <TtsSettingsPanel provider={safeProvider} settings={providerSettings} onChange={updateSettings} pythonServiceHealth={report?.pythonService} />
          </SettingsDisclosure>

          {/* ANCHOR: barre d'action collante en bas de l'écran tant que le panneau est visible ; les marges négatives annulent le padding du corps. */}
          <div className="sticky bottom-0 z-10 -mx-3 -mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-b-2xl border-t border-line bg-surface px-3 py-2.5 sm:-mx-4 sm:-mb-4 sm:px-4">
            {generating ? (
              <>
                <Button variant="secondary" size="lg" icon={<Icon name="stop" />} tooltip="Échap" onClick={() => abortRef.current?.abort()}>
                  Annuler
                </Button>
                <span aria-live="polite" className="flex min-w-0 items-center gap-2 text-sm text-muted">
                  <span className="size-2 shrink-0 rounded-full bg-[var(--provider)] animate-pulse-dot" />
                  <span className="truncate">Génération {providerLabel}</span>
                  <span className="tabular-nums text-ink">{formatTimer(elapsedMs)}</span>
                </span>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Icon name="tts" size={20} />}
                  tooltip="Ctrl + Entrée"
                  onClick={() => void generate()}
                  disabled={!canGenerate}
                  className="min-w-0 max-w-full"
                >
                  <span className="truncate">
                    Générer avec {providerLabel}
                    {selectedVoiceName ? `, ${selectedVoiceName}` : ""}
                  </span>
                </Button>
                {disabledReason && <span className="text-xs text-muted">{disabledReason}</span>}
              </>
            )}
            <span className={cn("ml-auto text-xs tabular-nums", tooLong ? "font-medium text-danger" : "text-muted")}>
              {text.length} / {MAX_TEXT_LENGTH}
            </span>
          </div>
        </Panel>

        <div ref={listenRef} className="min-w-0 scroll-mt-20 space-y-4 lg:sticky lg:top-20">
          <TtsAudioMonitor
            entry={currentEntry}
            peers={history.items}
            origin={effectiveOrigin}
            selectedProvider={safeProvider}
            autoPlayToken={autoPlayToken}
            onToggleFavorite={history.toggleFavorite}
            onScore={history.setScore}
          />
          <ActivityPanel storageKey="tts-activity" sources={[...TTS_PROVIDER_IDS, "api"]} requestId={activeRequestId} live={generating} />
        </div>
      </div>

      <TtsInsightsPanel
        items={history.items}
        onSelect={(id) => {
          const entry = history.items.find((item) => item.id === id);
          if (entry) playEntry(entry);
        }}
      />

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
    </div>
  );
}
