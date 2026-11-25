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
  GC_TRADE_EMAIL_TEST_TYPE,
  newTradeToken,
  parseTradeEmail,
  spanishHeld,
  TRADE_EMAIL_ERRORS,
  tradeEmailGroup,
  tradeEmailReach,
  tradeEmailRecipientsOf,
  tradeEmailTestSubject,
  tradePortalLinkUrl,
  tradeTestLinkUrl,
  type TradeEmailErrorKey,
  type TradeMailPerson,
} from '../_shared/gcTradeEmail.ts'
import { readEachAlone, sendTradeEmailToReach, tradeEmailOwed, tradeMailsReached, tradeNamesWith, type TradeEmailHeld, type TradeMailSent } from '../_shared/gcTradeEmailAlone.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * gc-trade-email — GC mode, every email to a trade partner company, from one sender (P3-a of the trade partner portal,
 * plan `to-dos/gc-mode/mockups/portal-p3.md` on spike/gc-mode). A lane sends by kind: the Ask window's invitation and
 * reminder, a new set's plans, the questions window's answer, and the rest as they land.
 *
 *   POST { companyId, kind, key, projectId | null, lang, subject, lines, group?, groups?, test?, eachAlone? }   staff JWT
 *     → { companyId, messageId, emailSendLogId, to, emails, held }, with `already: true` for a key sent before
 *     → { companyId, test: true, email, to, wouldGo: [{ name, email }] } for a test copy: who the real send would reach
 *     → { error: key } with TRADE_EMAIL_ERRORS' status
 *
 * Since the Board's B2b-viii-b: a `nudge` may name `groups` (the Follow up sheet from the company), and it goes to everyone
 * who gets any of them; its row keeps the first of them in TRADE_MAIL_GROUPS' order, and the portal's Messages show every
 * message whatever its group. `test: true` (every kind) runs the same gate and builds the same email, to the caller's own
 * address only, `[TEST]` before the subject, no copy to anyone, logged as `gc_trade_email_test`. It uses no key, makes no
 * link and shows none, and writes no message row and no sent copy.
 *
 * In order: the caller (a dev until the portal's door; never a training account or a digital twin), the shape, Spanish
 * held, the company, its ask on the project, the key sent once, who gets it by the kind's group, the company's link (made
 * on its first send), the email, the send, then the `gc_trade_messages` row and the sent copy. A send that reached nobody
 * writes no row. The service role reads and writes here, so the read-only blocks and the twin fence never see it.
 *
 * One email a person (punch list #205, `_shared/gcTradeEmailAlone.ts`): the email goes as one message, the first person on
 * To and the rest on CC, and the mail service refuses all of it when it refuses one address. A caller that sends
 * `eachAlone: true` (Word to every trade) then has each person sent the email alone. The row's `to_names` are the ones
 * that went, each email that went has its own log line and sent copy, and `held` names each person the service refused,
 * with its reason. A second press of the key sends nothing to a person on the row, and sends the email alone to a person
 * who gets these emails and is not on it: that is the retry for a person held the first time. `emails` is how many went
 * on this call. A caller that does not ask is sent to as before.
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

/** The wait before each email that goes alone, so a run of them stays under the mail service's two a second. */
const ALONE_PAUSE_MS = 600

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
    const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal
    if (!u?.user) return refuse('signIn')
    const { data: who } = await admin.from('users').select('role, name, email, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who || !GC_TRADE_EMAIL_ROLES.includes(String(who.role))) return refuse('officeOnly')
    if (who.read_only || who.is_digital_twin) return refuse('readOnly')

    const callerId = u.user.id
    const body: unknown = await req.json().catch(() => null)
    const parsed = parseTradeEmail(body)
    if (!parsed.ok) return refuse('badRequest')
    const eachAlone = readEachAlone(body)
    if (eachAlone === null) return refuse('badRequest')
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

    // A key is sent once: the first send's ids, and nothing sent. A test copy uses no key. A caller that asked for one
    // email a person goes on, to see whether anyone who gets these emails is not on the row yet.
    type SentRow = { id: string; email_send_log_id: string | null; to_names: string[] | null }
    const alreadyAnswer = (row: SentRow, more: { to?: string[]; emails?: number; held?: TradeEmailHeld[] } = {}) => ({
      companyId: m.companyId,
      messageId: row.id,
      emailSendLogId: row.email_send_log_id,
      to: more.to ?? row.to_names ?? [],
      already: true,
      emails: more.emails ?? 0,
      held: more.held ?? [],
    })
    const sentBefore = async () => (await admin.from('gc_trade_messages').select('id, email_send_log_id, to_names').eq('company_id', m.companyId).eq('msg_key', m.key).maybeSingle()).data as SentRow | null
    const before = m.test ? null : await sentBefore()
    if (before && !eachAlone) return json(alreadyAnswer(before))

    // Who gets it: the kind's group, or a nudge's groups together (B2b-viii-b). The row keeps the first.
    const group = m.groups?.[0] ?? tradeEmailGroup(m.kind, stage, m.group)
    const { data: people } = await admin.from('gc_company_people').select('name, email, gets').eq('company_id', m.companyId).is('removed_at', null)
    const reach = tradeEmailReach(tradeEmailRecipientsOf(company, (people ?? []) as TradeMailPerson[], m.groups ?? [group]))
    if (reach.length === 0) return before ? json(alreadyAnswer(before)) : refuse('noEmail')
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const pm = pmId ? (await admin.from('users').select('name, email').eq('id', pmId).maybeSingle()).data : null
    const replyTo = (pm?.email || who.email || '').trim() || undefined
    const signer = (pm?.name || who.name || GC_TRADE_EMAIL_FROM_NAME).trim()
    const from = mailboxWithName(GC_TRADE_EMAIL_FROM_NAME, EMAIL_FROM)

    // A test copy: the same email to the caller's own address, with no link made or shown, and nothing written.
    if (m.test) {
      const testAddress = String(who.email ?? '').trim()
      if (!testAddress) return refuse('noEmail')
      const email = buildGcTradeEmail({
        lang: m.lang,
        recipients: reach.map((r) => r.name),
        company: String(company.name ?? ''),
        subject: m.subject,
        lines: m.lines,
        linkUrl: tradeTestLinkUrl(origin),
        signer,
        gc: GC_TRADE_EMAIL_FROM_NAME,
      })
      const sent = await sendEmailViaResend(testAddress, tradeEmailTestSubject(email.subject), email.text, email.html, resendApiKey, {
        from,
        ...(replyTo ? { replyTo } : {}),
        emailType: GC_TRADE_EMAIL_TEST_TYPE,
      })
      if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')
      return json({ companyId: m.companyId, test: true, email: testAddress, to: reach.map((r) => r.name), wouldGo: reach })
    }

    // A second press of a key (one email a person): only a person who is not on the row is sent to, alone.
    let sendTo = reach
    if (before) {
      const owed = tradeEmailOwed(reach, before.to_names ?? [])
      if (owed.length === 0) return json(alreadyAnswer(before))
      sendTo = owed
    }

    // The company's link that is on, else a new one by mint_gc_trade_portal_link's rules (one on per company).
    const activeToken = async () => (await admin.from('gc_trade_portal_links').select('token').eq('company_id', m.companyId).is('revoked_at', null).maybeSingle()).data?.token as string | null | undefined
    let token = await activeToken()
    if (!token) {
      await admin.from('gc_trade_portal_links').update({ revoked_at: new Date().toISOString() }).eq('company_id', m.companyId).is('revoked_at', null)
      const raw = newTradeToken()
      const { error: mintError } = await admin.from('gc_trade_portal_links').insert({ company_id: m.companyId, token: raw, token_hash: await sha256Hex(raw), created_by: callerId })
      token = mintError ? await activeToken() : raw
      if (!token) return refuse('failed', `The portal link was not made: ${mintError?.message ?? 'no link'}`)
    }

    const linkUrl = tradePortalLinkUrl(origin, token)
    const emailFor = (names: string[]) =>
      buildGcTradeEmail({ lang: m.lang, recipients: names, company: String(company.name ?? ''), subject: m.subject, lines: m.lines, linkUrl, signer, gc: GC_TRADE_EMAIL_FROM_NAME })

    // The send: one message, the first person on To and the rest on CC. Refused, and asked for: each person alone.
    const outcome = await sendTradeEmailToReach({
      reach: sendTo,
      eachAlone,
      aloneOnly: Boolean(before),
      send: (first, others) => {
        const email = emailFor([first, ...others].map((r) => r.name))
        return sendEmailViaResend(first.email, email.subject, email.text, email.html, resendApiKey, {
          from,
          ...(replyTo ? { replyTo } : {}),
          ...(others.length ? { cc: others.map((r) => r.email) } : {}),
          emailType: 'gc_trade_email',
        })
      },
      pause: () => new Promise((done) => setTimeout(done, ALONE_PAUSE_MS)),
    })
    for (const h of outcome.held) console.warn(`gc-trade-email: held one person. company ${m.companyId}, kind ${m.kind}: ${h.reason}`)
    if (!outcome.went) {
      console.warn(`gc-trade-email: nobody reached. company ${m.companyId}, kind ${m.kind}, ${sendTo.length} tried: ${outcome.reason}`)
      // A second press where the one owed is refused again: the row stands, and the answer names who is still held.
      if (before) return json(alreadyAnswer(before, { held: outcome.held }))
      return refuse('sendFailed', outcome.reason)
    }

    // Sent copies (docs/SENT_COPIES.md): one for each email that went, filed after the row, by its id; the kept copy
    // shows /t/… and never the link.
    const fileCopy = (mail: TradeMailSent, sourceId: string | null) => {
      const email = emailFor([mail.to, ...mail.cc].map((r) => r.name))
      return fileSentEmailBestEffort(
        { kind: 'gc_trade_email', title: email.subject, recipientName: String(company.name ?? ''), source: { table: 'gc_trade_messages', id: sourceId }, sentBy: callerId },
        { to: [mail.to.email], cc: mail.cc.map((r) => r.email), from, subject: email.subject, html: email.html, resendEmailId: mail.resendEmailId },
      )
    }
    const names = tradeMailsReached(outcome.mails).map((r) => r.name)

    // A second press reached someone who was owed: the row gains the names. Its first log line stays.
    if (before) {
      const all = tradeNamesWith(before.to_names ?? [], names)
      const { error } = await admin.from('gc_trade_messages').update({ to_names: all }).eq('id', before.id)
      for (const mail of outcome.mails) await fileCopy(mail, before.id)
      if (error) return refuse('failed', `Sent, but not recorded: ${error.message}`)
      return json(alreadyAnswer(before, { to: all, emails: outcome.mails.length, held: outcome.held }))
    }

    const firstId = outcome.mails[0]?.resendEmailId ?? null
    const logId = firstId ? ((await admin.from('email_send_log').select('id').eq('resend_email_id', firstId).maybeSingle()).data?.id ?? null) : null
    const messageId = crypto.randomUUID()
    const { error } = await admin.from('gc_trade_messages').insert({
      id: messageId,
      company_id: m.companyId,
      project_id: m.projectId,
      kind: m.kind,
      mail_group: group,
      msg_key: m.key,
      lang: m.lang,
      subject: emailFor(names).subject,
      lines: m.lines,
      to_names: names,
      sent_on: officeYmd(new Date().toISOString()),
      sent_by: callerId,
      email_send_log_id: logId,
    })
    // Two presses at once: the other one's row stands, and this answers with its ids.
    const raced = error?.code === '23505' ? await sentBefore() : null

    for (const mail of outcome.mails) await fileCopy(mail, error ? null : messageId)
    if (raced) return json(alreadyAnswer(raced, { emails: outcome.mails.length, held: outcome.held }))
    if (error) return refuse('failed', `Sent, but not recorded: ${error.message}`)
    return json({ companyId: m.companyId, messageId, emailSendLogId: logId, to: names, emails: outcome.mails.length, held: outcome.held })
  } catch (e) {
    return refuse('failed', e instanceof Error ? e.message : String(e))
  }
})
