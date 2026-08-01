import sys, io, os, time, shutil
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')
from fastapi.responses import StreamingResponse
from fastapi.responses import FileResponse
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks, Depends
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List, Union


import whisper
whisper_model = whisper.load_model("base")

from rag_engine import (
    evaluate_answer, process_document, retrieve_chunks, expand_parent_context,
    generate_answer, generate_answer_stream, get_loaded_documents, clear_all_documents, image_metadata,
    delete_document, generate_summary_and_questions, generate_action_answer,
    generate_insights, LLM_PROVIDER, LLM_MODEL, lazy_render_page_preview,
    background_caption_images, set_provider, build_relations, query_graph
)
from security import (
    run_security_checks,
    mask_pii,
    get_current_user,
    require_role,
)
from logger import log_query, get_all_logs, get_stats, get_hourly_activity

app = FastAPI(title="SecureRAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("images/extracted_images", exist_ok=True)

# Mount the extracted_images directory at /images so URL is /images/<filename>
# rag_engine saves to "images/extracted_images/<file>" → served at /images/<file>
app.mount("/images", StaticFiles(directory="images/extracted_images"), name="images")

session = {"docs_loaded": False, "query_count": 0}


class QueryRequest(BaseModel):
    query: str
    doc_filter: Optional[Union[str, List[str]]] = "All Documents"
    answer_mode: Optional[str] = "detailed"


class ActionRequest(BaseModel):
    action: str  # summarize | explain | translate | compare | extract
    doc_filter: Optional[Union[str, List[str]]] = "All Documents"
    language: Optional[str] = "Spanish"


job_status = {}

def process_files_background(job_id: str, paths: list, collection: str, ocr_quality: str = "medium"):
    results = []

    def _process_one(path, filename):
        """Process a single file, never raises — returns result dict."""
        try:
            chunks, words, error, duplicate_of = process_document(path, filename, collection, ocr_quality)
            if error:
                return {"name": filename, "status": "error", "message": error}
            session["docs_loaded"] = True
            entry = {"name": filename, "status": "ok", "chunks": chunks, "words": words}
            if duplicate_of:
                entry["duplicate_of"] = duplicate_of
                entry["warning"] = f"Content appears identical to already-uploaded '{duplicate_of}'"
            return entry
        except Exception as e:
            return {"name": filename, "status": "error", "message": str(e)}

    from concurrent.futures import as_completed
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_process_one, path, filename): (path, filename) for path, filename in paths}
        total = len(futures)
        done = 0
        for future in as_completed(futures):
            result = future.result()  # never raises — _process_one handles exceptions
            results.append(result)
            done += 1
            job_status[job_id]["progress"] = int(done / total * 100)

    # AI summary for successful docs
    for r in results:
        if r.get("status") == "ok":
            try:
                summary_data = generate_summary_and_questions(r["name"])
                r["summary"] = summary_data.get("summary", "")
                r["suggested_questions"] = summary_data.get("suggested_questions", [])
            except Exception:
                pass

    job_status[job_id]["results"] = results
    job_status[job_id]["status"] = "completed"
    job_status[job_id]["progress"] = 100

    import threading
    threading.Thread(target=background_caption_images, daemon=True).start()


@app.get("/health")
def health():
    return {"status": "ok", "model": LLM_MODEL or "default", "vector_db": "ChromaDB"}


@app.get("/provider")
def provider():
    return {"provider": LLM_PROVIDER, "model": LLM_MODEL or "default"}


class ProviderRequest(BaseModel):
    provider: str
    model: str
    apiKey: Optional[str] = None


@app.post("/provider")
def update_provider(req: ProviderRequest):
    import os
    set_provider(req.provider, req.model)
    # If an API key was sent, update the environment in-process
    key_map = {
        "groq": "GROQ_API_KEY",
        "openai": "OPENAI_API_KEY",
        "gemini": "GEMINI_API_KEY",
        "claude": "ANTHROPIC_API_KEY",
        "anthropic": "ANTHROPIC_API_KEY",
        "openrouter": "OPENROUTER_API_KEY",
        "qwen": "QWEN_API_KEY",
        "huggingface": "HF_API_KEY",
    }
    if req.apiKey and req.provider in key_map:
        os.environ[key_map[req.provider]] = req.apiKey
    return {"status": "ok", "provider": req.provider, "model": req.model}


@app.post("/upload")
async def upload(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    collection: str = Form("General"),
    ocr_quality: str = Form("medium"),
):
    results = []
    paths = []

    # Save all uploaded files first
    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".pdf", ".docx", ".doc", ".txt", ".csv", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".pptx", ".ppt"]:
            results.append({"name": file.filename, "status": "error", "message": "Unsupported format"})
            continue

        # Prevent Directory Traversal Attack by sanitizing filename
        safe_filename = os.path.basename(file.filename)
        path = f"uploads/{safe_filename}"
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        paths.append((path, file.filename))

    job_id = str(uuid.uuid4())
    job_status[job_id] = {"status": "processing", "progress": 0, "results": results}
    
    if paths:
        background_tasks.add_task(process_files_background, job_id, paths, collection, ocr_quality)
    else:
        job_status[job_id]["status"] = "completed"
        job_status[job_id]["progress"] = 100

    return {"job_id": job_id, "status": "processing"}


@app.get("/upload_status/{job_id}")
def get_upload_status(job_id: str):
    if job_id not in job_status:
        raise HTTPException(404, "Job not found")
    return job_status[job_id]


@app.get("/documents")
def documents():
    docs = get_loaded_documents()
    return {"documents": [
        {
            "name": n, "chunks": i["chunks"], "words": i["words"], "chars": i["chars"],
            "collection": i.get("collection", "General"),
            "summary": i.get("summary"),
            "suggested_questions": i.get("suggested_questions", []),
            "duplicate_of": i.get("duplicate_of"),
        }
        for n, i in docs.items()
    ]}


@app.delete("/documents/{name}")
def delete_one_document(name: str, user_id: str = Depends(require_role("admin", "manager"))):
    ok = delete_document(name)
    if not ok:
        raise HTTPException(404, "Document not found")
    if not get_loaded_documents():
        session["docs_loaded"] = False
    return {"status": "deleted", "name": name}


@app.delete("/documents")
def delete_all(user_id: str = Depends(require_role("admin", "manager"))):
    global session
    clear_all_documents()
    image_metadata.clear()
    session = {"docs_loaded": False, "query_count": 0}
    return {"status": "cleared"}




@app.post("/query/stream")
def query_stream(req: QueryRequest):
    is_safe, sec_msg = run_security_checks(req.query)
    if not is_safe:
        def blocked():
            yield sec_msg
        return StreamingResponse(blocked(), media_type="text/plain")

    selected = None if req.doc_filter in (None, "All Documents", []) else req.doc_filter
    chunks = retrieve_chunks(
            query=req.query,
            top_k=8,
            doc_filter=selected
        )
    chunks = expand_parent_context(chunks)
    if not chunks:
        def no_docs():
            yield "No documents loaded or no matching information found. Please upload a document."
        return StreamingResponse(no_docs(), media_type="text/plain")

    def gen():
        buffer = ""
        in_thinking = False
        for token in generate_answer_stream(query=req.query, chunks=chunks, mode=req.answer_mode):
            buffer += token
            if not in_thinking:
                if "<think>" in buffer:
                    parts = buffer.split("<think>", 1)
                    if parts[0]:
                        yield parts[0]
                    buffer = parts[1]
                    in_thinking = True
                else:
                    yield token
                    buffer = ""
            else:
                if "</think>" in buffer:
                    parts = buffer.split("</think>", 1)
                    buffer = parts[1]
                    in_thinking = False
    return StreamingResponse(gen(), media_type="text/plain")


@app.post("/query")
def query(req: QueryRequest):
    t0 = time.perf_counter()

    is_safe, sec_msg = run_security_checks(req.query)
    if not is_safe:
        log_query(mask_pii(req.query), False, sec_msg)
        return {"blocked": True, "message": sec_msg}

    selected = None if req.doc_filter in (None, "All Documents", []) else req.doc_filter
    chunks = retrieve_chunks(query=req.query, top_k=8, doc_filter=selected)
    chunks = expand_parent_context(chunks)
    if not chunks:
        return {"blocked": False, "answer": "No relevant information found.",
                "sources": [], "confidence": 0, "chunks_used": 0, "images": []}
    result = generate_answer(query=req.query, chunks=chunks, mode=req.answer_mode)

    images, seen = [], set()
    evidence_pages = []
    seen_evidence = set()
    image_chunks_res = []
    seen_img_chunks = set()
    
    for c in chunks:
        doc_name = c["doc_name"]
        page_num = c.get("page", 1)
        file_path = c.get("file_path")
        source_type = c.get("source_type", "text")

        if source_type == "image" and c.get("image_path"):
            img_path = c["image_path"]
            if img_path not in seen_img_chunks:
                seen_img_chunks.add(img_path)
                clean_path = img_path
                for prefix in ("images/extracted_images/", "extracted_images/", "images/"):
                    if clean_path.startswith(prefix):
                        clean_path = clean_path[len(prefix):]
                        break
                image_chunks_res.append({
                    "doc": doc_name,
                    "page": page_num,
                    "image_path": clean_path,
                    "caption": c.get("image_caption", ""),
                    "confidence": c.get("relevance", 0),
                    "file_path": file_path
                })

        # Generate Evidence Page for PDFs
        if file_path and file_path.lower().endswith(".pdf"):
            ev_key = f"{doc_name}_{page_num}"
            if ev_key not in seen_evidence:
                preview_path = lazy_render_page_preview(file_path, page_num)
                if preview_path:
                    clean_preview = preview_path
                    for prefix in ("images/extracted_images/", "extracted_images/", "images/"):
                        if clean_preview.startswith(prefix):
                            clean_preview = clean_preview[len(prefix):]
                            break
                    seen_evidence.add(ev_key)
                    evidence_pages.append({
                        "doc": doc_name,
                        "page": page_num,
                        "preview": clean_preview,
                        "file_path": file_path
                    })

        # Match images by document + page (exact match first)
        for img in image_metadata:
            if img["doc_name"] == doc_name and img["page"] == page_num:
                img_path = img["path"]
                if not img_path:  # None → text-only page with no render
                    continue
                # Strip known prefixes
                for prefix in ("images/extracted_images/", "extracted_images/", "images/"):
                    if img_path.startswith(prefix):
                        img_path = img_path[len(prefix):]
                        break
                # Verify file exists on disk before returning
                disk_path = os.path.join("images", "extracted_images", img_path)
                if not os.path.exists(disk_path):
                    continue
                if img_path not in seen:
                    seen.add(img_path)
                    images.append(img_path)

        # Fallback: any image from the same document
        if not images:
            for img in image_metadata:
                if img["doc_name"] == doc_name and img["path"]:
                    img_path = img["path"]
                    for prefix in ("images/extracted_images/", "extracted_images/", "images/"):
                        if img_path.startswith(prefix):
                            img_path = img_path[len(prefix):]
                            break
                    disk_path = os.path.join("images", "extracted_images", img_path)
                    if not os.path.exists(disk_path):
                        continue
                    if img_path not in seen:
                        seen.add(img_path)
                        images.append(img_path)

    eval_scores = evaluate_answer(req.query, result["answer"], chunks)
    response_ms = int((time.perf_counter() - t0) * 1000)

    log_query(mask_pii(req.query), True, sec_msg, mask_pii(result["answer"]),
              ", ".join(result.get("sources", [])), result.get("confidence", 0),
              response_time_ms=response_ms)
    session["query_count"] += 1
    source_chunks = [
        {"doc": c["doc_name"], "chunk": c["chunk_index"], "page": c.get("page", 1), "relevance": c["relevance"]}
        for c in chunks
    ]
    return {
        "blocked": False,
        "answer": result["answer"],
        "confidence": result.get("confidence", 0),
        "sources": result.get("sources", []),
        "source_chunks": source_chunks,
        "images": images[:3],
        "evidencePages": evidence_pages,
        "imageChunks": image_chunks_res,
        "chunks_used": result.get("chunks_used", 0),
        "response_time_ms": response_ms,
        "faithfulness": eval_scores.get("faithfulness"),
        "groundedness": eval_scores.get("groundedness"),
        "citations": result.get("citations", []),
        "low_confidence": result.get("low_confidence", False),
    }


@app.post("/action")
def action(req: ActionRequest):
    selected = None if req.doc_filter in (None, "All Documents", []) else req.doc_filter
    probe = {"summarize": "summary", "explain": "explain this", "translate": "translate",
              "compare": "compare", "extract": "key facts figures dates action items"}
    chunks = retrieve_chunks(query=probe.get(req.action, req.action), top_k=10, doc_filter=selected)
    chunks = expand_parent_context(chunks)
    result = generate_action_answer(req.action, chunks, language=req.language)
    return {"answer": result["answer"], "confidence": result.get("confidence", 0),
            "sources": result.get("sources", [])}


@app.get("/insights")
def insights(doc_filter: Optional[str] = None):
    filt = None if not doc_filter or doc_filter == "All Documents" else doc_filter.split(",")
    return generate_insights(doc_filter=filt)


@app.get("/graph/build")
def graph_build(doc_filter: Optional[str] = None, user_id: str = Depends(get_current_user)):
    filt = doc_filter.split(",") if doc_filter else None
    edges = build_relations(filt)
    return {"edges": edges}


@app.get("/graph/query")
def graph_query(entity: str, user_id: str = Depends(get_current_user)):
    return {"entity": entity, "relations": query_graph(entity)}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    path = f"uploads/audio_{int(time.time())}.wav"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    result = whisper_model.transcribe(
    path,
    fp16=False,
    language="en"
)
    os.remove(path)
    return {"text": result["text"]}


@app.get("/analytics")
def analytics():
    docs = get_loaded_documents()
    query_stats = get_stats()
    return {
        "documents": len(docs),
        "chunks": sum(d["chunks"] for d in docs.values()),
        "words": sum(d["words"] for d in docs.values()),
        "total": query_stats.get("total", 0),
        "safe": query_stats.get("safe", 0),
        "blocked": query_stats.get("blocked", 0),
        "avg_confidence": query_stats.get("avg_confidence", 0),
        "avg_response_ms": query_stats.get("avg_response_ms", 0),
        "hourly_activity": get_hourly_activity(),
        "avg_faithfulness": query_stats.get("avg_faithfulness", 0),
        "avg_groundedness": query_stats.get("avg_groundedness", 0),
    }


@app.get("/logs")
def logs():
    return get_all_logs()

@app.get("/download/{doc_name}")
def download_document(doc_name: str):
    file_path = os.path.join("uploads", doc_name)
    if not os.path.exists(file_path):
        raise HTTPException(404, "Document not found")
    return FileResponse(file_path, filename=doc_name)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

def build_relations(*args, **kwargs):
    """Fallback function for knowledge graph / document relations."""
    return []