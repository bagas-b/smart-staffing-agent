type Message = { role: 'user' | 'assistant'; content: string }

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

  const data = await res.json()
  return data.content[0].text as string
}

export async function callClaudeStreaming(
  messages: Message[],
  systemPrompt = 'You are a helpful HR assistant.',
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
