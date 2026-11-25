/**
 * remind-person-papers (punch list #376): reminders by email for a staff or sub paper that waits on a signature.
 * pg_cron calls this hourly with X-Cron-Secret, as it calls remind-job-contracts. It reads the papers that are out
 * with a reminder due, emails each signer at the address the send kept, and counts it: three days apart, up to three.
 *
 * The switch: `app_settings` `person_paper_reminders_v1`. It ships '0', and while it is off this answers
 * `{ skipped: 'off' }` and writes nothing. The rules are `_shared/personPaperReminder.ts`.
 *
 * Each reminder carries a new link. A person's signing link is kept only as a hash, so the one sent before cannot be
 * sent again: a reminder makes a new one that works for 14 days, and that ends the link before it. The email says so.
 *
 * It does what is ready: a paper that cannot be reminded is held with its reason and its reminders stop, an email that
 * fails is named and tried again the next hour, and the rest still go. A job's paper built from settings has no words
 * of its own: the job's row is asked whether it carries settings, as the send asks, so it is reminded too.
 *
 * `dry_run: true` writes nothing and emails nobody. It answers who would be emailed, switch on or off.
 * `only_id` narrows one run to one paper.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { buildContractSigningEmail, CONTRACT_SIGNING_EMAIL_COMPANY } from '../_shared/contractSigningEmail.ts'
import { hasSigningContent, withJobPaperSettings, type JobPaperSettingsReader } from '../_shared/contractSigningSend.ts'
import { signerEmailWord } from '../_shared/paperSigner.ts'
import {
  afterReminder,
  paperRemindersOn,
  PERSON_PAPER_MAX_REMINDERS,
  PERSON_PAPER_REMINDER_LINK_DAYS,
  PERSON_PAPER_REMINDERS_KEY,
  reminderHold,
  reminderHoldWords,
  reminderIntro,
  reminderSubject,
  type ReminderHold,
} from '../_shared/personPaperReminder.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type DueRow = {
  id: string
  person_id: string | null
  person_name: string
  document_name: string
  doc_type: string | null
  status: string
  signer_email: string | null
  reminders_enabled: boolean | null
  reminder_count: number | null
  next_reminder_at: string | null
  signing_body_html: string | null
  canonical_document_url: string | null
  url: string | null
  form_template_id: string | null
  job_required_paper_id: string | null
}

const DUE_COLUMNS =
  'id, person_id, person_name, document_name, doc_type, status, signer_email, reminders_enabled, reminder_count, next_reminder_at, signing_body_html, canonical_document_url, url, form_template_id, job_required_paper_id'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomUrlToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) return json({ error: 'CRON_SECRET not configured' }, 500)
    const body = (await req.json().catch(() => ({}))) as { cron_secret?: string; dry_run?: boolean; only_id?: unknown }
    if (req.headers.get('X-Cron-Secret') !== cronSecret && body.cron_secret !== cronSecret) {
      return json({ error: 'Unauthorized - Invalid or missing cron secret' }, 401)
    }
    const dryRun = body.dry_run === true
    const onlyId = typeof body.only_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.only_id) ? body.only_id : null

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: sw } = await admin.from('app_settings').select('value_text').eq('key', PERSON_PAPER_REMINDERS_KEY).maybeSingle()
    const switchOn = paperRemindersOn((sw as { value_text?: string | null } | null)?.value_text)
    if (!switchOn && !dryRun) return json({ ok: true, skipped: 'off', sent: 0 })

    const nowMs = Date.now()
    let query = admin
      .from('person_contract_documents')
      .select(DUE_COLUMNS)
      .eq('status', 'sent')
      .eq('reminders_enabled', true)
      .lte('next_reminder_at', new Date(nowMs).toISOString())
      .lt('reminder_count', PERSON_PAPER_MAX_REMINDERS)
      .order('next_reminder_at', { ascending: true })
      .limit(50)
    if (onlyId) query = query.eq('id', onlyId)
    const { data: dueRaw, error: dueErr } = await query
    if (dueErr) return json({ error: dueErr.message }, 500)
    const due = (dueRaw ?? []) as unknown as DueRow[]

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const from = mailboxWithName(CONTRACT_SIGNING_EMAIL_COMPANY, EMAIL_FROM)
    const held: Array<{ id: string; reason: string }> = []
    const failed: Array<{ id: string; reason: string }> = []
    const would: Array<{ id: string; to: string; document: string; nth: number }> = []
    let sent = 0

    for (const c of due) {
      let hold: ReminderHold | 'left' | 'nothing_to_sign' | null = reminderHold(c)
      if (!hold) {
        // A job's paper built from settings has no words of its own (punch list #389, step 3), so the job's row is
        // asked, as the send asks it, and such a paper is reminded like any other (punch list #376, call 1). A read
        // that fails holds nothing: the paper is named and read again the next hour, with its date as it was.
        try {
          if (!hasSigningContent(await withJobPaperSettings(admin as unknown as JobPaperSettingsReader, c))) hold = 'nothing_to_sign'
        } catch (e) {
          failed.push({ id: c.id, reason: `The job's settings were not read: ${(e as { message?: string } | null)?.message ?? 'no reason given'}` })
          continue
        }
      }
      if (!hold && c.person_id) {
        // Someone who left the team is not chased by a robot: the office chases them, or lets the paper go.
        const { data: person } = await admin.from('people').select('archived_at').eq('id', c.person_id).maybeSingle()
        if ((person as { archived_at?: string | null } | null)?.archived_at) hold = 'left'
      }
      if (hold) {
        held.push({ id: c.id, reason: hold === 'nothing_to_sign' ? 'The paper has nothing to sign.' : reminderHoldWords(hold) })
        // Nothing to remind with: stop this paper's reminders so it is not read again each hour.
        if (!dryRun) await admin.from('person_contract_documents').update({ next_reminder_at: null }).eq('id', c.id)
        continue
      }
      const to = signerEmailWord(c.signer_email)!
      const countBefore = Math.max(0, Math.floor(Number(c.reminder_count ?? 0)))
      const nth = countBefore + 1
      if (dryRun) {
        would.push({ id: c.id, to, document: c.document_name, nth })
        continue
      }
      if (!resendKey) {
        failed.push({ id: c.id, reason: 'RESEND_API_KEY is not set, so nothing was emailed.' })
        continue
      }

      // The new link. It is written before the email goes, since the email carries it. The count is not: an email
      // that fails is tried again the next hour with another link, and is never counted as a reminder.
      const rawToken = randomUrlToken()
      const expiresAt = new Date(nowMs + PERSON_PAPER_REMINDER_LINK_DAYS * 86_400_000).toISOString()
      const { data: linked, error: linkErr } = await admin
        .from('person_contract_documents')
        .update({ public_token_hash: await sha256Hex(rawToken), public_token_expires_at: expiresAt })
        .eq('id', c.id)
        .eq('status', 'sent')
        .eq('reminder_count', countBefore)
        .select('id')
      if (linkErr || !linked?.length) {
        // Signed, sent again or reminded by another run a moment ago: nothing to do for it now.
        if (linkErr) failed.push({ id: c.id, reason: linkErr.message })
        continue
      }

      const mail = buildContractSigningEmail({
        documentName: c.document_name,
        personName: c.person_name,
        acceptUrl: `${origin}/contract/accept?t=${encodeURIComponent(rawToken)}`,
        expiresYmd: todayYmdInAppTz(new Date(expiresAt)),
        sentYmd: todayYmdInAppTz(),
        subjectOverride: reminderSubject(c.document_name, CONTRACT_SIGNING_EMAIL_COMPANY),
        introPlain: reminderIntro(nth),
        sender: null,
        portalUrl: null,
        officePhone: PORTAL_COMPANY.phone || null,
      })
      // Sent copies (docs/SENT_COPIES.md): each reminder is kept under the person. No sender: it sends itself.
      const r = await sendEmailViaResend(to, mail.subject, mail.text, mail.html, resendKey, {
        from,
        emailType: 'contract_reminder',
        file: { kind: 'person_contract', recipientName: c.person_name, personId: c.person_id, source: { table: 'person_contract_documents', id: c.id } },
      })
      if (!r.success) {
        failed.push({ id: c.id, reason: r.error ?? 'The email service refused it.' })
        continue
      }
      await admin.from('person_contract_documents').update(afterReminder(countBefore, nowMs)).eq('id', c.id).eq('status', 'sent')
      sent++
    }

    if (dryRun) return json({ ok: true, dry_run: true, switch: switchOn ? 'on' : 'off', due: due.length, would, held })
    return json({ ok: true, sent, held, failed, due: due.length })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
