import os
import time
from faster_whisper import WhisperModel

whisper_models = {}

def get_whisper_model(model_size: str = "base", target_device_str: str = "cpu"):
    global whisper_models
    if target_device_str == "cuda":
        import torch
        if not torch.cuda.is_available():
            target_device_str = "cpu"
    
    key = f"{model_size}_{target_device_str}"
    if key not in whisper_models or whisper_models[key] is None:
        compute_type = "float16" if target_device_str == "cuda" else "int8"
        print(f"[Whisper] Loading Whisper '{model_size}' on '{target_device_str}' ({compute_type})...")
        whisper_models[key] = WhisperModel(model_size, device=target_device_str, compute_type=compute_type)
        print(f"[Whisper] Model '{key}' loaded successfully!")
    return whisper_models[key]

def get_loaded_models():
    return list(whisper_models.keys())

def is_loaded():
    return len(whisper_models) > 0

def transcribe(
    audio_path: str,
    model_size: str = "base",
    language: str = "fr",
    device: str = "cuda",
    beam_size: int = 5,
    word_timestamps: bool = True
) -> dict:
    start_time = time.time()
    whisper_m = get_whisper_model(model_size, device)
    
    lang_param = None if language == "auto" or not language else language
    segments_gen, info = whisper_m.transcribe(
        audio_path,
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
