interface FunnelData {
  outreach: number
  response: number
  interview: number
  hire: number
}

export function HireFunnel({ data }: { data: FunnelData }) {
  const steps = [
    { label: 'Outreach', value: data.outreach, color: 'bg-gray-200' },
    { label: 'Respons', value: data.response, color: 'bg-blue-200' },
    { label: 'Interview', value: data.interview, color: 'bg-purple-200' },
    { label: 'Hired', value: data.hire, color: 'bg-green-200' },
  ]
  const max = Math.max(...steps.map(s => s.value), 1)

  return (
    <div className="bg-white rounded-lg border p-5">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Hire Funnel</h3>
      <div className="space-y-3">
        {steps.map(step => (
          <div key={step.label} className="flex items-center gap-3">
            <span className="w-20 text-xs text-gray-500 text-right">{step.label}</span>
            <div className="flex-1 bg-gray-50 rounded-full h-6 overflow-hidden">
              <div
                className={`h-full rounded-full ${step.color} flex items-center pl-2`}
                style={{ width: `${Math.max(5, (step.value / max) * 100)}%` }}
              >
                <span className="text-xs font-medium">{step.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
