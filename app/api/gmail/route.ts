import { NextResponse } from 'next/server'

// ponytail: Phase 2 — Gmail OAuth + inbox polling via Gmail API; implement with google-auth-library + googleapis
export async function GET() {
  return NextResponse.json({ error: 'Gmail integration not yet implemented' }, { status: 501 })
}
