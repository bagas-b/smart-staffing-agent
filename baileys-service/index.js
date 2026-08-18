import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys'
import express from 'express'
import QRCode from 'qrcode'
import pino from 'pino'
import NodeCache from 'node-cache'
import fs from 'fs/promises'

const logger = pino({ level: 'silent' })
const app = express()
app.use(express.json())

// Without this, the socket can't answer WhatsApp's automatic retry-receipt
// handshake when a message fails to decrypt (Signal session desync — shows up
// as "Bad MAC" in logs) — every message after the first one just silently
// fails instead of WA re-sending it with fresh keys.
const msgRetryCounterCache = new NodeCache()

const SECRET = process.env.BAILEYS_SECRET ?? ''
const CALLBACK_URL = process.env.NEXT_APP_CALLBACK_URL ?? ''
const PORT = parseInt(process.env.PORT ?? '3001')

// Auth middleware
app.use((req, res, next) => {
  const auth = req.headers['authorization']
  if (auth !== `Bearer ${SECRET}`) return res.status(401).json({ error: 'unauthorized' })
  next()
})

let sock = null
let currentQR = null
let connectionStatus = 'disconnected'
let starting = false

async function startSocket() {
  if (starting) return // avoid overlapping sockets if /connect races the auto-reconnect timer
  starting = true
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
  sock = makeWASocket({ auth: state, logger, printQRInTerminal: false, msgRetryCounterCache })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = await QRCode.toDataURL(qr)
      connectionStatus = 'qr'
    }
    if (connection === 'open') {
      connectionStatus = 'connected'
      currentQR = null
      starting = false
    }
    if (connection === 'close') {
      connectionStatus = 'disconnected'
      starting = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) setTimeout(startSocket, 3000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !CALLBACK_URL) return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      const text = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text || ''
      if (!text) continue
      fetch(CALLBACK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SECRET}`,
        },
        body: JSON.stringify({
          from: msg.key.remoteJid,
          message: text,
          timestamp: msg.messageTimestamp,
        }),
      }).catch(console.error)
    }
  })
}

app.post('/send', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to and message required' })
  if (connectionStatus !== 'connected') return res.status(503).json({ error: 'WA not connected' })
  try {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`
    await sock.sendMessage(jid, { text: message })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/status', (_req, res) => res.json({ status: connectionStatus }))

app.get('/qr', (_req, res) => {
  if (!currentQR) return res.status(404).json({ error: 'no QR available' })
  res.json({ qr: currentQR })
})

// HR-triggered (re)connect from the app's Settings page — no more manually
// SSH-ing in to restart the process just to get a fresh QR.
app.post('/connect', async (_req, res) => {
  if (connectionStatus === 'disconnected') startSocket().catch(console.error)
  res.json({ status: connectionStatus === 'disconnected' ? 'connecting' : connectionStatus })
})

app.post('/logout', async (_req, res) => {
  try {
    await sock?.logout().catch(() => {})
  } finally {
    sock = null
    currentQR = null
    connectionStatus = 'disconnected'
    starting = false
    await fs.rm('./auth_info', { recursive: true, force: true }).catch(() => {})
    // Immediately start a fresh session so a new QR is ready without a
    // separate /connect call.
    startSocket().catch(console.error)
  }
  res.json({ status: 'ok' })
})

startSocket()
app.listen(PORT, () => console.log(`Baileys service on :${PORT}`))
