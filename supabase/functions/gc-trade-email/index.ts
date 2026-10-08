import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { officeYmd } from '../_shared/bidFollowupReminder.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { sha256Hex } from '../_shared/gcTradeLink.ts'
import {
  buildGcTradeEmail,
  GC_TRADE_EMAIL_FROM_NAME,
  GC_TRADE_EMAIL_ROLES,
  newTradeToken,
  parseTradeEmail,
  spanishHeld,
  TRADE_EMAIL_ERRORS,
  tradeEmailGroup,
  tradeEmailReach,
  tradeEmailRecipients,
  tradePortalLinkUrl,
  type TradeEmailErrorKey,
  type TradeMailPerson,
} from '../_shared/gcTradeEmail.ts'

/**
 * gc-trade-email — GC mode, every email to a trade partner company, from one sender (P3-a of the trade partner portal,
 * plan `to-dos/gc-mode/mockups/portal-p3.md` on spike/gc-mode). A lane sends by kind: the Ask window's invitation and
 * reminder, a new set's plans, the questions window's answer, and the rest as they land.
 *
 *   POST { companyId, kind, key, projectId | null, lang, subject, lines, group? }   staff JWT
 *     → { companyId, messageId, emailSendLogId, to }, with `already: true` for a key sent before
 *     → { error: key } with TRADE_EMAIL_ERRORS' status
 *
 * In order: the caller (a dev until the portal's door; never a training account or a digital twin), the shape, Spanish
 * held, the company, its ask on the project, the key sent once, who gets it by the kind's group, the company's link (made
 * on its first send), the email, the send, then the `gc_trade_messages` row and the sent copy. A failed send writes no
 * row. The service role reads and writes here, so the read-only blocks and the twin fence never see it.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const refuse = (key: TradeEmailErrorKey, detail?: string) => json({ error: key, ...(detail ? { detail } : {}) }, TRADE_EMAIL_ERRORS[key])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'badRequest' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!serviceRoleKey) return refuse('failed', 'SUPABASE_SERVICE_ROLE_KEY is not set')
    if (!resendApiKey) return refuse('failed', 'Email is not configured yet: set RESEND_API_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // The caller: a staff session, a dev until the portal's door, never a training account or a twin.
    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return refuse('signIn')
    const { data: who } = await admin.from('users').select('role, name, email, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who || !GC_TRADE_EMAIL_ROLES.includes(String(who.role))) return refuse('officeOnly')
    if (who.read_only || who.is_digital_twin) return refuse('readOnly')

    const parsed = parseTradeEmail(await req.json().catch(() => null))
    if (!parsed.ok) return refuse('badRequest')
    const m = parsed.req
    if (spanishHeld(m)) return refuse('spanishHeld')

    const { data: company } = await admin.from('gc_companies').select('id, name, contact_name, email, contact_gets').eq('id', m.companyId).maybeSingle()
    if (!company) return refuse('notFound')

    // A message about a project goes only to a company we asked on it.
    let stage: string | null = null
    let pmId: string | null = null
    if (m.projectId) {
      const { data: packages } = await admin.from('gc_trade_packages').select('id').eq('project_id', m.projectId)
      const packageIds = (packages ?? []).map((p: { id: string }) => p.id)
      const { count } = packageIds.length
        ? await admin.from('gc_invites').select('id', { count: 'exact', head: true }).eq('company_id', m.companyId).in('package_id', packageIds)
        : { count: 0 }
      if (!count) return refuse('notOnProject')
      const { data: gc } = await admin.from('gc_projects').select('stage, project_manager_user_id').eq('project_id', m.projectId).maybeSingle()
      stage = gc?.stage ?? null
      pmId = gc?.project_manager_user_id ?? null
    }

    // A key is sent once: the first send's ids, and nothing sent.
    const sentBefore = async () => (await admin.from('gc_trade_messages').select('id, email_send_log_id, to_names').eq('company_id', m.companyId).eq('msg_key', m.key).maybeSingle()).data
    const before = await sentBefore()
    if (before) return json({ companyId: m.companyId, messageId: before.id, emailSendLogId: before.email_send_log_id, to: before.to_names ?? [], already: true })

    const group = tradeEmailGroup(m.kind, stage, m.group)
    const { data: people } = await admin.from('gc_company_people').select('name, email, gets').eq('company_id', m.companyId).is('removed_at', null)
    const reach = tradeEmailReach(tradeEmailRecipients(company, (people ?? []) as TradeMailPerson[], group))
    if (reach.length === 0) return refuse('noEmail')

    // The company's link that is on, else a new one by mint_gc_trade_portal_link's rules (one on per company).
    const activeToken = async () => (await admin.from('gc_trade_portal_links').select('token').eq('company_id', m.companyId).is('revoked_at', null).maybeSingle()).data?.token as string | null | undefined
    let token = await activeToken()
    if (!token) {
      await admin.from('gc_trade_portal_links').update({ revoked_at: new Date().toISOString() }).eq('company_id', m.companyId).is('revoked_at', null)
      const raw = newTradeToken()
      const { error: mintError } = await admin.from('gc_trade_portal_links').insert({ company_id: m.companyId, token: raw, token_hash: await sha256Hex(raw), created_by: u.user.id })
      token = mintError ? await activeToken() : raw
      if (!token) return refuse('failed', `The portal link was not made: ${mintError?.message ?? 'no link'}`)
    }
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')

    const pm = pmId ? (await admin.from('users').select('name, email').eq('id', pmId).maybeSingle()).data : null
    const replyTo = (pm?.email || who.email || '').trim() || undefined
    const signer = (pm?.name || who.name || GC_TRADE_EMAIL_FROM_NAME).trim()
    const email = buildGcTradeEmail({
      lang: m.lang,
      recipients: reach.map((r) => r.name),
      company: String(company.name ?? ''),
      subject: m.subject,
      lines: m.lines,
      linkUrl: tradePortalLinkUrl(origin, token),
      signer,
      gc: GC_TRADE_EMAIL_FROM_NAME,
    })

    const from = mailboxWithName(GC_TRADE_EMAIL_FROM_NAME, EMAIL_FROM)
    const [first, ...rest] = reach
    const cc = rest.map((r) => r.email)
    const sent = await sendEmailViaResend(first!.email, email.subject, email.text, email.html, resendApiKey, {
      from,
      ...(replyTo ? { replyTo } : {}),
      ...(cc.length ? { cc } : {}),
      emailType: 'gc_trade_email',
    })
    if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')

    const logId = sent.resendEmailId
      ? ((await admin.from('email_send_log').select('id').eq('resend_email_id', sent.resendEmailId).maybeSingle()).data?.id ?? null)
      : null
    const names = reach.map((r) => r.name)
    const messageId = crypto.randomUUID()
    const { error } = await admin.from('gc_trade_messages').insert({
      id: messageId,
      company_id: m.companyId,
      project_id: m.projectId,
      kind: m.kind,
      mail_group: group,
      msg_key: m.key,
      lang: m.lang,
      subject: email.subject,
      lines: m.lines,
      to_names: names,
      sent_on: officeYmd(new Date().toISOString()),
      sent_by: u.user.id,
      email_send_log_id: logId,
    })
    // Two presses at once: the other one's row stands, and this answers with its ids.
    const raced = error?.code === '23505' ? await sentBefore() : null

    // Sent copies (docs/SENT_COPIES.md): filed after the row, by its id; the kept copy shows /t/… and never the link.
    await fileSentEmailBestEffort(
      { kind: 'gc_trade_email', title: email.subject, recipientName: String(company.name ?? ''), source: { table: 'gc_trade_messages', id: error ? null : messageId }, sentBy: u.user.id },
      { to: [first!.email], cc, from, subject: email.subject, html: email.html, resendEmailId: sent.resendEmailId ?? null },
    )
    if (raced) return json({ companyId: m.companyId, messageId: raced.id, emailSendLogId: raced.email_send_log_id, to: raced.to_names ?? [], already: true })
    if (error) return refuse('failed', `Sent, but not recorded: ${error.message}`)
    return json({ companyId: m.companyId, messageId, emailSendLogId: logId, to: names })
  } catch (e) {
    return refuse('failed', e instanceof Error ? e.message : String(e))
  }
})
