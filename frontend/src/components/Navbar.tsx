import { Sun, Moon, Wifi, Menu, Shield, X, PanelLeft } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { Page } from '../types'
import { api } from '../services/api'
import kelvinLogo from '../../assets/kelvin6k-logo.jpg'

const titles: Record<Page, string> = {
  dashboard: 'Dashboard', chat: 'AI Assistant', knowledge: 'Knowledge Base',
  analytics: 'Analytics', security: 'Security Center', architecture: 'Architecture', settings: 'Settings',
}

interface NavbarProps {
  page: Page
  onNavigate: (p: Page) => void
  onMenuToggle?: () => void
  sidebarOpen?: boolean
}

export default function Navbar({ page, onNavigate, onMenuToggle, sidebarOpen }: NavbarProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  })
  const [providerInfo, setProviderInfo] = useState({ provider: 'Loading...', model: 'Loading...' })
  const [infoOpen, setInfoOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const fetchProvider = () => {
      api.provider().then(setProviderInfo).catch(console.error)
    }
    fetchProvider()
    const interval = setInterval(fetchProvider, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setInfoOpen(false)
      }
    }
    if (infoOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [infoOpen])

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-white/[0.05] bg-[#0a0a0a]/95 backdrop-blur-xl flex-shrink-0 relative z-20">
      {/* Top edge accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent pointer-events-none" />

      <div className="flex items-center gap-3">
        {/* Sidebar toggle — always visible */}
        <button
          onClick={onMenuToggle}
          className={`p-2 rounded-xl transition-all duration-200 border ${
            sidebarOpen
              ? 'text-violet-400 bg-violet-500/10 border-violet-500/30'
              : 'text-slate-500 hover:text-slate-200 bg-white/[0.03] border-white/[0.06] hover:border-white/10 hover:bg-white/[0.06]'
          }`}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <PanelLeft size={16} />
        </button>

        <div className="w-px h-5 bg-white/[0.06]" />

        <h1 className="text-sm font-medium text-slate-300 tracking-tight">{titles[page]}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/8 border border-emerald-400/15 px-2.5 py-1.5 rounded-full">
          <Wifi size={11} />
          <span className="font-medium">Live</span>
        </div>

        {/* Provider badge */}
        <div className="hidden md:block text-[11px] text-slate-500 bg-white/[0.03] border border-white/[0.06] px-3 py-1.5 rounded-full uppercase font-mono tracking-wide">
          {providerInfo.provider} · {providerInfo.model}
        </div>

        {/* DB badge */}
        <div className="hidden md:block text-[11px] text-slate-500 bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 rounded-full">ChromaDB</div>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.06]"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Info button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setInfoOpen(o => !o)}
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 transition-all duration-150 overflow-hidden bg-white p-0.5"
            title="Sentra Info"
          >
            <img src={kelvinLogo} className="w-full h-full object-contain" alt="Kelvin6k Brand" />
          </button>

          {infoOpen && (
            <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-white/[0.07] bg-[#0d0d0d]/98 backdrop-blur-2xl shadow-2xl shadow-black/70 p-5 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={kelvinLogo}
                    className="w-9 h-9 rounded-xl object-contain bg-white p-0.5 shadow-lg flex-shrink-0"
                    alt="Kelvin6k Logo"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">Sentra Enterprise</p>
                    <p className="text-[10px] text-violet-400/80 mt-0.5 uppercase tracking-wider">Multimodal RAG Platform</p>
                  </div>
                </div>
                <button onClick={() => setInfoOpen(false)} className="text-slate-600 hover:text-slate-300 transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  ['Version', '2.1.0 Enterprise'],
                  ['LLM Provider', providerInfo.provider.toUpperCase()],
                  ['Model', providerInfo.model],
                  ['Vector DB', 'ChromaDB'],
                  ['OCR Pipeline', 'EasyOCR → Paddle → Hunyuan → Vision LLM'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                    <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">{k}</span>
                    <span className="text-[10px] text-slate-300 font-mono text-right max-w-[55%] truncate">{v}</span>
                  </div>
                ))}

                <div className="pt-1">
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2 font-medium">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['Hybrid Retrieval', 'Secure RAG', 'OCR Routing', 'Semantic Image Search', 'Evidence Viewer', 'Multimodal AI'].map(f => (
                      <span key={f} className="text-[10px] text-violet-400 bg-violet-400/8 border border-violet-400/20 px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.04]">
                  <p className="text-[10px] text-slate-700 text-center">React · FastAPI · ChromaDB · Ollama · Qwen3 · Gemini · Groq</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
