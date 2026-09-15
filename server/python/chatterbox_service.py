import os
import io
import time
import tempfile
import threading
import warnings
from contextlib import asynccontextmanager

# Silence les warnings externes (HF Hub, Diffusers, PyTorch deprecations) pour garder un terminal propre
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
import torchaudio
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from chatterbox import ChatterboxMultilingualTTS
from faster_whisper import WhisperModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=load_model_background, daemon=True).start()
    yield

app = FastAPI(title="TTS & STT AI Micro-Service", lifespan=lifespan)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[AI Service] Ready on: {device}")

REFERENCES_DIR = os.path.join(os.path.dirname(__file__), "references")
os.makedirs(REFERENCES_DIR, exist_ok=True)

models = {}
whisper_models = {}

def get_model(target_device_str: str = "cpu"):
    global models
    if target_device_str == "cuda" and not torch.cuda.is_available():
        target_device_str = "cpu"
    
    if target_device_str not in models or models[target_device_str] is None:
        print(f"[Chatterbox] Loading ChatterboxMultilingualTTS on device: '{target_device_str}'...")
        dev = torch.device(target_device_str)
        models[target_device_str] = ChatterboxMultilingualTTS.from_pretrained(device=dev)
        print(f"[Chatterbox] Model on '{target_device_str}' loaded successfully!")
    return models[target_device_str]

def get_whisper_model(model_size: str = "base", target_device_str: str = "cpu"):
    global whisper_models
    if target_device_str == "cuda" and not torch.cuda.is_available():
        target_device_str = "cpu"
    
    key = f"{model_size}_{target_device_str}"
    if key not in whisper_models or whisper_models[key] is None:
        compute_type = "float16" if target_device_str == "cuda" else "int8"
        print(f"[Whisper] Loading Whisper '{model_size}' on '{target_device_str}' ({compute_type})...")
        whisper_models[key] = WhisperModel(model_size, device=target_device_str, compute_type=compute_type)
        print(f"[Whisper] Model '{key}' loaded successfully!")
    return whisper_models[key]

class TTSRequest(BaseModel):
    text: str
    language: str = "fr"
    reference_name: str | None = None
    device: str = "cpu"
    exaggeration: float = 0.5
    temperature: float = 0.8
    repetition_penalty: float = 2.0

def load_model_background():
    try:
        time.sleep(1.0)
        dev_str = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[AI Service] Preloading Chatterbox & Whisper on {dev_str} in background...")
        get_model(dev_str)
        print("[AI Service] Chatterbox ready!")
        get_whisper_model("base", dev_str)
        print("[AI Service] Whisper ready!")
    except Exception as e:
        print(f"[AI Service] Warning during background preload: {e}")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(device),
        "cuda_available": torch.cuda.is_available(),
        "loaded_tts_devices": list(models.keys()),
        "loaded_whisper_models": list(whisper_models.keys()),
        "tts_loaded": len(models) > 0,
        "whisper_loaded": len(whisper_models) > 0
    }

@app.get("/references")
def list_references():
    files = []
    if os.path.exists(REFERENCES_DIR):
        for f in os.listdir(REFERENCES_DIR):
            if f.endswith(".wav") or f.endswith(".mp3"):
                name = os.path.splitext(f)[0].replace("_", " ").title()
                files.append({
                    "id": f,
                    "name": name,
                    "path": os.path.join(REFERENCES_DIR, f)
                })
    return files

# Optimisation des threads OpenMP / MKL pour PyTorch CPU
if "OMP_NUM_THREADS" not in os.environ:
    os.environ["OMP_NUM_THREADS"] = str(min(8, os.cpu_count() or 4))
if "MKL_NUM_THREADS" not in os.environ:
    os.environ["MKL_NUM_THREADS"] = str(min(8, os.cpu_count() or 4))

torch.set_num_threads(min(8, os.cpu_count() or 4))
if hasattr(torch, "set_float32_matmul_precision"):
    torch.set_float32_matmul_precision("high")

@app.post("/tts")
def generate_tts(req: TTSRequest):
    try:
        req_dev = req.device.lower().strip() if req.device else "cuda"
        m = get_model(req_dev)
        ref_path = None
        if req.reference_name:
            candidate = os.path.join(REFERENCES_DIR, req.reference_name)
            if os.path.exists(candidate):
                ref_path = candidate
            elif os.path.exists(req.reference_name):
                ref_path = req.reference_name

        with torch.inference_mode():
            wav = m.generate(
                text=req.text,
                language_id=req.language or "fr",
                audio_prompt_path=ref_path,
                exaggeration=req.exaggeration,
                temperature=req.temperature,
                repetition_penalty=req.repetition_penalty
            )

        buffer = io.BytesIO()
        if hasattr(wav, "dim") and wav.dim() == 1:
            wav = wav.unsqueeze(0)
        
        torchaudio.save(buffer, wav.cpu(), sample_rate=24000, format="wav")
        buffer.seek(0)

        return Response(content=buffer.read(), media_type="audio/wav")
    except Exception as e:
        print(f"[Chatterbox] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stt/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: str = Form("fr"),
    device: str = Form("cuda"),
    beam_size: int = Form(5),
    word_timestamps: bool = Form(True)
):
    start_time = time.time()
    try:
        whisper_m = get_whisper_model(model_size, device)
        
        # Écriture temporaire du flux audio entrant
        suffix = os.path.splitext(file.filename or ".wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            lang_param = None if language == "auto" or not language else language
            segments_gen, info = whisper_m.transcribe(
                tmp_path,
                language=lang_param,
                beam_size=beam_size,
                word_timestamps=word_timestamps
            )
            
            segments = []
            full_text_list = []
            
            for seg in segments_gen:
                seg_dict = {
                    "id": seg.id,
                    "seek": seg.seek,
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": seg.text.strip(),
                    "avg_logprob": round(seg.avg_logprob, 3),
                    "no_speech_prob": round(seg.no_speech_prob, 3)
                }
                if word_timestamps and seg.words:
                    seg_dict["words"] = [
                        {
                            "word": w.word,
                            "start": round(w.start, 2),
                            "end": round(w.end, 2),
                            "probability": round(w.probability, 3)
                        }
                        for w in seg.words
                    ]
                segments.append(seg_dict)
                full_text_list.append(seg.text.strip())

            processing_time_sec = time.time() - start_time
            audio_duration = getattr(info, "duration", 0.0) or 1.0
            rtf = round(processing_time_sec / audio_duration, 3) if audio_duration > 0 else 0.0

            return {
                "text": " ".join(full_text_list),
                "language": info.language,
                "language_probability": round(info.language_probability, 3),
                "duration": round(audio_duration, 2),
                "processing_time_ms": round(processing_time_sec * 1000),
                "rtf": rtf,
                "model_size": model_size,
                "device": device,
                "segments": segments
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except Exception as e:
        print(f"[Whisper STT] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5002)
