import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

export default function AnalyticsCards({ data }: { data: any }) {
  if (!data || !data.total) return <p className="text-slate-500 text-sm">No analytics data yet.</p>

  const chartData = [
    { name: 'Safe', value: data.safe ?? 0, fill: '#3b82f6' },
    { name: 'Blocked', value: data.blocked ?? 0, fill: '#f85149' },
  ]

  const activity = data.hourly_activity ?? []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs text-slate-500 mb-3 font-medium">Query Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <p className="text-xs text-slate-500 mb-3 font-medium">Activity Timeline (last 24h)</p>
          {activity.length === 0 || activity.every((a: any) => a.queries === 0) ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-600">No queries logged yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="queries" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
