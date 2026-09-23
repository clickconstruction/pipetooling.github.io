import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { stripeApiKeyForMode } from '../_shared/stripeSecrets.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { buildPayLinkPayload, isPayLinkId, payLinkRowEligible, type PayLinkRow, type PayLinkStripeFacts } from '../_shared/payLink.ts'

/**
 * pay-link (punch list #35, v2.3754): what a scanned pay code opens. `GET ?id=<bill id>`
 * answers with the bill's *current* Stripe payment link, its number, the job's name and what
 * is still owed, so `/pay/<id>` can name the bill and forward to Stripe — or say *Paid*.
 *
 * No auth: the id is the capability, exactly as Stripe's own hosted link is (a UUID, never
 * guessed; the function refuses anything that is not one before touching the database).
 * Modelled on `customer-portal`'s live pay links (v2.3590): the invoice is retrieved from
 * Stripe in the row's own mode, and when the hosted link differs from the stored one the row
 * is brought up to date (as `get-stripe-invoice-details` does), so a scan also refreshes the
 * link every other reader hands out. Stripe unreachable → the stored link and the row's own
 * status, never an error page for a customer holding a phone.
 *
 * Rate limit: 60 opens a minute per client address, and 600 a minute across the isolate,
 * in memory — best effort, enough to blunt a scan of random ids without a table.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PER_IP_PER_MINUTE = 60
const TOTAL_PER_MINUTE = 600
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function rateLimited(ip: string, now: number): boolean {
  let total = 0
  for (const [k, arr] of hits) {
    const kept = arr.filter((t) => now - t < WINDOW_MS)
    if (kept.length === 0) hits.delete(k)
    else {
      hits.set(k, kept)
      total += kept.length
    }
  }
  const mine = hits.get(ip) ?? []
  if (mine.length >= PER_IP_PER_MINUTE || total >= TOTAL_PER_MINUTE) return true
  mine.push(now)
  hits.set(ip, mine)
  return false
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

/** YYYY-MM-DD of a Stripe epoch-seconds stamp, in the company's calendar (America/Chicago). */
function ymdInAppTz(epochSeconds: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(epochSeconds * 1000))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const url = new URL(req.url)
    const rawId = (url.searchParams.get('id') ?? '').trim().toLowerCase()
    if (!isPayLinkId(rawId)) return jsonResponse({ error: 'Missing bill' }, 400)

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown'
    if (rateLimited(ip, Date.now())) return jsonResponse({ error: 'Too many requests — try again in a minute.' }, 429)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

    const { data: rowRaw, error: rowErr } = await admin
      .from('jobs_ledger_invoices')
      .select('id, job_id, status, stripe_invoice_id, stripe_mode, hosted_invoice_url, stripe_invoice_status')
      .eq('id', rawId)
      .maybeSingle()
    if (rowErr) throw new Error(rowErr.message)
    const row = rowRaw as PayLinkRow | null
    if (!payLinkRowEligible(row)) {
      console.log(JSON.stringify({ event: 'pay_link_open', id: rawId, state: 'not_found' }))
      return jsonResponse({ error: 'not_found' }, 404)
    }

    let jobName = ''
    if (row.job_id) {
      const { data: job } = await admin.from('jobs_ledger').select('job_name').eq('id', row.job_id).maybeSingle()
      jobName = ((job as { job_name?: string | null } | null)?.job_name ?? '').trim()
    }

    // Stripe's current word on the bill, in the row's own mode (NULL is pre-v2.1114 legacy = live).
    let facts: PayLinkStripeFacts | null = null
    let paidOn: string | null = null
    let refreshed = false
    const mode = row.stripe_mode === 'test' ? 'test' : 'live'
    const key = stripeApiKeyForMode(mode)
    if (key) {
      try {
        const stripe = new Stripe(key, { apiVersion: '2024-06-20' })
        const inv = await stripe.invoices.retrieve(row.stripe_invoice_id!)
        facts = {
          number: inv.number ?? null,
          status: inv.status ?? null,
          hosted_invoice_url: inv.hosted_invoice_url ?? null,
          amount_remaining: typeof inv.amount_remaining === 'number' ? inv.amount_remaining : null,
          currency: inv.currency ?? null,
        }
        const paidAt = inv.status_transitions?.paid_at
        if (typeof paidAt === 'number' && Number.isFinite(paidAt) && paidAt > 0) paidOn = ymdInAppTz(paidAt)
        // The scan refreshes the stored link for every other reader (v2.3590's rule).
        const fresh = (inv.hosted_invoice_url ?? '').trim()
        if (fresh && fresh !== (row.hosted_invoice_url ?? '').trim()) {
          const { error: upErr } = await admin.from('jobs_ledger_invoices').update({ hosted_invoice_url: fresh }).eq('id', row.id)
          if (upErr) console.warn('pay-link: link refresh not stored —', upErr.message)
          else refreshed = true
        }
      } catch (e) {
        console.warn('pay-link: Stripe retrieve failed, answering from the row —', e instanceof Error ? e.message : String(e))
      }
    } else {
      console.warn(`pay-link: no Stripe key for ${mode} — answering from the row`)
    }

    const payload = buildPayLinkPayload({ row, facts, jobName, company: PORTAL_COMPANY.name, phone: PORTAL_COMPANY.phone, paidOn })
    console.log(JSON.stringify({ event: 'pay_link_open', id: row.id, state: payload.state, mode, stripe: facts ? 'answered' : 'skipped', refreshed }))
    return jsonResponse(payload)
  } catch (e) {
    console.error('pay-link failed', e)
    return jsonResponse({ error: 'We could not open that bill right now. Please try again, or call our office.' }, 500)
  }
})
