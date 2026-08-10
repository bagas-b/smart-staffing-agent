const BASE = process.env.BAILEYS_SERVICE_URL ?? 'http://localhost:3001'
const SECRET = process.env.BAILEYS_SECRET ?? ''

async function baileysRequest(path: string, method = 'GET', body?: object) {
  // Without a timeout, an unreachable/silently-dropping VPS hangs the request
  // until Vercel force-kills the function — which looks like the whole app
  // crashed. Fail fast instead so callers get a clean error to handle.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Baileys service error ${res.status}`)
    return res.json()
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Baileys service tidak merespons (timeout 8s) — kemungkinan VPS down')
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendWA(to: string, message: string) {
  return baileysRequest('/send', 'POST', { to, message })
}

export async function getWAStatus(): Promise<{ status: 'qr' | 'connected' | 'disconnected' }> {
  return baileysRequest('/status')
}

export async function getWAQR(): Promise<{ qr: string }> {
  return baileysRequest('/qr')
}
