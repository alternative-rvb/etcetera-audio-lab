import { icon } from "./icons.js";

export interface STTSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    probability: number;
  }>;
}

export interface STTHistoryItem {
  id: string;
  createdAt: string;
  text: string;
  engine: "whisper" | "webspeech" | "sherpa";
  modelSize?: string;
  device?: string;
  language: string;
  durationSec: number;
  processingTimeMs: number;
  rtf: number;
  filePath?: string;
  fileName?: string;
  url?: string;
  segments: STTSegment[];
  score?: number;
  isFavorite?: boolean;
}

const API_BASE = "";

export function initSttModule() {
  // Navigation Tabs
  const tabNavTts = document.getElementById("tabNavTts") as HTMLButtonElement | null;
  const tabNavStt = document.getElementById("tabNavStt") as HTMLButtonElement | null;
  const ttsPageView = document.getElementById("ttsPageView") as HTMLDivElement | null;
  const sttPageView = document.getElementById("sttPageView") as HTMLDivElement | null;

  // Icons Navigation
  const navTabTtsIcon = document.getElementById("navTabTtsIcon");
  if (navTabTtsIcon) navTabTtsIcon.innerHTML = icon("volume", { size: 15 });
  const navTabSttIcon = document.getElementById("navTabSttIcon");
  if (navTabSttIcon) navTabSttIcon.innerHTML = icon("mic", { size: 15 });

  // Hero Toggle STT
  const heroSttToggleBtn = document.getElementById("heroSttToggleBtn") as HTMLButtonElement | null;
  const heroSttGridCompare = document.getElementById("heroSttGridCompare") as HTMLDivElement | null;
  const heroSttToggleIcon = document.getElementById("heroSttToggleIcon");
  const heroSttToggleText = document.getElementById("heroSttToggleText");
  const heroSttTargetIcon = document.getElementById("heroSttTargetIcon");
  if (heroSttTargetIcon) heroSttTargetIcon.innerHTML = icon("target", { size: 13 });

  let heroSttCollapsed = false;
  if (heroSttToggleBtn && heroSttGridCompare) {
    heroSttToggleBtn.addEventListener("click", () => {
      heroSttCollapsed = !heroSttCollapsed;
      heroSttGridCompare.hidden = heroSttCollapsed;
      if (heroSttToggleIcon) heroSttToggleIcon.innerHTML = icon(heroSttCollapsed ? "chevronDown" : "chevronUp", { size: 14 });
      if (heroSttToggleText) heroSttToggleText.textContent = heroSttCollapsed ? "Afficher les specs" : "Masquer les specs";
    });
    if (heroSttToggleIcon) heroSttToggleIcon.innerHTML = icon("chevronUp", { size: 14 });
  }

  // Navigation Logic
  function switchPage(page: "tts" | "stt") {
    if (!ttsPageView || !sttPageView || !tabNavTts || !tabNavStt) return;
    if (page === "tts") {
      ttsPageView.hidden = false;
      sttPageView.hidden = true;
      tabNavTts.classList.add("active");
      tabNavTts.setAttribute("aria-selected", "true");
      tabNavStt.classList.remove("active");
      tabNavStt.setAttribute("aria-selected", "false");
    } else {
      ttsPageView.hidden = true;
      sttPageView.hidden = false;
      tabNavTts.classList.remove("active");
      tabNavTts.setAttribute("aria-selected", "false");
      tabNavStt.classList.add("active");
      tabNavStt.setAttribute("aria-selected", "true");
      loadSttHistory();
    }
  }

  tabNavTts?.addEventListener("click", () => switchPage("tts"));
  tabNavStt?.addEventListener("click", () => switchPage("stt"));

  // Source Tabs (Microphone / Upload / Démos)
  const sourceTabMic = document.getElementById("sourceTabMic") as HTMLButtonElement | null;
  const sourceTabUpload = document.getElementById("sourceTabUpload") as HTMLButtonElement | null;
  const sourceTabDemo = document.getElementById("sourceTabDemo") as HTMLButtonElement | null;

  const sourcePanelMic = document.getElementById("sourcePanelMic") as HTMLDivElement | null;
  const sourcePanelUpload = document.getElementById("sourcePanelUpload") as HTMLDivElement | null;
  const sourcePanelDemo = document.getElementById("sourcePanelDemo") as HTMLDivElement | null;

  const sourceTabMicIcon = document.getElementById("sourceTabMicIcon");
  if (sourceTabMicIcon) sourceTabMicIcon.innerHTML = icon("mic", { size: 13 });
  const sourceTabUploadIcon = document.getElementById("sourceTabUploadIcon");
  if (sourceTabUploadIcon) sourceTabUploadIcon.innerHTML = icon("upload", { size: 13 });
  const sourceTabDemoIcon = document.getElementById("sourceTabDemoIcon");
  if (sourceTabDemoIcon) sourceTabDemoIcon.innerHTML = icon("play", { size: 13 });

  let currentSource: "mic" | "upload" | "demo" = "mic";
  let activeAudioBlob: Blob | null = null;
  let activeAudioFilename: string = "enregistrement.wav";

  function setSourceTab(tab: "mic" | "upload" | "demo") {
    currentSource = tab;
    [sourceTabMic, sourceTabUpload, sourceTabDemo].forEach((b) => b?.classList.remove("active"));
    [sourcePanelMic, sourcePanelUpload, sourcePanelDemo].forEach((p) => {
      if (p) p.hidden = true;
    });

    if (tab === "mic") {
      sourceTabMic?.classList.add("active");
      if (sourcePanelMic) sourcePanelMic.hidden = false;
    } else if (tab === "upload") {
      sourceTabUpload?.classList.add("active");
      if (sourcePanelUpload) sourcePanelUpload.hidden = false;
    } else {
      sourceTabDemo?.classList.add("active");
      if (sourcePanelDemo) sourcePanelDemo.hidden = false;
    }
  }

  sourceTabMic?.addEventListener("click", () => setSourceTab("mic"));
  sourceTabUpload?.addEventListener("click", () => setSourceTab("upload"));
  sourceTabDemo?.addEventListener("click", () => setSourceTab("demo"));

  // Microphone Recording
  const micRecordBtn = document.getElementById("micRecordBtn") as HTMLButtonElement | null;
  const micRecordBtnIcon = document.getElementById("micRecordBtnIcon");
  const micRecordBtnText = document.getElementById("micRecordBtnText");
  const micRecordTimer = document.getElementById("micRecordTimer") as HTMLSpanElement | null;
  const micCanvas = document.getElementById("micVisualizerCanvas") as HTMLCanvasElement | null;

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let isRecording = false;
  let recordStartTime = 0;
  let recordTimerInterval: number | null = null;
  let micAudioContext: AudioContext | null = null;
  let micAnalyser: AnalyserNode | null = null;
  let micAnimId: number | null = null;

  if (micRecordBtnIcon) micRecordBtnIcon.innerHTML = icon("mic", { size: 15 });

  function drawMicVisualizer() {
    if (!micCanvas || !micAnalyser) return;
    const ctx = micCanvas.getContext("2d");
    if (!ctx) return;

    const width = micCanvas.width = micCanvas.offsetWidth;
    const height = micCanvas.height = micCanvas.offsetHeight;

    const bufferLength = micAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    micAnalyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e11d48";
    ctx.beginPath();

    const sliceWidth = (width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (isRecording) {
      micAnimId = requestAnimationFrame(drawMicVisualizer);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      micAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = micAudioContext.createMediaStreamSource(stream);
      micAnalyser = micAudioContext.createAnalyser();
      micAnalyser.fftSize = 256;
      source.connect(micAnalyser);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        activeAudioBlob = new Blob(audioChunks, { type: "audio/wav" });
        activeAudioFilename = `enregistrement_${new Date().toISOString().slice(11, 19).replace(/:/g, "-")}.wav`;
        loadAudioIntoSttPlayer(activeAudioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      isRecording = true;
      recordStartTime = Date.now();

      if (micRecordBtn) micRecordBtn.classList.add("is-recording");
      if (micRecordBtnIcon) micRecordBtnIcon.innerHTML = icon("square", { size: 14 });
      if (micRecordBtnText) micRecordBtnText.textContent = "Arrêter l'enregistrement";
      if (micRecordTimer) micRecordTimer.classList.add("active");

      recordTimerInterval = window.setInterval(() => {
        const elapsed = (Date.now() - recordStartTime) / 1000;
        const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
        const secs = (elapsed % 60).toFixed(1).padStart(4, "0");
        if (micRecordTimer) micRecordTimer.textContent = `${mins}:${secs}`;
      }, 100);

      drawMicVisualizer();
    } catch (err: any) {
      alert(`Erreur d'accès au microphone : ${err.message}`);
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;

      if (micRecordBtn) micRecordBtn.classList.remove("is-recording");
      if (micRecordBtnIcon) micRecordBtnIcon.innerHTML = icon("mic", { size: 15 });
      if (micRecordBtnText) micRecordBtnText.textContent = "Enregistrer à nouveau";
      if (micRecordTimer) micRecordTimer.classList.remove("active");

      if (recordTimerInterval) {
        clearInterval(recordTimerInterval);
        recordTimerInterval = null;
      }
      if (micAnimId) cancelAnimationFrame(micAnimId);
    }
  }

  micRecordBtn?.addEventListener("click", () => {
    if (isRecording) stopRecording();
    else startRecording();
  });

  // Dropzone File Upload
  const dropzone = document.getElementById("sttFileDropzone") as HTMLDivElement | null;
  const fileInput = document.getElementById("sttFileInput") as HTMLInputElement | null;
  const selectedFileInfo = document.getElementById("selectedFileInfo") as HTMLDivElement | null;
  const selectedFileName = document.getElementById("selectedFileName") as HTMLSpanElement | null;
  const removeSelectedFileBtn = document.getElementById("removeSelectedFileBtn") as HTMLButtonElement | null;
  const sttDropzoneIcon = document.getElementById("sttDropzoneIcon");
  if (sttDropzoneIcon) sttDropzoneIcon.innerHTML = icon("upload", { size: 28 });

  dropzone?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("#removeSelectedFileBtn")) return;
    fileInput?.click();
  });

  dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });

  dropzone?.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });

  dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer?.files.length) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  fileInput?.addEventListener("change", () => {
    if (fileInput.files?.length) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  function handleFileSelected(file: File) {
    activeAudioBlob = file;
    activeAudioFilename = file.name;
    if (selectedFileInfo && selectedFileName) {
      selectedFileInfo.hidden = false;
      selectedFileName.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} Mo)`;
    }
    loadAudioIntoSttPlayer(file);
  }

  removeSelectedFileBtn?.addEventListener("click", () => {
    activeAudioBlob = null;
    if (fileInput) fileInput.value = "";
    if (selectedFileInfo) selectedFileInfo.hidden = true;
  });

  // Demo Samples
  const demoFemaleBtn = document.getElementById("demoSampleFemale");
  const demoMaleBtn = document.getElementById("demoSampleMale");

  async function loadDemoSample(type: "female" | "male") {
    try {
      const filename = type === "female" ? "reference_female.wav" : "reference_male.wav";
      const res = await fetch(`/api/voices?engine=chatterbox`);
      // Use direct local reference sample from server
      const audioRes = await fetch(`/audio/${filename}`).catch(() => fetch(`http://127.0.0.1:5002/references`));
      
      // Fallback to synthesizing a clean sample if static path is direct
      const sampleBlob = await fetch(`/audio/${filename}`).then((r) => r.blob()).catch(async () => {
        const fallbackRes = await fetch(`${API_BASE}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: "Bonjour, ceci est un extrait audio de test pour valider la transcription vocale Whisper.",
            engine: "edge",
            voiceId: "fr-FR-DeniseNeural",
          }),
        });
        return fallbackRes.blob();
      });

      activeAudioBlob = sampleBlob;
      activeAudioFilename = filename;
      loadAudioIntoSttPlayer(sampleBlob);

      [demoFemaleBtn, demoMaleBtn].forEach((b) => b?.classList.remove("is-active"));
      if (type === "female") demoFemaleBtn?.classList.add("is-active");
      else demoMaleBtn?.classList.add("is-active");
    } catch (err: any) {
      alert(`Erreur de chargement de l'extrait démo : ${err.message}`);
    }
  }

  demoFemaleBtn?.addEventListener("click", () => loadDemoSample("female"));
  demoMaleBtn?.addEventListener("click", () => loadDemoSample("male"));

  // Audio Player & Visualizer for STT
  const sttAudioPlayer = document.getElementById("sttAudioPlayer") as HTMLAudioElement | null;
  const sttFormatBadge = document.getElementById("sttFormatBadge") as HTMLSpanElement | null;
  const sttEngineBadge = document.getElementById("sttEngineBadge") as HTMLSpanElement | null;
  const sttDurationBadge = document.getElementById("sttDurationBadge") as HTMLSpanElement | null;
  const sttRtfBadge = document.getElementById("sttRtfBadge") as HTMLSpanElement | null;
  const sttVisualizerIcon = document.getElementById("sttVisualizerIcon");
  const sttPreviewDeckIcon = document.getElementById("sttPreviewDeckIcon");
  if (sttVisualizerIcon) sttVisualizerIcon.innerHTML = icon("activity", { size: 12 });
  if (sttPreviewDeckIcon) sttPreviewDeckIcon.innerHTML = icon("volume", { size: 13 });

  function loadAudioIntoSttPlayer(blobOrUrl: Blob | string) {
    if (!sttAudioPlayer) return;
    if (typeof blobOrUrl === "string") {
      sttAudioPlayer.src = blobOrUrl;
    } else {
      sttAudioPlayer.src = URL.createObjectURL(blobOrUrl);
    }
    if (sttFormatBadge) sttFormatBadge.textContent = "Audio chargé";
    sttAudioPlayer.load();
  }

  // STT Engine Selector
  const sttEngineSwitch = document.getElementById("sttEngineSwitch") as HTMLDivElement | null;
  const sttWhisperOptions = document.getElementById("sttWhisperOptions") as HTMLDivElement | null;
  const sttWhisperBtnIcon = document.getElementById("sttWhisperBtnIcon");
  const sttWebSpeechBtnIcon = document.getElementById("sttWebSpeechBtnIcon");
  const sttSherpaBtnIcon = document.getElementById("sttSherpaBtnIcon");

  if (sttWhisperBtnIcon) sttWhisperBtnIcon.innerHTML = icon("cpu", { size: 14 });
  if (sttWebSpeechBtnIcon) sttWebSpeechBtnIcon.innerHTML = icon("globe", { size: 14 });
  if (sttSherpaBtnIcon) sttSherpaBtnIcon.innerHTML = icon("zap", { size: 14 });

  let activeSttEngine: "whisper" | "webspeech" | "sherpa" = "whisper";

  sttEngineSwitch?.querySelectorAll<HTMLButtonElement>(".engine-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sttEngineSwitch.querySelectorAll(".engine-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      activeSttEngine = (btn.dataset.sttEngine as "whisper" | "webspeech" | "sherpa") || "whisper";
      if (sttWhisperOptions) {
        sttWhisperOptions.hidden = activeSttEngine !== "whisper";
      }
      if (sttEngineBadge) {
        sttEngineBadge.className = `badge engine-${activeSttEngine}`;
        sttEngineBadge.textContent = activeSttEngine === "whisper" ? "Whisper" : activeSttEngine === "webspeech" ? "Web Speech" : "Sherpa";
      }
    });
  });

  // Transcription Action
  const transcribeBtn = document.getElementById("transcribeBtn") as HTMLButtonElement | null;
  const transcribeBtnIcon = document.getElementById("transcribeBtnIcon");
  const transcribeBtnText = document.getElementById("transcribeBtnText");
  const transcriptionTextContent = document.getElementById("transcriptionTextContent") as HTMLDivElement | null;
  const transcriptionSegmentsContainer = document.getElementById("transcriptionSegmentsContainer") as HTMLDivElement | null;
  const transcriptionSegmentsList = document.getElementById("transcriptionSegmentsList") as HTMLDivElement | null;
  const copyTranscriptionBtn = document.getElementById("copyTranscriptionBtn") as HTMLButtonElement | null;
  const copyTranscriptionIcon = document.getElementById("copyTranscriptionIcon");

  if (transcribeBtnIcon) transcribeBtnIcon.innerHTML = icon("play", { size: 14 });
  if (copyTranscriptionIcon) copyTranscriptionIcon.innerHTML = icon("copy", { size: 13 });

  let isTranscribing = false;
  let lastTranscriptionText = "";

  copyTranscriptionBtn?.addEventListener("click", async () => {
    if (!lastTranscriptionText) return;
    await navigator.clipboard.writeText(lastTranscriptionText);
    copyTranscriptionBtn.classList.add("copied");
    if (copyTranscriptionIcon) copyTranscriptionIcon.innerHTML = icon("check", { size: 13 });
    setTimeout(() => {
      copyTranscriptionBtn.classList.remove("copied");
      if (copyTranscriptionIcon) copyTranscriptionIcon.innerHTML = icon("copy", { size: 13 });
    }, 1500);
  });

  async function handleTranscribe() {
    if (isTranscribing) return;

    if (!activeAudioBlob) {
      alert("Veuillez d'abord enregistrer un audio au micro ou importer un fichier.");
      return;
    }

    isTranscribing = true;
    if (transcribeBtn) transcribeBtn.disabled = true;
    if (transcribeBtnIcon) transcribeBtnIcon.innerHTML = icon("refreshCw", { size: 14 });
    if (transcribeBtnText) transcribeBtnText.textContent = "Transcription en cours...";

    const whisperModelSize = (document.getElementById("whisperModelSize") as HTMLSelectElement)?.value || "base";
    const whisperDevice = (document.getElementById("whisperDevice") as HTMLSelectElement)?.value || "cpu";
    const whisperLanguage = (document.getElementById("whisperLanguage") as HTMLSelectElement)?.value || "fr";

    try {
      const formData = new FormData();
      formData.append("file", activeAudioBlob, activeAudioFilename);
      formData.append("engine", activeSttEngine);
      formData.append("modelSize", whisperModelSize);
      formData.append("device", whisperDevice);
      formData.append("language", whisperLanguage);

      const res = await fetch(`${API_BASE}/api/stt/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Erreur de transcription.");
      }

      const data = await res.json();
      const result = data.result;
      lastTranscriptionText = result.text;
      currentSttId = data.entry?.id || null;

      // Affichage du texte
      if (transcriptionTextContent) {
        transcriptionTextContent.innerHTML = `<p class="transcription-text">${result.text}</p>`;
      }

      // Badges
      if (sttDurationBadge) sttDurationBadge.textContent = `${result.duration}s`;
      if (sttRtfBadge) sttRtfBadge.textContent = `RTF: ${result.rtf}x (${result.processingTimeMs}ms)`;
      if (sttFormatBadge) sttFormatBadge.textContent = `${result.modelSize.toUpperCase()} • ${result.device.toUpperCase()}`;

      // Activer les étoiles de notation dans le header de prévisualisation
      if (sttPreviewRating) {
        sttPreviewRating.hidden = false;
        updateSttPreviewRating(0);
      }
      if (sttPreviewUpvoteBtn) {
        sttPreviewUpvoteBtn.hidden = false;
        updateSttPreviewFavorite(false);
      }

      // Segments
      if (result.segments && result.segments.length > 0 && transcriptionSegmentsContainer && transcriptionSegmentsList) {
        transcriptionSegmentsContainer.hidden = false;
        transcriptionSegmentsList.innerHTML = result.segments
          .map(
            (seg: STTSegment) => `
          <div class="segment-row" data-start="${seg.start}">
            <span class="segment-time">${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s</span>
            <span class="segment-text">${seg.text}</span>
          </div>
        `
          )
          .join("");

        // Clic sur un segment pour caler l'audio
        transcriptionSegmentsList.querySelectorAll<HTMLDivElement>(".segment-row").forEach((row) => {
          row.addEventListener("click", () => {
            const start = Number(row.dataset.start || 0);
            if (sttAudioPlayer) {
              sttAudioPlayer.currentTime = start;
              sttAudioPlayer.play();
            }
          });
        });
      }

      loadSttHistory();
    } catch (err: any) {
      alert(`Erreur STT : ${err.message}`);
    } finally {
      isTranscribing = false;
      if (transcribeBtn) transcribeBtn.disabled = false;
      if (transcribeBtnIcon) transcribeBtnIcon.innerHTML = icon("play", { size: 14 });
      if (transcribeBtnText) transcribeBtnText.textContent = "Lancer la transcription STT";
    }
  }

  transcribeBtn?.addEventListener("click", handleTranscribe);

  // STT Preview Rating & Favorite Elements
  let currentSttId: string | null = null;
  let sttHistoryCache: STTHistoryItem[] = [];

  const sttPreviewRating = document.getElementById("sttPreviewRating");
  const sttPreviewUpvoteBtn = document.getElementById("sttPreviewUpvoteBtn");

  function updateSttPreviewRating(score: number = 0) {
    if (!sttPreviewRating) return;
    sttPreviewRating.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((star) => {
      const starScore = Number(star.dataset.score);
      const isActive = starScore <= score;
      star.classList.toggle("active", isActive);
      star.innerHTML = icon("star", {
        size: 13,
        fill: isActive ? "currentColor" : "none",
      });
    });
  }

  function updateSttPreviewFavorite(isFav: boolean = false) {
    if (!sttPreviewUpvoteBtn) return;
    sttPreviewUpvoteBtn.classList.toggle("active", isFav);
    sttPreviewUpvoteBtn.innerHTML = `${icon("heart", {
      size: 13,
      fill: isFav ? "currentColor" : "none",
    })} <span>${isFav ? "Favori" : "Favori"}</span>`;
  }

  async function setSttScore(id: string, score: number) {
    try {
      const res = await fetch(`${API_BASE}/api/stt/history/${id}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      if (!res.ok) throw new Error("Erreur score");
      const updated = await res.json();
      if (currentSttId === id) {
        updateSttPreviewRating(updated.score || 0);
      }
      loadSttHistory();
    } catch (err) {
      console.error("Erreur mise à jour score STT:", err);
    }
  }

  async function toggleSttFavorite(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/stt/history/${id}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error("Erreur favori");
      const updated = await res.json();
      if (currentSttId === id) {
        updateSttPreviewFavorite(Boolean(updated.isFavorite));
      }
      loadSttHistory();
    } catch (err) {
      console.error("Erreur toggle favori STT:", err);
    }
  }

  sttPreviewRating?.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((star) => {
    star.addEventListener("click", () => {
      if (!currentSttId) return;
      const clickedScore = Number(star.dataset.score);
      const currentItem = sttHistoryCache.find((i) => i.id === currentSttId);
      const newScore = currentItem?.score === clickedScore ? 0 : clickedScore;
      setSttScore(currentSttId, newScore);
    });
  });

  if (sttPreviewRating) {
    sttPreviewRating.addEventListener("mouseover", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>(".rating-star");
      if (!target) return;
      const hoverScore = Number(target.dataset.score || 0);
      sttPreviewRating.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((star) => {
        const starScore = Number(star.dataset.score || 0);
        star.classList.toggle("hovered", starScore <= hoverScore);
      });
    });

    sttPreviewRating.addEventListener("mouseleave", () => {
      sttPreviewRating.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((star) => {
        star.classList.remove("hovered");
      });
    });
  }

  sttPreviewUpvoteBtn?.addEventListener("click", () => {
    if (!currentSttId) return;
    toggleSttFavorite(currentSttId);
  });

  // STT History & Stats
  const sttHistoryCount = document.getElementById("sttHistoryCount");
  const sttHistoryList = document.getElementById("sttHistoryList");
  const clearSttHistoryBtn = document.getElementById("clearSttHistoryBtn");
  const sttStatsBadgeCount = document.getElementById("sttStatsBadgeCount");
  const sttStatsTitleIcon = document.getElementById("sttStatsTitleIcon");
  const sttZoneOptimalIcon = document.getElementById("sttZoneOptimalIcon");
  const sttZoneQualityIcon = document.getElementById("sttZoneQualityIcon");
  const sttLegendHintIcon = document.getElementById("sttLegendHintIcon");

  if (sttStatsTitleIcon) sttStatsTitleIcon.innerHTML = icon("chartBar", { size: 15 });
  if (sttZoneOptimalIcon) sttZoneOptimalIcon.innerHTML = icon("zap", { size: 12 });
  if (sttZoneQualityIcon) sttZoneQualityIcon.innerHTML = icon("trophy", { size: 12 });
  if (sttLegendHintIcon) sttLegendHintIcon.innerHTML = icon("target", { size: 11 });

  const clearSttHistoryIcon = document.getElementById("clearSttHistoryIcon");
  if (clearSttHistoryIcon) clearSttHistoryIcon.innerHTML = icon("trash", { size: 13 });

  async function loadSttHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/stt/history`);
      if (!res.ok) return;
      const history: STTHistoryItem[] = await res.json();
      sttHistoryCache = history;

      if (sttHistoryCount) sttHistoryCount.textContent = String(history.length);
      if (sttStatsBadgeCount) sttStatsBadgeCount.textContent = `${history.length} tests`;

      renderSttHistory(history);
      renderSttDecisionMatrix(history);
    } catch (err) {
      console.error("Erreur chargement historique STT:", err);
    }
  }

  function renderSttHistory(items: STTHistoryItem[]) {
    if (!sttHistoryList) return;
    if (items.length === 0) {
      sttHistoryList.innerHTML = `<p class="history-empty">Aucune transcription enregistrée pour le moment.</p>`;
      return;
    }

    sttHistoryList.innerHTML = items
      .map((item) => {
        const timeAgo = new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const scoreBadge =
          item.score && item.score > 0
            ? `<span class="history-card-rating" title="Note attribuée : ${item.score}/3">${icon("star", { size: 11, fill: "currentColor" })} <span>${item.score}/3</span></span>`
            : "";

        const favBadge = item.isFavorite
          ? `<span class="history-card-fav" title="Favori">${icon("heart", { size: 11, fill: "currentColor" })}</span>`
          : "";

        return `
          <div class="stt-history-card card-${item.engine} ${item.isFavorite ? 'is-favorite' : ''}" data-id="${item.id}">
            <div class="stt-history-header">
              <div class="stt-history-meta">
                <span class="badge engine-${item.engine}">${item.engine.toUpperCase()}</span>
                <span class="badge badge-subtle">${item.modelSize || "base"}</span>
                <span class="badge badge-subtle">${item.durationSec.toFixed(1)}s</span>
                <span class="badge badge-subtle">RTF: ${item.rtf}x</span>
                ${scoreBadge}
                ${favBadge}
              </div>
              <span class="history-time">${timeAgo}</span>
            </div>
            <p class="stt-history-text">${item.text}</p>
            <div class="stt-history-footer">
              <div class="history-card-rating-group" title="Noter la transcription (1 à 3)">
                <button type="button" class="rating-star ${item.score && item.score >= 1 ? 'active' : ''}" data-item-id="${item.id}" data-score="1" title="Note 1/3">${icon("star", { size: 12, fill: item.score && item.score >= 1 ? "currentColor" : "none" })}</button>
                <button type="button" class="rating-star ${item.score && item.score >= 2 ? 'active' : ''}" data-item-id="${item.id}" data-score="2" title="Note 2/3">${icon("star", { size: 12, fill: item.score && item.score >= 2 ? "currentColor" : "none" })}</button>
                <button type="button" class="rating-star ${item.score && item.score >= 3 ? 'active' : ''}" data-item-id="${item.id}" data-score="3" title="Note 3/3">${icon("star", { size: 12, fill: item.score && item.score >= 3 ? "currentColor" : "none" })}</button>
              </div>
              <div class="history-card-actions">
                <button type="button" class="history-action-btn stt-fav-btn ${item.isFavorite ? 'active' : ''}" data-id="${item.id}" title="${item.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${icon("heart", { size: 12, fill: item.isFavorite ? "currentColor" : "none" })}</button>
                ${
                  item.url
                    ? `<button type="button" class="history-action-btn stt-play-btn" data-id="${item.id}" data-url="${item.url}" title="Écouter l'audio source">${icon("play", { size: 12 })}</button>`
                    : ""
                }
                <button type="button" class="history-action-btn stt-copy-btn" data-text="${encodeURIComponent(item.text)}" title="Copier le texte">${icon("copy", { size: 12 })}</button>
                <button type="button" class="history-action-btn stt-delete-btn" data-id="${item.id}" title="Supprimer">${icon("trash", { size: 12 })}</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Bind Star Ratings in Cards
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".history-card-rating-group .rating-star").forEach((star) => {
      star.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = star.dataset.itemId;
        if (!id) return;
        const item = items.find((i) => i.id === id);
        if (!item) return;
        const clickedScore = Number(star.dataset.score);
        const newScore = item.score === clickedScore ? 0 : clickedScore;
        setSttScore(id, newScore);
      });
    });

    sttHistoryList.querySelectorAll<HTMLDivElement>(".history-card-rating-group").forEach((grp) => {
      grp.addEventListener("mouseover", (e) => {
        const star = (e.target as HTMLElement).closest<HTMLButtonElement>(".rating-star");
        if (!star) return;
        const hoverScore = Number(star.dataset.score || 0);
        grp.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((s) => {
          const sScore = Number(s.dataset.score || 0);
          s.classList.toggle("hovered", sScore <= hoverScore);
        });
      });
      grp.addEventListener("mouseleave", () => {
        grp.querySelectorAll<HTMLButtonElement>(".rating-star").forEach((s) => {
          s.classList.remove("hovered");
        });
      });
    });

    // Bind Favorite in Cards
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".stt-fav-btn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        if (!id) return;
        toggleSttFavorite(id);
      });
    });

    // Bind History Events
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".stt-play-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.id;
        const url = b.dataset.url;
        const item = items.find((i) => i.id === id);
        if (item) {
          currentSttId = item.id;
          lastTranscriptionText = item.text;
          if (transcriptionTextContent) {
            transcriptionTextContent.innerHTML = `<p class="transcription-text">${item.text}</p>`;
          }
          if (sttDurationBadge) sttDurationBadge.textContent = `${item.durationSec.toFixed(1)}s`;
          if (sttRtfBadge) sttRtfBadge.textContent = `RTF: ${item.rtf}x (${item.processingTimeMs}ms)`;
          if (sttFormatBadge) sttFormatBadge.textContent = `${(item.modelSize || "base").toUpperCase()} • ${(item.device || "cpu").toUpperCase()}`;
          if (sttPreviewRating) {
            sttPreviewRating.hidden = false;
            updateSttPreviewRating(item.score || 0);
          }
          if (sttPreviewUpvoteBtn) {
            sttPreviewUpvoteBtn.hidden = false;
            updateSttPreviewFavorite(Boolean(item.isFavorite));
          }
        }
        if (url && sttAudioPlayer) {
          sttAudioPlayer.src = url;
          sttAudioPlayer.play();
        }
      });
    });

    sttHistoryList.querySelectorAll<HTMLButtonElement>(".stt-copy-btn").forEach((b) => {
      b.addEventListener("click", async () => {
        const text = decodeURIComponent(b.dataset.text || "");
        await navigator.clipboard.writeText(text);
        b.innerHTML = icon("check", { size: 12 });
        setTimeout(() => {
          b.innerHTML = icon("copy", { size: 12 });
        }, 1500);
      });
    });

    sttHistoryList.querySelectorAll<HTMLButtonElement>(".stt-delete-btn").forEach((b) => {
      b.addEventListener("click", async () => {
        const id = b.dataset.id;
        if (!id) return;
        await fetch(`${API_BASE}/api/stt/history/${id}`, { method: "DELETE" });
        loadSttHistory();
      });
    });
  }

  function renderSttDecisionMatrix(items: STTHistoryItem[]) {
    const chart = document.getElementById("sttDecisionMatrixChart") as SVGSVGElement | null;
    const summaryGrid = document.getElementById("sttStatsSummaryGrid") as HTMLDivElement | null;
    if (!chart) return;

    if (summaryGrid) {
      const whisperItems = items.filter((i) => i.engine === "whisper");
      const avgRtf =
        whisperItems.length > 0
          ? (whisperItems.reduce((acc, i) => acc + i.rtf, 0) / whisperItems.length).toFixed(2)
          : "--";
      const avgTime =
        whisperItems.length > 0
          ? (whisperItems.reduce((acc, i) => acc + i.processingTimeMs, 0) / whisperItems.length).toFixed(0)
          : "--";

      const itemsWithScore = whisperItems.filter((i) => typeof i.score === "number" && i.score > 0);
      const avgScore =
        itemsWithScore.length > 0
          ? (itemsWithScore.reduce((acc, i) => acc + (i.score || 0), 0) / itemsWithScore.length).toFixed(1)
          : "--";

      summaryGrid.innerHTML = `
        <div class="stat-summary-card card-whisper">
          <div class="stat-card-title">
            <span>Whisper STT</span>
            <span class="badge badge-subtle">${whisperItems.length}</span>
          </div>
          <div class="stat-card-values">
            <span>${icon("timer", { size: 11 })} Traitement : <strong>${avgTime}ms</strong></span>
            <span>${icon("zap", { size: 11 })} Facteur RTF : <strong>${avgRtf}x</strong></span>
            <span>${icon("star", { size: 11, fill: "currentColor" })} Précision : <strong>${avgScore}${avgScore !== "--" ? "/3" : ""}</strong></span>
          </div>
        </div>
      `;
    }

    const width = 540;
    const height = 220;
    const paddingLeft = 46;
    const paddingRight = 24;
    const paddingTop = 26;
    const paddingBottom = 40;

    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    const maxDuration = Math.max(10, Math.ceil(Math.max(0, ...items.map((i) => i.durationSec)) * 1.2));
    const maxRtf = 1.0;

    const getX = (dur: number) => paddingLeft + Math.min(plotW, (dur / maxDuration) * plotW);
    const getY = (rtf: number) => paddingTop + Math.min(plotH, (rtf / maxRtf) * plotH);

    let svg = `
      <line x1="${paddingLeft}" y1="${getY(0.25)}" x2="${width - paddingRight}" y2="${getY(0.25)}" stroke="#10b981" stroke-dasharray="3,3" opacity="0.6" />
      <line x1="${paddingLeft}" y1="${getY(0.5)}" x2="${width - paddingRight}" y2="${getY(0.5)}" stroke="var(--border)" stroke-dasharray="3,3" opacity="0.5" />
      <line x1="${paddingLeft}" y1="${getY(1.0)}" x2="${width - paddingRight}" y2="${getY(1.0)}" stroke="var(--border)" stroke-width="1.2" opacity="0.9" />

      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="var(--border)" stroke-width="1.2" />

      <text x="${paddingLeft - 8}" y="${getY(0.25) + 3}" fill="#10b981" font-size="8.5" text-anchor="end" font-weight="700">0.25x</text>
      <text x="${paddingLeft - 8}" y="${getY(0.5) + 3}" fill="var(--text-muted)" font-size="8.5" text-anchor="end">0.50x</text>
      <text x="${paddingLeft - 8}" y="${getY(1.0) + 3}" fill="var(--text-muted)" font-size="8.5" text-anchor="end">1.0x</text>

      <text x="${paddingLeft}" y="${height - paddingBottom + 14}" fill="var(--text-muted)" font-size="9" text-anchor="start">0s</text>
      <text x="${paddingLeft + plotW / 2}" y="${height - paddingBottom + 14}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${(maxDuration / 2).toFixed(0)}s</text>
      <text x="${width - paddingRight}" y="${height - paddingBottom + 14}" fill="var(--text-muted)" font-size="9" text-anchor="end">${maxDuration.toFixed(0)}s</text>
      <text x="${width / 2}" y="${height - 6}" fill="var(--text-muted)" font-size="9" text-anchor="middle" font-weight="500">← Durée audio en secondes (Axe X) • RTF (Axe Y) →</text>
    `;

    items.forEach((item) => {
      const cx = getX(item.durationSec);
      const cy = getY(item.rtf);
      svg += `
        <circle
          cx="${cx}"
          cy="${cy}"
          r="5.5"
          fill="#d946ef"
          stroke="var(--surface)"
          stroke-width="1.5"
          data-id="${item.id}"
        />
      `;
    });

    chart.innerHTML = svg;
  }

  clearSttHistoryBtn?.addEventListener("click", async () => {
    if (!confirm("Voulez-vous vraiment effacer tout l'historique STT ?")) return;
    await fetch(`${API_BASE}/api/stt/history`, { method: "DELETE" });
    loadSttHistory();
  });

  // Initialisation immédiate des icônes et du chargement de l'historique STT
  updateSttPreviewRating(0);
  updateSttPreviewFavorite(false);
  loadSttHistory();
}
