import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const COMPANY_ID = process.env.COMPANY_ID!

interface RawMessage {
  content: string
  created_at: string
  direction: string
  channel: string
}

export async function GET() {
  const supabase = createServiceClient()

  // MVP: pull all candidates with any message history and aggregate client-side.
  // Revisit with a `last_message_at` column + index if this gets slow at scale.
  const { data, error } = await supabase
    .from('candidates')
    .select('id, name, position, outlet, phone, candidate_messages(content, created_at, direction, channel)')
    .eq('company_id', COMPANY_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const conversations = (data ?? [])
    .map(c => {
      // Drafts aren't real conversation yet — they haven't been approved/sent,
      // so they shouldn't make a candidate show up in the inbox or count as
      // the "last message".
      const messages = ((c.candidate_messages ?? []) as RawMessage[]).filter(m => m.direction !== 'draft')
      if (messages.length === 0) return null
      const sorted = [...messages].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const last = sorted[0]
      const lastOutbound = sorted.find(m => m.direction === 'outbound')
      const unread = last.direction === 'inbound' &&
        (!lastOutbound || new Date(last.created_at) > new Date(lastOutbound.created_at))

      return {
        candidateId: c.id,
        name: c.name,
        position: c.position,
        outlet: c.outlet,
        phone: c.phone,
        lastMessage: last.content,
        lastMessageAt: last.created_at,
        lastChannel: last.channel,
        unread,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  return NextResponse.json(conversations)
}
