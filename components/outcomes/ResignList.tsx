import Link from 'next/link'

export interface ResignEntry {
  candidateId: string
  name: string
  position: string | null
  outlet: string | null
  status: 'resigned' | 'terminated'
  resignDate: string | null
  resignReason: string | null
}

const STATUS_LABEL: Record<string, string> = {
  resigned: 'Resign',
  terminated: 'Diberhentikan',
}

export function ResignList({ items }: { items: ResignEntry[] }) {
  if (items.length === 0) return null

  return (
    <div className="bg-white rounded-lg border">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-medium text-gray-700">
          Attrisi <span className="text-gray-400 font-normal">({items.length})</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">Kandidat yang resign/diberhentikan dalam 30 hari pertama</p>
      </div>
      <div className="divide-y">
        {items.map(item => (
          <Link
            key={item.candidateId}
            href={`/candidates/${item.candidateId}`}
            className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {item.position ?? '-'}{item.outlet ? ` · ${item.outlet}` : ''}
              </p>
              {item.resignReason && (
                <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">{item.resignReason}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                {STATUS_LABEL[item.status]}
              </span>
              {item.resignDate && (
                <p className="text-[11px] text-gray-400 mt-1">{new Date(item.resignDate).toLocaleDateString('id-ID')}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
