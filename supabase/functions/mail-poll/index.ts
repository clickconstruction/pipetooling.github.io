import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DocsmitClient } from '../_shared/docsmitClient.ts'
import { loadDocsmitConfig } from '../_shared/mailConfig.ts'
import { appendEvent, mailStatusFromProvider, parseMailClientMsgId } from '../_shared/mailSend.ts'
import { loadOpenPieces, refreshPieces, type MailDb } from '../_shared/mailDocsmitRefresh.ts'

/**
 * mail-poll (the Docsmit train, PR 3): the hourly read-back, cron-driven (X-Cron-Secret, as
 * lien-pay-offer's expire). Every open Docsmit piece (sent · mailed · in_transit · notice_left ·
 * unknown) gets one `/parties` read through the shared refresh: tracking, status, the event log,
 * the filing's sends[], and the Certification PDF once delivered. Then, when app_settings
 * docsmit_match_site is 'true', `GET /messages/sent?turnOffSoftwareID=true` lists what the
 * office sent by hand from Docsmit's own site, and a message we do not hold becomes a piece of
 * kind `other` with a problem line, so nothing mailed goes unrecorded. `{ dry_run: true }`
 * reads and writes nothing.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, DOCSMIT_EMAIL,
 * DOCSMIT_PASSWORD_SHA512, DOCSMIT_SOFTWARE_ID, DOCSMIT_BASE_URL. Gateway verify_jwt = false.
 * app_settings docsmit_paused = 'true' skips the run. Last, the account's balance is written to app_settings
 * docsmit_credit_balance / docsmit_credit_as_of (the credit line, 6b).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const MAX_SITE_MATCH = 50

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function setting(admin: MailDb, key: string): Promise<string> {
  const { data } = await admin.from('app_settings').select('value_text').eq('key', key).maybeSingle()
  return String((data as { value_text?: unknown } | null)?.value_text ?? '').trim().toLowerCase()
}

/** One `app_settings` row written (the credit line, 6b): the poll's own keys, made on first write. */
async function writeSetting(admin: MailDb, key: string, value: string): Promise<void> {
  const { data } = await admin.from('app_settings').select('key').eq('key', key).maybeSingle()
  const { error } = data ? await admin.from('app_settings').update({ value_text: value }).eq('key', key) : await admin.from('app_settings').insert({ key, value_text: value })
  if (error) throw new Error(`app_settings ${key}: ${error.message}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: { cron_secret?: unknown; dry_run?: unknown } = {}
  try { body = (await req.json()) as typeof body } catch { body = {} }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const given = req.headers.get('x-cron-secret') ?? (typeof body.cron_secret === 'string' ? body.cron_secret : null)
    if (!cronSecret || given !== cronSecret) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'Server misconfigured' }, 500)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) as unknown as MailDb

    const { config: cfg } = await loadDocsmitConfig(admin as unknown as Parameters<typeof loadDocsmitConfig>[0], (k) => Deno.env.get(k))
    if (!cfg) return jsonResponse({ ok: true, skipped: 'docsmit not set up' })
    if ((await setting(admin, 'docsmit_paused')) === 'true') return jsonResponse({ ok: true, skipped: 'paused' })

    const dryRun = body.dry_run === true
    const client = new DocsmitClient(cfg)
    const nowIso = new Date().toISOString()
    const pieces = await loadOpenPieces(admin, 'docsmit')
    if (dryRun) return jsonResponse({ ok: true, dry_run: true, env: client.env(), open: pieces.map((p) => ({ id: p.id, status: p.status })) })

    const result = await refreshPieces(admin, client, pieces, nowIso, { supabaseUrl, serviceKey })

    let matched = 0
    const matchErrors: string[] = []
    if ((await setting(admin, 'docsmit_match_site')) === 'true') {
      try {
        const sent = (await client.sentList({ turnOffSoftwareID: 'true' })).slice(0, MAX_SITE_MATCH)
        const ids = sent.map((m) => String(m.messageID ?? m.MessageID ?? m.id ?? '')).filter(Boolean)
        const { data: known } = ids.length > 0 ? await admin.from('mail_pieces').select('provider_message_id').eq('provider', 'docsmit').in('provider_message_id', ids) : { data: [] }
        const have = new Set(((Array.isArray(known) ? known : []) as Array<{ provider_message_id: string }>).map((r) => r.provider_message_id))
        for (const m of sent) {
          const id = String(m.messageID ?? m.MessageID ?? m.id ?? '')
          if (!id || have.has(id)) continue
          const ours = parseMailClientMsgId(String(m.clientMsgID ?? ''))
          if (ours) continue // one of ours: its piece holds it (or held it before a reset); never a second row
          const party = (Array.isArray(m.physicalParties) ? m.physicalParties[0] : null) as Record<string, unknown> | null
          const status = mailStatusFromProvider({ sent: true, tracking: typeof party?.USPSTrackingID === 'string' ? party.USPSTrackingID : null, deliveryStatus: typeof party?.DeliveryStatus === 'string' ? party.DeliveryStatus : null })
          const { error } = await admin.from('mail_pieces').insert({
            kind: 'other',
            source_ids: [],
            provider: 'docsmit',
            recipient: 'unknown',
            name: String(party?.firstName ?? '').trim() + (party?.lastName ? ` ${String(party.lastName).trim()}` : ''),
            organization: String(party?.organization ?? '').trim(),
            address1: String(party?.address1 ?? '').trim(),
            address2: String(party?.address2 ?? '').trim(),
            city: String(party?.city ?? '').trim(),
            state: String(party?.state ?? '').trim().toUpperCase().slice(0, 2),
            postal_code: String(party?.postalCode ?? '').trim(),
            send_type: String(party?.sendType ?? 'Certified, Electronic Return Receipt'),
            provider_message_id: id,
            status,
            usps_tracking: typeof party?.USPSTrackingID === 'string' && party.USPSTrackingID ? party.USPSTrackingID : null,
            delivery_status: typeof party?.DeliveryStatus === 'string' ? party.DeliveryStatus : null,
            problem: `Sent from Docsmit's own site (${String(m.title ?? 'no title')}). Match it to a job.`,
            events: appendEvent([], { at: nowIso, kind: 'matched_from_site', title: m.title ?? null }),
          })
          if (error) matchErrors.push(`${id}: ${error.message}`)
          else matched++
        }
      } catch (e) {
        matchErrors.push(e instanceof Error ? e.message : String(e))
      }
    }

    // The credit line (6b): the account's balance, kept where the Dashboard's Needs you and the run's strip read it.
    let creditBalance: number | null = null
    let creditError: string | null = null
    try {
      creditBalance = (await client.accountInfo()).creditBalance
      if (creditBalance != null) {
        await writeSetting(admin, 'docsmit_credit_balance', String(creditBalance))
        await writeSetting(admin, 'docsmit_credit_as_of', nowIso)
      }
    } catch (e) {
      creditError = e instanceof Error ? e.message : String(e)
    }

    return jsonResponse({ ok: result.errors.length === 0 && matchErrors.length === 0, env: client.env(), read: pieces.length, updated: result.updated, errors: result.errors, matched_from_site: matched, match_errors: matchErrors, credit_balance: creditBalance, credit_error: creditError })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('mail-poll', message)
    return jsonResponse({ error: message }, 500)
  }
})
