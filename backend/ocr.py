import os
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

import cv2
import re
import numpy as np
from PIL import Image
import base64


try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

# Import the OCR engines
try:
    from paddleocr import PaddleOCR
    # Initialize PaddleOCR (angle classifier disabled for speed)
    try:
        paddle_ocr_engine = PaddleOCR(use_angle_cls=False, lang='en', show_log=False)
    except (TypeError, ValueError):
        paddle_ocr_engine = PaddleOCR(use_angle_cls=False, lang='en')
except Exception as e:
    print("Failed to initialize PaddleOCR, falling back to EasyOCR:", e)
    paddle_ocr_engine = None

import easyocr
# Initialize EasyOCR
import threading
ocr_lock = threading.Lock()

try:
    easy_ocr_engine = easyocr.Reader(['en'], gpu=False)
except Exception as e:
    print("Failed to initialize EasyOCR:", e)
    easy_ocr_engine = None

def preprocess_for_ocr(image_path: str) -> np.ndarray:
    img = cv2.imread(image_path)
    if img is None:
        # Fallback if image failed to read directly
        return image_path
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    contrast = cv2.convertScaleAbs(denoised, alpha=1.3, beta=10)
    sharpened = cv2.filter2D(contrast, -1, np.array([[0,-1,0],[-1,5,-1],[0,-1,0]]))
    return sharpened

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def extract_text_via_vision(image_path: str) -> tuple:
    compressed_path = image_path + ".compressed.jpg"
    try:
        from PIL import Image
        img = Image.open(image_path)
        img.thumbnail((1600, 1600))
        img.convert("RGB").save(compressed_path, "JPEG", quality=85)
    except Exception as e:
        print("Compression error:", e)
        compressed_path = image_path

    try:
        base64_image = encode_image(compressed_path)
    except Exception as e:
        return "", 0.0, "other", "en"

    prompt = """
    You are an expert OCR and document understanding engine. 
    Analyze the image and extract ALL written text, tables, handwritten notes, and layout elements.
    Ensure to capture details from blurry areas, low-light regions, screenshots, receipts, invoices, or forms.
    Do NOT summarize. Transcribe the text exactly as it appears. 
    If confidence is low or parts are completely unreadable, write '[Unreadable]' for those specific parts. Never hallucinate.
    
    Respond strictly in JSON format with these exact keys:
    {
      "extracted_text": "...",
      "confidence_score": 0.95,
      "detected_language": "en",
      "document_type": "receipt/invoice/screenshot/handwritten/form/scanned_page/table/other"
    }
    """

    extracted_text = ""
    confidence = 0.0
    doc_type = "other"
    lang = "en"

    import time
    for attempt in range(3):
        try:
            from rag_engine import LLM_PROVIDER, LLM_MODEL
            provider = LLM_PROVIDER.lower()
            model = LLM_MODEL.lower()

            if provider == "openai":
                from openai import OpenAI
                client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                vis_model = model if model else "gpt-4o-mini"
                r = client.chat.completions.create(
                    model=vis_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                                }
                            ]
                        }
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=1500,
                    temperature=0.1
                )
                res_text = r.choices[0].message.content

            elif provider == "gemini":
                import google.generativeai as genai
                genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
                vis_model = model if model else "gemini-2.0-flash"
                model_inst = genai.GenerativeModel(vis_model)
                from PIL import Image
                img = Image.open(compressed_path)
                r = model_inst.generate_content([prompt, img], generation_config={"response_mime_type": "application/json", "temperature": 0.1})
                res_text = r.text

            elif provider == "groq":
                from groq import Groq
                client = Groq(api_key=os.getenv("GROQ_API_KEY"))
                vis_model = model if "vision" in model else "llama-3.2-11b-vision-preview"
                r = client.chat.completions.create(
                    model=vis_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                                }
                            ]
                        }
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=1500,
                    temperature=0.1
                )
                res_text = r.choices[0].message.content

            elif provider == "claude" or provider == "anthropic":
                import anthropic
                client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
                vis_model = model if model else "claude-3-5-sonnet-20241022"
                r = client.messages.create(
                    model=vis_model,
                    max_tokens=1500,
                    temperature=0.1,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/jpeg",
                                        "data": base64_image
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": prompt
                                }
                            ]
                        }
                    ]
                )
                res_text = r.content[0].text

            elif provider == "ollama":
                from openai import OpenAI
                client = OpenAI(api_key="ollama", base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"))
                vis_model = model if model else "qwen2.5-vl"
                r = client.chat.completions.create(
                    model=vis_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                                }
                            ]
                        }
                    ],
                    max_tokens=1500,
                    temperature=0.1
                )
                res_text = r.choices[0].message.content

            elif provider == "openrouter":
                from openai import OpenAI
                client = OpenAI(api_key=os.getenv("OPENROUTER_API_KEY"), base_url="https://openrouter.ai/api/v1")
                vis_model = model if model else "google/gemini-2.0-flash"
                r = client.chat.completions.create(
                    model=vis_model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                                }
                            ]
                        }
                    ],
                    max_tokens=1500,
                    temperature=0.1
                )
                res_text = r.choices[0].message.content
            else:
                raise ValueError("No vision model mapping for provider " + provider)

            import json
            cleaned_res = res_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(cleaned_res)
            extracted_text = data.get("extracted_text", "")
            confidence = float(data.get("confidence_score", 0.0))
            doc_type = data.get("document_type", "other")
            lang = data.get("detected_language", "en")
            
            if extracted_text.strip():
                break
        except Exception as e:
            print(f"Vision API extraction attempt {attempt+1} failed: {e}")
            time.sleep(2 ** attempt)

    if compressed_path != image_path and os.path.exists(compressed_path):
        try: os.remove(compressed_path)
        except: pass

    return extracted_text, confidence, doc_type, lang

# Custom preprocessing strategies
def preprocess_stage_1(img):
    """Sharpening + CLAHE + Adaptive Thresholding (Optimized for blurry & low-contrast images)"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Advanced Unsharp Masking to recover fuzzy edges
    blurred = cv2.GaussianBlur(gray, (5, 5), 1.0)
    sharpened = cv2.addWeighted(gray, 2.5, blurred, -1.5, 0)
    
    # Enhance local contrast using CLAHE
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(sharpened)
    
    # High-sensitivity adaptive thresholding
    thresh = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    return thresh

def preprocess_stage_2(img):
    """Shadow Removal + Adaptive Thresholding (Good for receipts and scanned papers)"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Remove shadows by estimating background illumination
    dilated_img = cv2.dilate(gray, np.ones((7, 7), np.uint8))
    bg_img = cv2.medianBlur(dilated_img, 21)
    diff_img = 255 - cv2.absdiff(gray, bg_img)
    norm_img = cv2.normalize(diff_img, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX, dtype=cv2.CV_8UC1)
    
    # Adaptive thresholding
    thresh = cv2.adaptiveThreshold(norm_img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8)
    return thresh

def preprocess_stage_3(img):
    """Otsu Binarization after Gaussian Blur (Good for high noise)"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh

def deskew_image(img):
    """Detects text angle and deskews the image"""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Threshold the image
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        # Find contours
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
            
        if abs(angle) > 0.5:
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    except Exception as e:
        print("Deskew error:", e)
    return img

def enhance_image_advanced(file_path, strategy=1):
    try:
        # Load image via OpenCV
        img = cv2.imread(file_path)
        if img is None:
            # Try loading via PIL (HEIC, etc.) and converting to OpenCV
            pil_img = Image.open(file_path).convert('RGB')
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Deskew
        img = deskew_image(img)

        # Resize for better OCR: Target at least 1200px on the longest side
        h, w = img.shape[:2]
        if max(w, h) < 1200:
            scale = 1200.0 / max(w, h)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

        if strategy == 1:
            processed = preprocess_stage_1(img)
        elif strategy == 2:
            processed = preprocess_stage_2(img)
        else:
            processed = preprocess_stage_3(img)

        # Save to temp file
        temp_path = file_path + f".preprocessed_{strategy}.png"
        cv2.imwrite(temp_path, processed)
        return temp_path
    except Exception as e:
        print("Enhance image error:", e)
        return file_path

# Preserve layout helper: sorts bounding boxes and groups text by reading order
def parse_ocr_results_layout(results):
    if not results:
        return ""
    
    items = []
    for r in results:
        box, text, conf = r
        if not box or len(box) < 4:
            continue
        xs = [pt[0] for pt in box]
        ys = [pt[1] for pt in box]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        items.append({
            "x_min": x_min,
            "x_max": x_max,
            "y_min": y_min,
            "y_max": y_max,
            "y_center": (y_min + y_max) / 2,
            "text": text,
            "conf": conf
        })

    # Group lines based on overlapping y-intervals
    lines = []
    items.sort(key=lambda item: item["y_center"])
    
    for item in items:
        placed = False
        for line in lines:
            line_y_min = min(i["y_min"] for i in line)
            line_y_max = max(i["y_max"] for i in line)
            line_h = line_y_max - line_y_min
            if abs(item["y_center"] - (line_y_min + line_y_max) / 2) < (line_h * 0.6):
                line.append(item)
                placed = True
                break
        if not placed:
            lines.append([item])

    final_lines = []
    for line in lines:
        line.sort(key=lambda item: item["x_min"])
        line_text = ""
        last_x_max = 0
        for idx, item in enumerate(line):
            if idx == 0:
                line_text += item["text"]
            else:
                spaces = max(1, int((item["x_min"] - last_x_max) / 15))
                line_text += " " * spaces + item["text"]
            last_x_max = item["x_max"]
        final_lines.append(line_text)

    return "\n".join(final_lines)

# Run LLM Correction if confidence is high
def correct_ocr_text_with_llm(raw_text: str) -> str:
    # Bypassed to make text extraction significantly faster
    return raw_text

def run_advanced_ocr(file_path: str) -> tuple:
    # 1. Try Vision LLM first
    try:
        vis_text, vis_conf, doc_type, lang = extract_text_via_vision(file_path)
        if vis_text.strip() and vis_conf > 0.4:
            print(f"Vision LLM extracted text with confidence {vis_conf}. Doc type: {doc_type}, Lang: {lang}")
            return vis_text, vis_conf
    except Exception as e:
        print("Vision extraction failed, falling back to traditional OCR:", e)

    best_text = ""
    best_conf = 0.0
    
    for strategy in [1, 2, 3]:
        processed_path = enhance_image_advanced(file_path, strategy=strategy)
        
        ocr_blocks = []
        
        import time
        t0 = time.perf_counter()
        
        # 1. Try PaddleOCR first
        if paddle_ocr_engine is not None:
            try:
                with ocr_lock:
                    try:
                        res = paddle_ocr_engine.ocr(processed_path, cls=False)
                    except TypeError:
                        res = paddle_ocr_engine.ocr(processed_path)
                if res and res[0]:
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
                                ocr_blocks.append((box, text, conf))
                    else:
                        for line in res[0]:
                            box = line[0]
                            text, conf = line[1]
                            ocr_blocks.append((box, text, conf))
            except Exception as e:
                print("PaddleOCR failed:", e)

        print(f"PaddleOCR time (strategy {strategy}): {time.perf_counter() - t0:.2f}s")

        # 2. Try EasyOCR fallback if PaddleOCR didn't succeed or had low confidence
        avg_conf = np.mean([b[2] for b in ocr_blocks]) if ocr_blocks else 0.0
        if avg_conf < 0.6 and easy_ocr_engine is not None:
            try:
                with ocr_lock:
                    preprocessed = preprocess_for_ocr(processed_path)
                    res = easy_ocr_engine.readtext(preprocessed)
                if res:
                    ocr_blocks_fallback = []
                    for line in res:
                        box = line[0]
                        text = line[1]
                        conf = line[2]
                        if conf > 0.4:
                            ocr_blocks_fallback.append((box, text, conf))
                    
                    fallback_conf = np.mean([b[2] for b in ocr_blocks_fallback]) if ocr_blocks_fallback else 0.0
                    if fallback_conf > avg_conf:
                        ocr_blocks = ocr_blocks_fallback
                        avg_conf = fallback_conf
            except Exception as e:
                print("EasyOCR failed:", e)

        # Cleanup processed temp file
        if processed_path != file_path and os.path.exists(processed_path):
            try: os.remove(processed_path)
            except: pass
            
        # Parse blocks
        extracted_text = parse_ocr_results_layout(ocr_blocks)
        word_count = len(extracted_text.split())
        
        if avg_conf > best_conf:
            best_conf = avg_conf
            best_text = extracted_text
            
        # Break early if results are satisfactory (some words found with decent confidence)
        if avg_conf > 0.6 and word_count > 0:
            break
        # If strategy 1 found absolutely nothing, it's probably not text, so break early
        if strategy == 1 and word_count == 0 and avg_conf == 0:
            break

    # If the text is completely blank, return error
    if not best_text.strip():
        return "", 0.0

    # Clean LLM correction if confidence is decent
    if best_conf > 0.4:
        best_text = correct_ocr_text_with_llm(best_text)
        
    return best_text, best_conf
