import { Send, MessageCircle } from 'lucide-react'

export interface Conversation {
  candidateId: string
  name: string
  position: string | null
  outlet: string | null
  phone: string | null
  telegramLinked: boolean
  lastMessage: string
  lastMessageAt: string
  lastChannel: string
  unread: boolean
}

const CHANNEL_ICON: Record<string, typeof Send> = {
  telegram: Send,
  wa: MessageCircle,
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j`
  return `${Math.floor(hours / 24)}h`
}

interface ChatInboxProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (candidateId: string) => void
}

export function ChatInbox({ conversations, selectedId, onSelect }: ChatInboxProps) {
  return (
    <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col">
      <div className="px-4 py-3 border-b">
        <p className="text-sm font-semibold text-gray-800">Percakapan</p>
        <p className="text-xs text-gray-400 mt-0.5">{conversations.length} kandidat</p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y">
        {conversations.length === 0 && (
          <p className="p-4 text-xs text-gray-400">Belum ada percakapan. Kirim link Telegram ke kandidat untuk mulai chat.</p>
        )}
        {conversations.map(c => {
          const Icon = CHANNEL_ICON[c.lastChannel] ?? MessageCircle
          return (
            <button
              key={c.candidateId}
              onClick={() => onSelect(c.candidateId)}
              className={`w-full text-left px-4 py-3 transition-colors ${
                selectedId === c.candidateId ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${c.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {c.name}
                </p>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(c.lastMessageAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Icon size={11} className="text-gray-400 flex-shrink-0" />
                <p className={`text-xs truncate ${c.unread ? 'text-gray-700' : 'text-gray-400'}`}>
                  {c.lastMessage}
                </p>
                {c.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 ml-auto" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
