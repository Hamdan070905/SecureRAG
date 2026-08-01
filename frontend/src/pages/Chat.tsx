import { useEffect, useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import ChatInput from '../components/ChatInput'
import { useChat } from '../hooks/useChat'
import { api } from '../services/api'
import { Shield, Sparkles, FileText, Zap, Brain } from 'lucide-react'
import { TextLoop } from '../components/core/text-loop'
import { TextEffect } from '../components/core/text-effect'

import kelvinLogo from '../../assets/kelvin6k-logo.jpg'

interface Props {
  chat: ReturnType<typeof useChat>
}

const SUGGESTIONS = [
  { icon: FileText, label: 'Summarize key findings', color: 'violet' },
  { icon: Brain, label: 'Explain the main concepts', color: 'blue' },
  { icon: Zap, label: 'Extract action items', color: 'amber' },
  { icon: Sparkles, label: 'Show confidence scores', color: 'emerald' },
]

export default function Chat({ chat }: Props) {
  const [docs, setDocs] = useState<string[]>([])
  const hasMessages = chat.messages.length > 0

  const loadDocs = () => {
    api.getDocuments().then(d => setDocs(d.documents?.map((x: any) => x.name) ?? []))
    api.graphBuild?.().catch(() => {})
  }
  useEffect(() => { loadDocs() }, [])

  if (!hasMessages) {
    // HERO: full centered layout like Claude/Gemini
    return (
      <div className="flex flex-col h-full">
        {/* Top spacer + centered content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0">
          {/* Logo */}
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-2xl scale-150" />
            <img
              src={kelvinLogo}
              className="relative w-24 h-24 rounded-2xl object-contain bg-white p-1.5 shadow-2xl dark:bg-white/95"
              alt="Kelvin6k Logo"
            />
          </div>

          <h2 className="text-2xl font-semibold text-white mb-1 tracking-tight">
            <TextEffect preset="fade-in-blur" speedReveal={1.1} speedSegment={0.3}>
              Hi, I'm Sentra
            </TextEffect>
          </h2>

          <div className="h-6 flex items-center justify-center mb-3">
            <TextLoop className="text-sm text-violet-400/80 font-light">
              <span>Ask questions from uploaded PDFs</span>
              <span>Retrieve answers with citations</span>
              <span>Search engineering drawings</span>
              <span>Analyze contracts securely</span>
              <span>Compare technical specifications</span>
              <span>Extract tables from scanned reports</span>
              <span>Chat with enterprise documents</span>
            </TextLoop>
          </div>

          <p className="text-sm text-slate-400 max-w-md text-center leading-relaxed mb-5">
            Upload documents and ask anything — your data stays private with enterprise-grade security.
          </p>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 justify-center max-w-xl mb-8">
            {SUGGESTIONS.map(({ icon: Icon, label, color }) => (
              <button
                key={label}
                onClick={() => { if (!chat.loading) chat.sendMessage(label) }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-white/[0.02]
                  ${color === 'violet' ? 'border-violet-500/25 text-violet-400 hover:bg-violet-500/10 hover:border-violet-400/40' : ''}
                  ${color === 'blue' ? 'border-blue-500/25 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400/40' : ''}
                  ${color === 'amber' ? 'border-amber-500/25 text-amber-400 hover:bg-amber-500/10 hover:border-amber-400/40' : ''}
                  ${color === 'emerald' ? 'border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400/40' : ''}
                `}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Input — centered, max width like Claude */}
          <div className="w-full max-w-2xl">
            <ChatInput
              onSend={chat.sendMessage}
              onAction={chat.runAction}
              onStop={chat.stop}
              loading={chat.loading}
              docFilter={chat.docFilter}
              setDocFilter={chat.setDocFilter}
              answerMode={chat.answerMode}
              setAnswerMode={chat.setAnswerMode}
              docs={docs}
              onUploaded={loadDocs}
              aiVoice={chat.aiVoice}
              setAiVoice={chat.setAiVoice}
            />
          </div>
        </div>
      </div>
    )
  }

  // CHAT MODE: messages + input at bottom
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <ChatWindow messages={chat.messages} loading={chat.loading} />
      </div>
      <div className="max-w-3xl mx-auto w-full px-4 pb-2">
        <ChatInput
          onSend={chat.sendMessage}
          onAction={chat.runAction}
          onStop={chat.stop}
          loading={chat.loading}
          docFilter={chat.docFilter}
          setDocFilter={chat.setDocFilter}
          answerMode={chat.answerMode}
          setAnswerMode={chat.setAnswerMode}
          docs={docs}
          onUploaded={loadDocs}
          aiVoice={chat.aiVoice}
          setAiVoice={chat.setAiVoice}
        />
      </div>
    </div>
  )
}
