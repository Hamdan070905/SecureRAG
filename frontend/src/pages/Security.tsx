import SecurityStatus from '../components/SecurityStatus'
import { Shield, AlertTriangle, Activity } from 'lucide-react'

export default function Security() {
  return (
    <div className="p-6 overflow-y-auto h-full space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Shield, label: 'Security Score', value: '98.2%', sub: 'Enterprise Grade', color: 'text-emerald-400' },
          { icon: AlertTriangle, label: 'Threats Blocked', value: '18', sub: 'This session', color: 'text-amber-400' },
          { icon: Activity, label: 'Rate Limit', value: '10/min', sub: 'Per session', color: 'text-brand-400' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="card p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-bold text-slate-100 mt-0.5">{value}</p>
              <p className="text-xs text-slate-500 mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Security Guardrails</h3>
        <SecurityStatus />
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Detection Patterns</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Prompt Injection', 'ignore previous instructions, jailbreak, bypass…'],
            ['Toxic Content', 'hack, exploit, malware, weapon, ransomware…'],
            ['Length Validation', 'Min 3 chars · Max 2000 chars'],
            ['Rate Limiting', '10 queries per minute per session'],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface-800/50 border border-slate-700/40 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-300 mb-1">{k}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
