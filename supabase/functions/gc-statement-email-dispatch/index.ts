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
 *   3. Send via Resend from the EMAIL_FROM sender with the REQUESTER's
 *      email as reply-to (matches send-gc-statement-email).
 *   4. Audit into gc_statement_emails (group_by 'all' when no entity id) and
 *      best-effort email_send_log; stamp sent_at; re-enqueue weekly chains.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { resolveServerEmailWording } from '../_shared/emailWordingServer.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import {
  chicagoDateStr,
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const FROM = EMAIL_FROM
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
    const errors: string[] = []

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
        const html = isSingle ? renderGcStatementHtml(singleGroup!, dateStr, officePhone, portalUrl, wording.introText) : renderGcShareAllHtml(payload, dateStr, officePhone, wording.introText)
        const text = isSingle ? renderGcStatementText(singleGroup!, dateStr, officePhone, portalUrl, wording.introText) : renderGcShareAllText(payload, dateStr, officePhone, wording.introText)

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
        })

        // Audit row (same table + semantics as send-gc-statement-email; failure
        // must not fail an already-sent email).
        try {
          await admin.from('gc_statement_emails').insert({
            gc_customer_id: row.gc_customer_id,
            gc_name: isSingle
              ? singleGroup!.entity_name
              : payload.group_by === 'development'
                ? 'All developments'
                : 'All GCs',
            group_by: isSingle ? row.group_by : 'all',
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

    return jsonResponse({ ok: true, processed: rows.length, sent, skipped, errors })
  } catch (e) {
    console.error('gc-statement-email-dispatch', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
