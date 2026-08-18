interface MessageBubbleProps {
  direction: string
  content: string
  created_at: string
  channel?: string
}

const CHANNEL_LABEL: Record<string, string> = {
  wa: 'WA',
  email: 'Email',
}

export function MessageBubble({ direction, content, created_at, channel }: MessageBubbleProps) {
  const isOut = direction === 'outbound'
  const time = new Date(created_at).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  return (
    <div className={`flex flex-col gap-0.5 ${isOut ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
        isOut ? 'bg-[#1E3A2F] text-white' : 'bg-gray-100 text-gray-800'
      }`}>
        {content}
      </div>
      <span className="text-[10px] text-gray-400">
        {time}{channel && ` · ${CHANNEL_LABEL[channel] ?? channel}`}
      </span>
    </div>
  )
}
