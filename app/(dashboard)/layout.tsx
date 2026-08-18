'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Briefcase, MessageSquare, LayoutDashboard, LogOut, BarChart2, CheckSquare, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/candidates', label: 'Kandidat', icon: Users },
  { href: '/jobs', label: 'Job Posting', icon: Briefcase },
  { href: '/messages', label: 'Chat', icon: MessageSquare },
  { href: '/outcomes', label: 'Outcomes', icon: BarChart2 },
  { href: '/approval', label: 'Approval', icon: CheckSquare },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const onSettings = pathname.startsWith('/settings')

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 bg-[#1E3A2F] text-white flex flex-col">
        <div className="p-5 font-bold text-lg border-b border-white/10">
          Greenly Staffing
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                ${pathname === href
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        {/* Settings pinned above Logout, separate from the main nav list —
            more settings sub-pages (Kriteria Screening, Email, ...) will live
            under here as tabs rather than growing the main nav. */}
        <div className="p-3 pt-0 border-t border-white/10 space-y-1">
          <Link href="/settings/whatsapp"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
              ${onSettings
                ? 'bg-white/20 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
            <Settings size={16} />
            Setting
          </Link>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}
