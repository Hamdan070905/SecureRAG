import { Shield, MessageSquare, Search, Pencil, Trash2, Plus, LayoutDashboard, Bot, BarChart3, Lock, Network, Settings2, X } from 'lucide-react'
import { useState } from 'react'
import kelvinLogo from '../../assets/kelvin6k-logo.jpg'

interface ChatHistory { id: string; title: string }

interface Props {
  chats: ChatHistory[]
  currentChat: string
  onNewChat: () => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  onRenameChat: (id: string, title: string) => void
  onNavigate: (page: string) => void
  currentPage: string
  loading: boolean
  sidebarOpen?: boolean
  onCloseSidebar?: () => void
}

const NAV_ITEMS = [
  { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { label: 'AI Assistant', page: 'chat', icon: Bot },
  { label: 'Analytics', page: 'analytics', icon: BarChart3 },
  { label: 'Security', page: 'security', icon: Lock },
  { label: 'Architecture', page: 'architecture', icon: Network },
  { label: 'Settings', page: 'settings', icon: Settings2 },
]

export default function Sidebar({ chats, currentChat, onNewChat, onSelectChat, onDeleteChat, onRenameChat, onNavigate, currentPage, loading, sidebarOpen, onCloseSidebar }: Props) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const visibleChats = search.trim()
    ? chats.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))
    : chats

  const commitRename = (id: string) => {
    if (editValue.trim()) onRenameChat(id, editValue.trim())
    setEditingId(null)
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-[#0d0d0d]/98 backdrop-blur-2xl border-r border-white/[0.06]
        transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        shadow-2xl shadow-black/80
      `}
    >
      {/* Subtle gradient top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <img
            src={kelvinLogo}
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-md flex-shrink-0"
            alt="Kelvin6k Logo"
          />
          <div>
            <div className="text-sm font-semibold text-white leading-none tracking-tight">SecureRAG</div>
            <div className="text-[10px] text-purple-400/80 mt-0.5 font-medium uppercase tracking-[0.15em]">Enterprise</div>
          </div>
        </div>
        <button
          onClick={onCloseSidebar}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          <X size={15} />
        </button>
      </div>

      {/* New Chat + Search */}
      <div className="px-3 py-3 border-b border-white/[0.05] space-y-2">
        <button
          onClick={onNewChat}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium
            bg-gradient-to-r from-violet-600/20 to-purple-600/20 border border-violet-500/25
            text-violet-300 hover:text-white hover:border-violet-400/50 hover:from-violet-600/30 hover:to-purple-600/30
            transition-all duration-200 disabled:opacity-40 active:scale-[0.98]
            shadow-[0_0_20px_rgba(139,92,246,0.08)] hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]"
        >
          <Plus size={15} />
          New Chat
        </button>
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-400 placeholder-slate-600 focus:outline-none focus:border-violet-500/40 focus:text-slate-200 transition-all"
          />
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {chats.length > 0 && (
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-slate-600 font-medium">Recent</p>
        )}

        {visibleChats.length === 0 && search && (
          <p className="px-3 py-2 text-xs text-slate-600">No results for "{search}"</p>
        )}

        {visibleChats.map(chat => (
          <div
            key={chat.id}
            className={`group relative flex items-center gap-1 px-1 py-0.5 rounded-xl transition-all duration-200 ${
              currentChat === chat.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
            }`}
          >
            {currentChat === chat.id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-violet-500 rounded-r-full" />
            )}

            {editingId === chat.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitRename(chat.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitRename(chat.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 bg-white/[0.06] border border-violet-500/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
              />
            ) : (
              <button
                onClick={() => { onSelectChat(chat.id); }}
                disabled={loading}
                className="flex-1 text-left px-2 py-2 flex items-center gap-2.5 min-w-0 disabled:opacity-50"
              >
                <MessageSquare size={13} className={currentChat === chat.id ? 'text-violet-400 flex-shrink-0' : 'text-slate-600 flex-shrink-0'} />
                <span className={`truncate text-xs ${currentChat === chat.id ? 'text-slate-200 font-medium' : 'text-slate-500'}`}>{chat.title}</span>
              </button>
            )}

            {editingId !== chat.id && (
              <>
                <button
                  onClick={() => { setEditingId(chat.id); setEditValue(chat.title) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-slate-300 p-1 transition-all flex-shrink-0"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this chat?')) onDeleteChat(chat.id) }}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 p-1 transition-all flex-shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Navigation */}
        <div className="mt-4 pt-3 border-t border-white/[0.05]">
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-slate-600 font-medium">Navigate</p>
          <div className="space-y-0.5 mt-1">
            {NAV_ITEMS.map(({ label, page, icon: Icon }) => (
              <button
                key={page}
                onClick={() => onNavigate(page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  currentPage === page
                    ? 'bg-violet-500/12 text-violet-300 border border-violet-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={15} className={currentPage === page ? 'text-violet-400' : 'text-slate-600'} />
                <span className="font-medium text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer status */}
      <div className="px-4 py-4 border-t border-white/[0.05]">
        <div className="space-y-2">
          {[['Vector DB', 'Ready', 'emerald'], ['Security', 'Active', 'emerald'], ['LLM', 'Groq Llama 3.3', 'violet']].map(([k, v, color]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600 font-medium uppercase tracking-wide">{k}</span>
              <span className={`text-[10px] font-medium flex items-center gap-1.5 ${color === 'emerald' ? 'text-emerald-400' : 'text-violet-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block animate-pulse ${color === 'emerald' ? 'bg-emerald-400' : 'bg-violet-400'}`} />
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
