export default function Architecture() {
  const steps = [
    { label: 'User', desc: 'Upload PDF / DOCX / TXT / CSV' },
    { label: 'Parser', desc: 'PyMuPDF · python-docx · pandas' },
    { label: 'Chunker', desc: 'Semantic chunking (512 tokens, 50 overlap)' },
    { label: 'Embedder', desc: 'Sentence Transformers (paraphrase-MiniLM-L3-v2)' },
    { label: 'Vector DB', desc: 'ChromaDB — persistent storage' },
    { label: 'Security', desc: 'Injection · Toxicity · Rate limit · Validation' },
    { label: 'Retriever', desc: 'Top-K semantic search + parent context expansion' },
    { label: 'Reranker', desc: 'Cross-encoder reranking' },
    { label: 'LLM', desc: 'Groq Llama 3.3-70B — grounded generation' },
    { label: 'Output', desc: 'Answer + Confidence + Sources + Images' },
    { label: 'Logger', desc: 'Audit log — JSON persistence' },
  ]

  const stack = [
    ['Python', '#3b82f6'], ['FastAPI', '#22c55e'], ['React', '#38bdf8'],
    ['TypeScript', '#818cf8'], ['Tailwind CSS', '#f472b6'], ['ChromaDB', '#fb923c'],
    ['Sentence Transformers', '#a78bfa'], ['Groq API', '#34d399'],
    ['Llama 3.3-70B', '#fbbf24'], ['Whisper', '#60a5fa'], ['PyMuPDF', '#f87171'],
  ]

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-6">RAG Pipeline</h3>
        <div className="flex flex-col items-center gap-0">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className={`flex items-start gap-4 w-full max-w-md p-3 rounded-xl border transition-all
                ${i === 5 ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-700/60 bg-surface-800/50'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${i === 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-brand-600/20 text-brand-400'}`}>
                  {i + 1}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{s.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-5 bg-gradient-to-b from-brand-600/40 to-transparent" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Technology Stack</h3>
        <div className="flex flex-wrap gap-2">
          {stack.map(([name, color]) => (
            <span key={name} className="text-xs font-medium px-3 py-1.5 rounded-full border"
              style={{ borderColor: color + '40', color, background: color + '10' }}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
