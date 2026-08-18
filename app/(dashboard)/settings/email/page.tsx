import { Mail } from 'lucide-react'

export default function EmailSettingsPage() {
  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-500 mb-4">
        Hubungkan email perusahaan supaya agent bisa mengirim & menerima lamaran lewat email juga.
      </p>
      <div className="bg-white rounded-lg border shadow-sm p-8 flex flex-col items-center text-center gap-2 text-gray-400">
        <Mail size={28} />
        <p className="text-sm font-medium text-gray-500">Segera Hadir</p>
        <p className="text-xs">Integrasi email sedang dalam pengembangan.</p>
      </div>
    </div>
  )
}
