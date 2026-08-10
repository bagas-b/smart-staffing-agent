// Runs once when a new server instance (cold Lambda on Vercel) boots up —
// before any request is handled. Fixes a known Vercel/Node issue where the
// first outbound connection from a cold instance tries IPv6 first, hits a
// silent black hole (no response, no rejection) on routes without real IPv6
// connectivity, and hangs ~15-20s before falling back to IPv4. Once the IPv4
// connection is established and cached, subsequent requests are fast — which
// is exactly the "first page load slow, then fine" pattern this fixes.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('dns')
    dns.setDefaultResultOrder('ipv4first')
  }
}
