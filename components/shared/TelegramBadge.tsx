import { Send } from 'lucide-react'

/**
 * Compact pill shown wherever a candidate appears in the UI (kanban card,
 * modal header, chat inbox, dashboard, approval queue) when they have a
 * linked telegram_chat_id — so during a demo it's obvious at a glance which
 * candidates can actually be used to test the messaging flow end-to-end.
 */
export function TelegramBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium whitespace-nowrap ${className}`}
      title="Kandidat ini terhubung Telegram — bisa dipakai untuk test kirim/balas pesan"
    >
      <Send size={9} /> Telegram Aktif
    </span>
  )
}
