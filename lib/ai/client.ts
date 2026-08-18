type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }

type Message = { role: 'user' | 'assistant'; content: string | ContentBlock[] }

export async function callClaude(
  messages: Message[],
  systemPrompt = 'You are a helpful HR assistant for Greenly Cloud Kitchen.'
): Promise<string> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'
  const model = process.env.ANTHROPIC_MODEL ?? 'cc/claude-sonnet-4-5-20250929'

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  // Proxy appends `data: [DONE]` to non-streaming responses; extract JSON before parsing
  const raw = await res.text()
  const jsonMatch = raw.match(/\{[\s\S]+\}/)
  if (!jsonMatch) throw new Error(`Unparseable response: ${raw.slice(0, 200)}`)
  const data = JSON.parse(jsonMatch[0])
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') throw new Error(`Unexpected Anthropic response shape: ${JSON.stringify(data)}`)
  return text
}

export async function callClaudeStreaming(
  messages: Message[],
  systemPrompt = 'You are a helpful HR assistant for Greenly Cloud Kitchen.',
  onChunk: (text: string) => void
): Promise<string> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com'
  const model = process.env.ANTHROPIC_MODEL ?? 'cc/claude-sonnet-4-5-20250929'

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') continue // Etalas router quirk
      try {
        const parsed = JSON.parse(raw)
        const text = parsed?.delta?.text ?? ''
        if (text) { full += text; onChunk(text) }
      } catch {}
    }
  }
  return full
}
