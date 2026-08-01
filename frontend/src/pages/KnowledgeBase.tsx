import { useEffect, useState } from 'react'
import UploadPanel from '../components/UploadPanel'
import { api } from '../services/api'
import { FileText, Hash, AlignLeft, Search, Trash2, RefreshCw, Copy, Sparkles } from 'lucide-react'
import { Document } from '../types'
import { motion } from 'framer-motion'

export default function KnowledgeBase() {
  const [docs, setDocs] = useState<Document[]>([])
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [removingOne, setRemovingOne] = useState<string | null>(null)
  const [role] = useState<string>(() => localStorage.getItem('user_role') || 'admin')

  const load = () => api.getDocuments().then(d => setDocs(d.documents ?? []))
  useEffect(() => { load() }, [])

  const deleteAll = async () => {
    setDeleting(true)
    await api.deleteDocuments()
    setDocs([])
    setDeleting(false)
  }

  const deleteOne = async (name: string) => {
    setRemovingOne(name)
    try {
      await api.deleteDocument(name)
      load()
    } finally {
      setRemovingOne(null)
    }
  }

  const filtered = docs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: upload */}
      <div className="w-80 min-w-[320px] border-r border-slate-800 p-6 overflow-y-auto">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Upload Documents</h2>
        <UploadPanel onUploaded={load} />
      </div>

      {/* Right: doc list */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="input-base w-full pl-9 text-sm py-2" />
          </div>
          <button onClick={load} className="btn-ghost text-xs flex items-center gap-1.5"><RefreshCw size={13} /> Refresh</button>
          {docs.length > 0 && role === 'admin' && (
            <button onClick={deleteAll} disabled={deleting}
              className="text-xs text-red-400 border border-red-400/20 hover:bg-red-400/10 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5">
              <Trash2 size={13} /> Clear All
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
            <FileText size={32} className="mb-3 opacity-30" />
            {docs.length === 0 ? 'No documents indexed yet.' : 'No results.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((doc, i) => (
              <motion.div key={doc.name} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="card p-4 flex items-start gap-4 hover:border-brand-500/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-200 truncate">{doc.name}</p>
                    <span className="text-[10px] text-slate-500 bg-surface-800 border border-slate-700 px-2 py-0.5 rounded-full">
                      {doc.collection || 'General'}
                    </span>
                    {doc.duplicate_of && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                        <Copy size={9} /> duplicate of {doc.duplicate_of}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500"><Hash size={10} /> {doc.chunks.toLocaleString()} chunks</span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500"><AlignLeft size={10} /> {doc.words.toLocaleString()} words</span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">{(doc.chars / 1000).toFixed(1)}K chars</span>
                  </div>
                  {doc.summary && (
                    <p className="flex items-start gap-1.5 text-[11px] text-slate-400 mt-2 leading-relaxed">
                      <Sparkles size={11} className="text-amber-400 flex-shrink-0 mt-0.5" /> {doc.summary}
                    </p>
                  )}
                  {doc.suggested_questions && doc.suggested_questions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {doc.suggested_questions.map(q => (
                        <span key={q} className="text-[10px] text-blue-300 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
                          {q}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-full">Indexed</span>
                  <button
                    onClick={() => deleteOne(doc.name)}
                    disabled={removingOne === doc.name}
                    className="text-[11px] text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
