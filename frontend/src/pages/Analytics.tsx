import { useEffect, useState } from 'react'
import { api } from '../services/api'
import KPI from '../components/KPI'
import AnalyticsCards from '../components/AnalyticsCards'
import { BarChart3, CheckCircle2, XCircle, TrendingUp, RefreshCw, Clock } from 'lucide-react'
import { AnalyticsData, LogEntry } from '../types'

export default function Analytics() {
  const [stats, setStats] = useState<AnalyticsData | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [s, l] = await Promise.all([api.analytics(), api.logs()])
    setStats(s)
    setLogs(l.logs ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-200">Analytics Dashboard</h2>
        <button onClick={load} className="btn-ghost text-xs flex items-center gap-1.5"><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <KPI label="Total Queries" value={stats?.total ?? '—'} icon={BarChart3} />
        <KPI label="Successful" value={stats?.safe ?? '—'} icon={CheckCircle2} color="text-emerald-400" />
        <KPI label="Blocked" value={stats?.blocked ?? '—'} icon={XCircle} color="text-red-400" />
        <KPI label="Avg Confidence" value={stats ? `${stats.avg_confidence}%` : '—'} icon={TrendingUp} color="text-amber-400" />
        <KPI label="Avg Response" value={stats?.avg_response_ms ? `${stats.avg_response_ms}ms` : '—'} icon={Clock} color="text-blue-400" />
      </div>

      {/* Charts */}
      <AnalyticsCards data={stats} />

      {/* Audit Log */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60">
          <h3 className="text-sm font-semibold text-slate-200">Security Audit Log</h3>
          <span className="text-xs text-slate-500">{logs.length} entries</span>
        </div>
        <div className="divide-y divide-slate-700/40 max-h-80 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500 px-5 py-6">No log entries yet.</p>
          ) : [...logs].reverse().map((log, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              {log.security_passed
                ? <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                : <XCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 truncate">{log.query}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{log.timestamp} · {log.confidence}% confidence</p>
              </div>
              {!log.security_passed && (
                <span className="text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full flex-shrink-0">Blocked</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
