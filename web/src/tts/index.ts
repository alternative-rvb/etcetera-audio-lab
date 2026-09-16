import { icon } from "../shared/icons.js";

export interface VoiceInfo {
  id: string;
  name: string;
  language?: string;
  gender?: "female" | "male" | "unknown";
  quality?: string;
}

export interface AudioHistoryItem {
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

export function initTtsModule() {
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
  }

  setupHeroSection();

  // État local
  let currentEngine: Engine = "edge";
  let voices: VoiceInfo[] = [];
  let selectedVoiceId: string | null = null;
  let historyItems: AudioHistoryItem[] = [];
  let currentAudioItem: AudioHistoryItem | null = null;
  let currentFilter: HistoryFilter = "all";

  // Web Audio API & Visualizer State
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let audioSourceNode: MediaElementAudioSourceNode | null = null;
  let visualizerAnimationId: number | null = null;

  function initAudioVisualizer() {
    if (!visualizerCanvas || !playerEl) return;

    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
    }

    if (!analyser) {
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
    }

    if (!audioSourceNode) {
      try {
        audioSourceNode = audioCtx.createMediaElementSource(playerEl);
        audioSourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch (err) {
        console.warn("MediaElementSource déjà initialisé ou non supporté :", err);
      }
    }

    if (visualizerIcon) {
      visualizerIcon.innerHTML = icon("audiolines", { size: 14 });
    }
  }

  function getEngineVisualizerColor(engine: Engine): string {
    switch (engine) {
      case "edge": return "var(--engine-edge)";
      case "piper": return "var(--engine-piper)";
      case "kokoro": return "var(--engine-kokoro)";
      case "chatterbox": return "var(--engine-chatterbox)";
      default: return "var(--accent)";
    }
  }

  function drawVisualizer() {
    if (!visualizerCanvas) return;
    const ctx = visualizerCanvas.getContext("2d");
    if (!ctx) return;

    const width = visualizerCanvas.width;
    const height = visualizerCanvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!analyser || playerEl.paused || playerEl.ended) {
      ctx.fillStyle = "rgba(128, 128, 128, 0.25)";
      const barCount = 32;
      const barWidth = Math.floor(width / barCount) - 2;
      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + 2);
        const barH = 3 + Math.sin(i * 0.4) * 2;
        const y = height - barH;
        ctx.fillRect(x, y, barWidth, barH);
      }
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const barCount = 32;
    const barWidth = Math.floor(width / barCount) - 2;
    const step = Math.floor(bufferLength / barCount) || 1;

    const color = getEngineVisualizerColor(currentEngine);
    ctx.fillStyle = color;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.min(i * step, bufferLength - 1);
      const value = dataArray[dataIndex] || 0;
      const percent = value / 255;
      const barHeight = Math.max(3, percent * (height - 4));
      const x = i * (barWidth + 2);
      const y = height - barHeight;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  function startVisualizerLoop() {
    if (visualizerAnimationId !== null) {
      cancelAnimationFrame(visualizerAnimationId);
    }
    const loop = () => {
      drawVisualizer();
      if (playerEl && !playerEl.paused && !playerEl.ended) {
        visualizerAnimationId = requestAnimationFrame(loop);
      }
    };
    loop();
  }

  playerEl.addEventListener("play", () => {
    initAudioVisualizer();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (visualizerStatus) {
      visualizerStatus.textContent = "Signal en direct...";
      visualizerStatus.style.color = getEngineVisualizerColor(currentEngine);
    }
    startVisualizerLoop();
  });

  playerEl.addEventListener("pause", () => {
    if (visualizerStatus) {
      visualizerStatus.textContent = "En pause";
      visualizerStatus.style.color = "inherit";
    }
    drawVisualizer();
  });

  playerEl.addEventListener("ended", () => {
    if (visualizerStatus) {
      visualizerStatus.textContent = "Spectre inactif";
      visualizerStatus.style.color = "inherit";
    }
    drawVisualizer();
  });

  const observer = new ResizeObserver(() => {
    if (visualizerCanvas && visualizerContainer) {
      visualizerCanvas.width = visualizerContainer.clientWidth || 300;
      visualizerCanvas.height = 42;
      drawVisualizer();
    }
  });
  if (visualizerContainer) {
    observer.observe(visualizerContainer);
  }

  function getEngineBadge(engine: Engine): string {
    switch (engine) {
      case "edge": return `<span class="badge badge-edge">${icon("cloud", { size: 11 })} Edge</span>`;
      case "piper": return `<span class="badge badge-piper">${icon("cpu", { size: 11 })} Piper</span>`;
      case "kokoro": return `<span class="badge badge-kokoro">${icon("sparkles", { size: 11 })} Kokoro</span>`;
      case "chatterbox": return `<span class="badge badge-chatterbox">${icon("zap", { size: 11 })} Chatterbox</span>`;
      default: return `<span class="badge">${engine}</span>`;
    }
  }

  function getEngineBadgeText(engine: Engine): string {
    switch (engine) {
      case "edge": return "Edge TTS (API Cloud)";
      case "piper": return "Piper (Local CPU)";
      case "kokoro": return "Kokoro (Local ONNX)";
      case "chatterbox": return "Chatterbox (Local GPU)";
      default: return engine;
    }
  }

  function updateControlsVisibility() {
    piperControlsEl.style.display = currentEngine === "piper" ? "block" : "none";
    edgeControlsEl.style.display = currentEngine === "edge" ? "block" : "none";
    kokoroControlsEl.style.display = currentEngine === "kokoro" ? "block" : "none";
    chatterboxControlsEl.style.display = currentEngine === "chatterbox" ? "block" : "none";

    voiceSelectionTitleEl.textContent =
      currentEngine === "piper" ? "Voix Piper disponibles" :
      currentEngine === "edge" ? "Voix Edge Neural disponibles" :
      currentEngine === "kokoro" ? "Voix Kokoro ONNX disponibles" :
      "Échantillons audio de référence";
  }

  function renderVoiceButtons() {
    voiceButtonsEl.innerHTML = "";
    voiceCountBadgeEl.textContent = `${voices.length}`;

    if (voices.length === 0) {
      const p = document.createElement("p");
      p.className = "help";
      p.textContent = currentEngine === "piper"
        ? "Aucune voix Piper trouvée dans server/voices/. Exécutez ./scripts/setup-piper.sh."
        : currentEngine === "chatterbox"
        ? "Aucun échantillon audio trouvé dans server/python/references/."
        : "Aucune voix disponible pour ce moteur.";
      voiceButtonsEl.appendChild(p);
      selectedVoiceId = null;
      return;
    }

    if (!selectedVoiceId || !voices.some((v) => v.id === selectedVoiceId)) {
      selectedVoiceId = voices[0].id;
    }

    voices.forEach((v) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `voice-btn ${v.id === selectedVoiceId ? "active" : ""}`;
      btn.dataset.voiceId = v.id;

      const topRow = document.createElement("div");
      topRow.className = "voice-btn-top";

      const nameSpan = document.createElement("span");
      nameSpan.className = "voice-name";
      nameSpan.textContent = v.name;

      const iconSpan = document.createElement("span");
      iconSpan.className = "voice-check-icon";
      if (v.id === selectedVoiceId) {
        iconSpan.innerHTML = icon("check", { size: 14 });
      }

      topRow.appendChild(nameSpan);
      topRow.appendChild(iconSpan);

      const metaRow = document.createElement("div");
      metaRow.className = "voice-meta";

      if (v.gender) {
        const genderBadge = document.createElement("span");
        genderBadge.className = "voice-tag";
        genderBadge.textContent = v.gender === "female" ? "Femme" : v.gender === "male" ? "Homme" : "Neutre";
        metaRow.appendChild(genderBadge);
      }

      if (v.language) {
        const langBadge = document.createElement("span");
        langBadge.className = "voice-tag";
        langBadge.textContent = v.language;
        metaRow.appendChild(langBadge);
      }

      if (v.quality) {
        const qBadge = document.createElement("span");
        qBadge.className = "voice-tag quality";
        qBadge.textContent = v.quality;
        metaRow.appendChild(qBadge);
      }

      btn.appendChild(topRow);
      btn.appendChild(metaRow);

      btn.addEventListener("click", () => {
        selectedVoiceId = v.id;
        renderVoiceButtons();
      });

      voiceButtonsEl.appendChild(btn);
    });
  }

  async function loadVoices() {
    voiceButtonsEl.innerHTML = "<p class='help'>Chargement des voix...</p>";
    try {
      const res = await fetch(`/api/voices?engine=${currentEngine}&locale=fr-FR`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      voices = await res.json();
      renderVoiceButtons();
    } catch (err) {
      voiceButtonsEl.innerHTML = `<p class='help error'>Erreur de chargement : ${(err as Error).message}</p>`;
      voices = [];
      voiceCountBadgeEl.textContent = "0";
    }
  }

  function updatePreviewRating(score = 0) {
    const stars = previewRatingEl.querySelectorAll<HTMLButtonElement>(".star-btn");
    stars.forEach((s) => {
      const starVal = Number(s.dataset.rating || 0);
      if (score >= starVal) {
        s.classList.add("active");
        s.innerHTML = icon("star", { size: 14, fill: "currentColor" });
      } else {
        s.classList.remove("active");
        s.innerHTML = icon("star", { size: 14 });
      }
    });
  }

  function updatePreviewUpvoteButton(isFavorite: boolean) {
    if (isFavorite) {
      previewUpvoteBtn.classList.add("favorited");
      previewUpvoteBtn.innerHTML = `${icon("heart", { size: 14, fill: "currentColor" })} <span>Favori</span>`;
      previewUpvoteBtn.title = "Retirer des favoris";
    } else {
      previewUpvoteBtn.classList.remove("favorited");
      previewUpvoteBtn.innerHTML = `${icon("heart", { size: 14 })} <span>Favori</span>`;
      previewUpvoteBtn.title = "Ajouter aux favoris";
    }
  }

  function loadAudioIntoPreview(
    item: {
      id: string;
      engine: Engine;
      voiceName: string;
      voiceId: string;
      filePath: string;
      url: string;
      isFavorite?: boolean;
      score?: number;
      generationTimeMs?: number;
    },
    autoPlay = false
  ) {
    const fullItem = historyItems.find((h) => h.id === item.id) || {
      id: item.id,
      createdAt: new Date().toISOString(),
      text: textEl.value.trim(),
      engine: item.engine,
      voiceId: item.voiceId,
      voiceName: item.voiceName,
      filePath: item.filePath,
      fileName: item.filePath.split("/").pop() || "",
      url: item.url,
      format: item.engine === "edge" ? "mp3" : "wav",
      sizeBytes: 0,
      upvotes: 0,
      isFavorite: item.isFavorite || false,
      score: item.score || 0,
      generationTimeMs: item.generationTimeMs,
    };

    currentAudioItem = fullItem as AudioHistoryItem;

    previewInfoEl.style.display = "flex";
    if (previewFormatBadge) {
      previewFormatBadge.textContent = (fullItem.format || "wav").toUpperCase();
    }
    if (previewDeckIcon) {
      previewDeckIcon.innerHTML = icon("disc", { size: 15 });
    }

    if (fullItem.generationTimeMs) {
      const sec = (fullItem.generationTimeMs / 1000).toFixed(2);
      detailGenTimeEl.innerHTML = `${icon("clock", { size: 12 })} <span>${sec}s</span>`;
      detailGenTimeEl.style.display = "inline-flex";
      detailGenTimeEl.title = `Temps de génération : ${fullItem.generationTimeMs} ms`;
    } else {
      detailGenTimeEl.style.display = "none";
    }

    updatePreviewRating(fullItem.score || 0);
    updatePreviewUpvoteButton(!!fullItem.isFavorite);

    detailEngineEl.innerHTML = getEngineBadge(fullItem.engine);
    detailVoiceEl.textContent = fullItem.voiceName || fullItem.voiceId;
    detailPathEl.textContent = fullItem.filePath;
    audioDetailsEl.style.display = "block";

    playerEl.src = fullItem.url;
    if (autoPlay) {
      playerEl.play().catch(() => {});
    }
  }

  function renderDecisionMatrix() {
    if (!decisionMatrixChart) return;

    decisionMatrixChart.innerHTML = "";

    const ratedItems = historyItems.filter(
      (item) => item.score && item.score > 0 && item.generationTimeMs && item.generationTimeMs > 0
    );

    if (ratedItems.length === 0) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "300");
      text.setAttribute("y", "125");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("font-size", "13");
      text.textContent = "Aucune note attribuée (Notez des voix 1 à 3 étoiles pour afficher la matrice)";
      decisionMatrixChart.appendChild(text);
      return;
    }

    const padding = { top: 25, right: 35, bottom: 35, left: 45 };
    const width = 600;
    const height = 240;
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const minGenTime = 0;
    const maxGenTime = Math.max(3000, ...ratedItems.map((d) => d.generationTimeMs || 0)) * 1.15;

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <linearGradient id="matrixBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.05" />
        <stop offset="100%" stop-color="transparent" stop-opacity="0" />
      </linearGradient>
    `;
    decisionMatrixChart.appendChild(defs);

    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", padding.left.toString());
    bgRect.setAttribute("y", padding.top.toString());
    bgRect.setAttribute("width", plotWidth.toString());
    bgRect.setAttribute("height", plotHeight.toString());
    bgRect.setAttribute("fill", "url(#matrixBgGrad)");
    bgRect.setAttribute("rx", "6");
    decisionMatrixChart.appendChild(bgRect);

    // Lignes horizontales pour les scores 1, 2, 3
    for (let s = 1; s <= 3; s++) {
      const y = padding.top + plotHeight - ((s - 0.5) / 3) * plotHeight;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", padding.left.toString());
      line.setAttribute("y1", y.toString());
      line.setAttribute("x2", (padding.left + plotWidth).toString());
      line.setAttribute("y2", y.toString());
      line.setAttribute("stroke", "var(--border)");
      line.setAttribute("stroke-dasharray", "3 3");
      line.setAttribute("stroke-opacity", "0.6");
      decisionMatrixChart.appendChild(line);

      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", (padding.left - 10).toString());
      label.setAttribute("y", (y + 4).toString());
      label.setAttribute("text-anchor", "end");
      label.setAttribute("fill", "var(--text-muted)");
      label.setAttribute("font-size", "11");
      label.textContent = `${s}★`;
      decisionMatrixChart.appendChild(label);
    }

    // Axe Y
    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    yAxis.setAttribute("x1", padding.left.toString());
    yAxis.setAttribute("y1", padding.top.toString());
    yAxis.setAttribute("x2", padding.left.toString());
    yAxis.setAttribute("y2", (padding.top + plotHeight).toString());
    yAxis.setAttribute("stroke", "var(--border)");
    decisionMatrixChart.appendChild(yAxis);

    // Axe X
    const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xAxis.setAttribute("x1", padding.left.toString());
    xAxis.setAttribute("y1", (padding.top + plotHeight).toString());
    xAxis.setAttribute("x2", (padding.left + plotWidth).toString());
    xAxis.setAttribute("y2", (padding.top + plotHeight).toString());
    xAxis.setAttribute("stroke", "var(--border)");
    decisionMatrixChart.appendChild(xAxis);

    // Labels Axe X
    const xTicks = 4;
    for (let i = 0; i <= xTicks; i++) {
      const val = (maxGenTime / xTicks) * i;
      const x = padding.left + (i / xTicks) * plotWidth;
      const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      xLabel.setAttribute("x", x.toString());
      xLabel.setAttribute("y", (padding.top + plotHeight + 18).toString());
      xLabel.setAttribute("text-anchor", "middle");
      xLabel.setAttribute("fill", "var(--text-muted)");
      xLabel.setAttribute("font-size", "10");
      xLabel.textContent = `${(val / 1000).toFixed(1)}s`;
      decisionMatrixChart.appendChild(xLabel);
    }

    // Points de données
    ratedItems.forEach((item) => {
      const genTime = item.generationTimeMs || 0;
      const score = item.score || 1;

      const cx = padding.left + (genTime / maxGenTime) * plotWidth;
      const cy = padding.top + plotHeight - ((score - 0.5) / 3) * plotHeight;

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", cx.toString());
      circle.setAttribute("cy", cy.toString());
      circle.setAttribute("r", "6");
      circle.setAttribute("stroke", "#ffffff");
      circle.setAttribute("stroke-width", "1.5");
      circle.style.cursor = "pointer";

      let fill = "var(--accent)";
      if (item.engine === "edge") fill = "var(--engine-edge)";
      if (item.engine === "piper") fill = "var(--engine-piper)";
      if (item.engine === "kokoro") fill = "var(--engine-kokoro)";
      if (item.engine === "chatterbox") fill = "var(--engine-chatterbox)";
      circle.setAttribute("fill", fill);

      circle.addEventListener("mouseenter", (e) => {
        circle.setAttribute("r", "8");
        const rect = decisionMatrixChart.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        chartTooltip.innerHTML = `
          <strong>${item.voiceName || item.voiceId}</strong> (${item.engine})<br/>
          Note : ${"★".repeat(score)}${"☆".repeat(3 - score)}<br/>
          Temps : ${((item.generationTimeMs || 0) / 1000).toFixed(2)}s
        `;
        chartTooltip.style.left = `${clientX + 10}px`;
        chartTooltip.style.top = `${clientY - 30}px`;
        chartTooltip.style.opacity = "1";
      });

      circle.addEventListener("mouseleave", () => {
        circle.setAttribute("r", "6");
        chartTooltip.style.opacity = "0";
      });

      circle.addEventListener("click", () => {
        loadAudioIntoPreview(item, true);
      });

      decisionMatrixChart.appendChild(circle);
    });
  }

  function updateStatsDisplay() {
    if (!statsSummaryGrid) return;

    const totalAudios = historyItems.length;
    statsBadgeCount.textContent = `${totalAudios} audio${totalAudios > 1 ? "s" : ""}`;

    const ratedItems = historyItems.filter((i) => i.score && i.score > 0);
    const avgScore = ratedItems.length > 0
      ? (ratedItems.reduce((acc, cur) => acc + (cur.score || 0), 0) / ratedItems.length).toFixed(1)
      : "-";

    const itemsWithTime = historyItems.filter((i) => i.generationTimeMs && i.generationTimeMs > 0);
    const avgTime = itemsWithTime.length > 0
      ? ((itemsWithTime.reduce((acc, cur) => acc + (cur.generationTimeMs || 0), 0) / itemsWithTime.length) / 1000).toFixed(2)
      : "-";

    const favoriteCount = historyItems.filter((i) => i.isFavorite).length;

    statsSummaryGrid.innerHTML = `
      <div class="stat-card">
        <span class="stat-value">${totalAudios}</span>
        <span class="stat-label">Générations</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${avgScore}${avgScore !== "-" ? "★" : ""}</span>
        <span class="stat-label">Note moyenne</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${avgTime}${avgTime !== "-" ? "s" : ""}</span>
        <span class="stat-label">Vitesse moyenne</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">${favoriteCount}</span>
        <span class="stat-label">Favoris</span>
      </div>
    `;

    renderDecisionMatrix();
  }

  function setupStatsSection() {
    if (statsTitleIcon) {
      statsTitleIcon.innerHTML = icon("barchart", { size: 16 });
    }

    const updateStatsToggleState = () => {
      statsBody.classList.toggle("collapsed", statsCollapsed);
      statsToggleIcon.innerHTML = icon(statsCollapsed ? "chevron-down" : "chevrons-up-down", { size: 13 });
      statsToggleText.textContent = statsCollapsed ? "Déplier" : "Replier";
    };

    statsToggleBtn.addEventListener("click", () => {
      statsCollapsed = !statsCollapsed;
      updateStatsToggleState();
    });

    updateStatsToggleState();
  }

  setupStatsSection();

  function renderHistory() {
    historyListEl.innerHTML = "";

    const filteredItems = historyItems.filter((item) => {
      if (currentFilter === "all") return true;
      if (currentFilter === "favorites") return !!item.isFavorite;
      return item.engine === currentFilter;
    });

    historyCountEl.textContent = `${filteredItems.length}/${historyItems.length}`;

    if (filteredItems.length === 0) {
      const p = document.createElement("p");
      p.className = "help";
      p.textContent = historyItems.length === 0
        ? "Aucun enregistrement dans l'historique."
        : "Aucun enregistrement ne correspond au filtre sélectionné.";
      historyListEl.appendChild(p);
      return;
    }

    filteredItems.forEach((item) => {
      const card = document.createElement("div");
      card.className = "history-card";
      card.dataset.id = item.id;

      const header = document.createElement("div");
      header.className = "history-card-header";

      const chevronSpan = document.createElement("span");
      chevronSpan.className = "history-chevron-icon";
      chevronSpan.innerHTML = icon("chevron-right", { size: 14 });

      const headerContent = document.createElement("div");
      headerContent.className = "history-header-main";

      const engineBadge = document.createElement("div");
      engineBadge.innerHTML = getEngineBadge(item.engine);

      const voiceSpan = document.createElement("span");
      voiceSpan.className = "history-voice-name";
      voiceSpan.textContent = item.voiceName || item.voiceId;

      const dateSpan = document.createElement("span");
      dateSpan.className = "history-date";
      dateSpan.textContent = new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      headerContent.appendChild(chevronSpan);
      headerContent.appendChild(engineBadge.firstElementChild as HTMLElement);
      headerContent.appendChild(voiceSpan);
      headerContent.appendChild(dateSpan);

      const headerActions = document.createElement("div");
      headerActions.className = "history-header-actions";

      // Badge Note 1-3 étoiles dans le header
      const scoreBadge = document.createElement("span");
      scoreBadge.className = `history-score-badge ${item.score ? "scored" : ""}`;
      scoreBadge.innerHTML = `${icon("star", { size: 11, fill: item.score ? "currentColor" : "none" })} <span>${item.score ? `${item.score}/3` : "-"}</span>`;
      scoreBadge.title = item.score ? `Note : ${item.score} sur 3` : "Non noté";

      // Bouton Upvote / Favori rapide
      const favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = `history-fav-btn ${item.isFavorite ? "favorited" : ""}`;
      favBtn.innerHTML = icon("heart", { size: 13, fill: item.isFavorite ? "currentColor" : "none" });
      favBtn.title = item.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris";
      favBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await toggleHistoryUpvote(item.id);
      });

      headerActions.appendChild(scoreBadge);
      headerActions.appendChild(favBtn);

      header.appendChild(headerContent);
      header.appendChild(headerActions);

      const body = document.createElement("div");
      body.className = "history-card-body";

      const textPreview = document.createElement("p");
      textPreview.className = "history-text-preview";
      textPreview.textContent = item.text;

      const metaRow = document.createElement("div");
      metaRow.className = "history-meta-row";

      const sizeSpan = document.createElement("span");
      sizeSpan.className = "history-meta-tag";
      sizeSpan.innerHTML = `${icon("disc", { size: 11 })} ${(item.sizeBytes / 1024).toFixed(1)} KB`;

      metaRow.appendChild(sizeSpan);

      if (item.generationTimeMs) {
        const timeSpan = document.createElement("span");
        timeSpan.className = "history-meta-tag";
        timeSpan.innerHTML = `${icon("clock", { size: 11 })} ${(item.generationTimeMs / 1000).toFixed(2)}s`;
        metaRow.appendChild(timeSpan);
      }

      // Système de notation 3 étoiles dans le corps
      const ratingContainer = document.createElement("div");
      ratingContainer.className = "history-rating-stars";
      for (let s = 1; s <= 3; s++) {
        const starBtn = document.createElement("button");
        starBtn.type = "button";
        starBtn.className = `star-btn ${item.score && item.score >= s ? "active" : ""}`;
        starBtn.innerHTML = icon("star", { size: 13, fill: item.score && item.score >= s ? "currentColor" : "none" });
        starBtn.title = `Attribuer ${s} étoile${s > 1 ? "s" : ""}`;
        starBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          const newScore = item.score === s ? 0 : s;
          await setHistoryScore(item.id, newScore);
        });
        ratingContainer.appendChild(starBtn);
      }
      metaRow.appendChild(ratingContainer);

      const actionsRow = document.createElement("div");
      actionsRow.className = "history-card-actions";

      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "btn-secondary btn-sm";
      playBtn.innerHTML = `${icon("play", { size: 12 })} <span>Écouter</span>`;
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        loadAudioIntoPreview(item, true);
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn-icon-danger btn-sm";
      deleteBtn.innerHTML = icon("trash", { size: 13 });
      deleteBtn.title = "Supprimer cet enregistrement";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm("Supprimer cet audio de l'historique ?")) {
          await deleteHistoryItem(item.id);
        }
      });

      actionsRow.appendChild(playBtn);
      actionsRow.appendChild(deleteBtn);

      body.appendChild(textPreview);
      body.appendChild(metaRow);
      body.appendChild(actionsRow);

      card.appendChild(header);
      card.appendChild(body);

      header.addEventListener("click", () => {
        const isExpanded = card.classList.toggle("expanded");
        chevronSpan.innerHTML = icon(isExpanded ? "chevron-down" : "chevron-right", { size: 14 });
      });

      historyListEl.appendChild(card);
    });

    updateStatsDisplay();
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      historyItems = await res.json();
      renderHistory();
    } catch (err) {
      console.error("Erreur chargement historique :", err);
    }
  }

  async function toggleHistoryUpvote(id: string) {
    try {
      const res = await fetch(`/api/history/${id}/upvote`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updatedItem = await res.json();
      const idx = historyItems.findIndex((i) => i.id === id);
      if (idx !== -1) {
        historyItems[idx] = updatedItem;
      }
      if (currentAudioItem && currentAudioItem.id === id) {
        currentAudioItem = updatedItem;
        updatePreviewUpvoteButton(!!updatedItem.isFavorite);
      }
      renderHistory();
    } catch (err) {
      console.error("Erreur upvote :", err);
    }
  }

  async function setHistoryScore(id: string, score: number) {
    try {
      const res = await fetch(`/api/history/${id}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updatedItem = await res.json();
      const idx = historyItems.findIndex((i) => i.id === id);
      if (idx !== -1) {
        historyItems[idx] = updatedItem;
      }
      if (currentAudioItem && currentAudioItem.id === id) {
        currentAudioItem = updatedItem;
        updatePreviewRating(updatedItem.score || 0);
      }
      renderHistory();
    } catch (err) {
      console.error("Erreur score :", err);
    }
  }

  async function deleteHistoryItem(id: string) {
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      historyItems = historyItems.filter((i) => i.id !== id);
      if (currentAudioItem && currentAudioItem.id === id) {
        currentAudioItem = null;
        previewInfoEl.style.display = "none";
        audioDetailsEl.style.display = "none";
        playerEl.removeAttribute("src");
        playerEl.load();
      }
      renderHistory();
    } catch (err) {
      console.error("Erreur suppression historique :", err);
    }
  }

  async function clearHistory() {
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      historyItems = [];
      currentAudioItem = null;
      previewInfoEl.style.display = "none";
      audioDetailsEl.style.display = "none";
      playerEl.removeAttribute("src");
      playerEl.load();
      renderHistory();
    } catch (err) {
      console.error("Erreur vidage historique :", err);
    }
  }

  // Événements Filtres Historique
  historyFilterButtonsEl.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!target || !target.dataset.filter) return;

    historyFilterButtonsEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    target.classList.add("active");

    currentFilter = target.dataset.filter as HistoryFilter;
    renderHistory();
  });

  // Déplier / Replier tout l'historique
  let allHistoryExpanded = false;
  toggleAllHistoryBtn.addEventListener("click", () => {
    allHistoryExpanded = !allHistoryExpanded;
    const cards = historyListEl.querySelectorAll<HTMLDivElement>(".history-card");
    cards.forEach((card) => {
      card.classList.toggle("expanded", allHistoryExpanded);
      const chevron = card.querySelector(".history-chevron-icon");
      if (chevron) {
        chevron.innerHTML = icon(allHistoryExpanded ? "chevron-down" : "chevron-right", { size: 14 });
      }
    });
    toggleAllHistoryBtn.innerHTML = `${icon("chevrons-up-down", { size: 13 })} <span>${allHistoryExpanded ? "Tout replier" : "Tout déplier"}</span>`;
  });

  clearHistoryBtn.addEventListener("click", async () => {
    if (confirm("Voulez-vous vraiment supprimer tout l'historique TTS ?")) {
      await clearHistory();
    }
  });

  // Copier le chemin de fichier
  copyPathBtn.addEventListener("click", () => {
    const path = detailPathEl.textContent;
    if (path) {
      navigator.clipboard.writeText(path).then(() => {
        const originalText = copyPathBtn.innerHTML;
        copyPathBtn.innerHTML = `${icon("check", { size: 12 })} <span>Copié !</span>`;
        setTimeout(() => {
          copyPathBtn.innerHTML = originalText;
        }, 1500);
      });
    }
  });

  // Upvote depuis le lecteur principal
  previewUpvoteBtn.addEventListener("click", async () => {
    if (currentAudioItem) {
      await toggleHistoryUpvote(currentAudioItem.id);
    }
  });

  // Étoiles de notation dans le lecteur principal
  previewRatingEl.addEventListener("click", async (e) => {
    const starBtn = (e.target as HTMLElement).closest<HTMLButtonElement>(".star-btn");
    if (!starBtn || !currentAudioItem) return;

    const ratingVal = Number(starBtn.dataset.rating || 0);
    const newScore = currentAudioItem.score === ratingVal ? 0 : ratingVal;
    await setHistoryScore(currentAudioItem.id, newScore);
  });

  // Sliders Piper
  lengthScaleEl.addEventListener("input", () => {
    lengthScaleValueEl.textContent = Number(lengthScaleEl.value).toFixed(2);
  });
  noiseScaleEl.addEventListener("input", () => {
    noiseScaleValueEl.textContent = Number(noiseScaleEl.value).toFixed(2);
  });
  noiseWEl.addEventListener("input", () => {
    noiseWValueEl.textContent = Number(noiseWEl.value).toFixed(2);
  });

  // Slider Edge
  ratePercentEl.addEventListener("input", () => {
    const val = Number(ratePercentEl.value);
    ratePercentValueEl.textContent = `${val >= 0 ? "+" : ""}${val}%`;
  });

  // Slider Kokoro
  kokoroSpeedEl.addEventListener("input", () => {
    kokoroSpeedValueEl.textContent = `${Number(kokoroSpeedEl.value).toFixed(2)}x`;
  });

  // Sliders Chatterbox
  chatterboxExaggerationEl.addEventListener("input", () => {
    chatterboxExaggerationValueEl.textContent = Number(chatterboxExaggerationEl.value).toFixed(2);
  });
  chatterboxTemperatureEl.addEventListener("input", () => {
    chatterboxTemperatureValueEl.textContent = Number(chatterboxTemperatureEl.value).toFixed(2);
  });

  // Switch de moteur TTS
  engineSwitchEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!btn || !btn.dataset.engine) return;

    const engine = btn.dataset.engine as Engine;
    if (engine === currentEngine) return;

    engineSwitchEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    currentEngine = engine;
    updateControlsVisibility();
    loadVoices().catch((err) => {
      statusEl.textContent = `Erreur lors du changement de moteur : ${(err as Error).message}`;
    });
  });

  // Génération TTS
  async function generate() {
    const text = textEl.value.trim();
    if (!text) {
      statusEl.textContent = "Veuillez saisir un texte à synthétiser.";
      return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = `${icon("sparkles", { size: 15 })} <span>Génération en cours...</span>`;
    statusEl.textContent = `Génération (${getEngineBadgeText(currentEngine)})...`;

    const start = performance.now();

    try {
      const payload: {
        text: string;
        engine: Engine;
        voiceId?: string;
        lengthScale?: number;
        noiseScale?: number;
        noiseW?: number;
        ratePercent?: number;
        speed?: number;
        device?: string;
        exaggeration?: number;
        temperature?: number;
      } = {
        text,
        engine: currentEngine,
        voiceId: selectedVoiceId || undefined,
      };

      if (currentEngine === "piper") {
        payload.lengthScale = Number(lengthScaleEl.value);
        payload.noiseScale = Number(noiseScaleEl.value);
        payload.noiseW = Number(noiseWEl.value);
      } else if (currentEngine === "edge") {
        payload.ratePercent = Number(ratePercentEl.value);
      } else if (currentEngine === "kokoro") {
        payload.speed = Number(kokoroSpeedEl.value);
      } else if (currentEngine === "chatterbox") {
        payload.device = chatterboxDeviceEl.value;
        payload.exaggeration = Number(chatterboxExaggerationEl.value);
        payload.temperature = Number(chatterboxTemperatureEl.value);
      }

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${res.status}`);
      }

      const audioBlob = await res.blob();
      const url = URL.createObjectURL(audioBlob);

      const audioId = res.headers.get("X-Audio-Id") || `gen-${Date.now()}`;
      const audioEngine = (res.headers.get("X-Audio-Engine") as Engine) || currentEngine;
      const audioVoiceName = res.headers.get("X-Audio-Voice") || selectedVoiceId || "Voix";
      const audioPath = res.headers.get("X-Audio-Path") || "";
      const genTimeHeader = res.headers.get("X-Audio-Gen-Time");
      const generationTimeMs = genTimeHeader ? Number(genTimeHeader) : Math.round(performance.now() - start);

      loadAudioIntoPreview(
        {
          id: audioId,
          engine: audioEngine,
          voiceName: audioVoiceName,
          voiceId: selectedVoiceId || "",
          filePath: audioPath,
          url,
          isFavorite: false,
          generationTimeMs,
        },
        true
      );

      const elapsed = ((performance.now() - start) / 1000).toFixed(2);
      statusEl.textContent = `Généré en ${elapsed}s (${currentEngine}).`;

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

  setupStaticIcons();
  updateControlsVisibility();
  updatePreviewRating(0);
  updatePreviewUpvoteButton(false);
  loadVoices().catch((err) => {
    statusEl.textContent = `Impossible de charger les voix : ${(err as Error).message}`;
  });
  loadHistory().catch((err) => {
    console.error("Erreur lors du chargement initial de l'historique TTS :", err);
  });
}
