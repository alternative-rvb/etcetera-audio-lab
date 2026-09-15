import { icon } from "./icons.js";

interface VoiceInfo {
  id: string;
  name: string;
  language?: string;
  gender?: "female" | "male" | "unknown";
  quality?: string;
}

interface AudioHistoryItem {
  id: string;
  createdAt: string;
  text: string;
  engine: "piper" | "edge" | "kokoro" | "chatterbox";
  voiceId: string;
  voiceName: string;
  filePath: string;
  fileName: string;
  url: string;
  format: "wav" | "mp3";
  sizeBytes: number;
  upvotes: number;
  isFavorite?: boolean;
}

type Engine = "piper" | "edge" | "kokoro" | "chatterbox";
type HistoryFilter = "all" | "edge" | "piper" | "kokoro" | "chatterbox" | "favorites";

const textEl = document.getElementById("text") as HTMLTextAreaElement;
const engineSwitchEl = document.getElementById("engineSwitch") as HTMLDivElement;
const voiceButtonsEl = document.getElementById("voiceButtons") as HTMLDivElement;
const voiceCountBadgeEl = document.getElementById("voiceCountBadge") as HTMLSpanElement;
const voiceSelectionTitleEl = document.getElementById("voiceSelectionTitle") as HTMLSpanElement;

const piperControlsEl = document.getElementById("piperControls") as HTMLDivElement;
const edgeControlsEl = document.getElementById("edgeControls") as HTMLDivElement;
const kokoroControlsEl = document.getElementById("kokoroControls") as HTMLDivElement;
const chatterboxControlsEl = document.getElementById("chatterboxControls") as HTMLDivElement;

const lengthScaleEl = document.getElementById("lengthScale") as HTMLInputElement;
const lengthScaleValueEl = document.getElementById("lengthScaleValue") as HTMLSpanElement;
const noiseScaleEl = document.getElementById("noiseScale") as HTMLInputElement;
const noiseScaleValueEl = document.getElementById("noiseScaleValue") as HTMLSpanElement;
const noiseWEl = document.getElementById("noiseW") as HTMLInputElement;
const noiseWValueEl = document.getElementById("noiseWValue") as HTMLSpanElement;
const ratePercentEl = document.getElementById("ratePercent") as HTMLInputElement;
const ratePercentValueEl = document.getElementById("ratePercentValue") as HTMLSpanElement;

const kokoroSpeedEl = document.getElementById("kokoroSpeed") as HTMLInputElement;
const kokoroSpeedValueEl = document.getElementById("kokoroSpeedValue") as HTMLSpanElement;

const chatterboxExaggerationEl = document.getElementById("chatterboxExaggeration") as HTMLInputElement;
const chatterboxExaggerationValueEl = document.getElementById("chatterboxExaggerationValue") as HTMLSpanElement;
const chatterboxTemperatureEl = document.getElementById("chatterboxTemperature") as HTMLInputElement;
const chatterboxTemperatureValueEl = document.getElementById("chatterboxTemperatureValue") as HTMLSpanElement;

const generateBtn = document.getElementById("generate") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;
const playerEl = document.getElementById("player") as HTMLAudioElement;
const themeToggleEl = document.getElementById("themeToggle") as HTMLButtonElement;

// Éléments de l'aperçu détaillé
const previewInfoEl = document.getElementById("previewInfo") as HTMLDivElement;
const previewUpvoteBtn = document.getElementById("previewUpvoteBtn") as HTMLButtonElement;
const audioDetailsEl = document.getElementById("audioDetails") as HTMLDivElement;
const detailEngineEl = document.getElementById("detailEngine") as HTMLSpanElement;
const detailVoiceEl = document.getElementById("detailVoice") as HTMLSpanElement;
const detailPathEl = document.getElementById("detailPath") as HTMLElement;
const copyPathBtn = document.getElementById("copyPathBtn") as HTMLButtonElement;

// Éléments de l'historique
const historyCountEl = document.getElementById("historyCount") as HTMLSpanElement;
const toggleAllHistoryBtn = document.getElementById("toggleAllHistoryBtn") as HTMLButtonElement;
const clearHistoryBtn = document.getElementById("clearHistoryBtn") as HTMLButtonElement;
const historyFilterButtonsEl = document.getElementById("historyFilterButtons") as HTMLDivElement;
const historyListEl = document.getElementById("historyList") as HTMLDivElement;

// Éléments des onglets d'information
const tabBtnGoal = document.getElementById("tabBtnGoal") as HTMLButtonElement;
const tabBtnHelp = document.getElementById("tabBtnHelp") as HTMLButtonElement;
const tabPanelGoal = document.getElementById("tabPanelGoal") as HTMLDivElement;
const tabPanelHelp = document.getElementById("tabPanelHelp") as HTMLDivElement;

function setupInfoTabs() {
  const tabs = [
    { btn: tabBtnGoal, panel: tabPanelGoal },
    { btn: tabBtnHelp, panel: tabPanelHelp },
  ];

  for (const { btn, panel } of tabs) {
    if (!btn || !panel) continue;
    btn.addEventListener("click", () => {
      for (const t of tabs) {
        const isActive = t.btn === btn;
        t.btn.classList.toggle("active", isActive);
        t.btn.setAttribute("aria-selected", String(isActive));
        t.panel.hidden = !isActive;
      }
    });
  }
}

setupInfoTabs();

let allExpanded = false;

let engine: Engine = "edge";
let selectedVoiceId: string = "";
let currentVoices: VoiceInfo[] = [];
let historyItems: AudioHistoryItem[] = [];
let historyFilter: HistoryFilter = "all";
let currentPreviewAudioId: string | null = null;

function bindRangeDisplay(input: HTMLInputElement, display: HTMLSpanElement, format: (n: number) => string) {
  const update = () => {
    display.textContent = format(Number(input.value));
  };
  input.addEventListener("input", update);
  update();
}

bindRangeDisplay(lengthScaleEl, lengthScaleValueEl, (n) => n.toFixed(2));
bindRangeDisplay(noiseScaleEl, noiseScaleValueEl, (n) => n.toFixed(2));
bindRangeDisplay(noiseWEl, noiseWValueEl, (n) => n.toFixed(2));
bindRangeDisplay(ratePercentEl, ratePercentValueEl, (n) => `${n >= 0 ? "+" : ""}${n}%`);
bindRangeDisplay(kokoroSpeedEl, kokoroSpeedValueEl, (n) => `${n.toFixed(2)}x`);
bindRangeDisplay(chatterboxExaggerationEl, chatterboxExaggerationValueEl, (n) => n.toFixed(2));
bindRangeDisplay(chatterboxTemperatureEl, chatterboxTemperatureValueEl, (n) => n.toFixed(2));

function updateControlsVisibility() {
  document.body.dataset.activeEngine = engine;
  piperControlsEl.hidden = engine !== "piper";
  edgeControlsEl.hidden = engine !== "edge";
  kokoroControlsEl.hidden = engine !== "kokoro";
  chatterboxControlsEl.hidden = engine !== "chatterbox";

  if (voiceSelectionTitleEl) {
    if (engine === "chatterbox") {
      voiceSelectionTitleEl.textContent = "Échantillon de voix (Clonage)";
    } else {
      voiceSelectionTitleEl.textContent = "Modèle de voix (France)";
    }
  }

  for (const btn of Array.from(engineSwitchEl.querySelectorAll<HTMLButtonElement>(".engine-btn"))) {
    btn.setAttribute("aria-pressed", String(btn.dataset.engine === engine));
  }
}

function selectVoice(voiceId: string) {
  selectedVoiceId = voiceId;
  const buttons = Array.from(voiceButtonsEl.querySelectorAll<HTMLButtonElement>(".voice-btn"));
  for (const btn of buttons) {
    const isSelected = btn.dataset.voiceId === voiceId;
    btn.setAttribute("aria-checked", String(isSelected));
    btn.tabIndex = isSelected ? 0 : -1;
  }
}

function renderVoiceButtons(voices: VoiceInfo[]) {
  voiceButtonsEl.innerHTML = "";
  const unitName = engine === "chatterbox" ? "échantillon" : "modèle";
  voiceCountBadgeEl.textContent = `${voices.length} ${unitName}${voices.length > 1 ? "s" : ""}`;

  if (voices.length === 0) {
    selectedVoiceId = "";
    voiceButtonsEl.innerHTML = `<span class="voice-count">Aucun ${unitName} disponible</span>`;
    return;
  }

  // Préserve la sélection si possible, sinon première voix
  const stillExists = voices.some((v) => v.id === selectedVoiceId);
  if (!stillExists) {
    selectedVoiceId = voices[0].id;
  }

  voices.forEach((voice, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "voice-btn";
    btn.role = "radio";
    btn.dataset.voiceId = voice.id;

    const isSelected = voice.id === selectedVoiceId;
    btn.setAttribute("aria-checked", String(isSelected));
    btn.tabIndex = isSelected ? 0 : -1;

    const genderLabel = voice.gender === "female" ? "Femme" : voice.gender === "male" ? "Homme" : "";
    const genderBadge = genderLabel
      ? `<span class="voice-tag voice-gender-tag">${icon("user", { size: 12 })} <span>${genderLabel}</span></span>`
      : "";
    const qualityBadge = voice.quality ? `<span class="voice-tag">${voice.quality}</span>` : "";

    btn.innerHTML = `
      <div class="voice-btn-name" title="${voice.name}">${voice.name}</div>
      <div class="voice-btn-meta">
        ${genderBadge}
        ${qualityBadge}
      </div>
    `;

    btn.addEventListener("click", () => {
      selectVoice(voice.id);
    });

    btn.addEventListener("keydown", (e) => {
      const allButtons = Array.from(voiceButtonsEl.querySelectorAll<HTMLButtonElement>(".voice-btn"));
      let nextIndex = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (index + 1) % allButtons.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex = (index - 1 + allButtons.length) % allButtons.length;
      }
      if (nextIndex >= 0) {
        e.preventDefault();
        const nextBtn = allButtons[nextIndex];
        const nextVoiceId = nextBtn.dataset.voiceId;
        if (nextVoiceId) {
          selectVoice(nextVoiceId);
          nextBtn.focus();
        }
      }
    });

    voiceButtonsEl.appendChild(btn);
  });
}

async function loadVoices() {
  const res = await fetch(`/api/voices?engine=${engine}&locale=fr-FR`);
  currentVoices = await res.json();
  renderVoiceButtons(currentVoices);
}

function setEngine(next: Engine) {
  if (next === engine) return;
  engine = next;
  updateControlsVisibility();
  loadVoices().catch((err) => {
    statusEl.textContent = `Impossible de charger les voix : ${(err as Error).message}`;
  });
}

engineSwitchEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".engine-btn");
  if (!btn) return;
  setEngine(btn.dataset.engine as Engine);
});

// Copie dans le presse-papier avec feedback visuel
async function copyToClipboard(text: string, buttonEl: HTMLButtonElement) {
  try {
    await navigator.clipboard.writeText(text);
    buttonEl.innerHTML = `${icon("check", { size: 12 })} <span>Copié !</span>`;
    buttonEl.classList.add("copied");
    setTimeout(() => {
      buttonEl.innerHTML = `${icon("copy", { size: 12 })} <span>Copier</span>`;
      buttonEl.classList.remove("copied");
    }, 1500);
  } catch {
    buttonEl.innerHTML = `${icon("copy", { size: 12 })} <span>Erreur</span>`;
    setTimeout(() => {
      buttonEl.innerHTML = `${icon("copy", { size: 12 })} <span>Copier</span>`;
    }, 1500);
  }
}

copyPathBtn.addEventListener("click", () => {
  const path = detailPathEl.textContent;
  if (path) copyToClipboard(path, copyPathBtn);
});

detailPathEl.addEventListener("click", () => {
  const path = detailPathEl.textContent;
  if (path) copyToClipboard(path, copyPathBtn);
});

// Gestion de l'upvote / favoris
async function toggleItemUpvote(id: string) {
  try {
    const res = await fetch(`/api/history/${id}/upvote`, { method: "POST" });
    if (!res.ok) throw new Error("Erreur upvote");
    const updated: AudioHistoryItem = await res.json();
    const idx = historyItems.findIndex((i) => i.id === id);
    if (idx !== -1) {
      historyItems[idx] = updated;
    }
    if (currentPreviewAudioId === id) {
      updatePreviewUpvoteButton(updated.isFavorite);
    }
    renderHistory();
  } catch (err) {
    console.error("Erreur lors de l'upvote :", err);
  }
}

function updatePreviewUpvoteButton(isFav?: boolean) {
  previewUpvoteBtn.classList.toggle("is-favorite", !!isFav);
  const star = icon("star", { size: 13, fill: isFav ? "currentColor" : "none" });
  previewUpvoteBtn.innerHTML = `${star} <span>${isFav ? "Favori ✓" : "Favori"}</span>`;
}

function getEngineDetails(eng: Engine) {
  switch (eng) {
    case "piper":
      return { label: "Piper", iconName: "cpu", badgeClass: "engine-piper", cardClass: "card-piper" };
    case "kokoro":
      return { label: "Kokoro", iconName: "zap", badgeClass: "engine-kokoro", cardClass: "card-kokoro" };
    case "chatterbox":
      return { label: "Chatterbox", iconName: "mic", badgeClass: "engine-chatterbox", cardClass: "card-chatterbox" };
    case "edge":
    default:
      return { label: "Edge TTS", iconName: "cloud", badgeClass: "engine-edge", cardClass: "card-edge" };
  }
}

// Fonction centrale de synchronisation de l'aperçu audio
function loadAudioIntoPreview(
  item: {
    id: string;
    engine: Engine;
    voiceName: string;
    voiceId?: string;
    filePath: string;
    url: string;
    isFavorite?: boolean;
  },
  autoPlay = false
) {
  currentPreviewAudioId = item.id;
  const engDetails = getEngineDetails(item.engine);

  detailEngineEl.innerHTML = `${icon(engDetails.iconName, { size: 12 })} <span>${engDetails.label}</span>`;
  detailEngineEl.className = `card-badge ${engDetails.badgeClass}`;
  detailVoiceEl.textContent = item.voiceName || item.voiceId || "Voix";
  detailPathEl.textContent = item.filePath || "";
  detailPathEl.title = item.filePath ? `Cliquer pour copier : ${item.filePath}` : "";

  previewInfoEl.hidden = false;
  audioDetailsEl.hidden = false;

  updatePreviewUpvoteButton(item.isFavorite);
  previewUpvoteBtn.hidden = false;

  playerEl.src = item.url;
  if (autoPlay) {
    playerEl.play().catch(() => {});
  }
}

previewUpvoteBtn.addEventListener("click", () => {
  if (currentPreviewAudioId) {
    toggleItemUpvote(currentPreviewAudioId);
  }
});

// Historique : chargement et rendu
async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error(res.statusText);
    historyItems = await res.json();
    renderHistory();
    // Si aucun audio n'est actuellement affiché dans l'aperçu et qu'un historique existe, charger le plus récent
    if (!currentPreviewAudioId && historyItems.length > 0) {
      loadAudioIntoPreview(historyItems[0], false);
    }
  } catch (err) {
    console.error("Impossible de charger l'historique :", err);
  }
}

function renderHistory() {
  historyCountEl.textContent = String(historyItems.length);

  const filtered = historyItems.filter((item) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "favorites") return !!item.isFavorite;
    return item.engine === historyFilter;
  });

  historyListEl.innerHTML = "";

  if (filtered.length === 0) {
    historyListEl.innerHTML = `
      <div class="history-empty">
        ${historyFilter === "favorites" ? "Aucun enregistrement marqué en favori pour le moment." : historyItems.length === 0 ? "Aucun enregistrement dans l'historique." : "Aucun enregistrement pour ce filtre."}
      </div>
    `;
    return;
  }

  for (const item of filtered) {
    const details = document.createElement("details");
    const engDetails = getEngineDetails(item.engine);
    details.className = `history-item-dropdown ${engDetails.cardClass}`;
    if (allExpanded) {
      details.open = true;
    }

    const dateStr = new Date(item.createdAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const engineIcon = icon(engDetails.iconName, { size: 12 });
    const favClass = item.isFavorite ? "is-favorite" : "";
    const starIcon = icon("star", { size: 13, fill: item.isFavorite ? "currentColor" : "none" });

    details.innerHTML = `
      <summary class="history-summary">
        <span class="dropdown-chevron">${icon("chevron-right", { size: 13 })}</span>
        <div class="history-summary-badges">
          <span class="card-badge ${engDetails.badgeClass}">${engineIcon} <span>${engDetails.label}</span></span>
          <span class="card-badge">${item.voiceName || item.voiceId}</span>
          <span class="history-card-time">${dateStr}</span>
        </div>
        <span class="history-summary-text" title="${item.text}">${item.text}</span>
        <div class="history-card-actions">
          <button type="button" class="upvote-btn item-upvote-btn ${favClass}" title="Marquer comme favori">
            ${starIcon} <span>Favori</span>
          </button>
          <button type="button" class="card-delete-btn" title="Supprimer cet enregistrement" aria-label="Supprimer">${icon("trash", { size: 13 })}</button>
        </div>
      </summary>

      <div class="history-details-body">
        <p class="history-card-text" title="${item.text}">${item.text}</p>

        <div class="history-card-path">
          <span class="history-path-text" title="${item.filePath}">${item.filePath}</span>
          <button type="button" class="copy-btn copy-item-path-btn">${icon("copy", { size: 12 })} <span>Copier</span></button>
        </div>

        <div class="history-card-footer">
          <audio controls src="${item.url}" preload="none"></audio>
          <button type="button" class="use-text-btn" title="Placer ce texte dans l'éditeur">${icon("rotate-ccw", { size: 12 })} <span>Réutiliser</span></button>
        </div>
      </div>
    `;

    // Événements de la carte
    const upvoteBtn = details.querySelector<HTMLButtonElement>(".item-upvote-btn");
    upvoteBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleItemUpvote(item.id);
    });

    const deleteBtn = details.querySelector<HTMLButtonElement>(".card-delete-btn");
    deleteBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await deleteHistoryItem(item.id);
    });

    const copyBtn = details.querySelector<HTMLButtonElement>(".copy-item-path-btn");
    copyBtn?.addEventListener("click", () => {
      if (copyBtn) copyToClipboard(item.filePath, copyBtn);
    });

    const useTextBtn = details.querySelector<HTMLButtonElement>(".use-text-btn");
    useTextBtn?.addEventListener("click", () => {
      textEl.value = item.text;
      textEl.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const cardAudio = details.querySelector<HTMLAudioElement>("audio");
    cardAudio?.addEventListener("play", () => {
      loadAudioIntoPreview(item, false);
    });

    historyListEl.appendChild(details);
  }
}

// Bouton tout déplier / replier
toggleAllHistoryBtn.addEventListener("click", () => {
  allExpanded = !allExpanded;
  toggleAllHistoryBtn.innerHTML = `${icon("chevrons-up-down", { size: 13 })} <span>${allExpanded ? "Tout replier" : "Tout déplier"}</span>`;
  const dropdowns = Array.from(historyListEl.querySelectorAll<HTMLDetailsElement>("details.history-item-dropdown"));
  for (const d of dropdowns) {
    d.open = allExpanded;
  }
});

async function deleteHistoryItem(id: string) {
  try {
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    historyItems = historyItems.filter((item) => item.id !== id);
    if (currentPreviewAudioId === id) {
      currentPreviewAudioId = null;
      if (historyItems.length > 0) {
        loadAudioIntoPreview(historyItems[0], false);
      } else {
        previewInfoEl.hidden = true;
        audioDetailsEl.hidden = true;
        previewUpvoteBtn.hidden = true;
        playerEl.removeAttribute("src");
        detailPathEl.textContent = "";
      }
    }
    renderHistory();
  } catch (err) {
    alert(`Erreur lors de la suppression : ${(err as Error).message}`);
  }
}

async function clearAllHistory() {
  if (historyItems.length === 0) return;
  if (!confirm("Voulez-vous vraiment vider tout l'historique et supprimer les fichiers audio associés ?")) return;

  try {
    await fetch("/api/history", { method: "DELETE" });
    historyItems = [];
    currentPreviewAudioId = null;
    previewInfoEl.hidden = true;
    audioDetailsEl.hidden = true;
    previewUpvoteBtn.hidden = true;
    playerEl.removeAttribute("src");
    detailPathEl.textContent = "";
    renderHistory();
  } catch (err) {
    alert(`Erreur lors du nettoyage : ${(err as Error).message}`);
  }
}

clearHistoryBtn.addEventListener("click", clearAllHistory);

// Gestion des filtres d'historique (boutons)
historyFilterButtonsEl.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".filter-btn");
  if (!btn || !btn.dataset.filter) return;

  historyFilter = btn.dataset.filter as HistoryFilter;

  for (const b of Array.from(historyFilterButtonsEl.querySelectorAll<HTMLButtonElement>(".filter-btn"))) {
    b.setAttribute("aria-pressed", String(b === btn));
  }

  renderHistory();
});

async function generate() {
  const text = textEl.value.trim();
  if (!text) {
    statusEl.textContent = "Entrez du texte avant de générer.";
    return;
  }
  if (!selectedVoiceId) {
    statusEl.textContent = "Aucun modèle de voix sélectionné.";
    return;
  }

  generateBtn.disabled = true;
  statusEl.textContent = "Génération en cours...";
  const start = performance.now();

  try {
    const body: Record<string, unknown> = {
      text,
      voiceId: selectedVoiceId,
      engine,
    };
    if (engine === "piper") {
      body.lengthScale = Number(lengthScaleEl.value);
      body.noiseScale = Number(noiseScaleEl.value);
      body.noiseW = Number(noiseWEl.value);
    } else if (engine === "edge") {
      body.ratePercent = Number(ratePercentEl.value);
    } else if (engine === "kokoro") {
      body.speed = Number(kokoroSpeedEl.value);
    } else if (engine === "chatterbox") {
      body.exaggeration = Number(chatterboxExaggerationEl.value);
      body.temperature = Number(chatterboxTemperatureEl.value);
    }

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error ?? "Erreur inconnue");
    }

    // Récupération des détails de l'audio depuis les en-têtes
    const audioPath = res.headers.get("X-Audio-Path") ?? "";
    const audioEngine = (res.headers.get("X-Audio-Engine") as Engine) ?? engine;
    const rawVoiceName = res.headers.get("X-Audio-Voice-Name");
    const audioVoiceName = rawVoiceName ? decodeURIComponent(rawVoiceName) : selectedVoiceId;
    const audioId = res.headers.get("X-Audio-Id") || `${Date.now()}`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    loadAudioIntoPreview(
      {
        id: audioId,
        engine: audioEngine,
        voiceName: audioVoiceName,
        voiceId: selectedVoiceId,
        filePath: audioPath,
        url,
        isFavorite: false,
      },
      true
    );

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    statusEl.textContent = `Généré en ${elapsed}s (${engine}).`;

    // Recharger l'historique pour afficher le nouvel élément
    await loadHistory();
  } catch (err) {
    statusEl.textContent = `Erreur : ${(err as Error).message}`;
  } finally {
    generateBtn.disabled = false;
  }
}

generateBtn.addEventListener("click", generate);

function setupStaticIcons() {
  const edgeBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-edge");
  if (edgeBtn) {
    edgeBtn.innerHTML = `${icon("cloud", { size: 15 })} <span>Edge TTS (Microsoft)</span>`;
  }
  const piperBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-piper");
  if (piperBtn) {
    piperBtn.innerHTML = `${icon("cpu", { size: 15 })} <span>Piper (local)</span>`;
  }
  const kokoroBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-kokoro");
  if (kokoroBtn) {
    kokoroBtn.innerHTML = `${icon("zap", { size: 15 })} <span>Kokoro (ONNX)</span>`;
  }
  const chatterboxBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-chatterbox");
  if (chatterboxBtn) {
    chatterboxBtn.innerHTML = `${icon("mic", { size: 15 })} <span>Chatterbox (Clonage)</span>`;
  }

  generateBtn.innerHTML = `${icon("sparkles", { size: 16 })} <span>Générer la voix</span>`;

  if (tabBtnGoal) {
    tabBtnGoal.innerHTML = `${icon("target", { size: 14 })} <span>Expliquer l'objectif</span>`;
  }
  if (tabBtnHelp) {
    tabBtnHelp.innerHTML = `${icon("help", { size: 14 })} <span>Aide</span>`;
  }

  const previewTitle = document.querySelector(".preview-title");
  if (previewTitle) {
    previewTitle.innerHTML = `${icon("volume", { size: 14 })} <span>Aperçu audio</span>`;
  }

  copyPathBtn.innerHTML = `${icon("copy", { size: 12 })} <span>Copier</span>`;

  const historyTitle = document.querySelector(".history-title-row .section-title");
  if (historyTitle) {
    historyTitle.innerHTML = `${icon("history", { size: 16 })} <span>Historique</span>`;
  }
  toggleAllHistoryBtn.innerHTML = `${icon("chevrons-up-down", { size: 13 })} <span>Tout déplier</span>`;
  clearHistoryBtn.innerHTML = `${icon("trash", { size: 13 })} <span>Vider</span>`;

  const filterAll = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="all"]');
  if (filterAll) filterAll.innerHTML = `${icon("filter", { size: 13 })} <span>Tous</span>`;

  const filterEdge = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="edge"]');
  if (filterEdge) filterEdge.innerHTML = `${icon("cloud", { size: 13 })} <span>Edge TTS</span>`;

  const filterPiper = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="piper"]');
  if (filterPiper) filterPiper.innerHTML = `${icon("cpu", { size: 13 })} <span>Piper</span>`;

  const filterKokoro = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="kokoro"]');
  if (filterKokoro) filterKokoro.innerHTML = `${icon("zap", { size: 13 })} <span>Kokoro</span>`;

  const filterChatterbox = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="chatterbox"]');
  if (filterChatterbox) filterChatterbox.innerHTML = `${icon("mic", { size: 13 })} <span>Chatterbox</span>`;

  const filterFav = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="favorites"]');
  if (filterFav) filterFav.innerHTML = `${icon("star", { size: 13, fill: "currentColor" })} <span>Favoris</span>`;
}

// Thème : préférence système par défaut, bascule manuelle mémorisée en localStorage.
function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  themeToggleEl.innerHTML = icon(theme === "dark" ? "sun" : "moon", { size: 18 });
  themeToggleEl.title = theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre";
}

function initTheme() {
  try {
    const stored = localStorage.getItem("tts-test-theme");
    if (stored === "light" || stored === "dark") {
      applyTheme(stored);
      return;
    }
  } catch {
    // localStorage indisponible : on retombe sur la préférence système.
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

themeToggleEl.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem("tts-test-theme", next);
  } catch {
    // ignoré
  }
});

setupStaticIcons();
initTheme();
updateControlsVisibility();
loadVoices().catch((err) => {
  statusEl.textContent = `Impossible de charger les voix : ${(err as Error).message}`;
});
loadHistory().catch((err) => {
  console.error("Erreur lors du chargement initial de l'historique :", err);
});
