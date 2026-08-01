import { CheckCircle2, XCircle } from 'lucide-react'

const checks = [
  'Prompt Injection Detection',
  'Toxic Content Filter',
  'Rate Limiter (10 req/min)',
  'Query Length Validation',
  'Audit Logging',
  'Secure Retrieval Pipeline',
]

export default function SecurityStatus() {
  return (
    <div className="space-y-2">
      {checks.map(c => (
        <div key={c} className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-xl border border-slate-700/40">
          <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
          <span className="text-sm text-slate-300">{c}</span>
          <span className="ml-auto text-[11px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-medium">Active</span>
        </div>
      ))}
    </div>
  )
}
