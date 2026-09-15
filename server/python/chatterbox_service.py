import os
import io
import torch
import torchaudio
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from chatterbox import ChatterboxMultilingualTTS

app = FastAPI(title="Chatterbox TTS Service")

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[Chatterbox] Using device: {device}")
model = None

REFERENCES_DIR = os.path.join(os.path.dirname(__file__), "references")
os.makedirs(REFERENCES_DIR, exist_ok=True)

models = {}

def get_model(target_device_str: str = "cuda"):
    global models
    # Fallback to cpu if cuda is requested but not available
    if target_device_str == "cuda" and not torch.cuda.is_available():
        target_device_str = "cpu"
    
    if target_device_str not in models or models[target_device_str] is None:
        print(f"[Chatterbox] Loading ChatterboxMultilingualTTS on device: '{target_device_str}'...")
        dev = torch.device(target_device_str)
        models[target_device_str] = ChatterboxMultilingualTTS.from_pretrained(device=dev)
        print(f"[Chatterbox] Model on '{target_device_str}' loaded successfully!")
    return models[target_device_str]

class TTSRequest(BaseModel):
    text: str
    language: str = "fr"
    reference_name: str | None = None
    device: str = "cuda" # "cuda" ou "cpu"
    exaggeration: float = 0.5
    temperature: float = 0.8
    repetition_penalty: float = 2.0

import threading
import time

def load_model_background():
    try:
        dev_str = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[Chatterbox Service] Preloading model on {dev_str} in background...")
        get_model(dev_str)
        print("[Chatterbox Service] Model preloaded and ready!")
    except Exception as e:
        print(f"[Chatterbox Service] Warning during model preload: {e}")

@app.on_event("startup")
def on_startup():
    threading.Thread(target=load_model_background, daemon=True).start()

@app.get("/health")
def health():
    return {
        "status": "ok",
        "device": str(device),
        "cuda_available": torch.cuda.is_available(),
        "loaded_devices": list(models.keys()),
        "model_loaded": len(models) > 0
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5002)
