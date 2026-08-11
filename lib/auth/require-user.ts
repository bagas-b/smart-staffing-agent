import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Gate for API routes that mutate candidate-facing state (approve/reject/edit
 * drafts). Mirrors middleware.ts's DEMO_MODE bypass: the public demo
 * deployment never runs a real login flow (DEMO_MODE=true skips the redirect
 * to /login), so requiring `auth.getUser()` here unconditionally meant every
 * approve/reject/edit call 401'd — there was never a session to check.
 * Outside demo mode this still requires a real authenticated HR user.
 *
 * Returns a 401 NextResponse to short-circuit with, or null if the caller
 * may proceed.
 */
export async function requireUser(): Promise<NextResponse | null> {
  if (process.env.DEMO_MODE === 'true') return null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return null
}
