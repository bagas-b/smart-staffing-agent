import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number
  color?: string
  icon?: LucideIcon
  href?: string
}

function CardInner({ label, value, color = '#1E3A2F', icon: Icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500">{label}</p>
        {Icon && <Icon size={16} style={{ color }} />}
      </div>
      <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

export function StatCard(props: StatCardProps) {
  if (props.href) {
    return (
      <Link href={props.href} className="block hover:shadow-md transition-shadow rounded-lg">
        <CardInner {...props} />
      </Link>
    )
  }
  return <CardInner {...props} />
}
