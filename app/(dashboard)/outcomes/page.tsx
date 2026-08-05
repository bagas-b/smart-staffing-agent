import { HireFunnel } from '@/components/outcomes/HireFunnel'
import { RetentionMetrics } from '@/components/outcomes/RetentionMetrics'

async function getOutcomes() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/outcomes`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json()
}

export default async function OutcomesPage() {
  const data = await getOutcomes()

  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-800">Outcome Dashboard</h1>
        <p className="text-sm text-red-500 mt-2">Gagal memuat data. Coba refresh.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Outcome Dashboard</h1>
        <p className="text-sm text-gray-500">Hasil hire nyata — bukan hanya berapa pesan yang terkirim.</p>
      </div>
      <HireFunnel data={data.funnel} />
      <div>
        <h2 className="text-sm font-medium text-gray-700 mb-3">Retention & Performa</h2>
        <RetentionMetrics data={data.retention} />
      </div>
      <p className="text-xs text-gray-400">
        Data retention diisi manual oleh HR. Integrasi absensi otomatis tersedia di fase berikutnya.
      </p>
    </div>
  )
}
