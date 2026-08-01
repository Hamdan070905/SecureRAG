import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import Download from "yet-another-react-lightbox/plugins/download"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Message, EvidencePage } from '../types'
import { Shield, FileText, Image as ImageIcon, TrendingUp, AlertTriangle, BookOpen, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'

// Use Vite proxy path — never hardcode localhost
const imgUrl = (src: string) => `/api/images/${src}`

export default function MessageBubble({ msg }: { msg: Message }) {

  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [evidenceIndex, setEvidenceIndex] = useState(0)
  const isUser = msg.role === 'user'



  const evidenceSlides = (msg.evidencePages ?? []).map((ep) => ({
    src: imgUrl(ep.preview),
    download: imgUrl(ep.preview),
    title: `${ep.doc} — Page ${ep.page}`,
  }))

  const [imgChunkOpen, setImgChunkOpen] = useState(false)
  const [imgChunkIndex, setImgChunkIndex] = useState(0)

  // Group image chunks by page
  const groupedImageChunks = (msg.imageChunks ?? []).reduce((acc, curr) => {
    const key = `${curr.doc}-${curr.page}`
    if (!acc[key]) acc[key] = []
    acc[key].push(curr)
    return acc
  }, {} as Record<string, typeof msg.imageChunks>)

  const groupedImgChunksArray = Object.values(groupedImageChunks)

  const imgChunkSlides = (msg.imageChunks ?? []).map((ic) => ({
    src: imgUrl(ic.image_path),
    download: imgUrl(ic.image_path),
    title: `${ic.doc} — Page ${ic.page}`,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1
        ${isUser ? 'bg-brand-600' : 'bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600'}`}>
        {isUser ? 'U' : <Shield size={14} className="text-brand-400" />}
      </div>

      <div className={`max-w-[75%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Bubble */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-brand-600 text-white rounded-tr-sm'
            : msg.blocked
              ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-tl-sm'
              : 'bg-surface-800 border border-slate-700/60 text-slate-200 rounded-tl-sm'
          }`}>
          {msg.blocked && (
            <div className="flex items-center gap-2 mb-2 text-red-400 font-semibold text-xs">
              <AlertTriangle size={12} /> Security Block
            </div>
          )}
          {msg.low_confidence && (
            <div className="mb-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-1.5 flex items-center gap-1.5 font-medium">
              <AlertTriangle size={13} /> ⚠ Low confidence — this answer may not be fully supported by your documents.
            </div>
          )}
          {isUser ? (
            <span>{msg.content}</span>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  const lang = /language-(\w+)/.exec(className || '')?.[1]
                  return lang ? (
                    <SyntaxHighlighter style={oneDark} language={lang} PreTag="div" className="rounded-lg text-xs my-2">
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : <code className="bg-surface-900 px-1.5 py-0.5 rounded text-brand-300 text-xs">{children}</code>
                },
                table: ({ children }) => (
                  <div className="overflow-auto my-2">
                    <table className="text-xs border-collapse w-full">{children}</table>
                  </div>
                ),
                th: ({ children }) => <th className="border border-slate-600 px-3 py-1.5 bg-surface-900 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-slate-700 px-3 py-1.5">{children}</td>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Confidence + Sources */}
        {!isUser && !msg.blocked && (msg.confidence !== undefined || (msg.sources && msg.sources.length > 0)) && (
          <div className="flex flex-wrap gap-2 px-1">
            {msg.confidence !== undefined && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-1 rounded-full">
                <TrendingUp size={10} /> {msg.confidence}% confidence
              </span>
            )}
            {msg.sources?.map(s => (
              <span key={s} className="flex items-center gap-1 text-[11px] text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-1 rounded-full">
                <FileText size={10} /> {s}
              </span>
            ))}
          </div>
        )}

        {/* Citations Badges */}
        {!isUser && msg.citations && msg.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 px-1">
            {msg.citations.map(c => (
              <span key={c.n} className="text-[10px] text-blue-300 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full font-mono">
                [{c.n}] {c.doc} p{c.page}
              </span>
            ))}
          </div>
        )}


        {/* PDF Evidence Pages */}
        {(msg.evidencePages ?? []).length > 0 && (
          <div className="px-1 w-full">
            <div className="flex items-center gap-1.5 mb-2">
              <BookOpen size={12} className="text-amber-400" />
              <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wide">Evidence Pages</span>
            </div>
            <div className="flex gap-3 flex-wrap">
              {(msg.evidencePages ?? []).map((ep, i) => (
                <div key={`${ep.doc}-${ep.page}`} className="flex flex-col gap-1">
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => { setEvidenceIndex(i); setEvidenceOpen(true) }}
                  >
                    <img
                      src={imgUrl(ep.preview)}
                      alt={`${ep.doc} p${ep.page}`}
                      className="w-32 h-44 object-cover object-top rounded-xl border border-slate-700 hover:border-amber-500/60 transition-colors shadow-lg"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <ExternalLink size={18} className="text-white" />
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                      p.{ep.page}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 w-32 mt-1">
                    <span className="text-[10px] text-slate-300 font-medium truncate" title={ep.doc}>{ep.doc}</span>
                    <div className="flex items-center justify-between text-[9px]">
                      <a
                        href={`/api/download/${ep.doc}#page=${ep.page}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-0.5"
                      >
                        <ExternalLink size={9} /> Open Page
                      </a>
                      <a
                        href={`/api/download/${ep.doc}`}
                        download={ep.doc}
                        className="text-slate-400 hover:text-slate-300 transition-colors"
                        title="Download PDF"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Lightbox
              open={evidenceOpen}
              close={() => setEvidenceOpen(false)}
              index={evidenceIndex}
              slides={evidenceSlides}
              plugins={[Download, Zoom]}
            />
          </div>
        )}

        {/* Semantic Image Chunks */}
        {(msg.imageChunks ?? []).length > 0 && (
          <div className="px-1 w-full">
            <div className="flex items-center gap-1.5 mb-2 mt-2">
              <ImageIcon size={12} className="text-purple-400" />
              <span className="text-[11px] text-purple-400 font-semibold uppercase tracking-wide">Image Matches</span>
            </div>
            <div className="flex flex-col gap-3">
              {groupedImgChunksArray.map((group, groupIdx) => (
                <div key={groupIdx} className="bg-surface-900 border border-slate-700 rounded-xl p-2">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {group!.map((ic, i) => (
                      <div
                        key={i}
                        className="relative group cursor-pointer"
                        onClick={() => {
                          const flatIndex = (msg.imageChunks ?? []).indexOf(ic)
                          setImgChunkIndex(flatIndex)
                          setImgChunkOpen(true)
                        }}
                      >
                        <img
                          src={imgUrl(ic.image_path)}
                          alt="matched visual"
                          className="w-24 h-24 object-cover rounded-lg border border-slate-600 hover:border-purple-500/60 transition-colors"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <ExternalLink size={16} className="text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-300">
                    <span className="font-semibold">{group![0].doc}</span> — Page {group![0].page}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 italic leading-tight border-l-2 border-purple-500/30 pl-2">
                    {group![0].caption}
                  </div>
                  <div className="flex items-center justify-start gap-4 mt-2 text-[9px]">
                    <a
                      href={`/api/download/${group![0].doc}#page=${group![0].page}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-0.5"
                    >
                      <ExternalLink size={9} /> Open Page
                    </a>
                    <a
                      href={`/api/download/${group![0].doc}`}
                      download={group![0].doc}
                      className="text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Download PDF
                    </a>
                    <span className="text-emerald-400/80 ml-auto flex items-center gap-0.5"><TrendingUp size={8}/> {group![0].confidence}% relevance</span>
                  </div>
                </div>
              ))}
            </div>
            <Lightbox
              open={imgChunkOpen}
              close={() => setImgChunkOpen(false)}
              index={imgChunkIndex}
              slides={imgChunkSlides}
              plugins={[Download, Zoom]}
            />
          </div>
        )}

        {/* Source chunks */}
        {msg.sourceChunks && msg.sourceChunks.length > 0 && (
          <details className="text-[11px] text-slate-500 px-1 cursor-pointer">
            <summary className="hover:text-slate-300 transition-colors">
              View {msg.sourceChunks.length} source chunks
            </summary>
            <div className="mt-1 space-y-1 pl-2 border-l border-slate-700">
              {msg.sourceChunks.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText size={10} />
                  <span>{c.doc}</span>
                  <span className="text-slate-600">·</span>
                  <span>Chunk {c.chunk}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-400">{c.relevance}%</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <span className="text-[10px] text-slate-600 px-1">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}
