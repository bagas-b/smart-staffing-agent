import Link from 'next/link'

export interface PendingCheckin {
  candidateId: string
  name: string
  position: string | null
  outlet: string | null
  hiredDate: string | null
  startDate: string | null
  firstDayAttended: boolean
  day7Status: string | null
  day30Status: string | null
  daysSinceHire: number | null
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function StatusChip({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
      done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {label}
    </span>
  )
}

export function PendingCheckins({ items }: { items: PendingCheckin[] }) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-medium text-gray-700">
          Perlu Check-in <span className="text-gray-400 font-normal">({items.length})</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Kandidat direkrut yang belum lengkap data hari-1/7/30-nya</p>
      </div>
      <div className="divide-y">
        {items.length === 0 && (
          <p className="p-4 text-sm text-gray-400">Semua kandidat aktif sudah lengkap datanya. 🎉</p>
        )}
        {items.map(item => (
          <Link
            key={item.candidateId}
            href={`/candidates/${item.candidateId}`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {item.position ?? '-'}{item.outlet ? ` · ${item.outlet}` : ''}
                {item.daysSinceHire !== null && ` · ${item.daysSinceHire} hari sejak direkrut`}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <StatusChip label="H-1" done={item.firstDayAttended} />
              <StatusChip label="H-7" done={!!item.day7Status} />
              <StatusChip label="H-30" done={!!item.day30Status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export { daysAgo }
