'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, CheckCircle2, XCircle, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Status = 'connected' | 'qr' | 'disconnected' | null
const QR_TIMEOUT_MS = 60_000

export default function WhatsAppSettingsPage() {
  const [status, setStatus] = useState<Status>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Avoids a stale fetch from a previous poll tick clobbering state after a
  // logout/connect action already changed things.
  const actionInFlight = useRef(false)
  // Tracks when the QR was first shown so we can revert to the default
  // "disconnected" view after 60s of no scan, instead of leaving a QR
  // (that may well have gone stale) on screen indefinitely.
  const qrStartedAt = useRef<number | null>(null)
  const [qrExpired, setQrExpired] = useState(false)

  const poll = useCallback(async () => {
    if (actionInFlight.current || qrExpired) return
    try {
      const res = await fetch('/api/wa/status')
      const data = await res.json()

      if (data.status === 'qr') {
        if (qrStartedAt.current === null) qrStartedAt.current = Date.now()
        if (Date.now() - qrStartedAt.current > QR_TIMEOUT_MS) {
          setQrExpired(true)
          setStatus('disconnected')
          setQr(null)
          return
        }
        const qrRes = await fetch('/api/wa/qr')
        const qrData = await qrRes.json()
        if (qrRes.ok) setQr(qrData.qr)
      } else {
        qrStartedAt.current = null
        setQr(null)
      }
      setStatus(data.status)
    } catch {
      setStatus('disconnected')
    }
  }, [qrExpired])

  useEffect(() => {
    // Standard fetch-on-mount + poll pattern; setState inside poll() only
    // runs after `await`, never synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll()
    // QR expires quickly and status can change any time HR scans on their
    // phone — poll frequently rather than making them manually refresh.
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [poll])

  async function handleConnect() {
    setBusy(true)
    setError('')
    setQrExpired(false)
    qrStartedAt.current = null
    actionInFlight.current = true
    try {
      const res = await fetch('/api/wa/connect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyambungkan')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyambungkan')
    } finally {
      actionInFlight.current = false
      setBusy(false)
      poll()
    }
  }

  async function handleLogout() {
    if (!confirm('Putuskan koneksi WhatsApp? Kandidat tidak akan bisa dihubungi lewat WA sampai disambungkan ulang.')) return
    setBusy(true)
    setError('')
    setQrExpired(false)
    qrStartedAt.current = null
    actionInFlight.current = true
    try {
      const res = await fetch('/api/wa/logout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal memutuskan koneksi')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal memutuskan koneksi')
    } finally {
      actionInFlight.current = false
      setBusy(false)
      poll()
    }
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm text-gray-500 mb-4">
        Sambungkan nomor WhatsApp perusahaan supaya agent bisa mengirim & menerima pesan dari kandidat.
      </p>

      <div className="bg-white rounded-lg border shadow-sm p-5 space-y-4">
        {status === null && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Memeriksa status...
          </div>
        )}

        {status === 'connected' && (
          <>
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} /> WhatsApp terhubung dan siap digunakan.
            </div>
            <Button variant="outline" onClick={handleLogout} disabled={busy} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Putuskan Koneksi
            </Button>
          </>
        )}

        {status === 'qr' && (
          <>
            <p className="text-sm text-gray-600">
              Scan QR ini pakai WhatsApp di nomor yang mau dijadikan bot: <br />
              <span className="text-xs text-gray-400">Setelan → Perangkat Tertaut → Tautkan Perangkat</span>
            </p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR WhatsApp" className="w-56 h-56 mx-auto border rounded-lg" />
            ) : (
              <div className="w-56 h-56 mx-auto border rounded-lg flex items-center justify-center text-gray-300">
                <Loader2 size={20} className="animate-spin" />
              </div>
            )}
            <p className="text-xs text-gray-400 text-center">QR otomatis diperbarui tiap beberapa detik, dan tertutup sendiri kalau 60 detik nggak discan.</p>
          </>
        )}

        {status === 'disconnected' && (
          <>
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <XCircle size={16} /> WhatsApp belum terhubung.
            </div>
            <Button onClick={handleConnect} disabled={busy} className="bg-[#1E3A2F] hover:bg-[#2d5242] gap-2">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Sambungkan WhatsApp
            </Button>
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
