import { useRef, useState } from 'react'
import { useUpload } from '../hooks/useUpload'
import { UploadCloud, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Loader } from './core/Loader'

export default function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploading, results, uploadFiles } = useUpload(onUploaded)
  const [collection, setCollection] = useState('General')
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (files: FileList | File[]) => uploadFiles(Array.from(files), collection)

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-slate-500 mb-1.5 block">Collection</label>
        <input
          value={collection}
          onChange={e => setCollection(e.target.value)}
          placeholder="e.g. HR Policies"
          className="input-base w-full text-sm py-2"
        />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-10 px-4 cursor-pointer transition-colors ${
          dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        {uploading ? (
          <Loader />
        ) : (
          <UploadCloud size={24} className="text-slate-500" />
        )}
        <p className="text-sm text-slate-300 text-center">
          {uploading ? 'Uploading…' : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[11px] text-slate-500">PDF · DOCX · PPTX · XLSX · CSV · Images — multiple files supported</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,image/png,image/jpeg"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-surface-800 border border-slate-700">
              {r.status === 'ok'
                ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                : <XCircle size={13} className="text-red-400 flex-shrink-0" />}
              <span className="truncate flex-1">{r.name}</span>
              <span className={r.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                {r.status === 'ok' ? `${r.chunks} chunks${r.duplicate_of ? ' · dup' : ''}` : r.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
