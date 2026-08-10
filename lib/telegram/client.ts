const API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) throw new Error(`Telegram sendMessage error ${res.status}: ${await res.text()}`)
}

interface TelegramBotInfo {
  id: number
  username: string
  first_name: string
}

export async function getBotInfo(): Promise<TelegramBotInfo> {
  const res = await fetch(`${API}/getMe`)
  if (!res.ok) throw new Error(`Telegram getMe error ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(`Telegram getMe error: ${data.description ?? 'unknown'}`)
  return data.result as TelegramBotInfo
}

/**
 * One-time setup — call after deploy (e.g. via a temporary script or admin action),
 * not part of the request lifecycle. Requires a public HTTPS URL (use a tunnel for local dev).
 */
export async function setTelegramWebhook(url: string): Promise<void> {
  const res = await fetch(`${API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }),
  })
  if (!res.ok) throw new Error(`Telegram setWebhook error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  if (!data.ok) throw new Error(`Telegram setWebhook error: ${data.description ?? 'unknown'}`)
}
