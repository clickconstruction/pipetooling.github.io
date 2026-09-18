/**
 * The owner's session for the pay scripts (v2.3579/v2.3580): reads `.env.local`, asks the
 * `dev-login` function for a magic link with the local secret, and verifies it — the same steps
 * the app's /dev-login page takes — so every call the script makes is an ordinary authenticated
 * one. RLS, the read-only write blocks and the payroll gate all apply; rows say who wrote them.
 * Never the service key from a laptop.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../src/types/database'

export const OWNER_EMAIL = 'robert@douglasmining.com'

export function readEnvLocal(): Record<string, string> {
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) throw new Error('.env.local not found — run from the repo root of a checkout that has one')
  const out: Record<string, string> = {}
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
  return out
}

export async function signInAsOwner(env: Record<string, string> = readEnvLocal()): Promise<SupabaseClient<Database>> {
  const url = env.VITE_SUPABASE_URL
  const anon = env.VITE_SUPABASE_ANON_KEY
  const secret = env.VITE_DEV_LOGIN_SECRET
  if (!url || !anon || !secret) throw new Error('.env.local needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_DEV_LOGIN_SECRET')
  const supabase = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const res = await fetch(`${url}/functions/v1/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, apikey: anon, 'X-Dev-Login-Secret': secret },
    body: JSON.stringify({ email: OWNER_EMAIL, redirectTo: 'http://localhost:5173/' }),
  })
  if (!res.ok) throw new Error(`dev-login refused (${res.status}) — the secret in .env.local may be stale`)
  const { action_link } = (await res.json()) as { action_link?: string }
  const tokenHash = action_link ? new URL(action_link).searchParams.get('token') : null
  if (!tokenHash) throw new Error('dev-login returned no action link')
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (error) throw new Error(`verifyOtp: ${error.message}`)
  const { data } = await supabase.auth.getUser()
  console.log(`signed in as ${data.user?.email ?? '?'}`)
  return supabase
}

export const money = (n: number | string | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`
