"""
vision_extractor.py
────────────────────────────────────────────────────────────────────────────
Enterprise-grade extraction layer for SecureRAG.

Extraction priority:
  1. OCR Router (ocr_router.py)  ← EasyOCR / PaddleOCR / HunyuanOCR
  2. Vision LLM                  ← Qwen2.5VL / GPT-4o / Gemini / Claude (final fallback)

Triggered automatically by extract_text() in rag_engine.py.
────────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import os
import base64
import json
import time
import tempfile
import numpy as np
from PIL import Image, ImageOps


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def preprocess_image(image_path: str) -> str:
    """
    Non-destructive OCR preprocessing.
    Auto-rotate (EXIF) → CLAHE contrast → mild sharpen.
    Delegates to ocr_router for the heavy lifting.
    Kept here for backward compatibility with callers that import it directly.
    """
    try:
        from ocr_router import preprocess_for_ocr
        return preprocess_for_ocr(image_path, mode="standard")
    except Exception as e:
        print(f"[VISION] Preprocessing failed: {e}, using original")
        return image_path


def compress_for_api(image_path: str, max_dim: int = 1600, quality: int = 85) -> str:
    """Compress + resize image for Vision API calls."""
    try:
        img = Image.open(image_path).convert("RGB")
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        img.save(tmp.name, "JPEG", quality=quality)
        tmp.close()
        return tmp.name
    except Exception as e:
        print(f"[VISION] Compression failed: {e}")
        return image_path


def _encode_b64(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# VISION LLM EXTRACTION  (final fallback only)
# ─────────────────────────────────────────────────────────────────────────────

VISION_PROMPT = """You are an expert document extraction engine.
Your task: extract ALL visible text from this image exactly as it appears.

Rules:
- Preserve layout: headings, tables, lists, line breaks.
- Infer slightly blurred words from context — do not guess wildly.
- For completely unreadable parts write [unclear].
- Do NOT summarize, add commentary, or hallucinate.
- Capture: receipts, bills, invoices, bank slips, handwritten notes, screenshots, forms, tables.

Return ONLY a JSON object:
{
  "extracted_text": "<full text here>",
  "confidence": 0.95,
  "language": "en",
  "doc_type": "receipt|invoice|screenshot|handwritten|form|table|scanned|other"
}"""


def _parse_vision_response(raw: str) -> dict:
    """Safely parse JSON or plain-text Vision responses."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
        return {
            "text": data.get("extracted_text", "").strip(),
            "confidence": float(data.get("confidence", 0.9)),
            "language": data.get("language", "en"),
            "doc_type": data.get("doc_type", "other"),
        }
    except (json.JSONDecodeError, ValueError):
        return {"text": raw.strip(), "confidence": 0.9, "language": "en", "doc_type": "other"}


def extract_via_vision(image_path: str) -> dict:
    """
    Vision LLM extraction.  Reads provider from env — no circular import.
    Returns {"text": ..., "confidence": ..., "language": ..., "doc_type": ...}
    """
    compressed = compress_for_api(image_path)
    b64 = _encode_b64(compressed)
    img_url = f"data:image/jpeg;base64,{b64}"

    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    vision_model = os.getenv("VISION_MODEL", "").strip()

    print(f"[VISION] Provider={provider} VisionModel={vision_model or '(default)'}")
    res_text = ""

    try:
        if provider == "openai":
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            r = client.chat.completions.create(
                model=vision_model or "gpt-4o-mini",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ]}],
                response_format={"type": "json_object"},
                max_tokens=2000, temperature=0.05,
            )
            res_text = r.choices[0].message.content

        elif provider == "gemini":
            import google.generativeai as genai
            genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
            pil_img = Image.open(compressed)
            r = genai.GenerativeModel(vision_model or "gemini-2.0-flash").generate_content(
                [VISION_PROMPT, pil_img],
                generation_config={"response_mime_type": "application/json", "temperature": 0.05},
            )
            res_text = r.text

        elif provider == "groq":
            from groq import Groq
            client = Groq(api_key=os.getenv("GROQ_API_KEY"))
            r = client.chat.completions.create(
                model=vision_model or "llama-3.2-11b-vision-preview",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ]}],
                response_format={"type": "json_object"},
                max_tokens=2000, temperature=0.05,
            )
            res_text = r.choices[0].message.content

        elif provider in ("claude", "anthropic"):
            import anthropic
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            r = client.messages.create(
                model=vision_model or "claude-3-5-sonnet-20241022",
                max_tokens=2000,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                    {"type": "text", "text": VISION_PROMPT},
                ]}],
            )
            res_text = r.content[0].text

        elif provider == "ollama":
            from openai import OpenAI
            client = OpenAI(api_key="ollama", base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"))
            r = client.chat.completions.create(
                model=vision_model or "qwen2.5vl:7b",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ]}],
                max_tokens=2000, temperature=0.05,
            )
            res_text = r.choices[0].message.content

        elif provider == "openrouter":
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENROUTER_API_KEY"), base_url="https://openrouter.ai/api/v1")
            r = client.chat.completions.create(
                model=vision_model or "google/gemini-2.0-flash",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ]}],
                max_tokens=2000, temperature=0.05,
            )
            res_text = r.choices[0].message.content

        elif provider == "qwen":
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("QWEN_API_KEY"), base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
            r = client.chat.completions.create(
                model=vision_model or "qwen-vl-plus",
                messages=[{"role": "user", "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {"type": "image_url", "image_url": {"url": img_url}},
                ]}],
                max_tokens=2000, temperature=0.05,
            )
            res_text = r.choices[0].message.content

        else:
            raise ValueError(f"No vision mapping for provider '{provider}'")

    finally:
        if compressed != image_path and os.path.exists(compressed):
            try:
                os.remove(compressed)
            except Exception:
                pass

    return _parse_vision_response(res_text)


# ─────────────────────────────────────────────────────────────────────────────
# BACKWARD-COMPATIBLE ENTRY POINTS
# ─────────────────────────────────────────────────────────────────────────────

def extract_image_text(image_path: str, ocr_quality: str = "medium") -> str:
    """
    Full extraction pipeline for images / embedded figures.
    Priority: OCR Router (quality-aware) → Vision LLM fallback.
    ocr_quality: 'easy' | 'medium' | 'high'
    """
    print(f"\n[EXTRACTOR] ── image: {os.path.basename(image_path)}")
    try:
        from ocr_router import ocr_image_with_quality
        text = ocr_image_with_quality(image_path, quality=ocr_quality)
        if text.strip():
            print(f"[EXTRACTOR] ✓ OCR Router: {len(text)} chars")
            return text
    except Exception as e:
        print(f"[EXTRACTOR] OCR Router error: {e}")

    # Vision LLM fallback (with retry)
    for attempt in range(3):
        try:
            result = extract_via_vision(image_path)
            text = result.get("text", "")
            if text.strip():
                print(f"[EXTRACTOR] ✓ Vision LLM ({attempt+1}): {len(text)} chars")
                return text
        except Exception as e:
            wait = 2 ** attempt
            print(f"[EXTRACTOR] Vision attempt {attempt+1} failed: {e}. Retrying in {wait}s...")
            time.sleep(wait)

    print("[EXTRACTOR] ✗ All methods failed.")
    return ""


def extract_scanned_pdf_page(image_path: str) -> str:
    """
    Extraction pipeline for scanned PDF pages.
    Priority: OCR Router (PaddleOCR → EasyOCR) → Vision LLM fallback.
    """
    print(f"\n[SCAN_EXTRACTOR] ── {os.path.basename(image_path)}")
    try:
        from ocr_router import ocr_image
        text = ocr_image(image_path, doc_hint="scanned")
        if text.strip():
            print(f"[SCAN_EXTRACTOR] ✓ OCR Router: {len(text)} chars")
            return text
    except Exception as e:
        print(f"[SCAN_EXTRACTOR] OCR Router error: {e}")

    # Vision LLM fallback
    for attempt in range(2):
        try:
            result = extract_via_vision(image_path)
            text = result.get("text", "")
            if text.strip():
                print(f"[SCAN_EXTRACTOR] ✓ Vision LLM: {len(text)} chars")
                return text
        except Exception as e:
            print(f"[SCAN_EXTRACTOR] Vision attempt {attempt+1} failed: {e}")
            time.sleep(1)

    return ""
