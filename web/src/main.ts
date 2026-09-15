import { icon } from "./icons.js";
import { initSttModule } from "./stt.js";

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
  score?: number;
  generationTimeMs?: number;
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

const chatterboxDeviceEl = document.getElementById("chatterboxDevice") as HTMLSelectElement;
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
const previewFormatBadge = document.getElementById("previewFormatBadge") as HTMLSpanElement | null;
const previewDeckIcon = document.getElementById("previewDeckIcon") as HTMLSpanElement | null;
const detailGenTimeEl = document.getElementById("detailGenTime") as HTMLSpanElement;
const previewRatingEl = document.getElementById("previewRating") as HTMLDivElement;
const previewUpvoteBtn = document.getElementById("previewUpvoteBtn") as HTMLButtonElement;
const audioDetailsEl = document.getElementById("audioDetails") as HTMLDivElement;
const detailEngineEl = document.getElementById("detailEngine") as HTMLSpanElement;
const detailVoiceEl = document.getElementById("detailVoice") as HTMLSpanElement;
const detailPathEl = document.getElementById("detailPath") as HTMLElement;
const copyPathBtn = document.getElementById("copyPathBtn") as HTMLButtonElement;

// Éléments du Spectre Audio
const visualizerContainer = document.getElementById("visualizerContainer") as HTMLDivElement | null;
const visualizerCanvas = document.getElementById("audioVisualizer") as HTMLCanvasElement | null;
const visualizerStatus = document.getElementById("visualizerStatus") as HTMLSpanElement | null;
const visualizerIcon = document.getElementById("visualizerIcon") as HTMLSpanElement | null;

// Éléments des Stats & Graphique
const statsTitleIcon = document.getElementById("statsTitleIcon") as HTMLElement;
const statsBadgeCount = document.getElementById("statsBadgeCount") as HTMLElement;
const statsToggleBtn = document.getElementById("statsToggleBtn") as HTMLButtonElement;
const statsToggleIcon = document.getElementById("statsToggleIcon") as HTMLElement;
const statsToggleText = document.getElementById("statsToggleText") as HTMLElement;
const statsBody = document.getElementById("statsBody") as HTMLElement;
const statsSummaryGrid = document.getElementById("statsSummaryGrid") as HTMLElement;
const decisionMatrixChart = document.getElementById("decisionMatrixChart") as unknown as SVGSVGElement;
const chartTooltip = document.getElementById("chartTooltip") as HTMLElement;

let statsCollapsed = false;

// Éléments de l'historique
const historyCountEl = document.getElementById("historyCount") as HTMLSpanElement;
const toggleAllHistoryBtn = document.getElementById("toggleAllHistoryBtn") as HTMLButtonElement;
const clearHistoryBtn = document.getElementById("clearHistoryBtn") as HTMLButtonElement;
const historyFilterButtonsEl = document.getElementById("historyFilterButtons") as HTMLDivElement;
const historyListEl = document.getElementById("historyList") as HTMLDivElement;

// Éléments du Hero et Guide
const heroToggleBtn = document.getElementById("heroToggleBtn") as HTMLButtonElement | null;
const heroGridCompare = document.getElementById("heroGridCompare") as HTMLDivElement | null;
const heroToggleIcon = document.getElementById("heroToggleIcon") as HTMLSpanElement | null;
const heroToggleText = document.getElementById("heroToggleText") as HTMLSpanElement | null;

let heroSpecsCollapsed = false;

function setupHeroSection() {
  const headerBrandIcon = document.getElementById("headerBrandIcon");
  if (headerBrandIcon) {
    headerBrandIcon.innerHTML = icon("audiolines", { size: 19, color: "#ffffff" });
  }

  const heroTargetIcon = document.getElementById("heroTargetIcon");
  if (heroTargetIcon) {
    heroTargetIcon.innerHTML = icon("target", { size: 13 });
  }

  const helpIcon = document.getElementById("helpIcon");
  if (helpIcon) {
    helpIcon.innerHTML = icon("help", { size: 14 });
  }

  const helpChevron = document.getElementById("helpChevron");
  if (helpChevron) {
    helpChevron.innerHTML = icon("chevron-right", { size: 13 });
  }

  if (heroToggleBtn && heroGridCompare) {
    const updateHeroToggleState = () => {
      heroGridCompare.classList.toggle("collapsed", heroSpecsCollapsed);
      if (heroToggleIcon) {
        heroToggleIcon.innerHTML = icon(heroSpecsCollapsed ? "chevron-down" : "chevrons-up-down", { size: 13 });
      }
      if (heroToggleText) {
        heroToggleText.textContent = heroSpecsCollapsed ? "Afficher les specs" : "Masquer les specs";
      }
      heroToggleBtn.title = heroSpecsCollapsed ? "Afficher les spécifications des moteurs" : "Masquer les spécifications des moteurs";
    };

    heroToggleBtn.addEventListener("click", () => {
      heroSpecsCollapsed = !heroSpecsCollapsed;
      updateHeroToggleState();
    });

    updateHeroToggleState();
  }

  if (statsTitleIcon) {
    statsTitleIcon.innerHTML = icon("gauge", { size: 15 });
  }

  if (statsToggleBtn && statsBody) {
    const updateStatsToggleState = () => {
      statsBody.hidden = statsCollapsed;
      if (statsToggleIcon) {
        statsToggleIcon.innerHTML = icon(statsCollapsed ? "chevron-down" : "chevrons-up-down", { size: 13 });
      }
      if (statsToggleText) {
        statsToggleText.textContent = statsCollapsed ? "Afficher le graphique" : "Masquer le graphique";
      }
      statsToggleBtn.title = statsCollapsed ? "Afficher le graphique" : "Masquer le graphique";
    };

    statsToggleBtn.addEventListener("click", () => {
      statsCollapsed = !statsCollapsed;
      updateStatsToggleState();
    });

    updateStatsToggleState();
  }

  const zoneOptimalIcon = document.getElementById("zoneOptimalIcon");
  if (zoneOptimalIcon) {
    zoneOptimalIcon.innerHTML = icon("trophy", { size: 12 });
  }

  const zoneQualityIcon = document.getElementById("zoneQualityIcon");
  if (zoneQualityIcon) {
    zoneQualityIcon.innerHTML = icon("palette", { size: 12 });
  }

  const legendHintIcon = document.getElementById("legendHintIcon");
  if (legendHintIcon) {
    legendHintIcon.innerHTML = icon("headphones", { size: 12 });
  }

  const helpStarBadge = document.getElementById("helpStarBadge");
  if (helpStarBadge) {
    helpStarBadge.innerHTML = `${icon("star", { size: 11, fill: "currentColor" })} Favori`;
  }

  const visualizerIconEl = document.getElementById("visualizerIcon");
  if (visualizerIconEl) {
    visualizerIconEl.innerHTML = icon("activity", { size: 12 });
  }

  const previewDeckIconEl = document.getElementById("previewDeckIcon");
  if (previewDeckIconEl) {
    previewDeckIconEl.innerHTML = icon("volume", { size: 13 });
  }

  const edgeBtnIcon = document.getElementById("edgeBtnIcon");
  if (edgeBtnIcon) edgeBtnIcon.innerHTML = icon("cloud", { size: 14 });

  const piperBtnIcon = document.getElementById("piperBtnIcon");
  if (piperBtnIcon) piperBtnIcon.innerHTML = icon("cpu", { size: 14 });

  const kokoroBtnIcon = document.getElementById("kokoroBtnIcon");
  if (kokoroBtnIcon) kokoroBtnIcon.innerHTML = icon("sparkles", { size: 14 });

  const chatterboxBtnIcon = document.getElementById("chatterboxBtnIcon");
  if (chatterboxBtnIcon) chatterboxBtnIcon.innerHTML = icon("zap", { size: 14 });

  const generateBtnIcon = document.getElementById("generateBtnIcon");
  if (generateBtnIcon) generateBtnIcon.innerHTML = icon("play", { size: 14 });

  const copyPathIcon = document.getElementById("copyPathIcon");
  if (copyPathIcon) copyPathIcon.innerHTML = icon("copy", { size: 12 });

  const toggleAllHistoryIcon = document.getElementById("toggleAllHistoryIcon");
  if (toggleAllHistoryIcon) toggleAllHistoryIcon.innerHTML = icon("chevrons-up-down", { size: 13 });

  const clearHistoryIcon = document.getElementById("clearHistoryIcon");
  if (clearHistoryIcon) clearHistoryIcon.innerHTML = icon("trash", { size: 13 });

  const ttsSettingsIcon = document.getElementById("ttsSettingsIcon");
  if (ttsSettingsIcon) ttsSettingsIcon.innerHTML = icon("sliders", { size: 14 });

  const ttsSettingsChevron = document.getElementById("ttsSettingsChevron");
  if (ttsSettingsChevron) ttsSettingsChevron.innerHTML = icon("chevronRight", { size: 13 });
}

setupHeroSection();

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

async function setAudioScore(id: string, score: number) {
  try {
    const res = await fetch(`/api/history/${id}/score`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
    if (!res.ok) throw new Error(res.statusText);
    const updated: AudioHistoryItem = await res.json();
    const idx = historyItems.findIndex((i) => i.id === id);
    if (idx !== -1) {
      historyItems[idx] = updated;
    }
    if (currentPreviewAudioId === id) {
      updatePreviewRating(updated.score || 0);
    }
    renderHistory();
    renderStatsAndChart();
  } catch (err) {
    console.error("Erreur lors de la mise à jour du score :", err);
  }
}

function updatePreviewRating(score: number = 0) {
  if (!previewRatingEl) return;
  const stars = Array.from(previewRatingEl.querySelectorAll<HTMLButtonElement>(".rating-star"));
  stars.forEach((star) => {
    const starScore = Number(star.dataset.score);
    const isActive = starScore <= score;
    star.classList.toggle("active", isActive);
    star.innerHTML = icon("star", { size: 14, fill: isActive ? "currentColor" : "none" });
  });
}

function updatePreviewUpvoteButton(isFav?: boolean) {
  previewUpvoteBtn.classList.toggle("is-favorite", !!isFav);
  const star = icon("star", { size: 13, fill: isFav ? "currentColor" : "none" });
  previewUpvoteBtn.innerHTML = `${star} <span>Favori</span>`;
}

function getEngineDetails(eng: Engine) {
  switch (eng) {
    case "piper":
      return {
        label: "Piper",
        iconName: "cpu",
        badgeClass: "engine-piper",
        cardClass: "card-piper",
        tooltip: "Moteur local (CPU)",
      };
    case "kokoro":
      return {
        label: "Kokoro",
        iconName: "cpu",
        badgeClass: "engine-kokoro",
        cardClass: "card-kokoro",
        tooltip: "Moteur local (ONNX)",
      };
    case "chatterbox":
      return {
        label: "Chatterbox",
        iconName: "cpu",
        badgeClass: "engine-chatterbox",
        cardClass: "card-chatterbox",
        tooltip: "Moteur local (GPU / PyTorch)",
      };
    case "edge":
    default:
      return {
        label: "Edge TTS",
        iconName: "cloud",
        badgeClass: "engine-edge",
        cardClass: "card-edge",
        tooltip: "API Cloud (Microsoft)",
      };
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
    score?: number;
    generationTimeMs?: number;
  },
  autoPlay = false
) {
  currentPreviewAudioId = item.id;
  const engDetails = getEngineDetails(item.engine);

  detailEngineEl.innerHTML = `${icon(engDetails.iconName, { size: 12 })} <span>${engDetails.label}</span>`;
  detailEngineEl.className = `card-badge ${engDetails.badgeClass}`;
  detailEngineEl.title = `${engDetails.label} — ${engDetails.tooltip}`;
  detailVoiceEl.textContent = item.voiceName || item.voiceId || "Voix";
  detailPathEl.textContent = item.filePath || "";
  detailPathEl.title = item.filePath ? `Cliquer pour copier : ${item.filePath}` : "";

  if (item.generationTimeMs && item.generationTimeMs > 0) {
    const genSec = (item.generationTimeMs / 1000).toFixed(2);
    detailGenTimeEl.innerHTML = `${icon("timer", { size: 11 })} <span>${genSec}s</span>`;
    detailGenTimeEl.title = `Temps de calcul : ${genSec}s (${item.generationTimeMs}ms)`;
    detailGenTimeEl.hidden = false;
  } else {
    detailGenTimeEl.hidden = true;
  }

  if (previewFormatBadge) {
    let fmt = "24kHz";
    if (item.engine === "edge") fmt = "MP3 • 24kHz";
    else if (item.engine === "piper") fmt = "WAV • 22.05kHz";
    else if (item.engine === "kokoro") fmt = "WAV • 24kHz Studio";
    else if (item.engine === "chatterbox") fmt = "WAV • 24kHz Clonage";
    previewFormatBadge.textContent = fmt;
    previewFormatBadge.hidden = false;
  }

  previewInfoEl.hidden = false;
  audioDetailsEl.hidden = false;

  updatePreviewRating(item.score || 0);
  if (previewRatingEl) previewRatingEl.hidden = false;

  updatePreviewUpvoteButton(item.isFavorite);
  previewUpvoteBtn.hidden = false;

  playerEl.src = item.url;
  if (autoPlay) {
    playerEl.play().catch(() => {});
  }
  updateHistoryPlayButtons();
}

function updateHistoryPlayButtons() {
  const isPlaying = !playerEl.paused && !playerEl.ended;
  const playButtons = Array.from(historyListEl.querySelectorAll<HTMLButtonElement>(".card-play-btn"));
  for (const btn of playButtons) {
    const isThisItem = btn.dataset.itemId === currentPreviewAudioId;
    if (isThisItem && isPlaying) {
      btn.innerHTML = icon("pause", { size: 12 });
      btn.classList.add("is-playing");
      btn.title = "Mettre en pause";
    } else {
      btn.innerHTML = icon("play", { size: 12 });
      btn.classList.remove("is-playing");
      btn.title = "Écouter cet enregistrement";
    }
  }
}

// ==========================================================================
// Moteur du Spectre Audio (Web Audio API + HTML5 Canvas)
// ==========================================================================
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let audioSourceNode: MediaElementAudioSourceNode | null = null;
let visualizerAnimId: number | null = null;
const numBars = 36;
const peaks: number[] = new Array(numBars).fill(0);

function initVisualizerAudioContext() {
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      analyser.minDecibels = -85;
      analyser.maxDecibels = -15;

      audioSourceNode = audioCtx.createMediaElementSource(playerEl);
      audioSourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (err) {
      console.warn("Initialisation du contexte audio pour le visualiseur :", err);
    }
  }

  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

function getActiveEngineColors(): { primary: string; secondary: string } {
  const currentItem = currentPreviewAudioId ? historyItems.find((i) => i.id === currentPreviewAudioId) : null;
  const activeEng = currentItem?.engine || engine;
  const isRetro = document.documentElement.dataset.theme === "retro";

  if (isRetro) {
    switch (activeEng) {
      case "piper":
        return { primary: "#00f0ff", secondary: "#80f7ff" };
      case "kokoro":
        return { primary: "#00ff66", secondary: "#80ffaa" };
      case "chatterbox":
        return { primary: "#ff007f", secondary: "#ff80bf" };
      case "edge":
      default:
        return { primary: "#c084fc", secondary: "#e9d5ff" };
    }
  }

  switch (activeEng) {
    case "piper":
      return { primary: "#0284c7", secondary: "#38bdf8" };
    case "kokoro":
      return { primary: "#059669", secondary: "#34d399" };
    case "chatterbox":
      return { primary: "#e11d48", secondary: "#fb7185" };
    case "edge":
    default:
      return { primary: "#7c3aed", secondary: "#a78bfa" };
  }
}

function drawVisualizer() {
  if (!visualizerCanvas) return;
  const ctx = visualizerCanvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = visualizerCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width === 0 || height === 0) return;

  if (visualizerCanvas.width !== Math.floor(width * dpr) || visualizerCanvas.height !== Math.floor(height * dpr)) {
    visualizerCanvas.width = Math.floor(width * dpr);
    visualizerCanvas.height = Math.floor(height * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const isPlaying = !playerEl.paused && !playerEl.ended;
  const colors = getActiveEngineColors();

  const binCount = analyser ? analyser.frequencyBinCount : 128;
  const dataArray = new Uint8Array(binCount);
  if (analyser && isPlaying) {
    analyser.getByteFrequencyData(dataArray as unknown as Uint8Array<ArrayBuffer>);
  }

  const gap = 3;
  const barWidth = Math.max(2, (width - gap * (numBars - 1)) / numBars);

  for (let i = 0; i < numBars; i++) {
    // Échantillonnage logarithmique de 20 Hz à 20 kHz
    const binIndex = Math.min(dataArray.length - 1, Math.floor(Math.pow(i / (numBars - 1), 1.45) * (dataArray.length - 1)));
    const val = isPlaying ? (dataArray[binIndex] || 0) : 0;
    const normalized = val / 255;
    
    const minHeight = 3;
    const barHeight = Math.max(minHeight, Math.round(normalized * (height - 8)));

    // Gestion de l'inertie des pics (peak decay)
    if (barHeight > peaks[i]) {
      peaks[i] = barHeight;
    } else {
      peaks[i] = Math.max(minHeight, peaks[i] - 0.5);
    }

    const x = i * (barWidth + gap);
    const y = height - barHeight;

    // Dégradé vertical adapté au moteur TTS actif
    const grad = ctx.createLinearGradient(0, y, 0, height);
    grad.addColorStop(0, colors.secondary);
    grad.addColorStop(1, colors.primary);

    ctx.fillStyle = grad;
    ctx.beginPath();
    const radius = Math.min(barWidth / 2, 2.5);
    if ("roundRect" in ctx && typeof (ctx as any).roundRect === "function") {
      (ctx as any).roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
    } else {
      ctx.fillRect(x, y, barWidth, barHeight);
    }
    ctx.fill();

    // Ligne de crête (Peak Indicator)
    const peakY = height - peaks[i] - 2;
    if (peakY < height - 5) {
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(x, Math.max(0, peakY), barWidth, 1.5);
    }
  }

  ctx.restore();

  if (isPlaying || peaks.some((p) => p > 3.5)) {
    visualizerAnimId = requestAnimationFrame(drawVisualizer);
  } else {
    visualizerAnimId = null;
  }
}

function startVisualizer() {
  initVisualizerAudioContext();
  if (visualizerStatus) {
    visualizerStatus.textContent = "Lecture en cours";
    visualizerStatus.classList.add("playing");
  }
  if (visualizerContainer) {
    visualizerContainer.classList.add("is-active");
  }
  if (visualizerAnimId) {
    cancelAnimationFrame(visualizerAnimId);
  }
  visualizerAnimId = requestAnimationFrame(drawVisualizer);
}

function stopVisualizer() {
  if (visualizerStatus) {
    visualizerStatus.textContent = playerEl.ended ? "Terminé" : "En pause";
    visualizerStatus.classList.remove("playing");
  }
  if (visualizerContainer) {
    visualizerContainer.classList.remove("is-active");
  }
}

playerEl.addEventListener("play", () => {
  updateHistoryPlayButtons();
  startVisualizer();
});

playerEl.addEventListener("pause", () => {
  updateHistoryPlayButtons();
  stopVisualizer();
});

playerEl.addEventListener("ended", () => {
  updateHistoryPlayButtons();
  stopVisualizer();
});

// Déverrouillage automatique de l'AudioContext dès la première interaction utilisateur
const unlockAudioContext = () => {
  initVisualizerAudioContext();
};
window.addEventListener("click", unlockAudioContext, { once: true });
window.addEventListener("keydown", unlockAudioContext, { once: true });
window.addEventListener("touchstart", unlockAudioContext, { once: true });

// Premier tracé au repos
window.addEventListener("resize", () => {
  drawVisualizer();
});
setTimeout(() => {
  drawVisualizer();
}, 100);

previewUpvoteBtn.addEventListener("click", () => {
  if (currentPreviewAudioId) {
    toggleItemUpvote(currentPreviewAudioId);
  }
});

if (previewRatingEl) {
  previewRatingEl.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>(".rating-star");
    if (!target || !currentPreviewAudioId) return;
    const currentItem = historyItems.find((i) => i.id === currentPreviewAudioId);
    const clickedScore = Number(target.dataset.score);
    const newScore = currentItem?.score === clickedScore ? 0 : clickedScore;
    setAudioScore(currentPreviewAudioId, newScore);
  });

  previewRatingEl.addEventListener("mouseover", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>(".rating-star");
    if (!target) return;
    const hoverScore = Number(target.dataset.score || 0);
    previewRatingEl.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((star) => {
      const starScore = Number(star.dataset.score || 0);
      star.classList.toggle("hovered", starScore <= hoverScore);
    });
  });

  previewRatingEl.addEventListener("mouseleave", () => {
    previewRatingEl.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((star) => {
      star.classList.remove("hovered");
    });
  });
}

function renderStatsAndChart() {
  if (!statsBody || !decisionMatrixChart) return;

  statsBadgeCount.textContent = `${historyItems.length} test${historyItems.length > 1 ? "s" : ""}`;

  // Calcul des statistiques par moteur
  const engines: Engine[] = ["edge", "piper", "kokoro", "chatterbox"];
  const summaryHtml = engines
    .map((eng) => {
      const items = historyItems.filter((i) => i.engine === eng);
      const count = items.length;
      const itemsWithTime = items.filter((i) => i.generationTimeMs && i.generationTimeMs > 0);
      const avgTime =
        itemsWithTime.length > 0
          ? (itemsWithTime.reduce((acc, i) => acc + (i.generationTimeMs || 0), 0) / itemsWithTime.length / 1000).toFixed(2)
          : "--";
      const itemsWithScore = items.filter((i) => typeof i.score === "number" && i.score > 0);
      const avgScore =
        itemsWithScore.length > 0
          ? (itemsWithScore.reduce((acc, i) => acc + (i.score || 0), 0) / itemsWithScore.length).toFixed(1)
          : "--";
      const engDetails = getEngineDetails(eng);

      return `
        <div class="stat-summary-card ${engDetails.cardClass}">
          <div class="stat-card-title">
            <span>${engDetails.label}</span>
            <span class="badge badge-subtle">${count}</span>
          </div>
          <div class="stat-card-values">
            <span>${icon("timer", { size: 11 })} Tps : <strong>${avgTime}${avgTime !== "--" ? "s" : ""}</strong></span>
            <span>${icon("star", { size: 11, fill: "currentColor" })} Note : <strong>${avgScore}${avgScore !== "--" ? "/3" : ""}</strong></span>
          </div>
        </div>
      `;
    })
    .join("");

  statsSummaryGrid.innerHTML = summaryHtml;

  // Rendu du Graphique SVG
  const width = 540;
  const height = 220;
  const paddingLeft = 46;
  const paddingRight = 24;
  const paddingTop = 26;
  const paddingBottom = 40;

  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  const times = historyItems.map((i) => (i.generationTimeMs ? i.generationTimeMs / 1000 : 0.5));
  const maxTime = Math.max(2.5, Math.ceil(Math.max(0, ...times) * 1.15));

  const getX = (tSec: number) => paddingLeft + Math.min(plotW, (tSec / maxTime) * plotW);
  const getY = (score: number = 0) => {
    const normalized = score / 3;
    return paddingTop + (1 - normalized) * plotH;
  };

  const engineColors: Record<Engine, string> = {
    edge: "#7c3aed",
    piper: "#0284c7",
    kokoro: "#059669",
    chatterbox: "#e11d48",
  };

  const optimalThresholdSec = Math.min(1.2, maxTime * 0.4);
  const optimalW = Math.max(70, getX(optimalThresholdSec) - paddingLeft);
  const qualityW = Math.max(60, (width - paddingRight) - (paddingLeft + optimalW));
  
  const zoneTopY = Math.max(8, paddingTop - 8);
  const optimalH = (getY(2) - zoneTopY) + 12; // Englobe proprement les scores 2/3 et 3/3
  const qualityH = (getY(3) - zoneTopY) + 20; // Englobe la ligne supérieure score 3/3

  const zoneOptimalTag = document.getElementById("zoneOptimalTag");
  if (zoneOptimalTag) {
    zoneOptimalTag.innerHTML = `<span class="zone-icon" id="zoneOptimalIcon">${icon("trophy", { size: 12 })}</span> Idéal Prod (≤ ${optimalThresholdSec.toFixed(1)}s • Note ≥ 2/3)`;
  }
  const zoneQualityTag = document.getElementById("zoneQualityTag");
  if (zoneQualityTag) {
    zoneQualityTag.innerHTML = `<span class="zone-icon" id="zoneQualityIcon">${icon("palette", { size: 12 })}</span> Qualité Studio (Note 3/3)`;
  }

  let svgContent = `
    <defs>
      <linearGradient id="optimalGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.04" />
      </linearGradient>
      <linearGradient id="qualityGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#e11d48" stop-opacity="0.16" />
        <stop offset="100%" stop-color="#e11d48" stop-opacity="0.03" />
      </linearGradient>
    </defs>

    <!-- Zone 1 : Idéal Prod (Temps rapide <= ${optimalThresholdSec.toFixed(1)}s & Note >= 2/3) -->
    <rect x="${paddingLeft}" y="${zoneTopY}" width="${optimalW}" height="${optimalH}" fill="url(#optimalGrad)" stroke="rgba(16, 185, 129, 0.45)" stroke-width="1" stroke-dasharray="3,3" rx="5" />

    <!-- Zone 2 : Qualité Studio / Poids lourd (Note 3/3 • Temps plus long) -->
    <rect x="${paddingLeft + optimalW}" y="${zoneTopY}" width="${qualityW}" height="${qualityH}" fill="url(#qualityGrad)" stroke="rgba(225, 29, 72, 0.35)" stroke-width="1" stroke-dasharray="3,3" rx="5" />

    <line x1="${paddingLeft}" y1="${getY(3)}" x2="${width - paddingRight}" y2="${getY(3)}" stroke="var(--border)" stroke-dasharray="3,3" opacity="0.7" />
    <line x1="${paddingLeft}" y1="${getY(2)}" x2="${width - paddingRight}" y2="${getY(2)}" stroke="var(--border)" stroke-dasharray="3,3" opacity="0.7" />
    <line x1="${paddingLeft}" y1="${getY(1)}" x2="${width - paddingRight}" y2="${getY(1)}" stroke="var(--border)" stroke-dasharray="3,3" opacity="0.7" />
    <line x1="${paddingLeft}" y1="${getY(0)}" x2="${width - paddingRight}" y2="${getY(0)}" stroke="var(--border)" stroke-width="1.2" opacity="0.9" />

    <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="var(--border)" stroke-width="1.2" />

    <text x="${paddingLeft - 8}" y="${getY(3) + 3}" fill="var(--text-muted)" font-size="9" text-anchor="end" font-weight="600">3/3</text>
    <text x="${paddingLeft - 8}" y="${getY(2) + 3}" fill="var(--text-muted)" font-size="9" text-anchor="end" font-weight="600">2/3</text>
    <text x="${paddingLeft - 8}" y="${getY(1) + 3}" fill="var(--text-muted)" font-size="9" text-anchor="end" font-weight="600">1/3</text>
    <text x="${paddingLeft - 8}" y="${getY(0) + 3}" fill="var(--text-muted)" font-size="9" text-anchor="end" opacity="0.6">0/3</text>

    <text x="${paddingLeft}" y="${height - paddingBottom + 14}" fill="var(--text-muted)" font-size="9" text-anchor="start">0s</text>
    <text x="${paddingLeft + plotW / 2}" y="${height - paddingBottom + 14}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${(maxTime / 2).toFixed(1)}s</text>
    <text x="${width - paddingRight}" y="${height - paddingBottom + 14}" fill="var(--text-muted)" font-size="9" text-anchor="end">${maxTime.toFixed(1)}s</text>
    <text x="${width / 2}" y="${height - 6}" fill="var(--text-muted)" font-size="9" text-anchor="middle" font-weight="500">← Vitesse (Temps de génération en secondes) →</text>
  `;

  historyItems.forEach((item, index) => {
    const tSec = item.generationTimeMs ? item.generationTimeMs / 1000 : 0.4;
    const score = item.score ?? 0;
    const cx = getX(tSec);
    const cy = getY(score);
    const color = engineColors[item.engine] || "var(--accent)";
    const engDetails = getEngineDetails(item.engine);

    const jitterX = Math.sin(index * 7) * 4;
    const jitterY = Math.cos(index * 5) * 3;

    const safeVoice = (item.voiceName || item.voiceId).replace(/"/g, "&quot;");
    const safeText = (item.text || "").substring(0, 45).replace(/"/g, "&quot;");

    svgContent += `
      <circle
        class="chart-node"
        cx="${cx + jitterX}"
        cy="${cy + jitterY}"
        r="5.5"
        fill="${color}"
        stroke="var(--surface)"
        stroke-width="1.5"
        data-item-id="${item.id}"
        data-engine="${engDetails.label}"
        data-voice="${safeVoice}"
        data-time="${tSec.toFixed(2)}s"
        data-score="${score > 0 ? score + '/3' : 'Non noté'}"
        data-text="${safeText}..."
      />
    `;
  });

  decisionMatrixChart.innerHTML = svgContent;

  const nodes = Array.from(decisionMatrixChart.querySelectorAll<SVGCircleElement>(".chart-node"));
  nodes.forEach((node) => {
    node.addEventListener("mouseenter", () => {
      const rect = decisionMatrixChart.getBoundingClientRect();
      const nodeX = (node.cx.baseVal.value / width) * rect.width;
      const nodeY = (node.cy.baseVal.value / height) * rect.height;

      chartTooltip.innerHTML = `
        <div style="font-weight:600;margin-bottom:2px">${node.dataset.engine} • ${node.dataset.voice}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <span style="display:inline-flex;align-items:center;gap:3px">${icon("timer", { size: 11 })} ${node.dataset.time}</span>
          <span style="display:inline-flex;align-items:center;gap:3px">${icon("star", { size: 11, fill: "currentColor" })} ${node.dataset.score}</span>
        </div>
        <div style="font-style:italic;opacity:0.75;font-size:0.68rem">${node.dataset.text}</div>
        <div style="display:inline-flex;align-items:center;gap:3px;margin-top:3px;font-size:0.65rem;color:var(--accent)">${icon("play", { size: 10, fill: "currentColor" })} Cliquer pour écouter</div>
      `;
      chartTooltip.style.left = `${nodeX}px`;
      chartTooltip.style.top = `${nodeY}px`;
      chartTooltip.hidden = false;
    });

    node.addEventListener("mouseleave", () => {
      chartTooltip.hidden = true;
    });

    node.addEventListener("click", () => {
      const id = node.dataset.itemId;
      const item = historyItems.find((i) => i.id === id);
      if (item) {
        loadAudioIntoPreview(item, true);
      }
    });
  });
}

// Historique : chargement et rendu
async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    if (!res.ok) throw new Error(res.statusText);
    historyItems = await res.json();
    renderHistory();
    renderStatsAndChart();
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
    const genTimeBadge = (item.generationTimeMs && item.generationTimeMs > 0)
      ? `<span class="card-badge history-card-gentime" title="Temps de calcul : ${(item.generationTimeMs / 1000).toFixed(2)}s">${icon("timer", { size: 11 })} <span>${(item.generationTimeMs / 1000).toFixed(2)}s</span></span>`
      : "";
    const scoreBadge = (item.score && item.score > 0)
      ? `<span class="history-card-rating" title="Note attribuée : ${item.score}/3">${icon("star", { size: 11, fill: "currentColor" })} <span>${item.score}/3</span></span>`
      : "";

    details.innerHTML = `
      <summary class="history-summary">
        <span class="dropdown-chevron">${icon("chevron-right", { size: 13 })}</span>
        <div class="history-summary-badges">
          <span class="card-badge ${engDetails.badgeClass}" title="${engDetails.label} — ${engDetails.tooltip}">
            ${engineIcon} <span>${engDetails.label}</span>
          </span>
          <span class="card-badge">${item.voiceName || item.voiceId}</span>
          ${genTimeBadge}
          ${scoreBadge}
          <span class="history-card-time">${dateStr}</span>
        </div>
        <span class="history-summary-text" title="${item.text}">${item.text}</span>
        <div class="history-card-actions">
          <div class="history-card-stars-action" title="Attribuer une note (1 à 3)">
            <button type="button" class="rating-star ${item.score && item.score >= 1 ? 'active' : ''}" data-item-id="${item.id}" data-score="1" title="Note 1/3">${icon("star", { size: 12, fill: item.score && item.score >= 1 ? "currentColor" : "none" })}</button>
            <button type="button" class="rating-star ${item.score && item.score >= 2 ? 'active' : ''}" data-item-id="${item.id}" data-score="2" title="Note 2/3">${icon("star", { size: 12, fill: item.score && item.score >= 2 ? "currentColor" : "none" })}</button>
            <button type="button" class="rating-star ${item.score && item.score >= 3 ? 'active' : ''}" data-item-id="${item.id}" data-score="3" title="Note 3/3">${icon("star", { size: 12, fill: item.score && item.score >= 3 ? "currentColor" : "none" })}</button>
          </div>
          <button type="button" class="card-play-btn" data-item-id="${item.id}" title="Écouter cet enregistrement" aria-label="Écouter">
            ${icon("play", { size: 12 })}
          </button>
          <button type="button" class="upvote-btn item-upvote-btn ${favClass}" title="Marquer comme favori" aria-label="Favori">
            ${starIcon}
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

    // Gestion du clic sur les étoiles dans la carte
    const cardStars = details.querySelectorAll<HTMLButtonElement>(".history-card-stars-action .rating-star");
    cardStars.forEach((star) => {
      star.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clickedScore = Number(star.dataset.score);
        const newScore = item.score === clickedScore ? 0 : clickedScore;
        setAudioScore(item.id, newScore);
      });
    });

    const cardStarsAction = details.querySelector<HTMLDivElement>(".history-card-stars-action");
    if (cardStarsAction) {
      cardStarsAction.addEventListener("mouseover", (e) => {
        const star = (e.target as HTMLElement).closest<HTMLButtonElement>(".rating-star");
        if (!star) return;
        const hoverScore = Number(star.dataset.score || 0);
        cardStarsAction.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((s) => {
          const sScore = Number(s.dataset.score || 0);
          s.classList.toggle("hovered", sScore <= hoverScore);
        });
      });
      cardStarsAction.addEventListener("mouseleave", () => {
        cardStarsAction.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((s) => {
          s.classList.remove("hovered");
        });
      });
    }

    // Événements de la carte
    const playBtn = details.querySelector<HTMLButtonElement>(".card-play-btn");
    playBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentPreviewAudioId === item.id) {
        if (playerEl.paused) {
          playerEl.play().catch(() => {});
        } else {
          playerEl.pause();
        }
      } else {
        loadAudioIntoPreview(item, true);
      }
    });

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
  updateHistoryPlayButtons();
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
  generateBtn.innerHTML = `${icon("rotateCcw", { size: 14, className: "spin-animation" })} <span>Génération...</span>`;
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
      body.device = chatterboxDeviceEl ? chatterboxDeviceEl.value : "cpu";
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
    const genTimeHeader = res.headers.get("X-Audio-Generation-Time-Ms");
    const generationTimeMs = genTimeHeader ? parseFloat(genTimeHeader) : undefined;

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
        generationTimeMs,
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
    generateBtn.innerHTML = `${icon("sparkles", { size: 15 })} <span>Générer la voix</span>`;
  }
}

generateBtn.addEventListener("click", generate);

function setupStaticIcons() {
  const edgeBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-edge");
  if (edgeBtn) {
    edgeBtn.innerHTML = `${icon("cloud", { size: 14 })} <span>Edge TTS</span>`;
    edgeBtn.title = "Edge TTS — API Cloud (Microsoft Neural)";
  }
  const piperBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-piper");
  if (piperBtn) {
    piperBtn.innerHTML = `${icon("cpu", { size: 14 })} <span>Piper</span>`;
    piperBtn.title = "Piper — Moteur local (CPU Natif)";
  }
  const kokoroBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-kokoro");
  if (kokoroBtn) {
    kokoroBtn.innerHTML = `${icon("sparkles", { size: 14 })} <span>Kokoro</span>`;
    kokoroBtn.title = "Kokoro — Moteur local (ONNX Runtime)";
  }
  const chatterboxBtn = engineSwitchEl.querySelector<HTMLButtonElement>(".engine-chatterbox");
  if (chatterboxBtn) {
    chatterboxBtn.innerHTML = `${icon("zap", { size: 14 })} <span>Chatterbox</span>`;
    chatterboxBtn.title = "Chatterbox — Moteur local (GPU / Clonage Vocal)";
  }

  generateBtn.innerHTML = `${icon("sparkles", { size: 15 })} <span>Générer la voix</span>`;

  copyPathBtn.innerHTML = `${icon("copy", { size: 12 })} <span>Copier</span>`;

  const historyTitle = document.querySelector(".history-title-row .section-title");
  if (historyTitle) {
    historyTitle.innerHTML = `${icon("history", { size: 16 })} <span>Historique</span>`;
  }
  toggleAllHistoryBtn.innerHTML = `${icon("chevrons-up-down", { size: 13 })} <span>Tout déplier</span>`;
  clearHistoryBtn.innerHTML = `${icon("trash", { size: 13 })} <span>Vider</span>`;

  const filterAll = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="all"]');
  if (filterAll) {
    filterAll.innerHTML = `${icon("filter", { size: 13 })} <span>Tous</span>`;
    filterAll.title = "Afficher tous les enregistrements";
  }

  const filterEdge = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="edge"]');
  if (filterEdge) {
    filterEdge.innerHTML = `${icon("cloud", { size: 13 })} <span>Edge TTS</span>`;
    filterEdge.title = "Filtrer : Edge TTS (API Cloud)";
  }

  const filterPiper = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="piper"]');
  if (filterPiper) {
    filterPiper.innerHTML = `${icon("cpu", { size: 13 })} <span>Piper</span>`;
    filterPiper.title = "Filtrer : Piper (Local CPU)";
  }

  const filterKokoro = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="kokoro"]');
  if (filterKokoro) {
    filterKokoro.innerHTML = `${icon("sparkles", { size: 13 })} <span>Kokoro</span>`;
    filterKokoro.title = "Filtrer : Kokoro (Local ONNX)";
  }

  const filterChatterbox = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="chatterbox"]');
  if (filterChatterbox) {
    filterChatterbox.innerHTML = `${icon("zap", { size: 13 })} <span>Chatterbox</span>`;
    filterChatterbox.title = "Filtrer : Chatterbox (Local GPU)";
  }

  const filterFav = historyFilterButtonsEl.querySelector<HTMLButtonElement>('[data-filter="favorites"]');
  if (filterFav) {
    filterFav.innerHTML = `${icon("star", { size: 13, fill: "currentColor" })} <span>Favoris</span>`;
    filterFav.title = "Afficher uniquement les favoris";
  }
}

type ThemeMode = "light" | "dark" | "retro";

// Thème : Clair / Sombre / Rétro Y2K Cyber, bascule mémorisée en localStorage.
function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  let iconName = "moon";
  let title = "Passer en mode sombre";

  if (theme === "light") {
    iconName = "moon";
    title = "Passer en mode sombre";
  } else if (theme === "dark") {
    iconName = "terminal";
    title = "Passer en mode Rétro Y2K Cyber";
  } else if (theme === "retro") {
    iconName = "sun";
    title = "Passer en mode clair";
  }

  themeToggleEl.innerHTML = icon(iconName, { size: 18 });
  themeToggleEl.title = title;

  // Actualiser le spectre audio avec la palette active
  drawVisualizer();
}

function initTheme() {
  try {
    const stored = localStorage.getItem("tts-test-theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "retro") {
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
  const current = (document.documentElement.dataset.theme as ThemeMode) || "light";
  let next: ThemeMode = "dark";
  if (current === "light") next = "dark";
  else if (current === "dark") next = "retro";
  else next = "light";

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
updatePreviewRating(0);
updatePreviewUpvoteButton(false);
loadVoices().catch((err) => {
  statusEl.textContent = `Impossible de charger les voix : ${(err as Error).message}`;
});
loadHistory().catch((err) => {
  console.error("Erreur lors du chargement initial de l'historique :", err);
});
initSttModule();
