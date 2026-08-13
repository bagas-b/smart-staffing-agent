/**
 * Resolves this deployment's own origin, for server-to-server self-fetch
 * calls (e.g. an API route enqueueing agent_tasks then kicking off
 * /api/agent/run to process them).
 *
 * VERCEL_URL is auto-populated by Vercel for every deployment — production
 * AND preview — with that exact deployment's own unique host. Preferring it
 * over a manually-set NEXT_PUBLIC_BASE_URL means a preview deployment always
 * calls back into itself; if NEXT_PUBLIC_BASE_URL were hardcoded to the
 * production domain (as it was) and reused as-is for Preview, every preview
 * build would silently self-fetch into production instead of testing itself.
 */
export function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  return 'http://localhost:3000'
}
