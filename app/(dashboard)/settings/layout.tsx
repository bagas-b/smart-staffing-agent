'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/settings/whatsapp', label: 'WhatsApp' },
  { href: '/settings/scoring', label: 'Kriteria Screening' },
  { href: '/settings/email', label: 'Email' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-gray-800 mb-4">Setting</h1>
      <div className="flex gap-1 border-b mb-5">
        {tabs.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              pathname === t.href
                ? 'border-[#1E3A2F] text-[#1E3A2F]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  )
}
