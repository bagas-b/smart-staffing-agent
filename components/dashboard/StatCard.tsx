interface StatCardProps {
  label: string
  value: number
  color?: string
}

export function StatCard({ label, value, color = '#1E3A2F' }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}
