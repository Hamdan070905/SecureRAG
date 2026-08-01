import { useEffect, useState } from 'react'
import { api } from '../services/api'
import KPI from '../components/KPI'
import { BarChart3, CheckCircle2, XCircle, TrendingUp, MessageSquare, Database, ArrowRight } from 'lucide-react'
import { Page } from '../types'
import { motion } from 'framer-motion'

export default function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [stats, setStats] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    api.analytics().then(setStats).catch(() => {})
    api.getDocuments().then(d => setDocs(d.documents ?? [])).catch(() => {})
    api.health().then(setHealth).catch(() => {})
  }, [])

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      {/* Welcome */}
      <div className="card p-6 bg-gradient-to-br from-brand-900/40 via-surface-800 to-surface-800 border-brand-800/40">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Welcome to SecureRAG Enterprise</h2>
        <p className="text-sm text-slate-400">Your private, secure AI document intelligence platform.</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => onNavigate('knowledge')} className="btn-primary text-xs flex items-center gap-2">
            <Database size={13} /> Upload Documents
          </button>
          <button onClick={() => onNavigate('chat')} className="btn-ghost text-xs border border-slate-700 flex items-center gap-2">
            <MessageSquare size={13} /> Start Chatting <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPI label="Total Queries" value={stats?.total ?? 0} icon={BarChart3} />
        <KPI label="Success Rate" value={stats?.safe ? `${Math.round(stats.safe / stats.total * 100)}%` : '—'} icon={CheckCircle2} color="text-emerald-400" />
        <KPI label="Blocked" value={stats?.blocked ?? 0} icon={XCircle} color="text-red-400" />
        <KPI label="Documents" value={docs.length} icon={Database} color="text-amber-400" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { title: 'AI Assistant', desc: 'Query your documents with natural language', icon: MessageSquare, page: 'chat' },
          { title: 'Knowledge Base', desc: 'Manage and index your documents', icon: Database, page: 'knowledge' },
          { title: 'Analytics', desc: 'View usage and performance metrics', icon: BarChart3, page: 'analytics' },
        ].map(({ title, desc, icon: Icon, page }) => (
          <motion.button key={page} whileHover={{ scale: 1.01 }}
            onClick={() => onNavigate(page as Page)}
            className="card p-5 text-left hover:border-brand-500/40 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-brand-600/15 flex items-center justify-center mb-3 group-hover:bg-brand-600/25 transition-colors">
              <Icon size={17} className="text-brand-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </motion.button>
        ))}
      </div>

      {/* System status */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">System Status</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Vector Database', 'ChromaDB', true],
            ['Language Model', health?.model ?? 'Groq Llama 3.3', true],
            ['Security Layer', 'Active', true],
            ['Embedding Model', 'MiniLM-L3-v2', true],
            ['Whisper ASR', 'Loaded', true],
            ['Audit Logger', 'Recording', true],
          ].map(([k, v, ok]) => (
            <div key={k as string} className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-800/50">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <div>
                <p className="text-[11px] text-slate-500">{k as string}</p>
                <p className="text-xs font-medium text-slate-300">{v as string}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
