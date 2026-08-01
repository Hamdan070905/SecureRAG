import { useUpload } from "../hooks/useUpload"
import { useState, useRef, KeyboardEvent } from 'react'
import { Send, Paperclip, Mic, MicOff, Square, CheckCircle2, XCircle, Loader2, X, FileText, Sparkles } from 'lucide-react'
import { api } from '../services/api'

interface Props {
  onSend: (text: string) => void
  onAction: (action: string, language?: string) => void
  onStop: () => void
  loading: boolean
  docFilter: string | string[]
  setDocFilter: (v: string | string[]) => void
  answerMode: string
  setAnswerMode: (v: string) => void
  docs: string[]
  onUploaded: () => void
  aiVoice: boolean
  setAiVoice: (v: boolean) => void
}

const ACTIONS = [
  { id: 'summarize', label: 'Summarize' },
  { id: 'explain', label: 'Explain' },
  { id: 'translate', label: 'Translate' },
  { id: 'compare', label: 'Compare' },
  { id: 'extract', label: 'Extract' },
]

// Animated waveform bars shown while recording
function Waveform() {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="w-0.5 bg-red-400 rounded-full animate-pulse"
          style={{
            height: `${8 + (i % 3) * 6}px`,
            animationDelay: `${i * 0.12}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  )
}

export default function ChatInput({
  onSend, onAction, onStop, loading, docFilter, setDocFilter, answerMode, setAnswerMode, docs, onUploaded, aiVoice, setAiVoice
}: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploading, results, uploadFiles, progress } = useUpload(onUploaded)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [removingDoc, setRemovingDoc] = useState<string | null>(null)
  const [ocrQuality, setOcrQuality] = useState<'off' | 'easy' | 'medium' | 'high'>('off')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const selectedList = docFilter === 'All Documents' ? docs : (Array.isArray(docFilter) ? docFilter : [docFilter])

  const toggleDoc = (name: string) => {
    const current = docFilter === 'All Documents' ? [...docs] : (Array.isArray(docFilter) ? [...docFilter] : [docFilter])
    const next = current.includes(name) ? current.filter(d => d !== name) : [...current, name]
    if (next.length === 0 || next.length === docs.length) setDocFilter('All Documents')
    else setDocFilter(next)
  }

  const removeDoc = async (name: string) => {
    setRemovingDoc(name)
    try {
      await api.deleteDocument(name)
      onUploaded()
      if (Array.isArray(docFilter)) setDocFilter(docFilter.filter(d => d !== name))
    } catch {
      alert('Failed to remove document')
    } finally {
      setRemovingDoc(null)
    }
  }

  const submit = () => {
    const val = textRef.current?.value || ''
    if (!val.trim() || loading) return
    onSend(val.trim())
    if (textRef.current) {
      textRef.current.value = ''
      textRef.current.style.height = 'auto'
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const toggleMic = async () => {
    if (recording) {
      mediaRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' })
        setTranscribing(true)
        try {
          const { text: t } = await api.transcribe(blob)
          let finalT = t.trim()
          if (/^(hey|hi)\s+sentra/i.test(finalT)) {
            finalT = finalT.replace(/^(hey|hi)\s+sentra\s*[.,!?]*\s*/i, '')
          }
          if (finalT) onSend(finalT)
        } catch {
          console.error('Transcription failed')
        } finally {
          setTranscribing(false)
        }
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch {
      alert('Microphone access denied')
    }
  }

  return (
    <div className="px-4 pb-4 pt-2">

      {/* Uploaded documents — Claude/ChatGPT style chips, tap to include/exclude from search */}
      {docs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wide text-slate-500 mr-1">Searching:</span>
          {docs.map(d => {
            const active = selectedList.includes(d)
            return (
              <div
                key={d}
                className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border transition cursor-pointer ${
                  active ? 'bg-brand-600/20 border-brand-500 text-brand-300' : 'bg-surface-800 border-slate-700 text-slate-500'
                }`}
              >
                <FileText size={11} onClick={() => toggleDoc(d)} />
                <span className="truncate max-w-[120px]" onClick={() => toggleDoc(d)}>{d}</span>
                <button
                  onClick={() => removeDoc(d)}
                  disabled={removingDoc === d}
                  title="Remove document"
                  className="p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  {removingDoc === d ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                </button>
              </div>
            )
          })}
          {selectedList.length !== docs.length && (
            <button onClick={() => setDocFilter('All Documents')} className="text-[10px] text-brand-400 hover:underline">
              select all
            </button>
          )}
        </div>
      )}

      {/* AI Actions */}
      {docs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Sparkles size={12} className="text-amber-400" />
          {ACTIONS.map(a => (
            <button
              key={a.id}
              disabled={loading}
              onClick={() => onAction(a.id)}
              className="text-[11px] text-slate-400 border border-slate-700 hover:border-brand-500 hover:text-brand-400 px-2.5 py-1 rounded-full transition-colors disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Answer mode */}
      <div className="flex gap-2 mb-3">
        <select value={answerMode} onChange={e => setAnswerMode(e.target.value)}
          className="input-base text-xs py-1.5">
          {['detailed', 'summary', 'bullet', 'technical'].map(m => <option key={m}>{m}</option>)}
        </select>
      </div>

      {/* Upload progress chips */}
      {results.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {results.map((file, i) => (
            <div key={i} className="flex flex-col gap-1 px-3 py-1.5 rounded-xl bg-surface-800 border border-slate-700 text-xs w-full max-w-[240px]">
              <div className="flex items-center gap-2">
                {uploading ? (
                  <Loader2 size={13} className="text-brand-400 animate-spin flex-shrink-0" />
                ) : file.status === 'ok' ? (
                  <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle size={13} className="text-red-400 flex-shrink-0" />
                )}
                <span className="font-medium truncate max-w-[160px]">{file.name}</span>
                {uploading ? (
                  <span className="text-brand-400">Uploading…</span>
                ) : file.status === 'ok' ? (
                  <span className="text-emerald-400">{file.chunks?.toLocaleString()} chunks{file.duplicate_of ? ' · duplicate' : ''}</span>
                ) : (
                  <span className="text-red-400">{file.message}</span>
                )}
              </div>
              {uploading && (
                <div className="w-full h-1 bg-surface-700 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transcribing indicator */}
      {transcribing && (
        <div className="mb-2 flex items-center gap-2 text-xs text-brand-400">
          <Loader2 size={13} className="animate-spin" /> Transcribing…
        </div>
      )}

      {/* Main input bar */}
      <div className="relative group rounded-full mt-1">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 via-brand-500 to-blue-500 rounded-full blur opacity-30 group-hover:opacity-100 hover:animate-none animate-pulse transition duration-500"></div>
        <div className="relative flex items-center gap-2 bg-surface-900/90 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2.5 focus-within:bg-surface-800 focus-within:border-purple-500/50 transition-all duration-300">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,image/png,image/jpeg"
          onChange={async (e) => {
            if (!e.target.files) return
            await uploadFiles(Array.from(e.target.files), 'General', ocrQuality)
            e.target.value = ""
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 mb-0.5 disabled:opacity-40"
          title="Attach documents"
        >
          {uploading ? <Loader2 size={18} className="animate-spin text-brand-400" /> : <Paperclip size={18} />}
        </button>

        {/* OCR Quality Switch & Toggle */}
        <div className="flex items-center gap-2 flex-shrink-0 mb-0.5 bg-surface-950/50 rounded-xl p-1 border border-white/10">
          <span className="text-[8px] text-slate-500 select-none font-medium uppercase tracking-wider ml-1">OCR</span>
          
          {/* Switch Button */}
          <div className="switch-button">
            <label className="switch-outer">
              <input
                type="checkbox"
                checked={ocrQuality !== 'off'}
                onChange={() => setOcrQuality(ocrQuality === 'off' ? 'easy' : 'off')}
              />
              <div className="button">
                <span className="button-toggle"></span>
                <span className="button-indicator"></span>
              </div>
            </label>
          </div>

          {/* E / M / H Buttons */}
          <div className="flex gap-0.5">
            {(['easy', 'medium', 'high'] as const).map((lvl) => {
              const active = ocrQuality === lvl;
              const disabled = ocrQuality === 'off';
              return (
                <button
                  key={lvl}
                  disabled={disabled}
                  onClick={() => setOcrQuality(lvl)}
                  title={
                    lvl === 'easy'   ? 'Easy: EasyOCR only (Fast)' :
                    lvl === 'medium' ? 'Medium: EasyOCR + PaddleOCR (Balanced)' :
                                       'High: Full chain with HunyuanOCR + Vision LLM (Max Accuracy)'
                  }
                  className={`relative z-10 text-[9px] uppercase tracking-wide font-bold w-5 h-5 flex items-center justify-center rounded-md transition-all duration-300 ${
                    disabled 
                      ? 'text-slate-700 opacity-40 cursor-not-allowed'
                      : active
                      ? lvl === 'easy'
                        ? 'text-white shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                        : lvl === 'medium'
                        ? 'text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                        : 'text-white shadow-[0_0_8px_rgba(236,72,153,0.4)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {active && !disabled && (
                    <span className={`absolute inset-0 rounded-md -z-10 ${
                      lvl === 'easy' ? 'bg-sky-500' :
                      lvl === 'medium' ? 'bg-purple-500' : 'bg-pink-500'
                    }`} />
                  )}
                  {lvl === 'easy' ? 'E' : lvl === 'medium' ? 'M' : 'H'}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          ref={textRef}
          onKeyDown={onKey}
          placeholder="Ask anything about your documents… (Enter to send)"
          rows={1}
          className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500/70 focus:outline-none resize-none max-h-40 overflow-y-auto py-1.5 leading-relaxed tracking-wide font-light"
          style={{ height: 'auto' }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = t.scrollHeight + 'px'
          }}
          disabled={loading}
        />

        <div className="flex items-center gap-1.5 flex-shrink-0 mb-0.5">
          <button
            onClick={() => setAiVoice(!aiVoice)}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
              aiVoice ? 'text-brand-400 bg-brand-400/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={aiVoice ? 'AI Voice ON' : 'AI Voice OFF'}
          >
            <span className="text-xs font-medium">Voice</span>
            {aiVoice ? '◉' : '○'}
          </button>
          <button
            onClick={toggleMic}
            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              recording ? 'text-red-400 bg-red-400/10' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={recording ? 'Stop recording' : 'Start voice input'}
          >
            {recording ? (
              <>
                <Waveform />
                <MicOff size={18} />
              </>
            ) : (
              <Mic size={18} />
            )}
          </button>
          <button
            onClick={loading ? onStop : submit}
            className="btn-primary p-2 rounded-xl"
            title={loading ? "Stop generation" : "Send message"}
          >
            {loading ? <Square size={16} className="animate-pulse" /> : <Send size={16} />}
          </button>
        </div>
        </div>
      </div>
      <p className="text-center text-[10px] text-slate-600 mt-2">Secure · Private · Enterprise Ready</p>
    </div>
  )
}
