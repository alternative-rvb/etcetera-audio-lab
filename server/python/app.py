import os
import time
import tempfile
import threading
import warnings
from contextlib import asynccontextmanager

# Silence les warnings externes (HF Hub, Diffusers, PyTorch deprecations) pour un terminal propre
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Optimisation des threads OpenMP / MKL pour PyTorch CPU
if "OMP_NUM_THREADS" not in os.environ:
    os.environ["OMP_NUM_THREADS"] = str(min(8, os.cpu_count() or 4))
if "MKL_NUM_THREADS" not in os.environ:
    os.environ["MKL_NUM_THREADS"] = str(min(8, os.cpu_count() or 4))

import torch
torch.set_num_threads(min(8, os.cpu_count() or 4))
if hasattr(torch, "set_float32_matmul_precision"):
    torch.set_float32_matmul_precision("high")

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel

from tts.chatterbox import (
    get_model,
    list_references,
    synthesize,
    get_loaded_devices as get_loaded_tts_devices,
    is_loaded as is_tts_loaded
)
from stt.whisper import (
    get_whisper_model,
    transcribe as transcribe_audio_file,
    get_loaded_models as get_loaded_whisper_models,
    is_loaded as is_whisper_loaded
)

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=load_model_background, daemon=True).start()
    yield

app = FastAPI(title="TTS & STT AI Micro-Service", lifespan=lifespan)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[AI Service] Ready on: {device}")

class TTSRequest(BaseModel):
    text: str
    language: str = "fr"
    reference_name: str | None = None
    device: str = "cpu"
    exaggeration: float = 0.5
    temperature: float = 0.8
    repetition_penalty: float = 2.0

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(device),
        "cuda_available": torch.cuda.is_available(),
        "loaded_tts_devices": get_loaded_tts_devices(),
        "loaded_whisper_models": get_loaded_whisper_models(),
        "tts_loaded": is_tts_loaded(),
        "whisper_loaded": is_whisper_loaded()
    }

@app.get("/references")
def get_references():
    return list_references()

@app.post("/tts")
def generate_tts(req: TTSRequest):
    try:
        wav_bytes = synthesize(
            text=req.text,
            language=req.language,
            reference_name=req.reference_name,
            device=req.device,
            exaggeration=req.exaggeration,
            temperature=req.temperature,
            repetition_penalty=req.repetition_penalty
        )
        return Response(content=wav_bytes, media_type="audio/wav")
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
    try:
        suffix = os.path.splitext(file.filename or ".wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            result = transcribe_audio_file(
                audio_path=tmp_path,
                model_size=model_size,
                language=language,
                device=device,
                beam_size=beam_size,
                word_timestamps=word_timestamps
            )
            return result
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except Exception as e:
        print(f"[Whisper STT] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5002)
