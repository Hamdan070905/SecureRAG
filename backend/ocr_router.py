"""
ocr_router.py
─────────────────────────────────────────────────────────────────────────────
Modular OCR Router for SecureRAG.

Supported engines (controlled by OCR_ENGINE env var):
  auto         → smart routing (default)
  easyocr      → always use EasyOCR
  paddleocr    → always use PaddleOCR
  hunyuanocr   → always use Tencent HunyuanOCR

Auto-routing rules:
  EasyOCR      → general lightweight OCR
  PaddleOCR    → tables, forms, structured documents
  HunyuanOCR  → blurred / skewed / multilingual / dense / receipts / invoices
  Vision LLM   → always the final fallback (Qwen2.5VL via Ollama)

Hardware target: i7-13650HX + RTX 4060 8GB VRAM + 16GB RAM.
Models are lazy-loaded and cached for reuse.
─────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import os
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

import cv2
import time
import tempfile
import threading
import numpy as np
from PIL import Image, ImageOps

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

OCR_ENGINE = os.getenv("OCR_ENGINE", "auto").lower().strip()

# Minimum char count to consider OCR successful
_MIN_CHARS = 10

# Quality level → engine mapping
_QUALITY_ENGINE_MAP = {
    "easy":   "easyocr",   # EasyOCR only, fastest
    "medium": "medium",    # EasyOCR + PaddleOCR, no HunyuanOCR/VisionLLM
    "high":   "auto",      # Full chain: EasyOCR → PaddleOCR → HunyuanOCR → VisionLLM
}

# ─────────────────────────────────────────────────────────────────────────────
# LAZY MODEL CACHE (singleton pattern, thread-safe)
# ─────────────────────────────────────────────────────────────────────────────

_lock = threading.Lock()
_easy_reader = None
_paddle_engine = None
_hunyuan_model = None
_hunyuan_processor = None


def _get_easyocr():
    global _easy_reader
    if _easy_reader is None:
        with _lock:
            if _easy_reader is None:
                try:
                    import easyocr
                    import torch
                    gpu = torch.cuda.is_available()
                    _easy_reader = easyocr.Reader(["en", "ch_sim"], gpu=gpu)
                    print("[OCR_ROUTER] EasyOCR loaded (gpu={})".format(gpu))
                except Exception as e:
                    print(f"[OCR_ROUTER] EasyOCR init failed: {e}")
    return _easy_reader


def _get_paddle():
    global _paddle_engine
    if _paddle_engine is None:
        with _lock:
            if _paddle_engine is None:
                try:
                    from paddleocr import PaddleOCR
                    import logging
                    logging.getLogger("ppocr").setLevel(logging.ERROR)
                    # Build kwargs without unsupported args for newer PaddleOCR versions
                    paddle_kwargs = {"use_angle_cls": True, "lang": "en"}
                    try:
                        _paddle_engine = PaddleOCR(**paddle_kwargs, show_log=False)
                    except (TypeError, ValueError):
                        # Older or newer API: show_log not supported
                        _paddle_engine = PaddleOCR(**paddle_kwargs)
                    print("[OCR_ROUTER] PaddleOCR loaded")
                except Exception as e:
                    print(f"[OCR_ROUTER] PaddleOCR init failed: {e}")
    return _paddle_engine



def _get_hunyuan():
    """
    Load HunyuanOCR in lightweight mode.
    Uses the Hunyuan-DiT-based OCR model via transformers.
    Only loaded on demand (hunyuanocr or auto when needed).
    """
    global _hunyuan_model, _hunyuan_processor
    if _hunyuan_model is None:
        with _lock:
            if _hunyuan_model is None:
                try:
                    import torch
                    from transformers import AutoProcessor, AutoModelForVision2Seq
                    # Use the lightweight HunyuanOCR checkpoint
                    model_id = os.getenv("HUNYUAN_OCR_MODEL", "Tencent-Hunyuan/HunyuanOCR")
                    device = "cuda" if torch.cuda.is_available() else "cpu"
                    dtype = torch.float16 if device == "cuda" else torch.float32

                    _hunyuan_processor = AutoProcessor.from_pretrained(
                        model_id, trust_remote_code=True
                    )
                    _hunyuan_model = AutoModelForVision2Seq.from_pretrained(
                        model_id,
                        torch_dtype=dtype,
                        trust_remote_code=True,
                        device_map=device,
                    )
                    _hunyuan_model.eval()
                    print(f"[OCR_ROUTER] HunyuanOCR loaded on {device}")
                except Exception as e:
                    print(f"[OCR_ROUTER] HunyuanOCR init failed: {e}")
    return _hunyuan_model, _hunyuan_processor


# ─────────────────────────────────────────────────────────────────────────────
# IMAGE PREPROCESSING PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def _pil_to_cv(img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)


def _estimate_dpi(img_cv: np.ndarray) -> int:
    h, w = img_cv.shape[:2]
    return min(w, h)


def preprocess_for_ocr(image_path: str, mode: str = "standard") -> str:
    """
    Full preprocessing pipeline. Returns path to a temp file.

    Modes:
      standard  → CLAHE + mild sharpen  (fast, general)
      aggressive → deskew + shadow removal + adaptive threshold + super-res upscale
    """
    try:
        pil = Image.open(image_path)
        pil = ImageOps.exif_transpose(pil)  # auto-rotate from EXIF
        img = _pil_to_cv(pil)

        # ── Upscale if low/medium resolution ────────────────────────────────
        h, w = img.shape[:2]
        if mode == "aggressive" and max(w, h) < 3000:
            # Strong upscale for blurry/small images in aggressive mode
            scale = 2500.0 / max(w, h)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LANCZOS4)
        elif max(w, h) < 1000:
            scale = 1500.0 / max(w, h)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        if mode == "aggressive":
            img = _deskew(img)
            img = _remove_shadows(img)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # CLAHE contrast — stronger clip in aggressive mode for blurry images
        clip = 4.0 if mode == "aggressive" else 3.0
        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
        gray = clahe.apply(gray)

        # Denoise — stronger denoising in aggressive mode
        denoise_h = 15 if mode == "aggressive" else 10
        gray = cv2.fastNlMeansDenoising(gray, h=denoise_h)

        # Sharpen — unsharp mask in aggressive, simple kernel otherwise
        if mode == "aggressive":
            blur = cv2.GaussianBlur(gray, (0, 0), 3)
            gray = cv2.addWeighted(gray, 1.5, blur, -0.5, 0)
        else:
            kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
            gray = cv2.filter2D(gray, -1, kernel)

        if mode == "aggressive":
            gray = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 3
            )

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        cv2.imwrite(tmp.name, gray)
        tmp.close()
        return tmp.name

    except Exception as e:
        print(f"[OCR_ROUTER] Preprocess failed: {e}")
        return image_path


def _deskew(img: np.ndarray) -> np.ndarray:
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        if abs(angle) > 0.5:
            h, w = img.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    except Exception as e:
        print(f"[OCR_ROUTER] Deskew failed: {e}")
    return img


def _remove_shadows(img: np.ndarray) -> np.ndarray:
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        dilated = cv2.dilate(gray, np.ones((7, 7), np.uint8))
        bg = cv2.medianBlur(dilated, 21)
        diff = 255 - cv2.absdiff(gray, bg)
        norm = cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX)
        return cv2.cvtColor(norm, cv2.COLOR_GRAY2BGR)
    except Exception as e:
        print(f"[OCR_ROUTER] Shadow removal failed: {e}")
        return img


# Minimum image dimensions to attempt OCR (skip logos/icons smaller than this)
_MIN_OCR_W = 100
_MIN_OCR_H = 50

# Text density threshold: Laplacian variance below this = likely no text
_TEXT_LAP_THRESHOLD = 30.0


def classify_image_for_ocr(image_path: str) -> str:
    """
    Classify an image to decide OCR vs Vision-caption vs skip.
    Returns:
      'ocr'     → run OCR pipeline (screenshot, scan, table, form, receipt, diagram)
      'caption' → send to Vision LLM for semantic caption (photo, render, map, logo)
      'skip'    → ignore (blank, tiny, separator, icon)
    """
    try:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return "skip"
        h, w = img.shape[:2]
        # Too small → skip (logo / icon / separator)
        if w < _MIN_OCR_W or h < _MIN_OCR_H:
            return "skip"
        # Nearly blank → skip
        std = float(np.std(img))
        if std < 8.0:
            return "skip"
        # Estimate text presence via Laplacian variance
        lap_var = float(cv2.Laplacian(img, cv2.CV_64F).var())
        # Count near-black pixels (text pixels)
        dark_ratio = float(np.sum(img < 80)) / (h * w)
        # Very low sharpness + few dark pixels → photo/artwork, send to caption
        if lap_var < _TEXT_LAP_THRESHOLD and dark_ratio < 0.03:
            return "caption"
        # Otherwise treat as potentially text-bearing → OCR
        return "ocr"
    except Exception:
        return "ocr"  # safe default


def _cleanup(*paths: str, original: str = ""):
    for p in paths:
        if p and p != original and os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# OCR ENGINE WRAPPERS
# ─────────────────────────────────────────────────────────────────────────────

def _run_easyocr(image_path: str) -> tuple[str, float]:
    """Returns (text, avg_confidence)."""
    try:
        reader = _get_easyocr()
        if reader is None:
            return "", 0.0
        results = reader.readtext(image_path)
        if not results:
            return "", 0.0
        lines = [(text, conf) for (_, text, conf) in results if conf > 0.25]
        if not lines:
            return "", 0.0
        text = "\n".join(t for t, _ in lines)
        avg_conf = float(np.mean([c for _, c in lines]))
        return text, avg_conf
    except Exception as e:
        print(f"[OCR_ROUTER][EasyOCR] Error: {e}")
        return "", 0.0


def _run_paddleocr(image_path: str) -> tuple[str, float]:
    """Returns (text, avg_confidence) with layout-aware line reconstruction."""
    try:
        engine = _get_paddle()
        if engine is None:
            return "", 0.0
        try:
            res = engine.ocr(image_path, cls=True)
        except TypeError:
            res = engine.ocr(image_path)
        if not res or not res[0]:
            return "", 0.0

        blocks = []
        if isinstance(res[0], dict):
            for item in res:
                if not isinstance(item, dict):
                    continue
                texts = item.get("rec_texts", [])
                scores = item.get("rec_scores", [])
                polys = item.get("rec_polys", [])
                for idx in range(len(texts)):
                    text = texts[idx]
                    conf = scores[idx] if idx < len(scores) else 1.0
                    box = polys[idx] if idx < len(polys) else None
                    if conf > 0.25:
                        if box is not None:
                            ys = [pt[1] for pt in box]
                            xs = [pt[0] for pt in box]
                            y_center = (min(ys) + max(ys)) / 2
                            y_min, y_max = min(ys), max(ys)
                            x_min, x_max = min(xs), max(xs)
                        else:
                            y_center, y_min, y_max, x_min, x_max = 0, 0, 0, 0, 0
                        blocks.append({
                            "text": text, "conf": conf,
                            "y_center": y_center,
                            "y_min": y_min, "y_max": y_max,
                            "x_min": x_min, "x_max": x_max,
                        })
        else:
            for line in res[0]:
                box, (text, conf) = line[0], line[1]
                if conf > 0.25:
                    ys = [pt[1] for pt in box]
                    xs = [pt[0] for pt in box]
                    blocks.append({
                        "text": text, "conf": conf,
                        "y_center": (min(ys) + max(ys)) / 2,
                        "y_min": min(ys), "y_max": max(ys),
                        "x_min": min(xs), "x_max": max(xs),
                    })

        if not blocks:
            return "", 0.0

        # Group into visual lines
        blocks.sort(key=lambda b: b["y_center"])
        lines_grouped: list[list[dict]] = []
        for b in blocks:
            placed = False
            for g in lines_grouped:
                g_y = (min(i["y_min"] for i in g) + max(i["y_max"] for i in g)) / 2
                g_h = max(i["y_max"] for i in g) - min(i["y_min"] for i in g)
                if abs(b["y_center"] - g_y) < max(g_h * 0.6, 10):
                    g.append(b)
                    placed = True
                    break
            if not placed:
                lines_grouped.append([b])

        final = []
        for g in lines_grouped:
            g.sort(key=lambda b: b["x_min"])
            final.append(" ".join(b["text"] for b in g))

        text = "\n".join(final)
        avg_conf = float(np.mean([b["conf"] for b in blocks]))
        return text, avg_conf
    except Exception as e:
        print(f"[OCR_ROUTER][PaddleOCR] Error: {e}")
        return "", 0.0


def _run_hunyuanocr(image_path: str, task: str = "doc_parse") -> tuple[str, float]:
    """
    Run HunyuanOCR-1.5 via llama.cpp GGUF OpenAI-compatible server.
    Tasks: 'doc_parse' (default) or 'info_extract'. Returns plain text.
    """
    try:
        from openai import OpenAI
        import base64
        import os
        
        api_base = os.getenv("HUNYUAN_API_BASE", "http://localhost:8080/v1")
        client = OpenAI(api_key="none", base_url=api_base)
        
        with open(image_path, "rb") as f:
            b64_img = base64.b64encode(f.read()).decode('utf-8')
            
        prompts = {
            "doc_parse": "Please parse the document in the image.",
            "info_extract": "Extract key information from the image."
        }
        
        response = client.chat.completions.create(
            model="hunyuanocr-1.5",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompts.get(task, prompts["doc_parse"])},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                    ]
                }
            ],
            max_tokens=2048,
            temperature=0.1
        )
        
        text = response.choices[0].message.content.strip()
        conf = 0.90 if text else 0.0
        return text, conf
    except Exception as e:
        print(f"[OCR_ROUTER][HunyuanOCR-1.5] Error: {e}")
        return "", 0.0


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT TYPE HINTING  (used by auto-router)
# ─────────────────────────────────────────────────────────────────────────────

def _classify_image_complexity(image_path: str) -> str:
    """
    Return a hint: 'simple', 'structured', 'complex'.
    simple     → EasyOCR
    structured → PaddleOCR  (tables, forms)
    complex    → HunyuanOCR (low-quality / multilingual / dense)
    """
    try:
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return "simple"

        h, w = img.shape[:2]
        # Very low resolution → complex (super-res needed)
        if max(w, h) < 600:
            return "complex"

        # Estimate noise level (Laplacian variance; low = blurry)
        lap_var = cv2.Laplacian(img, cv2.CV_64F).var()
        if lap_var < 50:
            return "complex"  # blurry / noisy

        # Detect horizontal lines (table indicator)
        edges = cv2.Canny(img, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100,
                                minLineLength=w * 0.4, maxLineGap=20)
        if lines is not None and len(lines) > 3:
            return "structured"

        return "simple"
    except Exception:
        return "simple"


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC ROUTER API
# ─────────────────────────────────────────────────────────────────────────────

def ocr_image(image_path: str, doc_hint: str = "") -> str:
    """
    Main entry point. Accepts an image file path and optional doc_hint.
    doc_hint: 'receipt' | 'invoice' | 'table' | 'form' | 'handwritten' | ''

    Returns extracted text string. Never raises.
    """
    engine = OCR_ENGINE
    print(f"[OCR_ROUTER] Engine={engine} hint='{doc_hint}' file={os.path.basename(image_path)}")

    # Pre-process: standard pass
    proc = preprocess_for_ocr(image_path, mode="standard")

    text = ""
    conf = 0.0

    # ── Explicit engine selection ─────────────────────────────────────────
    if engine == "easyocr":
        text, conf = _run_easyocr(proc)

    elif engine == "paddleocr":
        text, conf = _run_paddleocr(proc)

    elif engine == "hunyuanocr":
        text, conf = _run_hunyuanocr(proc)

    elif engine == "auto":
        # ── Classify image complexity ─────────────────────────────────────
        complexity = _classify_image_complexity(proc)
        hard_hints = {"receipt", "invoice", "bank_statement", "handwritten"}
        struct_hints = {"table", "form"}

        if doc_hint.lower() in hard_hints or complexity == "complex":
            # Try HunyuanOCR first for hard cases
            text, conf = _run_hunyuanocr(proc)
            if len(text.strip()) < _MIN_CHARS:
                print("[OCR_ROUTER] HunyuanOCR insufficient, trying PaddleOCR...")
                text, conf = _run_paddleocr(proc)
            if len(text.strip()) < _MIN_CHARS:
                print("[OCR_ROUTER] PaddleOCR insufficient, trying EasyOCR...")
                text, conf = _run_easyocr(proc)

        elif doc_hint.lower() in struct_hints or complexity == "structured":
            # PaddleOCR for tables/forms
            text, conf = _run_paddleocr(proc)
            if len(text.strip()) < _MIN_CHARS:
                print("[OCR_ROUTER] PaddleOCR insufficient, trying EasyOCR...")
                text, conf = _run_easyocr(proc)

        else:
            # General: EasyOCR first (lightweight)
            text, conf = _run_easyocr(proc)
            if len(text.strip()) < _MIN_CHARS:
                print("[OCR_ROUTER] EasyOCR insufficient, trying PaddleOCR...")
                text, conf = _run_paddleocr(proc)

    else:
        # Unknown engine value → fallback to EasyOCR
        print(f"[OCR_ROUTER] Unknown OCR_ENGINE='{engine}', defaulting to EasyOCR")
        text, conf = _run_easyocr(proc)

    # ── Low confidence: retry with aggressive preprocessing ───────────────
    if len(text.strip()) < _MIN_CHARS or conf < 0.35:
        print(f"[OCR_ROUTER] Low result (chars={len(text.strip())}, conf={conf:.2f}), retrying with aggressive preprocessing...")
        proc_agg = preprocess_for_ocr(image_path, mode="aggressive")

        # Try all engines on the aggressively preprocessed image
        best_text, best_conf = text, conf
        for runner in [_run_easyocr, _run_paddleocr, _run_hunyuanocr]:
            t2, c2 = runner(proc_agg)
            if len(t2.strip()) > len(best_text.strip()):
                best_text, best_conf = t2, c2
            if len(best_text.strip()) >= 50:  # good enough, stop trying
                break

        if len(best_text.strip()) > len(text.strip()):
            text, conf = best_text, best_conf

        _cleanup(proc_agg, original=image_path)

    _cleanup(proc, original=image_path)

    # ── Final fallback: Vision LLM (Qwen2.5VL) ───────────────────────────
    # Lower threshold to 30 chars so blurry images with minimal OCR output
    # still get the Vision LLM treatment
    if len(text.strip()) < 30:
        print("[OCR_ROUTER] Insufficient OCR output. Falling back to Vision LLM...")
        text = _vision_llm_fallback(image_path)

    return text


def _vision_llm_fallback(image_path: str) -> str:
    """Call vision_extractor.extract_via_vision as the final fallback."""
    try:
        from vision_extractor import extract_via_vision
        result = extract_via_vision(image_path)
        return result.get("text", "")
    except Exception as e:
        print(f"[OCR_ROUTER] Vision LLM fallback failed: {e}")
        return ""


def ocr_image_with_quality(image_path: str, quality: str = "easy", doc_hint: str = "") -> str:
    """
    Quality-aware entry point. All engines remain available — routing is quality-gated.

    Easy   (default): EasyOCR only — fastest, no PaddleOCR/HunyuanOCR/VisionLLM.
    Medium           : EasyOCR → PaddleOCR — balanced, no HunyuanOCR/VisionLLM.
    High             : EasyOCR → PaddleOCR → HunyuanOCR → Vision LLM — best accuracy.
    """
    quality = quality.lower()
    fname = os.path.basename(image_path)
    print(f"[OCR_ROUTER] Quality={quality} | file={fname}")

    if quality == "easy":
        # EasyOCR only — standard + aggressive preprocessing, no heavy models
        proc = preprocess_for_ocr(image_path, mode="standard")
        text, conf = _run_easyocr(proc)
        _cleanup(proc, original=image_path)
        if len(text.strip()) < _MIN_CHARS:
            proc_agg = preprocess_for_ocr(image_path, mode="aggressive")
            t2, _ = _run_easyocr(proc_agg)  # still EasyOCR only
            _cleanup(proc_agg, original=image_path)
            if len(t2.strip()) > len(text.strip()):
                text = t2
        print(f"[OCR_ROUTER] Easy result: {len(text.strip())} chars")
        return text

    if quality == "medium":
        # EasyOCR → PaddleOCR (no HunyuanOCR, no Vision LLM)
        proc = preprocess_for_ocr(image_path, mode="standard")
        text, conf = _run_easyocr(proc)
        _cleanup(proc, original=image_path)
        if len(text.strip()) < _MIN_CHARS or conf < 0.35:
            print("[OCR_ROUTER] Medium: EasyOCR low, trying PaddleOCR...")
            proc_agg = preprocess_for_ocr(image_path, mode="aggressive")
            t2, _ = _run_paddleocr(proc_agg)
            _cleanup(proc_agg, original=image_path)
            if len(t2.strip()) > len(text.strip()):
                text = t2
        print(f"[OCR_ROUTER] Medium result: {len(text.strip())} chars")
        return text

    # High (or any unknown value) → full auto chain
    # EasyOCR → PaddleOCR → HunyuanOCR → Vision LLM (all engines preserved)
    global OCR_ENGINE
    original_engine = OCR_ENGINE
    OCR_ENGINE = "auto"
    print("[OCR_ROUTER] High → full chain (EasyOCR→PaddleOCR→HunyuanOCR→VisionLLM)")
    try:
        return ocr_image(image_path, doc_hint=doc_hint)
    finally:
        OCR_ENGINE = original_engine
