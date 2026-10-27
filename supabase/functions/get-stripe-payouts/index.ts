import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveStripeBillingMode, stripeApiKeyForMode } from '../_shared/stripeSecrets.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'

/**
 * The next Stripe payout and the balance behind it, for the Dashboard's
 * Money in bar (punch list #191). Read-only: GET /v1/payouts + /v1/balance.
 * Nothing else in the app reads payouts — the webhook ignores payout.* and
 * no table stores them.
 */

const STRIPE_BASE = 'https://api.stripe.com/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// The Money in bar's own roles (#191 decision 4): everyone the Financials row
// shows to. Deliberately NOT a copy of get-mercury-account-balances' gate —
// that one mirrors is_banking_staff() and refuses plain assistants, but the
// bar is for assistants first (Taunya answering "what is coming in this
// week"), and a payout's amount and day reveal no account balances.
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Unix seconds → the company calendar's YYYY-MM-DD. */
function ymdInAppTz(unixSeconds: number): string {
  return todayYmdInAppTz(new Date(unixSeconds * 1000))
}

type StripePayout = { id: string; amount: number; currency: string; status: string; arrival_date: number; created: number }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse({ error: 'Invalid session' }, 401)
    const { data: userRow, error: roleErr } = await userClient.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (userRow as { role?: string } | null)?.role
    if (roleErr || !role || !ALLOWED_ROLES.has(role)) {
      return jsonResponse({ error: 'Forbidden — office access required' }, 403)
    }

    const body = (await req.json().catch(() => ({}))) as { stripe_mode?: unknown }
    const mode = resolveStripeBillingMode(body.stripe_mode)
    const stripeKey = stripeApiKeyForMode(mode)
    if (!stripeKey) return jsonResponse({ error: `Server misconfigured: no Stripe key for ${mode} mode` }, 500)
    const stripeHeaders = { Authorization: `Bearer ${stripeKey}` }

    const [payoutsRes, balanceRes] = await Promise.all([
      fetch(`${STRIPE_BASE}/payouts?limit=10`, { headers: stripeHeaders }),
      fetch(`${STRIPE_BASE}/balance`, { headers: stripeHeaders }),
    ])
    if (!payoutsRes.ok) {
      const text = await payoutsRes.text().catch(() => '')
      return jsonResponse({ error: `Stripe payouts fetch failed (${payoutsRes.status})`, detail: text.slice(0, 300) }, 502)
    }
    const payouts = ((await payoutsRes.json()) as { data?: StripePayout[] }).data ?? []
    const usd = (cents: number): number => Math.round(cents) / 100

    // The next payout to land: the pending / in-transit one with the earliest
    // arrival day. `paid` ones are already in the bank (Came in's business).
    const coming = payouts
      .filter((p) => p.status === 'pending' || p.status === 'in_transit')
      .sort((a, b) => a.arrival_date - b.arrival_date)
    const next = coming[0] ?? null
    const nextPayout = next ? { usd: usd(next.amount), arrivalYmd: ymdInAppTz(next.arrival_date), status: next.status } : null

    const lastPaid = payouts.filter((p) => p.status === 'paid').sort((a, b) => b.arrival_date - a.arrival_date)[0] ?? null

    let pendingBalanceUsd: number | null = null
    if (balanceRes.ok) {
      const balance = (await balanceRes.json()) as { pending?: Array<{ amount: number; currency: string }> }
      pendingBalanceUsd = (balance.pending ?? []).filter((b) => b.currency === 'usd').reduce((s, b) => s + usd(b.amount), 0)
    }

    return jsonResponse({
      ok: true,
      mode,
      nextPayout,
      lastPaidPayout: lastPaid ? { usd: usd(lastPaid.amount), arrivalYmd: ymdInAppTz(lastPaid.arrival_date) } : null,
      pendingBalanceUsd,
    })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
