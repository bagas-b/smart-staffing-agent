const BASE = process.env.BAILEYS_SERVICE_URL ?? 'http://localhost:3001'
const SECRET = process.env.BAILEYS_SECRET ?? ''

async function baileysRequest(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Baileys service error ${res.status}`)
  return res.json()
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
