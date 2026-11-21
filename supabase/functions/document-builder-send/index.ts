import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { officeYmd } from '../_shared/bidFollowupReminder.ts'
import { documentBuilderCaller } from '../_shared/documentBuilderCaller.ts'
import { documentBuilderLinkUrl } from '../_shared/documentBuilderLink.ts'
import { sheetLinkCodeFor } from '../_shared/documentBuilderLinkCode.ts'
import {
  BUILDER_SEND_SENT_KIND,
  DOCUMENT_BUILDER_SEND_REFUSALS as REFUSALS,
  SHEET_SEND_SENT_KIND,
  sentCopyJobIds,
  builderSendEmail,
  customerPageUrl,
  gcJobLabel,
  gcPageLink,
  parseBuilderSend,
  parseSheetSend,
  resendGoesToWhoItWentTo,
  sendAskKind,
  sheetSendEmail,
  sheetSendMessageKey,
  sheetWentOutChecked,
  type DocumentBuilderSendRefusal,
} from '../_shared/documentBuilderSend.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { sentCopyKeptHtml } from '../_shared/sentCopyEmail.ts'
import { buildGcTradeEmail, GC_TRADE_EMAIL_FROM_NAME, GC_TRADE_EMAIL_TEST_TYPE, newTradeToken, tradeEmailTestSubject, tradePortalLinkUrl, tradeTestLinkUrl } from '../_shared/gcTradeEmail.ts'
import { resolveTradeLink, sha256Hex, type TradeLinkRow } from '../_shared/gcTradeLink.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

/**
 * document-builder-send (punch list #404, step 5): the Document builder's send. A job's published sheet goes to one
 * person at a trade partner on that job, as an email with one press to the page the trade already opens. The office
 * then sees the day it went and the day it was opened. `verify_jwt = false`: the open comes from a trade's own page,
 * which has no session, and the send checks its caller here.
 *
 *   POST { action: 'send', builderKey, sheetId, companyId, contactEmail, note, why, anyway?, test? }   a dev, signed in
 *       → { ok, send: { id, contactName, contactEmail, sentAt, sentRevision, timesSent, openedAt, openedRevision }, page: 'on' }
 *       → { ok, test: true, email }     a test copy: the same email to the caller's own address, and nothing written
 *       → { error: key, words } with the key's status
 *     In order: the caller (a dev; never an archived account, a training account or a twin), the sheet (it must be
 *     published), the read mark (an unread revision goes only with `anyway`), the company (on a trade of this job),
 *     the person (someone on the company's record with that email; a reminder goes only to the address the send's
 *     own row went to, never to a namesake), then the company's page. A page that is on is
 *     used. A company that never had a page gets one. A page that was turned off stays off: the send is refused,
 *     since a send never turns a page back on. Then the sheet's own link (made when the sheet never had one), the
 *     email, and only after it went: the send's row, the message on the company's thread and the sent copy.
 *   POST { action: 'send', builderKey, customerId, aboutJobId, contactEmail, note, why, anyway?, test? }   a dev, signed in
 *       → the same answers, with `send.aboutJobId`
 *     Step 9: a published builder goes to one person at a customer who is the GC on a job with us. The same order:
 *     the caller, the builder (published), the read mark on its newest revision, the customer (the GC on a job, and
 *     `aboutJobId` one of those jobs or null for all of them), the person (on the customer's record with that email,
 *     and for a reminder the address the row went to), then their page (`customer_portal_links`, the GC's view or the
 *     whole account's): on is used, never made gets one, turned off stays off. Then the email, and after it the
 *     send's row and the sent copy. A reminder stays about what the first send was about.
 *   POST { action: 'opened', portalToken, builderKey }   a GC's own page, by its link → { ok }
 *   POST { action: 'opened', token, sheetId }   a trade's own page, by its link
 *       → { ok }   The day and the revision they opened are kept on their send. A signed-in teammate's look and a
 *                  preview are not counted. A link that is off answers 404.
 *
 * The service role reads and writes here, so the read-only blocks and the twin fence never see it: the caller check
 * stands in for them.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
const refuse = (key: DocumentBuilderSendRefusal, detail?: string) => json({ error: key, words: REFUSALS[key].words, ...(detail ? { detail } : {}) }, REFUSALS[key].status)

// deno-lint-ignore no-explicit-any
type Admin = any

/** The kind whose rule hides a page's key in a filed copy (`sentCopyKeptHtml`): the trade email's, whose frame this email is. */
const SENT_COPY_KEPT_AS = 'gc_trade_email'

/** The email log's name for a builder sent to a GC (`EMAIL_CATALOG`). */
const BUILDER_SEND_EMAIL_TYPE = 'document_builder_email'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SEND_COLUMNS = 'id, contact_name, contact_email, sent_at, sent_revision, times_sent, opened_at, opened_revision'

type SendRow = { id: string; contact_name: string; contact_email: string | null; sent_at: string; sent_revision: number; times_sent: number; opened_at: string | null; opened_revision: number | null }
const sendOut = (r: SendRow) => ({ id: r.id, contactName: r.contact_name, contactEmail: r.contact_email ?? '', sentAt: r.sent_at, sentRevision: r.sent_revision, timesSent: r.times_sent, openedAt: r.opened_at, openedRevision: r.opened_revision })

async function send(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>): Promise<Response> {
  const caller = await documentBuilderCaller(req, admin, supabaseUrl, corsHeaders, (why) => refuse(why))
  if (caller instanceof Response) return caller
  const m = parseSheetSend(body)
  if (!m) return refuse('badRequest')

  // The sheet, as published. A draft is never sent.
  const { data: sheetRow } = await admin.from('document_builder_sheets').select('id, builder_key, project_id, revision, usual_revision, published_sheet').eq('id', m.sheetId).eq('builder_key', m.builderKey).maybeSingle()
  const sheet = sheetRow as { id: string; builder_key: string; project_id: string; revision: number; usual_revision: number | null; published_sheet: unknown } | null
  if (!sheet) return refuse('notFound')
  if (sheet.revision < 1 || !sheet.published_sheet) return refuse('notPublished')
  const { data: builder } = await admin.from('document_builders').select('read_revision').eq('key', m.builderKey).maybeSingle()
  const usual = builder as { read_revision: number | null } | null
  if (!usual) return refuse('notFound')
  // A sheet that went out on a usual nobody checked goes only when the sender ticked Send it anyway. The mark is read
  // on the revision of the usual this sheet was published on, not on the usual's newest.
  if (!sheetWentOutChecked(usual.read_revision, sheet.usual_revision) && !m.anyway) return refuse('unread')

  // The company is on a trade of this job, and the person is on the company's record.
  const { data: company } = await admin.from('gc_companies').select('id, name, contact_name, email').eq('id', m.companyId).maybeSingle()
  if (!company) return refuse('notFound')
  const { data: packages } = await admin.from('gc_trade_packages').select('id').eq('project_id', sheet.project_id)
  const packageIds = ((packages ?? []) as Array<{ id: string }>).map((p) => p.id)
  const { count: asked } = packageIds.length ? await admin.from('gc_invites').select('id', { count: 'exact', head: true }).eq('company_id', m.companyId).in('package_id', packageIds) : { count: 0 }
  if (!asked) return refuse('notOnJob')
  const { data: people } = await admin.from('gc_company_people').select('name, email').eq('company_id', m.companyId).is('removed_at', null)
  const known = [{ name: String(company.contact_name ?? ''), email: String(company.email ?? '') }, ...((people ?? []) as Array<{ name: string | null; email: string | null }>).map((p) => ({ name: String(p.name ?? ''), email: String(p.email ?? '') }))]
  const contact = known.find((k) => k.email.trim().toLowerCase() === m.contactEmail)
  if (!contact) return refuse('noSuchContact')
  const contactName = contact.name.trim() || String(company.name ?? '')
  // The send that is on their page now, when there is one. A reminder goes to the address that row went to.
  const { data: liveRow } = await admin.from('document_builder_sends').select(SEND_COLUMNS).eq('builder_key', m.builderKey).eq('sheet_id', sheet.id).eq('company_id', m.companyId).is('taken_off_at', null).maybeSingle()
  const live = liveRow as SendRow | null
  if (!resendGoesToWhoItWentTo(m.why, live?.contact_email, m.contactEmail)) return refuse('notWhoItWentTo')

  // Their page: on is used, never made gets one, turned off stays off.
  const { data: links } = await admin.from('gc_trade_portal_links').select('token, revoked_at').eq('company_id', m.companyId)
  const pageLinks = (links ?? []) as Array<{ token: string | null; revoked_at: string | null }>
  let token = pageLinks.find((l) => !l.revoked_at)?.token ?? null
  if (!token && pageLinks.length > 0) return refuse('pageOff')

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return refuse('noEmail')
  const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
  const { data: project } = await admin.from('projects').select('name').eq('id', sheet.project_id).maybeSingle()
  const job = String((project as { name: string | null } | null)?.name ?? '').trim()
  const { data: gc } = await admin.from('gc_projects').select('project_manager_user_id, billing_job_id').eq('project_id', sheet.project_id).maybeSingle()
  const pmId = (gc as { project_manager_user_id: string | null } | null)?.project_manager_user_id ?? null
  const pm = pmId ? ((await admin.from('users').select('name, email').eq('id', pmId).maybeSingle()).data as { name: string | null; email: string | null } | null) : null
  const replyTo = (pm?.email || caller.email || '').trim() || undefined
  const signer = (pm?.name || caller.name || GC_TRADE_EMAIL_FROM_NAME).trim()
  const from = mailboxWithName(GC_TRADE_EMAIL_FROM_NAME, EMAIL_FROM)

  // A test copy: the same email to the caller's own address, with no page or link made, and nothing written.
  if (m.test) {
    if (!caller.email) return refuse('noSuchContact')
    const code = await sheetLinkCodeFor(admin, m.builderKey, sheet.id, caller.userId, { mintIfNone: false })
    const words = sheetSendEmail({ job, note: m.note, why: m.why, sheetUrl: code ? documentBuilderLinkUrl(origin, code) : null })
    const email = buildGcTradeEmail({ lang: 'en', recipients: [contactName], company: String(company.name ?? ''), subject: words.subject, lines: words.lines, linkUrl: tradeTestLinkUrl(origin), signer, gc: GC_TRADE_EMAIL_FROM_NAME })
    const sent = await sendEmailViaResend(caller.email, tradeEmailTestSubject(email.subject), email.text, email.html, resendApiKey, { from, ...(replyTo ? { replyTo } : {}), emailType: GC_TRADE_EMAIL_TEST_TYPE })
    if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')
    return json({ ok: true, test: true, email: caller.email, wouldGo: { name: contactName, email: contact.email } })
  }

  if (!token) {
    // The company never had a page: this send makes it, by mint_gc_trade_portal_link's rules.
    const raw = newTradeToken()
    const { error: mintError } = await admin.from('gc_trade_portal_links').insert({ company_id: m.companyId, token: raw, token_hash: await sha256Hex(raw), created_by: caller.userId })
    if (mintError) return refuse('failed', `The page was not made: ${mintError.message}`)
    token = raw
  }
  // The sheet's own link, for their insurance agent: made here when the sheet never had one, left off when a dev switched it off.
  const code = await sheetLinkCodeFor(admin, m.builderKey, sheet.id, caller.userId, { mintIfNone: true })
  const words = sheetSendEmail({ job, note: m.note, why: m.why, sheetUrl: code ? documentBuilderLinkUrl(origin, code) : null })
  const email = buildGcTradeEmail({ lang: 'en', recipients: [contactName], company: String(company.name ?? ''), subject: words.subject, lines: words.lines, linkUrl: tradePortalLinkUrl(origin, token), signer, gc: GC_TRADE_EMAIL_FROM_NAME })
  const sent = await sendEmailViaResend(contact.email.trim(), email.subject, email.text, email.html, resendApiKey, { from, ...(replyTo ? { replyTo } : {}), emailType: 'gc_trade_email' })
  if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')

  // It went. Now the record: the send's own row, sent again on the same row while it is on their page.
  const nowIso = new Date().toISOString()
  const write = live
    ? admin.from('document_builder_sends').update({ contact_name: contactName, contact_email: contact.email.trim(), note: m.note, sent_revision: sheet.revision, sent_at: nowIso, sent_by: caller.userId, sent_by_name: caller.name, times_sent: live.times_sent + 1 }).eq('id', live.id)
    : admin.from('document_builder_sends').insert({ builder_key: m.builderKey, sheet_id: sheet.id, company_id: m.companyId, contact_name: contactName, contact_email: contact.email.trim(), note: m.note, sent_revision: sheet.revision, sent_at: nowIso, sent_by: caller.userId, sent_by_name: caller.name })
  const { data: written, error: writeError } = await write.select(SEND_COLUMNS).single()
  if (writeError || !written) return refuse('failed', `Sent, but not recorded: ${writeError?.message ?? 'no row'}`)
  const row = written as SendRow

  // The company's thread keeps the message, as it keeps every email to them.
  const logId = sent.resendEmailId ? (((await admin.from('email_send_log').select('id').eq('resend_email_id', sent.resendEmailId).maybeSingle()).data as { id: string } | null)?.id ?? null) : null
  const { error: threadError } = await admin.from('gc_trade_messages').insert({
    company_id: m.companyId,
    project_id: sheet.project_id,
    kind: 'coi',
    mail_group: 'pay',
    msg_key: sheetSendMessageKey(row.id, row.times_sent),
    lang: 'en',
    subject: email.subject,
    lines: words.lines,
    to_names: [contactName],
    sent_on: officeYmd(nowIso),
    sent_by: caller.userId,
    email_send_log_id: logId,
  })
  if (threadError) console.error('document-builder-send thread row', threadError.message)

  // Sent copies (docs/SENT_COPIES.md): filed after the row, by its id. The email carries the company's own page link,
  // which is a key, so the copy is kept as a trade email's is: `/t/…`, never the token. The sheet's own link stays.
  await fileSentEmailBestEffort(
    { kind: SHEET_SEND_SENT_KIND, title: email.subject, recipientName: String(company.name ?? ''), jobIds: sentCopyJobIds((gc as { billing_job_id?: string | null } | null)?.billing_job_id), source: { table: 'document_builder_sends', id: row.id }, sentBy: caller.userId },
    { to: [contact.email.trim()], cc: [], from, subject: email.subject, html: sentCopyKeptHtml(SENT_COPY_KEPT_AS, email.html), resendEmailId: sent.resendEmailId ?? null },
  )
  console.log(JSON.stringify({ event: 'document_builder_send', send: row.id, sheet: sheet.id, company: m.companyId, revision: sheet.revision, why: m.why }))
  return json({ ok: true, send: sendOut(row), page: 'on' })
}

type BuilderSendRow = SendRow & { about_job_id: string | null }
const BUILDER_SEND_COLUMNS = `${SEND_COLUMNS}, about_job_id`

/**
 * A builder to a GC (step 9): a customer who is the GC on a job with us gets an email with one press to the page they
 * already open, and the builder is then on that page, under the job it is about. The same order as a sheet's send.
 */
async function sendBuilderToGc(req: Request, admin: Admin, supabaseUrl: string, body: Record<string, unknown>): Promise<Response> {
  const caller = await documentBuilderCaller(req, admin, supabaseUrl, corsHeaders, (why) => refuse(why))
  if (caller instanceof Response) return caller
  const m = parseBuilderSend(body)
  if (!m) return refuse('badRequest')

  // The builder, as published. A draft is never sent.
  const { data: builderRow } = await admin.from('document_builders').select('key, revision, read_revision, published').eq('key', m.builderKey).maybeSingle()
  const builder = builderRow as { key: string; revision: number; read_revision: number | null; published: unknown } | null
  if (!builder) return refuse('notFound')
  if (builder.revision < 1 || !builder.published) return refuse('notPublished')
  // A builder goes out as its newest published revision, so the mark is read on that one.
  if (builder.read_revision !== builder.revision && !m.anyway) return refuse('unread')

  // The customer is the GC on a job with us, and the person is on the customer's record.
  const { data: customerRow } = await admin.from('customers').select('id, name, contact_info').eq('id', m.customerId).maybeSingle()
  const customer = customerRow as { id: string; name: string | null; contact_info: unknown } | null
  if (!customer) return refuse('notFound')
  const { count: gcJobs } = await admin.from('jobs_ledger').select('id', { count: 'exact', head: true }).eq('gc_customer_id', m.customerId)
  if (!gcJobs) return refuse('notAGc')
  const { data: people } = await admin.from('customer_contact_persons').select('name, email').eq('customer_id', m.customerId)
  const ownEmail = typeof customer.contact_info === 'object' && customer.contact_info !== null ? (customer.contact_info as Record<string, unknown>).email : null
  const known = [{ name: String(customer.name ?? ''), email: typeof ownEmail === 'string' ? ownEmail : '' }, ...((people ?? []) as Array<{ name: string | null; email: string | null }>).map((p) => ({ name: String(p.name ?? ''), email: String(p.email ?? '') }))]
  const contact = known.find((k) => k.email.trim().toLowerCase() === m.contactEmail)
  if (!contact) return refuse('noSuchContact')
  const contactName = contact.name.trim() || String(customer.name ?? '')

  // The send that is on their page now, when there is one. A reminder goes to the address that row went to, and
  // stays about what the first send was about.
  const { data: liveRow } = await admin.from('document_builder_sends').select(BUILDER_SEND_COLUMNS).eq('builder_key', m.builderKey).is('sheet_id', null).eq('customer_id', m.customerId).is('taken_off_at', null).maybeSingle()
  const live = liveRow as BuilderSendRow | null
  if (!resendGoesToWhoItWentTo(m.why, live?.contact_email, m.contactEmail)) return refuse('notWhoItWentTo')
  const aboutJobId = live && m.why !== 'first' ? live.about_job_id : m.aboutJobId
  let aboutJob: string | null = null
  if (aboutJobId) {
    const { data: job } = await admin.from('jobs_ledger').select('id, job_name, hcp_number, click_number').eq('id', aboutJobId).eq('gc_customer_id', m.customerId).maybeSingle()
    // A first send names a job of theirs. A reminder about a job that has since left them still goes, and names no job.
    if (!job && !(live && m.why !== 'first')) return refuse('notTheirJob')
    aboutJob = job ? gcJobLabel(job as { job_name: string | null; hcp_number: string | null; click_number: string | null }) : null
  }

  // Their page: on is used, never made gets one, turned off stays off.
  const { data: links } = await admin.from('customer_portal_links').select('audience, token, revoked_at').eq('customer_id', m.customerId)
  const page = gcPageLink((links ?? []) as Array<{ audience: string; token: string | null; revoked_at: string | null }>)
  if (page.state === 'off') return refuse('pageOff')
  let token = page.state === 'on' ? page.token : null

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return refuse('noEmail')
  const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
  const us = PORTAL_COMPANY.name
  const replyTo = caller.email.trim() || undefined
  const signer = (caller.name || us).trim()
  const from = mailboxWithName(us, EMAIL_FROM)
  const words = builderSendEmail({ company: us, aboutJob, note: m.note, why: m.why })

  // A test copy: the same email to the caller's own address, with no page made, and nothing written.
  if (m.test) {
    if (!caller.email) return refuse('noSuchContact')
    const email = buildGcTradeEmail({ lang: 'en', recipients: [contactName], company: String(customer.name ?? ''), subject: words.subject, lines: words.lines, linkUrl: tradeTestLinkUrl(origin), signer, gc: us })
    const sent = await sendEmailViaResend(caller.email, tradeEmailTestSubject(email.subject), email.text, email.html, resendApiKey, { from, ...(replyTo ? { replyTo } : {}), emailType: GC_TRADE_EMAIL_TEST_TYPE })
    if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')
    return json({ ok: true, test: true, email: caller.email, wouldGo: { name: contactName, email: contact.email } })
  }

  if (!token) {
    // The customer never had a page: this send makes it, by mint_customer_portal_link's rules, as the whole account's.
    const raw = newTradeToken()
    const { error: mintError } = await admin.from('customer_portal_links').insert({ customer_id: m.customerId, audience: 'all', token: raw, token_hash: await sha256Hex(raw), created_by: caller.userId })
    if (mintError) return refuse('failed', `The page was not made: ${mintError.message}`)
    token = raw
  }
  const email = buildGcTradeEmail({ lang: 'en', recipients: [contactName], company: String(customer.name ?? ''), subject: words.subject, lines: words.lines, linkUrl: customerPageUrl(origin, token), signer, gc: us })
  const sent = await sendEmailViaResend(contact.email.trim(), email.subject, email.text, email.html, resendApiKey, { from, ...(replyTo ? { replyTo } : {}), emailType: BUILDER_SEND_EMAIL_TYPE })
  if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')

  // It went. Now the record: the send's own row, sent again on the same row while it is on their page.
  const nowIso = new Date().toISOString()
  const write = live
    ? admin.from('document_builder_sends').update({ contact_name: contactName, contact_email: contact.email.trim(), about_job_id: aboutJobId, note: m.note, sent_revision: builder.revision, sent_at: nowIso, sent_by: caller.userId, sent_by_name: caller.name, times_sent: live.times_sent + 1 }).eq('id', live.id)
    : admin.from('document_builder_sends').insert({ builder_key: m.builderKey, customer_id: m.customerId, about_job_id: aboutJobId, contact_name: contactName, contact_email: contact.email.trim(), note: m.note, sent_revision: builder.revision, sent_at: nowIso, sent_by: caller.userId, sent_by_name: caller.name })
  const { data: written, error: writeError } = await write.select(BUILDER_SEND_COLUMNS).single()
  if (writeError || !written) return refuse('failed', `Sent, but not recorded: ${writeError?.message ?? 'no row'}`)
  const row = written as BuilderSendRow

  // Sent copies (docs/SENT_COPIES.md): filed after the row, by its id. The email carries the customer's own page link,
  // which is a key, so the copy keeps it cut short, as a sheet's does.
  await fileSentEmailBestEffort(
    { kind: BUILDER_SEND_SENT_KIND, title: email.subject, recipientName: String(customer.name ?? ''), jobIds: sentCopyJobIds(aboutJobId), customerId: m.customerId, source: { table: 'document_builder_sends', id: row.id }, sentBy: caller.userId },
    { to: [contact.email.trim()], cc: [], from, subject: email.subject, html: sentCopyKeptHtml(SENT_COPY_KEPT_AS, email.html), resendEmailId: sent.resendEmailId ?? null },
  )
  console.log(JSON.stringify({ event: 'document_builder_send', send: row.id, builder: m.builderKey, customer: m.customerId, about: aboutJobId, revision: builder.revision, why: m.why }))
  return json({ ok: true, send: { ...sendOut(row), aboutJobId: row.about_job_id }, page: 'on' })
}

/** A GC's own page opened the builder: the day and the revision are kept on their live send. */
async function openedByCustomer(req: Request, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  const token = typeof body.portalToken === 'string' ? body.portalToken.trim() : ''
  const builderKey = typeof body.builderKey === 'string' ? body.builderKey.trim() : ''
  if (token.length < 16 || token.length > 128 || !/^[a-z][a-z0-9-]{0,39}$/.test(builderKey)) return refuse('badRequest')
  let { data: link } = await admin.from('customer_portal_links').select('customer_id, audience, revoked_at').eq('token', token).maybeSingle()
  if (!link) link = (await admin.from('customer_portal_links').select('customer_id, audience, revoked_at').eq('token_hash', await sha256Hex(token)).maybeSingle()).data
  const page = link as { customer_id: string; audience: string; revoked_at: string | null } | null
  // A link that is off, and a link that shows only their own jobs, opens nothing here.
  if (!page || page.revoked_at || (page.audience !== 'gc' && page.audience !== 'all')) return refuse('linkOff')
  const { data: liveRow } = await admin.from('document_builder_sends').select('id, opened_revision').eq('builder_key', builderKey).is('sheet_id', null).eq('customer_id', page.customer_id).is('taken_off_at', null).maybeSingle()
  const live = liveRow as { id: string; opened_revision: number | null } | null
  if (!live) return refuse('notFound')
  const { data: builderRow } = await admin.from('document_builders').select('revision').eq('key', builderKey).maybeSingle()
  const revision = (builderRow as { revision: number } | null)?.revision ?? 0
  if (revision < 1) return refuse('notFound')
  // Who looked: someone outside is counted. A signed-in teammate and the office's preview are not.
  const view = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
  if (view.count && live.opened_revision !== revision) {
    const { error } = await admin.from('document_builder_sends').update({ opened_at: new Date().toISOString(), opened_revision: revision }).eq('id', live.id)
    if (error) console.error('document-builder-send opened stamp', error.message)
  }
  console.log(JSON.stringify({ event: 'document_builder_send_opened', send: live.id, revision, viewer: view.viewer }))
  return json({ ok: true })
}

async function opened(req: Request, admin: Admin, body: Record<string, unknown>): Promise<Response> {
  if (typeof body.portalToken === 'string') return await openedByCustomer(req, admin, body)
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const sheetId = typeof body.sheetId === 'string' ? body.sheetId.toLowerCase() : ''
  if (token.length < 16 || token.length > 128 || !UUID_RE.test(sheetId)) return refuse('badRequest')
  const link = await resolveTradeLink(token, async (column, value) => {
    const { data } = await admin.from('gc_trade_portal_links').select('company_id, revoked_at').eq(column, value).maybeSingle()
    return data as TradeLinkRow | null
  })
  if (!link) return refuse('linkOff')
  const { data: liveRow } = await admin.from('document_builder_sends').select('id, opened_revision').eq('sheet_id', sheetId).eq('company_id', link.company_id).is('taken_off_at', null).maybeSingle()
  const live = liveRow as { id: string; opened_revision: number | null } | null
  if (!live) return refuse('notFound')
  const { data: sheetRow } = await admin.from('document_builder_sheets').select('revision').eq('id', sheetId).maybeSingle()
  const revision = (sheetRow as { revision: number } | null)?.revision ?? 0
  if (revision < 1) return refuse('notFound')
  // Who looked: someone outside is counted. A signed-in teammate and the office's preview are not.
  const view = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
  if (view.count && live.opened_revision !== revision) {
    const { error } = await admin.from('document_builder_sends').update({ opened_at: new Date().toISOString(), opened_revision: revision }).eq('id', live.id)
    if (error) console.error('document-builder-send opened stamp', error.message)
  }
  console.log(JSON.stringify({ event: 'document_builder_send_opened', send: live.id, revision, viewer: view.viewer }))
  return json({ ok: true })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'badRequest' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin: Admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const parsed: unknown = await req.json().catch(() => null)
    if (!parsed || typeof parsed !== 'object') return refuse('badRequest')
    const body = parsed as Record<string, unknown>
    if (body.action === 'send') return sendAskKind(body) === 'builder' ? await sendBuilderToGc(req, admin, supabaseUrl, body) : await send(req, admin, supabaseUrl, body)
    if (body.action === 'opened') return await opened(req, admin, body)
    return refuse('badRequest')
  } catch (e) {
    console.error('document-builder-send failed', e)
    return refuse('failed')
  }
})
