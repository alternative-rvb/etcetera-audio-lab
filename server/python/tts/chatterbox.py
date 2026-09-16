import os
import io
import torch
import torchaudio
from chatterbox import ChatterboxMultilingualTTS

REFERENCES_DIR = os.path.join(os.path.dirname(__file__), "references")
LEGACY_REFERENCES_DIR = os.path.join(os.path.dirname(__file__), "..", "references")
os.makedirs(REFERENCES_DIR, exist_ok=True)

models = {}

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

def list_references():
    files = []
    search_dirs = [REFERENCES_DIR]
    if os.path.exists(LEGACY_REFERENCES_DIR) and LEGACY_REFERENCES_DIR != REFERENCES_DIR:
        search_dirs.append(LEGACY_REFERENCES_DIR)

    seen = set()
    for d in search_dirs:
        if os.path.exists(d):
            for f in os.listdir(d):
                if (f.endswith(".wav") or f.endswith(".mp3")) and f not in seen:
                    seen.add(f)
                    name = os.path.splitext(f)[0].replace("_", " ").title()
                    files.append({
                        "id": f,
                        "name": name,
                        "path": os.path.join(d, f)
                    })
    return files

def get_loaded_devices():
    return list(models.keys())

def is_loaded():
    return len(models) > 0

def synthesize(
    text: str,
    language: str = "fr",
    reference_name: str | None = None,
    device: str = "cuda",
    exaggeration: float = 0.5,
    temperature: float = 0.8,
    repetition_penalty: float = 2.0
) -> bytes:
    req_dev = device.lower().strip() if device else "cuda"
    m = get_model(req_dev)
    ref_path = None
    if reference_name:
        candidate = os.path.join(REFERENCES_DIR, reference_name)
        legacy_candidate = os.path.join(LEGACY_REFERENCES_DIR, reference_name)
        if os.path.exists(candidate):
            ref_path = candidate
        elif os.path.exists(legacy_candidate):
            ref_path = legacy_candidate
        elif os.path.exists(reference_name):
            ref_path = reference_name

    with torch.inference_mode():
        wav = m.generate(
            text=text,
            language_id=language or "fr",
            audio_prompt_path=ref_path,
            exaggeration=exaggeration,
            temperature=temperature,
            repetition_penalty=repetition_penalty
        )

    buffer = io.BytesIO()
    if hasattr(wav, "dim") and wav.dim() == 1:
        wav = wav.unsqueeze(0)
    
    torchaudio.save(buffer, wav.cpu(), sample_rate=24000, format="wav")
    buffer.seek(0)
    return buffer.read()
