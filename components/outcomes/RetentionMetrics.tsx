interface RetentionData {
  first_day_rate: number | null
  day_30_rate: number | null
  avg_rating: number | null
}

function MetricBox({ label, value, unit = '%' }: {
  label: string; value: number | null; unit?: string
}) {
  return (
    <div className="bg-white rounded-lg border p-4 text-center">
      <p className="text-2xl font-bold text-[#1E3A2F]">
        {value !== null ? `${value}${unit}` : '—'}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {value === null && <p className="text-xs text-gray-400">Belum ada data</p>}
    </div>
  )
}

export function RetentionMetrics({ data }: { data: RetentionData }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricBox label="First Day Show Rate" value={data.first_day_rate} />
      <MetricBox label="30-Day Retention" value={data.day_30_rate} />
      <MetricBox label="Avg Performance Rating" value={data.avg_rating} unit="/5" />
    </div>
  )
}
