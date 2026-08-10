const PIPELINE_STAGES = [
  { key: 'belum_dihubungi', label: 'Belum Dihubungi', color: 'bg-gray-400' },
  { key: 'menunggu_balasan', label: 'Menunggu', color: 'bg-yellow-400' },
  { key: 'tertarik', label: 'Tertarik', color: 'bg-blue-400' },
  { key: 'interview_dijadwalkan', label: 'Interview', color: 'bg-purple-400' },
  { key: 'lulus_interview', label: 'Lulus', color: 'bg-teal-400' },
  { key: 'onboarding', label: 'Onboarding', color: 'bg-emerald-400' },
  { key: 'aktif', label: 'Aktif', color: 'bg-green-500' },
]

interface Props {
  candidates: Array<{ id: string; status: string }>
}

export function PipelineSummary({ candidates }: Props) {
  const counts = Object.fromEntries(
    PIPELINE_STAGES.map(s => [s.key, candidates.filter(c => c.status === s.key).length])
  )
  const max = Math.max(...Object.values(counts), 1)

  return (
    <div className="bg-white rounded-lg border shadow-sm p-5">
      <p className="text-sm font-medium text-gray-700 mb-4">Pipeline Kandidat</p>
      <div className="grid grid-cols-7 gap-2">
        {PIPELINE_STAGES.map(stage => {
          const count = counts[stage.key]
          const heightPct = Math.round((count / max) * 100)
          return (
            <div key={stage.key} className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold text-gray-800">{count}</span>
              <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{ height: 40 }}>
                <div
                  className={`w-full rounded-full transition-all ${stage.color}`}
                  style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 text-center leading-tight">{stage.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
