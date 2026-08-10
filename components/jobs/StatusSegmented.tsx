import { STATUS_LABEL } from './constants'

const ORDER = ['draft', 'published', 'closed']

export function StatusSegmented({ value, onChange }: { value: string; onChange: (status: string) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-gray-50">
      {ORDER.map(s => (
        <button
          type="button"
          key={s}
          onClick={() => onChange(s)}
          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
            value === s
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  )
}
