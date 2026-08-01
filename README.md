<<<<<<< HEAD
# SecureRAG Enterprise

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
# Copy your existing rag_engine.py, security.py, logger.py here
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Structure
- `backend/` — FastAPI wrapper around your existing Python pipeline
- `frontend/` — React + TypeScript + Tailwind enterprise UI

## API Endpoints
- `GET /health` — System status
- `POST /upload` — Upload documents
- `GET /documents` — List indexed documents
- `DELETE /documents` — Clear all documents
- `POST /query` — Query the RAG pipeline
- `POST /transcribe` — Whisper voice transcription
- `GET /analytics` — Usage statistics
- `GET /logs` — Audit log entries
=======
# SecureRAG
>>>>>>> 1b114aa4b1cb2971f9ac630fe606e7dcf16ff824
