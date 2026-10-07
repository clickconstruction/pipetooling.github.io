import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import { stripeApiKeyForMode } from '../_shared/stripeSecrets.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { lienOfferCreditCents, lienOfferCreditMemo, lienOfferExpired, type LienOfferRow } from '../_shared/lienPayOffer.ts'

/**
 * lien-pay-offer (v2.4704): the money side of the pay offer — the leader's discount on each
 * bill behind a § 53.056 notice if it is paid in full by a day.
 *
 * `{ action: "apply", filing_id }` (the office, signed in): called by the desk right after the
 * run records a notice. Reads the offer off the desk item the filing closed
 * (`job_lien_desk_items.sent_filing_id`), and for every enclosed Stripe bill still open puts a
 * Stripe **credit note** on it for the percent of what Stripe then asks for, so the scanned
 * code — and Stripe's own emails — show the lower amount. The bill row remembers the credit
 * (`lien_offer_*`). A bill that already carries a live credit is left alone, so a second call
 * is harmless. The ledger's amount is NOT changed here; the webhook writes it down once the
 * bill is paid in full.
 *
 * `{ action: "expire" }` (pg_cron, `X-Cron-Secret`): every night, a few minutes after midnight
 * Central, every live credit whose day has passed is voided on Stripe and the row marked
 * `lien_offer_ended_at`, so the code shows the full amount again. A bill Stripe says is paid
 * is marked taken instead (the webhook normally did that first). `dry_run: true` reports and
 * writes nothing.
 *
 * Auth: apply = the caller's JWT, role dev · master_technician · assistant · controller; expire =
 * `CRON_SECRET`. Gateway `verify_jwt = false` (the cron has no JWT). Secrets: `SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CRON_SECRET`, `STRIPE_SECRET_KEY_LIVE` /
 * `STRIPE_SECRET_KEY_TEST` (legacy `STRIPE_SECRET_KEY`).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
/** Rows swept per night; a night with more leaves the rest for tomorrow. */
const MAX_EXPIRE_ROWS = 200

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type InvoiceRow = LienOfferRow & {
  id: string
  job_id: string
  status: string | null
  stripe_invoice_id: string | null
  stripe_mode: string | null
}

const OFFER_COLUMNS = 'id, job_id, status, stripe_invoice_id, stripe_mode, lien_offer_pct, lien_offer_by, lien_offer_credit_note_id, lien_offer_credit_cents, lien_offer_taken_at, lien_offer_ended_at'

function stripeFor(mode: string | null): Stripe | null {
  const key = stripeApiKeyForMode(mode === 'test' ? 'test' : 'live')
  return key ? new Stripe(key, { apiVersion: '2024-06-20' }) : null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { action?: unknown; filing_id?: unknown; cron_secret?: unknown; dry_run?: unknown } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    body = {}
  }
  const action = typeof body.action === 'string' ? body.action : ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!serviceKey) return jsonResponse({ error: 'Server misconfigured: SUPABASE_SERVICE_ROLE_KEY' }, 500)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    if (action === 'expire') {
      const cronSecret = Deno.env.get('CRON_SECRET')
      const given = req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : null)
      if (!cronSecret || given !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)
      const dryRun = body.dry_run === true
      const today = todayYmdInAppTz()
      const { data: rowsRaw, error: rowsErr } = await admin
        .from('jobs_ledger_invoices')
        .select(OFFER_COLUMNS)
        .not('lien_offer_credit_note_id', 'is', null)
        .is('lien_offer_taken_at', null)
        .is('lien_offer_ended_at', null)
        .lt('lien_offer_by', today)
        .order('lien_offer_by', { ascending: true })
        .limit(MAX_EXPIRE_ROWS)
      if (rowsErr) throw new Error(rowsErr.message)
      const rows = ((rowsRaw ?? []) as InvoiceRow[]).filter((r) => lienOfferExpired(r, today))
      const ended: string[] = []
      const taken: string[] = []
      const failed: { id: string; reason: string }[] = []
      for (const r of rows) {
        try {
          const stripe = stripeFor(r.stripe_mode)
          if (!stripe) throw new Error(`no Stripe key for ${r.stripe_mode ?? 'live'}`)
          const inv = await stripe.invoices.retrieve(r.stripe_invoice_id!)
          if (inv.status === 'paid' || (typeof inv.amount_remaining === 'number' && inv.amount_remaining <= 0)) {
            // Paid with the credit still on: the webhook should have recorded the write-down; mark it taken and say so.
            if (!dryRun) await admin.from('jobs_ledger_invoices').update({ lien_offer_taken_at: new Date().toISOString() }).eq('id', r.id)
            taken.push(r.id)
            console.warn(JSON.stringify({ event: 'lien_pay_offer_expire_paid', id: r.id, note: 'paid before the sweep; check the write-down' }))
            continue
          }
          if (!dryRun) {
            await stripe.creditNotes.voidCreditNote(r.lien_offer_credit_note_id!)
            const { error: upErr } = await admin.from('jobs_ledger_invoices').update({ lien_offer_ended_at: new Date().toISOString() }).eq('id', r.id)
            if (upErr) throw new Error(upErr.message)
          }
          ended.push(r.id)
        } catch (e) {
          failed.push({ id: r.id, reason: e instanceof Error ? e.message : String(e) })
        }
      }
      console.log(JSON.stringify({ event: 'lien_pay_offer_expire', today, dry_run: dryRun, candidates: rows.length, ended: ended.length, taken: taken.length, failed: failed.length }))
      return jsonResponse({ ok: true, today, dry_run: dryRun, ended, taken, failed })
    }

    if (action !== 'apply') return jsonResponse({ error: 'Unknown action' }, 400)

    // apply: the office, signed in.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Missing authorization' }, 401)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''))
    if (authErr || !user) return jsonResponse({ error: 'Invalid session' }, 401)
    const { data: roleRow } = await admin.from('users').select('role, read_only').eq('id', user.id).maybeSingle()
    const role = String((roleRow as { role?: string } | null)?.role ?? '')
    if (!OFFICE_ROLES.has(role) || (roleRow as { read_only?: boolean } | null)?.read_only) return jsonResponse({ error: 'Not authorized' }, 403)

    const filingId = typeof body.filing_id === 'string' ? body.filing_id.trim() : ''
    if (!filingId) return jsonResponse({ error: 'Missing filing_id' }, 400)

    const { data: filing, error: filingErr } = await admin.from('job_lien_filings').select('id, job_id, kind, invoice_ids, voided_at').eq('id', filingId).maybeSingle()
    if (filingErr) throw new Error(filingErr.message)
    const f = filing as { id: string; job_id: string; kind: string; invoice_ids: string[] | null; voided_at: string | null } | null
    if (!f || f.voided_at) return jsonResponse({ error: 'Filing not found' }, 404)

    const { data: itemRaw, error: itemErr } = await admin
      .from('job_lien_desk_items')
      .select('id, offer_pct, offer_by, offer_set_by')
      .eq('sent_filing_id', f.id)
      .is('voided_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (itemErr) throw new Error(itemErr.message)
    const item = itemRaw as { id: string; offer_pct: number | null; offer_by: string | null; offer_set_by: string | null } | null
    const pct = Math.round(Number(item?.offer_pct ?? 0))
    const by = (item?.offer_by ?? '').trim()
    if (!item || !(pct > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(by)) {
      return jsonResponse({ ok: true, applied: [], skipped: [], failed: [], reason: 'no offer on the notice' })
    }
    if (by < todayYmdInAppTz()) return jsonResponse({ ok: true, applied: [], skipped: [], failed: [], reason: 'the offer’s day has passed' })

    const ids = Array.isArray(f.invoice_ids) ? f.invoice_ids.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : []
    const { data: invRaw, error: invErr } = ids.length ? await admin.from('jobs_ledger_invoices').select(OFFER_COLUMNS).in('id', ids) : { data: [], error: null }
    if (invErr) throw new Error(invErr.message)
    const invoices = (invRaw ?? []) as InvoiceRow[]

    const applied: { id: string; credit_cents: number; credit_note_id: string }[] = []
    const skipped: { id: string; reason: string }[] = []
    const failed: { id: string; reason: string }[] = []
    for (const r of invoices) {
      if (r.status !== 'billed') {
        skipped.push({ id: r.id, reason: `status ${r.status ?? 'unknown'}` })
        continue
      }
      if (!(r.stripe_invoice_id ?? '').trim()) {
        skipped.push({ id: r.id, reason: 'no Stripe bill' })
        continue
      }
      if ((r.lien_offer_credit_note_id ?? '').trim() && !r.lien_offer_ended_at && !r.lien_offer_taken_at) {
        skipped.push({ id: r.id, reason: 'already carries the offer' })
        continue
      }
      try {
        const stripe = stripeFor(r.stripe_mode)
        if (!stripe) throw new Error(`no Stripe key for ${r.stripe_mode ?? 'live'}`)
        const inv = await stripe.invoices.retrieve(r.stripe_invoice_id!)
        if (inv.status !== 'open') {
          skipped.push({ id: r.id, reason: `Stripe says ${inv.status ?? 'unknown'}` })
          continue
        }
        const remaining = typeof inv.amount_remaining === 'number' ? inv.amount_remaining : 0
        const credit = lienOfferCreditCents(remaining, pct)
        if (credit < 1 || credit >= remaining) {
          skipped.push({ id: r.id, reason: 'nothing to discount' })
          continue
        }
        const cn = await stripe.creditNotes.create({
          invoice: r.stripe_invoice_id!,
          amount: credit,
          reason: 'order_change',
          memo: lienOfferCreditMemo(pct, by),
          metadata: { pipetooling_lien_offer: '1', filing_id: f.id, offer_by: by },
        })
        const { error: upErr } = await admin
          .from('jobs_ledger_invoices')
          .update({
            lien_offer_pct: pct,
            lien_offer_by: by,
            lien_offer_set_by: item.offer_set_by,
            lien_offer_filing_id: f.id,
            lien_offer_credit_note_id: cn.id,
            lien_offer_credit_cents: credit,
            lien_offer_applied_at: new Date().toISOString(),
            lien_offer_taken_at: null,
            lien_offer_ended_at: null,
          })
          .eq('id', r.id)
        if (upErr) {
          // The credit is on Stripe but not on the row: take it back rather than leave a discount nobody can see.
          await stripe.creditNotes.voidCreditNote(cn.id).catch(() => undefined)
          throw new Error(upErr.message)
        }
        applied.push({ id: r.id, credit_cents: credit, credit_note_id: cn.id })
      } catch (e) {
        failed.push({ id: r.id, reason: e instanceof Error ? e.message : String(e) })
      }
    }
    console.log(JSON.stringify({ event: 'lien_pay_offer_apply', filing: f.id, pct, by, applied: applied.length, skipped: skipped.length, failed: failed.length, by_user: user.id }))
    return jsonResponse({ ok: true, pct, by, applied, skipped, failed })
  } catch (e) {
    console.error('lien-pay-offer failed', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'lien-pay-offer failed' }, 500)
  }
})
