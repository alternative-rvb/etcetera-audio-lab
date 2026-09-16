import { icon } from "../shared/icons.js";

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
  let liveSpeechRecognition: any = null;
  let liveSpeechTranscript: string = "";

  if (micRecordBtnIcon) micRecordBtnIcon.innerHTML = icon("mic", { size: 15 });

  function drawMicVisualizer() {
    if (!micCanvas || !micAnalyser) return;
    const ctx = micCanvas.getContext("2d");
    if (!ctx) return;

    const width = (micCanvas.width = micCanvas.offsetWidth);
    const height = (micCanvas.height = micCanvas.offsetHeight);

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
      liveSpeechTranscript = "";

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

        // Déclenchement automatique de la transcription dès la fin de l'enregistrement micro
        handleTranscribe();
      };

      mediaRecorder.start();
      isRecording = true;
      recordStartTime = Date.now();

      if (transcriptionTextContent && activeSttEngine !== "webspeech") {
        transcriptionTextContent.innerHTML = `<p class="transcription-placeholder"><span class="recording-pulse-dot"></span> Écoute en cours... Parlez dans votre micro, la transcription ${activeSttEngine.toUpperCase()} sera générée automatiquement dès l'arrêt.</p>`;
      }

      // Reconnaissance vocale temps réel Web Speech API si active
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (activeSttEngine === "webspeech" && SpeechRec) {
        try {
          liveSpeechRecognition = new SpeechRec();
          liveSpeechRecognition.continuous = true;
          liveSpeechRecognition.interimResults = true;
          liveSpeechRecognition.lang =
            (document.getElementById("webspeechLanguage") as HTMLSelectElement)?.value || "fr-FR";

          liveSpeechRecognition.onresult = (event: any) => {
            let interim = "";
            let final = "";
            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            liveSpeechTranscript = (final + " " + interim).trim();
            if (transcriptionTextContent && liveSpeechTranscript) {
              transcriptionTextContent.innerHTML = `<p class="transcription-text">${liveSpeechTranscript}</p>`;
            }
          };

          liveSpeechRecognition.start();
        } catch (recErr) {
          console.warn("Web Speech API non disponible ou erreur :", recErr);
        }
      }

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

      if (liveSpeechRecognition) {
        try {
          liveSpeechRecognition.stop();
        } catch {}
      }

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

  // Dropzone STT
  const sttDropzone = document.getElementById("sttDropzone") as HTMLDivElement | null;
  const sttAudioFileInput = document.getElementById("sttAudioFileInput") as HTMLInputElement | null;
  const sttDropzoneIcon = document.getElementById("sttDropzoneIcon");
  const selectedFileInfo = document.getElementById("selectedFileInfo") as HTMLDivElement | null;
  const selectedFileName = document.getElementById("selectedFileName") as HTMLSpanElement | null;
  const removeSelectedFileBtn = document.getElementById("removeSelectedFileBtn") as HTMLButtonElement | null;

  if (sttDropzoneIcon) sttDropzoneIcon.innerHTML = icon("upload", { size: 28 });

  sttDropzone?.addEventListener("click", () => {
    sttAudioFileInput?.click();
  });

  sttDropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    sttDropzone.classList.add("drag-over");
  });

  sttDropzone?.addEventListener("dragleave", () => {
    sttDropzone.classList.remove("drag-over");
  });

  sttDropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    sttDropzone.classList.remove("drag-over");
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  sttAudioFileInput?.addEventListener("change", (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
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

  removeSelectedFileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    activeAudioBlob = null;
    activeAudioFilename = "";
    if (selectedFileInfo) selectedFileInfo.hidden = true;
    if (sttAudioFileInput) sttAudioFileInput.value = "";
    if (sttAudioPlayer) {
      sttAudioPlayer.src = "";
    }
  });

  // Demo Samples
  const demoSampleFemale = document.getElementById("demoSampleFemale");
  const demoSampleMale = document.getElementById("demoSampleMale");

  async function loadDemoSample(type: "female" | "male") {
    try {
      const filename = type === "female" ? "sample_female_fr.wav" : "sample_male_fr.wav";
      const res = await fetch(`/samples/${filename}`);
      if (!res.ok) throw new Error("Échantillon audio introuvable");
      const blob = await res.blob();
      activeAudioBlob = blob;
      activeAudioFilename = filename;
      loadAudioIntoSttPlayer(blob);

      if (transcriptionTextContent) {
        transcriptionTextContent.innerHTML = `<p class="transcription-placeholder">Échantillon ${type === "female" ? "féminin" : "masculin"} chargé. Cliquez sur "Lancer la transcription" pour analyser.</p>`;
      }
    } catch (err: any) {
      alert(`Impossible de charger l'échantillon : ${err.message}`);
    }
  }

  demoSampleFemale?.addEventListener("click", () => loadDemoSample("female"));
  demoSampleMale?.addEventListener("click", () => loadDemoSample("male"));

  // Player & Visualizer
  const sttAudioPlayer = document.getElementById("sttAudioPlayer") as HTMLAudioElement | null;
  const sttVisualizerStatus = document.getElementById("sttVisualizerStatus");
  const sttAudioVisualizer = document.getElementById("sttAudioVisualizer") as HTMLCanvasElement | null;
  const sttFormatBadge = document.getElementById("sttFormatBadge");
  const sttEngineBadge = document.getElementById("sttEngineBadge");
  const sttDurationBadge = document.getElementById("sttDurationBadge");
  const sttRtfBadge = document.getElementById("sttRtfBadge");
  const sttVisualizerIcon = document.getElementById("sttVisualizerIcon");
  const sttPreviewDeckIcon = document.getElementById("sttPreviewDeckIcon");

  if (sttVisualizerIcon) sttVisualizerIcon.innerHTML = icon("activity", { size: 12 });
  if (sttPreviewDeckIcon) sttPreviewDeckIcon.innerHTML = icon("volume", { size: 13 });

  function loadAudioIntoSttPlayer(blob: Blob) {
    if (!sttAudioPlayer) return;
    const url = URL.createObjectURL(blob);
    sttAudioPlayer.src = url;
    if (sttVisualizerStatus) sttVisualizerStatus.textContent = "Prêt à transcrire";
  }

  // STT Engine Selector
  const sttEngineSwitch = document.getElementById("sttEngineSwitch") as HTMLDivElement | null;
  const sttWebSpeechOptions = document.getElementById("sttWebSpeechOptions") as HTMLDivElement | null;
  const sttWhisperOptions = document.getElementById("sttWhisperOptions") as HTMLDivElement | null;
  const sttSherpaOptions = document.getElementById("sttSherpaOptions") as HTMLDivElement | null;
  const sttWhisperBtnIcon = document.getElementById("sttWhisperBtnIcon");
  const sttWebSpeechBtnIcon = document.getElementById("sttWebSpeechBtnIcon");
  const sttSherpaBtnIcon = document.getElementById("sttSherpaBtnIcon");

  if (sttWebSpeechBtnIcon) sttWebSpeechBtnIcon.innerHTML = icon("globe", { size: 14 });
  if (sttWhisperBtnIcon) sttWhisperBtnIcon.innerHTML = icon("cpu", { size: 14 });
  if (sttSherpaBtnIcon) sttSherpaBtnIcon.innerHTML = icon("zap", { size: 14 });

  let activeSttEngine: "whisper" | "webspeech" | "sherpa" = "webspeech";

  sttEngineSwitch?.querySelectorAll<HTMLButtonElement>(".engine-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sttEngineSwitch.querySelectorAll(".engine-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      activeSttEngine = (btn.dataset.sttEngine as "whisper" | "webspeech" | "sherpa") || "webspeech";
      if (sttWebSpeechOptions) {
        sttWebSpeechOptions.hidden = activeSttEngine !== "webspeech";
      }
      if (sttWhisperOptions) {
        sttWhisperOptions.hidden = activeSttEngine !== "whisper";
      }
      if (sttSherpaOptions) {
        sttSherpaOptions.hidden = activeSttEngine !== "sherpa";
      }
      if (sttEngineBadge) {
        sttEngineBadge.className = `badge engine-${activeSttEngine}`;
        sttEngineBadge.textContent =
          activeSttEngine === "webspeech"
            ? "Web Speech"
            : activeSttEngine === "whisper"
            ? "Whisper"
            : "Sherpa";
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

    if (isRecording) {
      stopRecording();
      await new Promise((r) => setTimeout(r, 200));
    }

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

    const sherpaModel = (document.getElementById("sherpaModel") as HTMLSelectElement)?.value || "tiny";
    const sherpaDevice = (document.getElementById("sherpaDevice") as HTMLSelectElement)?.value || "cpu";

    const modelSize = activeSttEngine === "sherpa" ? sherpaModel : whisperModelSize;
    const device = activeSttEngine === "sherpa" ? sherpaDevice : whisperDevice;

    try {
      const formData = new FormData();
      formData.append("file", activeAudioBlob, activeAudioFilename || "audio.wav");
      formData.append("engine", activeSttEngine);
      formData.append("modelSize", modelSize);
      formData.append("device", device);
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
    sttPreviewUpvoteBtn.classList.toggle("is-favorite", isFav);
    sttPreviewUpvoteBtn.classList.toggle("active", isFav);
    sttPreviewUpvoteBtn.innerHTML = `${icon("star", {
      size: 13,
      fill: isFav ? "currentColor" : "none",
    })} <span>Favori</span>`;
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

  let allSttExpanded = false;
  const toggleAllSttHistoryBtn = document.getElementById("toggleAllSttHistoryBtn") as HTMLButtonElement | null;
  const toggleAllSttHistoryIcon = document.getElementById("toggleAllSttHistoryIcon");
  if (toggleAllSttHistoryIcon) toggleAllSttHistoryIcon.innerHTML = icon("chevrons-up-down", { size: 13 });

  toggleAllSttHistoryBtn?.addEventListener("click", () => {
    allSttExpanded = !allSttExpanded;
    const detailsList = Array.from(sttHistoryList?.querySelectorAll<HTMLDetailsElement>("details.history-item-dropdown") || []);
    detailsList.forEach((d) => {
      d.open = allSttExpanded;
    });
    if (toggleAllSttHistoryBtn) {
      toggleAllSttHistoryBtn.innerHTML = `${icon("chevrons-up-down", { size: 13 })} <span>${allSttExpanded ? "Tout replier" : "Tout déplier"}</span>`;
    }
  });

  const clearSttHistoryIcon = document.getElementById("clearSttHistoryIcon");
  if (clearSttHistoryIcon) clearSttHistoryIcon.innerHTML = icon("trash", { size: 13 });

  const sttSettingsIcon = document.getElementById("sttSettingsIcon");
  if (sttSettingsIcon) sttSettingsIcon.innerHTML = icon("sliders", { size: 14 });

  const sttSettingsChevron = document.getElementById("sttSettingsChevron");
  if (sttSettingsChevron) sttSettingsChevron.innerHTML = icon("chevronRight", { size: 13 });

  let sttHistoryFilter: "all" | "webspeech" | "whisper" | "sherpa" | "favorites" = "all";
  const sttHistoryFilterButtons = document.getElementById("sttHistoryFilterButtons");

  sttHistoryFilterButtons?.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sttHistoryFilterButtons.querySelectorAll<HTMLButtonElement>(".filter-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      sttHistoryFilter = (btn.dataset.filter as any) || "all";
      applySttHistoryFilter();
    });
  });

  function applySttHistoryFilter() {
    const filtered = sttHistoryCache.filter((item) => {
      if (sttHistoryFilter === "all") return true;
      if (sttHistoryFilter === "favorites") return !!item.isFavorite;
      return item.engine === sttHistoryFilter;
    });
    renderSttHistory(filtered);
  }

  async function loadSttHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/stt/history`);
      if (!res.ok) return;
      const history: STTHistoryItem[] = await res.json();
      sttHistoryCache = history;

      if (sttHistoryCount) sttHistoryCount.textContent = String(history.length);
      if (sttStatsBadgeCount) sttStatsBadgeCount.textContent = `${history.length} tests`;

      applySttHistoryFilter();
      renderSttDecisionMatrix(history);
    } catch (err) {
      console.error("Erreur chargement historique STT:", err);
    }
  }

  function renderSttHistory(items: STTHistoryItem[]) {
    if (!sttHistoryList) return;
    if (items.length === 0) {
      sttHistoryList.innerHTML = `<p class="history-empty">${sttHistoryFilter === "favorites" ? "Aucune transcription marquée en favori pour le moment." : sttHistoryCache.length === 0 ? "Aucune transcription enregistrée pour le moment." : "Aucune transcription pour ce filtre."}</p>`;
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
          ? `<span class="history-card-fav" title="Favori">${icon("star", { size: 11, fill: "currentColor" })}</span>`
          : "";

        const favClass = item.isFavorite ? "is-favorite" : "";
        const starFavIcon = icon("star", { size: 13, fill: item.isFavorite ? "currentColor" : "none" });

        return `
          <details class="history-item-dropdown card-${item.engine} ${favClass}" data-id="${item.id}" ${allSttExpanded ? "open" : ""}>
            <summary class="history-summary">
              <span class="dropdown-chevron">${icon("chevron-right", { size: 13 })}</span>
              <div class="history-summary-badges">
                <span class="card-badge engine-${item.engine}">
                  ${item.engine.toUpperCase()}
                </span>
                <span class="card-badge">${item.modelSize || "base"}</span>
                <span class="card-badge">${item.durationSec.toFixed(1)}s</span>
                <span class="card-badge history-card-gentime">RTF: ${item.rtf}x</span>
                ${scoreBadge}
                ${favBadge}
                <span class="history-card-time">${timeAgo}</span>
              </div>
              <span class="history-summary-text" title="${item.text}">${item.text}</span>
              <div class="history-card-actions">
                <div class="history-card-stars-action history-card-rating-group" title="Noter la transcription (1 à 3)">
                  <button type="button" class="rating-star ${item.score && item.score >= 1 ? 'active' : ''}" data-item-id="${item.id}" data-score="1" title="Note 1/3">${icon("star", { size: 12, fill: item.score && item.score >= 1 ? "currentColor" : "none" })}</button>
                  <button type="button" class="rating-star ${item.score && item.score >= 2 ? 'active' : ''}" data-item-id="${item.id}" data-score="2" title="Note 2/3">${icon("star", { size: 12, fill: item.score && item.score >= 2 ? "currentColor" : "none" })}</button>
                  <button type="button" class="rating-star ${item.score && item.score >= 3 ? 'active' : ''}" data-item-id="${item.id}" data-score="3" title="Note 3/3">${icon("star", { size: 12, fill: item.score && item.score >= 3 ? "currentColor" : "none" })}</button>
                </div>
                ${
                  item.url
                    ? `<button type="button" class="card-play-btn history-action-btn stt-play-btn" data-id="${item.id}" data-url="${item.url}" title="Écouter l'audio source">${icon("play", { size: 13 })}</button>`
                    : ""
                }
                <button type="button" class="upvote-btn item-upvote-btn history-action-btn stt-fav-btn ${favClass}" data-id="${item.id}" title="${item.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${starFavIcon}</button>
                <button type="button" class="card-delete-btn history-action-btn stt-delete-btn" data-id="${item.id}" title="Supprimer">${icon("trash", { size: 13 })}</button>
              </div>
            </summary>

            <div class="history-details-body">
              <p class="history-card-text" title="${item.text}">${item.text}</p>

              <div class="history-card-path">
                <span class="history-path-text">${item.filePath || item.url || (item.fileName ? 'Fichier: ' + item.fileName : 'Enregistrement direct micro')}</span>
                <button type="button" class="copy-btn copy-stt-text-btn" data-text="${encodeURIComponent(item.text)}">${icon("copy", { size: 12 })} <span>Copier texte</span></button>
              </div>

              <div class="history-card-footer">
                ${item.url ? `<audio controls src="${item.url}" preload="none"></audio>` : `<span style="font-size:0.75rem;color:var(--text-muted)">Audio source micro</span>`}
                <button type="button" class="use-text-btn use-stt-text-btn" data-text="${encodeURIComponent(item.text)}" title="Placer ce texte dans l'éditeur TTS">${icon("rotate-ccw", { size: 12 })} <span>Utiliser dans TTS</span></button>
              </div>
            </div>
          </details>
        `;
      })
      .join("");

    // Bind Star Ratings in Cards
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".history-card-rating-group .rating-star").forEach((star) => {
      star.addEventListener("click", (e) => {
        e.preventDefault();
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
        e.preventDefault();
        e.stopPropagation();
        const id = b.dataset.id;
        if (!id) return;
        toggleSttFavorite(id);
      });
    });

    // Bind History Play Buttons
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".stt-play-btn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
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

    // Bind Copy Buttons inside dropdown
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".copy-stt-text-btn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = decodeURIComponent(b.dataset.text || "");
        await navigator.clipboard.writeText(text);
        const originalHtml = b.innerHTML;
        b.innerHTML = `${icon("check", { size: 12 })} <span>Copié !</span>`;
        setTimeout(() => {
          b.innerHTML = originalHtml;
        }, 1500);
      });
    });

    // Bind Use Text in TTS
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".use-stt-text-btn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = decodeURIComponent(b.dataset.text || "");
        const ttsTextEl = document.getElementById("text") as HTMLTextAreaElement | null;
        if (ttsTextEl) {
          ttsTextEl.value = text;
          ttsTextEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const tabNavTts = document.getElementById("tabNavTts");
        if (tabNavTts) {
          tabNavTts.click();
        }
      });
    });

    // Bind Delete Buttons
    sttHistoryList.querySelectorAll<HTMLButtonElement>(".stt-delete-btn").forEach((b) => {
      b.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
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
    const chartTooltip = document.getElementById("sttChartTooltip") as HTMLElement | null;
    if (!chart) return;

    if (summaryGrid) {
      const sttEngines: Array<{ id: "webspeech" | "whisper" | "sherpa"; label: string; cardClass: string }> = [
        { id: "webspeech", label: "Web Speech", cardClass: "card-webspeech" },
        { id: "whisper", label: "Whisper", cardClass: "card-whisper" },
        { id: "sherpa", label: "Sherpa-ONNX", cardClass: "card-sherpa" },
      ];

      const summaryHtml = sttEngines
        .map(({ id, label, cardClass }) => {
          const engItems = items.filter((i) => i.engine === id);
          const count = engItems.length;
          const avgTime =
            count > 0
              ? (engItems.reduce((acc, i) => acc + (i.processingTimeMs || 0), 0) / (count * 1000)).toFixed(2)
              : "--";
          const scoredItems = engItems.filter((i) => typeof i.score === "number" && i.score > 0);
          const avgScore =
            scoredItems.length > 0
              ? (scoredItems.reduce((acc, i) => acc + (i.score || 0), 0) / scoredItems.length).toFixed(1)
              : "--";

          return `
            <div class="stat-summary-card ${cardClass}">
              <div class="stat-card-title">
                <span>${label}</span>
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

      summaryGrid.innerHTML = summaryHtml;
    }

    const width = 540;
    const height = 220;
    const paddingLeft = 46;
    const paddingRight = 24;
    const paddingTop = 26;
    const paddingBottom = 40;

    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    const times = items.map((i) => (i.processingTimeMs ? i.processingTimeMs / 1000 : 0.3));
    const maxTime = Math.max(2.5, Math.ceil(Math.max(0, ...times) * 1.15));

    const getX = (tSec: number) => paddingLeft + Math.min(plotW, (tSec / maxTime) * plotW);
    const getY = (score: number = 0) => {
      const normalized = score / 3;
      return paddingTop + (1 - normalized) * plotH;
    };

    const sttEngineColors: Record<string, string> = {
      webspeech: "#0d9488",
      whisper: "#2563eb",
      sherpa: "#ea580c",
    };

    const optimalThresholdSec = Math.min(1.0, maxTime * 0.4);
    const optimalW = Math.max(70, getX(optimalThresholdSec) - paddingLeft);
    const qualityW = Math.max(60, width - paddingRight - (paddingLeft + optimalW));
    const zoneTopY = Math.max(8, paddingTop - 8);
    const optimalH = getY(2) - zoneTopY + 12;
    const qualityH = getY(3) - zoneTopY + 20;

    let svgContent = `
      <defs>
        <linearGradient id="sttOptimalGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.04" />
        </linearGradient>
        <linearGradient id="sttQualityGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2563eb" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#2563eb" stop-opacity="0.03" />
        </linearGradient>
      </defs>

      <!-- Zone 1 : Idéal Prod (Temps rapide <= ${optimalThresholdSec.toFixed(1)}s & Note >= 2/3) -->
      <rect x="${paddingLeft}" y="${zoneTopY}" width="${optimalW}" height="${optimalH}" fill="url(#sttOptimalGrad)" stroke="rgba(16, 185, 129, 0.45)" stroke-width="1" stroke-dasharray="3,3" rx="5" />

      <!-- Zone 2 : Précision Maximale (Note 3/3) -->
      <rect x="${paddingLeft + optimalW}" y="${zoneTopY}" width="${qualityW}" height="${qualityH}" fill="url(#sttQualityGrad)" stroke="rgba(37, 99, 235, 0.35)" stroke-width="1" stroke-dasharray="3,3" rx="5" />

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
      <text x="${width / 2}" y="${height - 6}" fill="var(--text-muted)" font-size="9" text-anchor="middle" font-weight="500">← Vitesse (Temps de traitement en secondes) →</text>
    `;

    items.forEach((item, index) => {
      const tSec = item.processingTimeMs ? item.processingTimeMs / 1000 : 0.3;
      const score = item.score ?? 0;
      const cx = getX(tSec);
      const cy = getY(score);
      const color = sttEngineColors[item.engine] || "var(--accent)";

      const jitterX = Math.sin(index * 7) * 4;
      const jitterY = Math.cos(index * 5) * 3;

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
          data-engine="${item.engine.toUpperCase()}"
          data-model="${item.modelSize || 'base'}"
          data-time="${tSec.toFixed(2)}s"
          data-rtf="${item.rtf}x"
          data-score="${score > 0 ? score + '/3' : 'Non noté'}"
          data-text="${safeText}..."
        />
      `;
    });

    chart.innerHTML = svgContent;

    const nodes = Array.from(chart.querySelectorAll<SVGCircleElement>(".chart-node"));
    nodes.forEach((node) => {
      node.addEventListener("mouseenter", () => {
        if (!chartTooltip) return;
        const rect = chart.getBoundingClientRect();
        const nodeX = (node.cx.baseVal.value / width) * rect.width;
        const nodeY = (node.cy.baseVal.value / height) * rect.height;

        chartTooltip.innerHTML = `
          <div style="font-weight:600;margin-bottom:2px">${node.dataset.engine} • ${node.dataset.model}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
            <span style="display:inline-flex;align-items:center;gap:3px">${icon("timer", { size: 11 })} ${node.dataset.time} (RTF: ${node.dataset.rtf})</span>
            <span style="display:inline-flex;align-items:center;gap:3px">${icon("star", { size: 11, fill: "currentColor" })} ${node.dataset.score}</span>
          </div>
          <div style="font-style:italic;opacity:0.75;font-size:0.68rem">${node.dataset.text}</div>
          <div style="display:inline-flex;align-items:center;gap:3px;margin-top:3px;font-size:0.65rem;color:var(--accent)">${icon("play", { size: 10, fill: "currentColor" })} Cliquer pour charger l'audio</div>
        `;
        chartTooltip.style.left = `${nodeX}px`;
        chartTooltip.style.top = `${nodeY}px`;
        chartTooltip.hidden = false;
      });

      node.addEventListener("mouseleave", () => {
        if (chartTooltip) chartTooltip.hidden = true;
      });

      node.addEventListener("click", () => {
        const id = node.dataset.itemId;
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
          if (item.url && sttAudioPlayer) {
            sttAudioPlayer.src = item.url;
            sttAudioPlayer.play();
          }
        }
      });
    });
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
