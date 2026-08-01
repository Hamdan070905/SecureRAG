import { useState, useEffect } from 'react'
import { User, Eye, Palette, Cpu, Key, MessageSquare, FileText, Image, Volume2, Shield, Download, HelpCircle, Info } from 'lucide-react'
import { api } from '../services/api'

type Section =
  | 'profile'
  | 'appearance'
  | 'theme'
  | 'provider'
  | 'model'
  | 'api_keys'
  | 'chat'
  | 'documents'
  | 'ocr'
  | 'voice'
  | 'privacy'
  | 'export'
  | 'help'
  | 'about'

const sections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Eye },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'provider', label: 'AI Provider', icon: Cpu },
  { id: 'model', label: 'Model Selection', icon: Cpu },
  { id: 'api_keys', label: 'API Keys', icon: Key },
  { id: 'chat', label: 'Chat Settings', icon: MessageSquare },
  { id: 'documents', label: 'Document Settings', icon: FileText },
  { id: 'ocr', label: 'OCR Settings', icon: Image },
  { id: 'voice', label: 'Voice Settings', icon: Volume2 },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
  { id: 'export', label: 'Export Data', icon: Download },
  { id: 'help', label: 'Help & Support', icon: HelpCircle },
  { id: 'about', label: 'About', icon: Info },
] as const

const PROVIDER_MODELS: Record<string, string[]> = {
  groq: ['llama-3.3-70b-versatile', 'llama3-8b-8192', 'mixtral-8x7b-32768'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
  claude: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.0-flash-exp:free'],
  huggingface: ['meta-llama/Llama-3.3-70B-Instruct'],
  ollama: ['qwen3:8b', 'llama3', 'mistral', 'phi3']
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState<Section>('profile')
  const [providerInfo, setProviderInfo] = useState({ provider: 'ollama', model: 'qwen3:8b' })
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  )

  useEffect(() => {
    api.provider().then(setProviderInfo).catch(console.error)
  }, [])

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const activeKey = apiKey.trim() ? apiKey : undefined
      await api.updateProvider(providerInfo.provider, providerInfo.model, activeKey)
      alert('Settings saved successfully!')
      if (activeKey) setApiKey('') // Clear visually after saving
    } catch (e: any) {
      alert('Failed to save settings: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    document.documentElement.classList.toggle('light', newTheme === 'light')
    localStorage.setItem('theme', newTheme)
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Profile Settings</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-xl font-bold text-white shadow-lg">A</div>
              <div>
                <h4 className="text-sm font-medium text-slate-200">Administrator</h4>
                <p className="text-xs text-slate-500">admin@securerag.enterprise</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Display Name</label>
                <input className="input-base w-full text-sm py-2" defaultValue="Admin User" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Role</label>
                <input className="input-base w-full text-sm py-2" defaultValue="Enterprise Admin" disabled />
              </div>
            </div>
          </div>
        )
      case 'appearance':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Appearance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Font Size</label>
                <select className="input-base w-full text-sm py-2">
                  <option>Compact</option>
                  <option selected>Default (Medium)</option>
                  <option>Large</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Density</label>
                <select className="input-base w-full text-sm py-2">
                  <option>Cozy</option>
                  <option selected>Standard</option>
                </select>
              </div>
            </div>
          </div>
        )
      case 'theme':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Theme</h3>
            <div className="flex gap-4">
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 p-4 rounded-xl border text-center transition ${
                  theme === 'dark' ? 'bg-brand-600/20 border-brand-500 text-brand-300' : 'bg-surface-800 border-slate-700 text-slate-400'
                }`}
              >
                Dark Theme
              </button>
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 p-4 rounded-xl border text-center transition ${
                  theme === 'light' ? 'bg-brand-600/20 border-brand-500 text-brand-300' : 'bg-surface-800 border-slate-700 text-slate-400'
                }`}
              >
                Light Theme
              </button>
            </div>
          </div>
        )
      case 'provider':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">AI Provider</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Select Provider</label>
                <select
                  value={providerInfo.provider}
                  onChange={(e) => {
                    const prov = e.target.value
                    const defaultModel = PROVIDER_MODELS[prov]?.[0] || ''
                    setProviderInfo({ provider: prov, model: defaultModel })
                  }}
                  className="input-base w-full text-sm py-2 uppercase font-mono"
                >
                  {Object.keys(PROVIDER_MODELS).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn-primary text-xs w-full py-2.5 mt-4"
              >
                {saving ? 'Saving...' : 'Save Provider Settings'}
              </button>
            </div>
          </div>
        )
      case 'model':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Model Selection</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Select Model</label>
                <select
                  value={providerInfo.model}
                  onChange={(e) => setProviderInfo(prev => ({ ...prev, model: e.target.value }))}
                  className="input-base w-full text-sm py-2 font-mono"
                >
                  {(PROVIDER_MODELS[providerInfo.provider] || []).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn-primary text-xs w-full py-2.5 mt-4"
              >
                {saving ? 'Saving...' : 'Save Model Settings'}
              </button>
            </div>
          </div>
        )
      case 'api_keys':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">API Keys</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                  API Key for {providerInfo.provider.toUpperCase()}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder="Enter API Key here..."
                    className="input-base flex-1 text-sm py-2 font-mono"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="btn-primary text-xs whitespace-nowrap"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn-primary text-xs w-full py-2.5 mt-2"
              >
                {saving ? 'Saving...' : 'Save API Key'}
              </button>
              <p className="text-xs text-slate-500">
                SecureRAG validates and registers API keys securely on the backend server. These are never stored in your local browser storage.
              </p>
            </div>
          </div>
        )
      case 'chat':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Chat Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">System Prompt Overrides</h4>
                  <p className="text-xs text-slate-500">Allow client-side prompt injections defenses.</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-surface-900 text-brand-600 focus:ring-brand-500" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Save History</h4>
                  <p className="text-xs text-slate-500">Persist chat histories in local memory.</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-surface-900 text-brand-600 focus:ring-brand-500" />
              </div>
            </div>
          </div>
        )
      case 'documents':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Document Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Chunk Size (Characters)</label>
                <input type="number" className="input-base w-full text-sm py-2" defaultValue={2000} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Chunk Overlap</label>
                <input type="number" className="input-base w-full text-sm py-2" defaultValue={300} />
              </div>
            </div>
          </div>
        )
      case 'ocr':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">OCR Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Auto-skew Correction</h4>
                  <p className="text-xs text-slate-500">Detect and deskew low-quality document scans.</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-surface-900 text-brand-600 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Min Confidence Threshold</label>
                <input type="range" min="0" max="1" step="0.1" className="w-full accent-brand-500" defaultValue="0.4" />
              </div>
            </div>
          </div>
        )
      case 'voice':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Voice Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Text-to-Speech Engine</label>
                <select className="input-base w-full text-sm py-2">
                  <option>System Default Voice</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Auto-play Responses</h4>
                  <p className="text-xs text-slate-500">Automatically speak text generated by the assistant.</p>
                </div>
                <input type="checkbox" className="rounded border-slate-700 bg-surface-900 text-brand-600 focus:ring-brand-500" />
              </div>
            </div>
          </div>
        )
      case 'privacy':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Privacy & Security</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">PII Masking</h4>
                  <p className="text-xs text-slate-500">Mask private personal info before sending to cloud LLMs.</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-surface-900 text-brand-600 focus:ring-brand-500" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Audit Logging</h4>
                  <p className="text-xs text-slate-500">Log all prompt metadata internally for compliance audits.</p>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-slate-700 bg-surface-900 text-brand-600 focus:ring-brand-500" />
              </div>
            </div>
          </div>
        )
      case 'export':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Export Settings & Data</h3>
            <p className="text-xs text-slate-500">Download your active chat histories and indexed documents metadata.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const data = localStorage.getItem('secureRag_sessions')
                  if (data) {
                    const blob = new Blob([data], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'securerag_history_export.json'
                    a.click()
                  } else {
                    alert('No chat history to export.')
                  }
                }}
                className="btn-primary text-xs"
              >
                Export Chat History (.JSON)
              </button>
            </div>
          </div>
        )
      case 'help':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">Help & Support</h3>
            <p className="text-xs text-slate-400">
              For support queries, please contact our enterprise system administrator at <code className="bg-surface-900 px-1 py-0.5 rounded text-brand-400">support@securerag.enterprise</code>.
            </p>
          </div>
        )
      case 'about':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-100">About SecureRAG</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <p><span className="font-semibold text-slate-200">Version:</span> 2.1.0 Enterprise</p>
              <p><span className="font-semibold text-slate-200">Release Build:</span> 2026.07.23-PROD</p>
              <p><span className="font-semibold text-slate-200">Framework:</span> Vite + Fast RAG Core</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex h-full bg-surface-950 text-slate-100">
      {/* Settings Navigation Sidebar */}
      <div className="w-64 border-r border-slate-800 bg-surface-900/40 p-4 space-y-1">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-4">Settings</h2>
        {sections.map((sec) => {
          const Icon = sec.icon
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                activeSection === sec.id ? 'bg-brand-600/20 text-brand-300' : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200'
              }`}
            >
              <Icon size={16} />
              {sec.label}
            </button>
          )
        })}
      </div>

      {/* Main Settings Panel */}
      <div className="flex-1 p-8 max-w-2xl overflow-y-auto">
        <div className="bg-surface-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
