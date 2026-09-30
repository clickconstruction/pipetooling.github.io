/**
 * gc-statement-email-dispatch — scheduled GC statement sends (v2.1426).
 *
 * Phase 2 of the gc_statement Report Subscriptions stream
 * (docs/REPORT_SUBSCRIPTIONS.md). CRON-ONLY: pg_cron posts here every 5
 * minutes with X-Cron-Secret; there are no user-JWT modes — immediate sends
 * stay on send-gc-statement-email, and scheduling/cancelling are direct
 * RLS-gated writes to gc_statement_email_requests from the client.
 *
 * Per due row (send_at <= now, unsent, attempts < 5):
 *   1. Rebuild the statement FRESH via get_gc_statement_email_payload
 *      (group_by + entity id + include_collections from the row).
 *   2. Entity statements with nothing outstanding are skipped (stamped with a
 *      note, never emailed empty) — but a repeat_weekly chain still advances.
 *      Likewise a statement that already went to the same address inside the
 *      unattended dedupe window (12 h, by ANY lane — journey-map #45) is
 *      stamped `skipped: duplicate — …` via the shared gcStatementSendDedupe
 *      kernel, and the chain still advances.
 *   3. Send via Resend from the EMAIL_FROM sender with the REQUESTER's
 *      email as reply-to (matches send-gc-statement-email).
 *   4. Audit into gc_statement_emails (group_by 'all' when no entity id) and
 *      best-effort email_send_log (email_type 'gc_statement_scheduled' — the
 *      lane); stamp sent_at; re-enqueue weekly chains.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { resolveServerEmailWording } from '../_shared/emailWordingServer.ts'
import { COMPANY_EMAIL_FROM, EMAIL_FROM } from '../_shared/emailFrom.ts'
import {
  GC_STATEMENT_DEDUPE_WINDOW_MS,
  GC_STATEMENT_EMAIL_TYPES,
  dedupeSinceIso,
  describeDuplicateStatementSkip,
  findDuplicateStatementSend,
  type RecentStatementSend,
} from '../_shared/gcStatementSendDedupe.ts'
import { PORTAL_QR_CONTENT_ID, PORTAL_QR_FILENAME } from '../_shared/portalAccountCard.ts'
import { qrMatrix } from '../_shared/qrMatrix.ts'
import { bytesToBase64, qrPngBytes } from '../_shared/qrPng.ts'
import { buildGcChecksReport, type ChecksDepositIn, type ChecksEventIn, type ChecksJobIn } from '../_shared/gcChecksApplied.ts'
import { STATEMENT_RECEIVED_DAYS, statementReceivedFromChecks, type StatementReceivedIn } from '../_shared/gcStatementByProperty.ts'
import { ymdPlusDays } from '../_shared/customerSample.ts'
import {
  chicagoDateStr,
  chicagoTodayYmd,
  gcShareAllSubject,
  gcStatementSubject,
  renderGcShareAllHtml,
  renderGcShareAllText,
  renderGcStatementHtml,
  renderGcStatementText,
  type GcStatementPayload,
} from './render.ts'

/**
 * GC's portal link for the statement card (v2.2151). Keep in sync with
 * src/lib/portal/gcPortalLink.ts `resolveGcPortalLink`: an active GC-scoped
 * link ('gc') wins (token URL); else the main link ('all') — short custom
 * address when a slug is saved, otherwise its token URL; nothing active → null.
 */
const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'
const PORTAL_APP_ORIGIN = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)
// deno-lint-ignore no-explicit-any
async function resolveGcPortalUrl(admin: any, customerId: string): Promise<string | null> {
  try {
    const [{ data: links }, { data: slugRow }] = await Promise.all([
      admin.from('customer_portal_links').select('audience, token, revoked_at').eq('customer_id', customerId).is('revoked_at', null),
      admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle(),
    ])
    const rows = (links ?? []) as Array<{ audience: string; token: string | null }>
    const gc = rows.find((l) => l.audience === 'gc' && l.token)
    if (gc?.token) return `${PORTAL_APP_ORIGIN}/portal?t=${gc.token}`
    const all = rows.find((l) => l.audience === 'all' && l.token)
    if (!all?.token) return null
    const slug = typeof (slugRow as { slug?: string } | null)?.slug === 'string' ? (slugRow as { slug: string }).slug.trim() : ''
    return slug ? `${PORTAL_SHORT_ORIGIN}${slug}` : `${PORTAL_APP_ORIGIN}/portal?t=${all.token}`
  } catch {
    return null
  }
}

/**
 * Each job's property record, for the statement's property blocks (v2.4255).
 * Read beside the payload, in chunks (an `.in()` list is a row-capped read);
 * a failed read groups the statement by address alone, which still sends.
 */
// deno-lint-ignore no-explicit-any
async function loadPropertyIdByJob(admin: any, jobIds: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  const ids = [...new Set(jobIds)]
  try {
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await admin.from('jobs_ledger').select('id, customer_address_id').in('id', ids.slice(i, i + 200))
      if (error) return {}
      for (const j of (data ?? []) as Array<{ id: string; customer_address_id: string | null }>) out[j.id] = j.customer_address_id ?? null
    }
    return out
  } catch {
    return {}
  }
}

/**
 * "Payments we have received" (v2.4260): the GC's checks of the last
 * STATEMENT_RECEIVED_DAYS days and where each went — the same rows Find a check
 * reads (`src/lib/jobs/gcChecksAppliedIo.ts` `fetchGcChecksInputs`), through
 * the same kernel. Best-effort: a failed read sends the statement without the
 * block rather than not at all.
 */
// deno-lint-ignore no-explicit-any
async function receivedFor(admin: any, gcId: string, todayYmd: string): Promise<{ received: StatementReceivedIn[]; receivedSinceYmd: string } | null> {
  try {
    const { data: rawJobs, error: jobsErr } = await admin
      .from('jobs_ledger')
      .select(
        'id, hcp_number, click_number, job_name, job_address, customer_id, gc_customer_id, bill_to_party, lien_retainage_held, ' +
          'invoices:jobs_ledger_invoices(id, job_id, sequence_order, amount, status, billed_at, bill_to_party, bill_to_email), ' +
          'payments:jobs_ledger_payments(id, job_id, invoice_id, amount, paid_on, sent_on, payment_type, reference_number, mercury_transaction_id, sequence_order, created_at)',
      )
      .or(`gc_customer_id.eq.${gcId},customer_id.eq.${gcId}`)
    if (jobsErr) return null
    const jobs: ChecksJobIn[] = ((rawJobs ?? []) as Array<Omit<ChecksJobIn, 'invoices' | 'payments'> & { invoices: ChecksJobIn['invoices'] | null; payments: ChecksJobIn['payments'] | null }>).map((j) => ({
      ...j,
      invoices: j.invoices ?? [],
      payments: j.payments ?? [],
    }))
    const jobIds = jobs.map((j) => j.id)
    let events: ChecksEventIn[] = []
    if (jobIds.length > 0) {
      const idList = `(${jobIds.join(',')})`
      const { data } = await admin
        .from('jobs_ledger_payment_events')
        .select('id, kind, payment_id, from_job_id, to_job_id, amount, created_at')
        .or(`from_job_id.in.${idList},to_job_id.in.${idList}`)
        .order('created_at', { ascending: true })
      events = (data ?? []) as ChecksEventIn[]
    }
    // Deposit dates only sharpen the sheet; the statement's block does not print them.
    const deposits: ChecksDepositIn[] = []
    const receivedSinceYmd = ymdPlusDays(todayYmd, -STATEMENT_RECEIVED_DAYS)
    const report = buildGcChecksReport({ gcId, jobs, events, deposits, sinceYmd: receivedSinceYmd })
    const byJob = new Map(jobs.map((j) => [j.id, { address: j.job_address ?? null, number: (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() }]))
    return { received: statementReceivedFromChecks(report.checks, byJob), receivedSinceYmd }
  } catch {
    return null
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const FROM = COMPANY_EMAIL_FROM
const MAX_QUEUE_BATCH = 10
const MAX_ATTEMPTS = 5

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type RequestRow = {
  id: string
  requested_by: string
  sent_to: string
  group_by: 'gc' | 'development'
  gc_customer_id: string | null
  development_id: string | null
  entity_name: string
  include_collections: boolean
  send_at: string
  repeat_weekly: boolean
  attempts: number
  /** CC recipients (v2.2160), normalized by the client; null = none. */
  cc_emails: string[] | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof body.cron_secret === 'string' ? body.cron_secret : undefined
    if (!cronSecret || (headerSecret !== cronSecret && bodySecret !== cronSecret)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRole)

    const { data: pending, error: qErr } = await admin
      .from('gc_statement_email_requests')
      .select(
        'id, requested_by, sent_to, group_by, gc_customer_id, development_id, entity_name, include_collections, send_at, repeat_weekly, attempts, cc_emails',
      )
      .is('sent_at', null)
      .lte('send_at', new Date().toISOString())
      .lt('attempts', MAX_ATTEMPTS)
      .order('send_at', { ascending: true })
      .limit(MAX_QUEUE_BATCH)
    if (qErr) return jsonResponse({ error: qErr.message }, 500)

    const rows = (pending ?? []) as RequestRow[]
    if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

    let sent = 0
    let skipped = 0
    let duplicates = 0
    const errors: string[] = []

    /** Recent audit rows for one recipient, shaped for the dedupe kernel. Fails open (empty) on a read error. */
    const recentSendsTo = async (sentTo: string, nowMs: number): Promise<RecentStatementSend[]> => {
      try {
        const { data } = await admin
          .from('gc_statement_emails')
          .select('gc_customer_id, group_by, gc_name, sent_to, sent_at')
          .ilike('sent_to', sentTo)
          .gte('sent_at', dedupeSinceIso(GC_STATEMENT_DEDUPE_WINDOW_MS.unattended, nowMs))
          .order('sent_at', { ascending: false })
          .limit(20)
        return ((data ?? []) as Array<{ gc_customer_id: string | null; group_by: string; gc_name: string; sent_to: string; sent_at: string }>).map(
          (r) => ({ gcCustomerId: r.gc_customer_id, groupBy: r.group_by, gcName: r.gc_name, sentTo: r.sent_to, sentAt: r.sent_at }),
        )
      } catch (e) {
        console.error('gc_statement_emails dedupe read failed (sending anyway)', e)
        return []
      }
    }

    /** Advance a repeat_weekly chain (guarded against retry double-inserts). */
    const enqueueNextWeek = async (row: RequestRow) => {
      if (!row.repeat_weekly) return
      const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
      const { data: existing } = await admin
        .from('gc_statement_email_requests')
        .select('id')
        .eq('sent_to', row.sent_to)
        .eq('send_at', nextSendAt)
        .is('sent_at', null)
        .limit(1)
      if (!existing || existing.length === 0) {
        await admin.from('gc_statement_email_requests').insert({
          requested_by: row.requested_by,
          sent_to: row.sent_to,
          group_by: row.group_by,
          gc_customer_id: row.gc_customer_id,
          development_id: row.development_id,
          entity_name: row.entity_name,
          include_collections: row.include_collections,
          send_at: nextSendAt,
          repeat_weekly: true,
          cc_emails: row.cc_emails && row.cc_emails.length ? row.cc_emails : null,
        })
      }
    }

    // Office number for the footer line (v2.2133) — Settings → Company → invoice issuer.
    let officePhone: string | null = null
    try {
      const { data: issuerRow } = await admin
        .from('app_settings')
        .select('value_text')
        .eq('key', 'physical_invoice_issuer_v1')
        .maybeSingle()
      const parsed = issuerRow?.value_text ? (JSON.parse(issuerRow.value_text) as { phone?: unknown }) : null
      officePhone = parsed && typeof parsed.phone === 'string' ? parsed.phone : null
    } catch {
      officePhone = null
    }

    for (const row of rows) {
      try {
        const entityId = row.gc_customer_id ?? row.development_id
        const { data: payloadRaw, error: rpcErr } = await admin.rpc('get_gc_statement_email_payload', {
          p_group_by: row.group_by,
          p_entity_id: entityId,
          p_include_collections: row.include_collections,
        })
        if (rpcErr) throw new Error(`payload rpc: ${rpcErr.message}`)
        const payload = payloadRaw as GcStatementPayload
        if (!payload || !Array.isArray(payload.groups)) throw new Error('empty payload')

        const dateStr = chicagoDateStr()
        const isSingle = entityId != null
        const singleGroup = isSingle ? payload.groups[0] : null
        if (isSingle && (!singleGroup || singleGroup.rows.length === 0)) {
          // Nothing outstanding for this entity — never email an empty statement,
          // but a weekly chain still advances to next week.
          await admin
            .from('gc_statement_email_requests')
            .update({ sent_at: new Date().toISOString(), error: 'skipped: nothing outstanding' })
            .eq('id', row.id)
          await enqueueNextWeek(row)
          skipped += 1
          continue
        }

        // Send-time dedupe (journey-map #45): same statement, same address,
        // inside the unattended window, by any lane → skip; the chain advances.
        const auditGcName = isSingle
          ? singleGroup!.entity_name
          : payload.group_by === 'development'
            ? 'All developments'
            : 'All GCs'
        const auditGroupBy = isSingle ? row.group_by : 'all'
        const nowMs = Date.now()
        const dup = findDuplicateStatementSend(
          await recentSendsTo(row.sent_to, nowMs),
          { gcCustomerId: row.gc_customer_id, groupBy: auditGroupBy, gcName: auditGcName, sentTo: row.sent_to },
          GC_STATEMENT_DEDUPE_WINDOW_MS.unattended,
          nowMs,
        )
        if (dup) {
          const reason = describeDuplicateStatementSkip(dup, nowMs)
          console.log('gc-statement-email-dispatch', row.id, reason)
          await admin
            .from('gc_statement_email_requests')
            .update({ sent_at: new Date().toISOString(), error: reason.slice(0, 900) })
            .eq('id', row.id)
          await enqueueNextWeek(row)
          skipped += 1
          duplicates += 1
          continue
        }

        // Dev-saved wording (Settings → Email templates, v2.2660) — also frees
        // the subject's baked-in company name for editing without a deploy.
        const wording = await resolveServerEmailWording(
          'gc_statement_scheduled',
          { date: dateStr },
          isSingle ? gcStatementSubject(dateStr) : gcShareAllSubject(payload.group_by, dateStr),
        )
        const subject = wording.subject
        // Portal card (v2.2151; says "Pay online any time at …" since journey-map #46): single-GC statements carry the GC's portal link when one is active.
        const portalUrl = isSingle && row.group_by === 'gc' && row.gc_customer_id ? await resolveGcPortalUrl(admin, row.gc_customer_id) : null
        // The intro rides INSIDE the statement (journey-map #46) so the scheduled
        // lane and the client's Draft Message lane render one identical body —
        // src/lib/jobsDocuments/gcStatementEmailParity.test.ts pins it.
        // One property at a time (v2.4255): the jobs' property records group the bills, and the
        // account card carries the portal's QR code as an inline attachment — as a bill email does.
        const propertyIdByJob = isSingle ? await loadPropertyIdByJob(admin, singleGroup!.rows.map((r) => r.job_id)) : null
        const qrModules = portalUrl ? qrMatrix(portalUrl) : null
        // "Payments we have received" (v2.4260) — a GC's statement only; a development has no one payer to read.
        const received = isSingle && row.group_by === 'gc' && row.gc_customer_id ? await receivedFor(admin, row.gc_customer_id, chicagoTodayYmd()) : null
        const extras = { propertyIdByJob, qrImgSrc: qrModules ? `cid:${PORTAL_QR_CONTENT_ID}` : null, ...(received ?? {}) }
        const html = isSingle ? renderGcStatementHtml(singleGroup!, dateStr, officePhone, portalUrl, wording.introText, extras) : renderGcShareAllHtml(payload, dateStr, officePhone, wording.introText)
        const text = isSingle ? renderGcStatementText(singleGroup!, dateStr, officePhone, portalUrl, wording.introText, extras) : renderGcShareAllText(payload, dateStr, officePhone, wording.introText)

        const { data: requester } = await admin
          .from('users')
          .select('email, name')
          .eq('id', row.requested_by)
          .maybeSingle()
        const replyTo =
          typeof requester?.email === 'string' && requester.email.includes('@') ? requester.email : undefined

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [row.sent_to],
            ...(Array.isArray(row.cc_emails) && row.cc_emails.length ? { cc: row.cc_emails } : {}),
            subject,
            html,
            text,
            ...(replyTo ? { reply_to: replyTo } : {}),
            ...(isSingle && qrModules ? { attachments: [{ filename: PORTAL_QR_FILENAME, content: bytesToBase64(qrPngBytes(qrModules)), content_id: PORTAL_QR_CONTENT_ID }] } : {}),
          }),
        })
        if (!resendResponse.ok) {
          const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
          throw new Error(errorData.message || `Resend ${resendResponse.status}`)
        }
        const sentMail = (await resendResponse.json().catch(() => ({}))) as { id?: string }

        await logEmailSendBestEffort({
          resendEmailId: sentMail.id ?? null,
          to: [row.sent_to, ...(Array.isArray(row.cc_emails) ? row.cc_emails : [])],
          from: FROM,
          subject,
          emailType: GC_STATEMENT_EMAIL_TYPES.scheduled,
        })

        // Audit row (same table + semantics as send-gc-statement-email; failure
        // must not fail an already-sent email).
        try {
          await admin.from('gc_statement_emails').insert({
            gc_customer_id: row.gc_customer_id,
            gc_name: auditGcName,
            group_by: auditGroupBy,
            sent_to: row.sent_to,
            subject,
            total: isSingle ? singleGroup!.subtotal : payload.grand_total,
            job_count: isSingle
              ? singleGroup!.job_count
              : payload.groups.reduce((s, g) => s + g.job_count, 0),
            sent_by: row.requested_by,
            sent_by_name: typeof requester?.name === 'string' ? requester.name : '',
            cc_emails: Array.isArray(row.cc_emails) && row.cc_emails.length ? row.cc_emails : null,
            resend_email_id: sentMail.id ?? null,
          })
        } catch (auditErr) {
          console.error('gc_statement_emails audit insert failed', auditErr)
        }

        await admin
          .from('gc_statement_email_requests')
          .update({ sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id)
        sent += 1
        await enqueueNextWeek(row)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await admin
          .from('gc_statement_email_requests')
          .update({ error: msg.slice(0, 900), attempts: row.attempts + 1 })
          .eq('id', row.id)
        errors.push(`${row.id}: ${msg}`)
      }
    }

    return jsonResponse({ ok: true, processed: rows.length, sent, skipped, duplicates, errors })
  } catch (e) {
    console.error('gc-statement-email-dispatch', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
