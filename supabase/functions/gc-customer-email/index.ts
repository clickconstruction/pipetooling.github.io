import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { customerBillingEmail, customerContactEmail } from '../_shared/billToParty.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { loadPortalReturnUrl, PORTAL_RETURN_SHORT_ORIGIN } from '../_shared/customerPortalReturnUrl.ts'
import { bytesSha256Hex } from '../_shared/gcPortal.ts'
import { GC_CARD_BILL_SETTING_KEY, gcCardBillOn, gcEmailCardFee } from '../_shared/gcCardBill.ts'
import {
  buildGcCustomerEmail,
  bytesBase64,
  CUSTOMER_EMAIL_ERRORS,
  GC_CUSTOMER_EMAIL_CONTRACT_PORTAL_WORDS,
  GC_CUSTOMER_EMAIL_MAX_CONTRACT_BYTES,
  gcContractAttachmentName,
  gcContractPortalUrl,
  GC_CUSTOMER_EMAIL_ADDRESS,
  GC_CUSTOMER_EMAIL_FILED_AS,
  GC_CUSTOMER_EMAIL_FRAMED,
  GC_CUSTOMER_EMAIL_FROM_NAME,
  GC_CUSTOMER_EMAIL_GATE,
  GC_CUSTOMER_EMAIL_PORTAL_LINE,
  GC_CUSTOMER_EMAIL_ROLES,
  GC_CUSTOMER_EMAIL_SOURCE,
  GC_CUSTOMER_EMAIL_TEST_TYPE,
  GC_CUSTOMER_EMAIL_TO,
  gcCustomerEmailCc,
  gcCustomerEmailTestSubject,
  gcWeeklyReportLines,
  parseCustomerEmail,
  type CustomerEmailErrorKey,
} from '../_shared/gcCustomerEmails.ts'

/**
 * gc-customer-email — GC mode, Owner Billing's O4b: our emails to a GC project's customer and its architect, from one
 * sender (plan `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → Edge functions, on spike/gc-mode). The window writes the
 * words; this frames them, sends and files the sent copy. O4b-1's kinds: `pay_app` (to the customer, the form
 * attached) and `certify_ask` (to the architect, the form attached). O4b-2's: `certified` (the bill the architect
 * certified, to the customer, with their portal link when they already have one) and `change_order` (to the customer,
 * to sign by reply). O5b's: `reminder` (to the customer, the words `gc_remind_customer_to_pay` filed, with their portal
 * link when they have one; its email's log is written back on the reminder). O6b-2's: `interest_bill` (to the
 * customer, with their portal link when they have one). Building's U7b: `weekly` (the Friday report, to the customer's
 * contact, the architect copied when its row says so, in the row's own words with no frame; its email's log is written
 * back on the row). The Board's B6-d-iii-b: `contract` (our contract to sign, to the customer's contact, the send's own
 * file attached here once its SHA-256 still matches, and their portal link required: one where their GC jobs show). The
 * schedule's PR 15a: `schedule` (the customer's schedule on its own, G-94, to their contact, in the `gc_schedule_sends`
 * row's own words with no frame; its email's log is written back on the row).
 *
 *   POST { projectId, kind, sourceId, subject, lines, pdf?, test? }   staff JWT
 *     → { to, email, resendEmailId, copied, test }
 *     → { error: key } with CUSTOMER_EMAIL_ERRORS' status
 *
 * In order: the caller (a real account, never a training account, a sample or a digital twin), the shape, the kind's
 * gate (the money team for a bill or a change; the weekly report's and the schedule's rows read with the caller's own
 * JWT, so RLS decides),
 * the project, the row the kind is about (this project's pay application, certified for `certified`; this project's
 * change order, sent and not yet answered; this project's reminder, not emailed yet; this project's interest bill;
 * this project's weekly report from the company, not emailed yet; or this project's schedule as kept, not emailed yet),
 * who gets the kind (`GC_CUSTOMER_EMAIL_ADDRESS`: the billing email first for a bill, the contact first for the weekly
 * report and the schedule), the email, the send, the log written back on a reminder, a weekly report or a schedule, then
 * its sent copy (docs/SENT_COPIES.md, `GC_CUSTOMER_EMAIL_FILED_AS`, on the
 * billing job). The service role reads here but for the weekly report's and the schedule's rows, so the read-only blocks and the twin fence
 * never see it. Nothing else is written: the sent copies are the record of what went.
 *
 * `test: true` (every kind): the same gate and the same email, to the caller's own address only, `[TEST]` before the
 * subject, no copy to anyone, logged as `gc_customer_email_test`, nothing filed and nothing written back.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, EMAIL_FROM, APP_ORIGIN (the portal
 * link's address; clicktooling.com when unset).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const refuse = (key: CustomerEmailErrorKey, detail?: string) => json({ error: key, ...(detail ? { detail } : {}) }, CUSTOMER_EMAIL_ERRORS[key])

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

    // The caller: a real staff account (never a sample or a digital twin), never a training account. Then the kind's
    // gate: the money team for a bill or a change; the weekly report's own row, read below with this caller's JWT.
    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return refuse('signIn')
    const { data: who } = await admin.from('users').select('role, name, email, read_only').match(REAL_ACCOUNT).eq('id', u.user.id).maybeSingle()
    if (!who || who.read_only) return refuse('readOnly')

    const parsed = parseCustomerEmail(await req.json().catch(() => null))
    if (!parsed.ok) return refuse('badRequest')
    const m = parsed.req
    if (GC_CUSTOMER_EMAIL_GATE[m.kind] === 'moneyTeam' && !GC_CUSTOMER_EMAIL_ROLES.includes(String(who.role))) return refuse('moneyTeamOnly')

    const { data: project } = await admin.from('projects').select('id, name, customer_id').eq('id', m.projectId).maybeSingle()
    const { data: gc } = await admin.from('gc_projects').select('architect_customer_id, project_manager_user_id, billing_job_id, owner_contract_signed_on').eq('project_id', m.projectId).maybeSingle()
    if (!project || !gc) return refuse('notFound')

    // The row the kind is about. A pay application is sent once it exists (gc_send_owner_pay_app files it as it goes);
    // `certified` wants a certificate with a bill behind it (nothing certified makes no bill). A change order must be out
    // for their signature, not a draft and not answered. A reminder goes once, in the words gc_remind_customer_to_pay
    // filed; every other kind goes in the window's.
    let words = { subject: m.subject, lines: m.lines }
    // The weekly report's row says whether the architect is copied.
    let copyArchitect = false
    // The bill a certified email or a reminder is about, for Pay by card's offer in the portal line (O8c).
    let billId: string | null = null
    // Our contract's file (B6-d-iii-b), as the send kept it: attached here, never sent by the window.
    let contractFile: { path: string; name: string; sha256: string } | null = null
    const source = GC_CUSTOMER_EMAIL_SOURCE[m.kind]
    if (source === 'gc_owner_pay_apps') {
      const { data: app } = await admin.from('gc_owner_pay_apps').select('id, project_id, certified, invoice_id').eq('id', m.sourceId).maybeSingle()
      if (!app) return refuse('notFound')
      billId = app.invoice_id ?? null
      if (app.project_id !== m.projectId) return refuse('otherProject')
      if (m.kind === 'certified' && !(Number(app.certified) > 0)) return refuse('notCertified')
    } else if (source === 'gc_change_orders') {
      const { data: co } = await admin.from('gc_change_orders').select('id, project_id, status').eq('id', m.sourceId).maybeSingle()
      if (!co) return refuse('notFound')
      if (co.project_id !== m.projectId) return refuse('otherProject')
      if (co.status !== 'sent') return refuse('notSent')
    } else if (source === 'gc_owner_interest_bills') {
      const { data: bill } = await admin.from('gc_owner_interest_bills').select('id, project_id').eq('id', m.sourceId).maybeSingle()
      if (!bill) return refuse('notFound')
      if (bill.project_id !== m.projectId) return refuse('otherProject')
    } else if (source === 'gc_weekly_reports') {
      // The Friday report (Building's U7b), read as the caller, so RLS decides who may send it. A report from me went from
      // their own mail; one the company sent already answers alreadySent, except as a test.
      const { data: rep } = await anon.from('gc_weekly_reports').select('id, project_id, sent_from, copied_architect, subject, body, email_send_log_id').eq('id', m.sourceId).maybeSingle()
      if (!rep) return refuse('notFound')
      if (rep.project_id !== m.projectId) return refuse('otherProject')
      if (rep.sent_from !== 'company') return refuse('badRequest')
      if (rep.email_send_log_id && !m.test) return refuse('alreadySent')
      words = { subject: String(rep.subject), lines: gcWeeklyReportLines(String(rep.body)) }
      copyArchitect = rep.copied_architect === true
    } else if (source === 'gc_schedule_sends') {
      // The customer's schedule (the schedule's PR 15a), read as the caller, so RLS decides who may send it, as the weekly
      // report's. The letter as the window kept it goes, never the request's lines; a row emailed already answers
      // alreadySent, except as a test.
      const { data: letter } = await anon.from('gc_schedule_sends').select('id, project_id, subject, lines, email_send_log_id').eq('id', m.sourceId).maybeSingle()
      if (!letter) return refuse('notFound')
      if (letter.project_id !== m.projectId) return refuse('otherProject')
      if (letter.email_send_log_id && !m.test) return refuse('alreadySent')
      const lines = ((letter.lines ?? []) as unknown[]).map(String).filter((l) => l.trim() !== '')
      if (lines.length === 0) return refuse('badRequest')
      words = { subject: String(letter.subject), lines }
    } else if (source === 'gc_owner_contract_sends') {
      // Our contract (the Board's B6-d-iii-b): the project's newest send, not signed, on paper or in their portal.
      const { data: send } = await admin.from('gc_owner_contract_sends').select('id, project_id, signed_on, created_at, file_path, file_name, file_sha256').eq('id', m.sourceId).maybeSingle()
      if (!send) return refuse('notFound')
      if (send.project_id !== m.projectId) return refuse('otherProject')
      if (send.signed_on || gc.owner_contract_signed_on) return refuse('alreadySigned')
      const { data: newer } = await admin.from('gc_owner_contract_sends').select('id').eq('project_id', m.projectId).gt('created_at', send.created_at).limit(1)
      if ((newer ?? []).length > 0) return refuse('notNewest')
      contractFile = { path: String(send.file_path), name: String(send.file_name), sha256: String(send.file_sha256) }
    } else {
      const { data: rem } = await admin.from('gc_owner_pay_reminders').select('id, pay_app_id, subject, lines, email_send_log_id').eq('id', m.sourceId).maybeSingle()
      if (!rem) return refuse('notFound')
      const { data: app } = await admin.from('gc_owner_pay_apps').select('project_id, invoice_id').eq('id', rem.pay_app_id).maybeSingle()
      if (!app || app.project_id !== m.projectId) return refuse('otherProject')
      billId = app.invoice_id ?? null
      if (rem.email_send_log_id) return refuse('alreadySent')
      words = { subject: String(rem.subject), lines: (rem.lines ?? []).map(String) }
    }

    // Who gets it: the project's customer, or its architect; a bill at the address the Pipeline bills, the weekly report
    // at the contact's.
    const to = GC_CUSTOMER_EMAIL_TO[m.kind]
    const recipientId = to === 'customer' ? project.customer_id : gc.architect_customer_id
    const { data: recipient } = recipientId
      ? await admin.from('customers').select('id, name, billing_email, contact_info').eq('id', recipientId).maybeSingle()
      : { data: null }
    const address = recipient ? (GC_CUSTOMER_EMAIL_ADDRESS[m.kind] === 'contact' ? customerContactEmail(recipient) : customerBillingEmail(recipient)) : ''
    if (!recipient || !address) return refuse('noEmail')
    // The architect copied on a weekly report that says so, at their contact's address. None: no copy, and it still goes.
    const architect = copyArchitect && !m.test && gc.architect_customer_id
      ? (await admin.from('customers').select('id, billing_email, contact_info').eq('id', gc.architect_customer_id).maybeSingle()).data
      : null
    const cc = gcCustomerEmailCc({ copyArchitect, test: m.test === true, architectAddress: architect ? customerContactEmail(architect) : '', address })
    // A test copy goes to the caller's own address and nowhere else.
    const testAddress = m.test ? String(who.email ?? '').trim() : ''
    if (m.test && !testAddress) return refuse('noEmail')

    const pm = gc.project_manager_user_id ? (await admin.from('users').select('name, email').eq('id', gc.project_manager_user_id).maybeSingle()).data : null
    const replyTo = (pm?.email || who.email || '').trim() || undefined
    const signer = (pm?.name || who.name || GC_CUSTOMER_EMAIL_FROM_NAME).trim()
    // The customer's portal, for the kinds that link it, only when a link is already on: never minted here. Our contract
    // needs one where their GC jobs show (the window makes it at the first send, D6); with none it does not go.
    const appOrigin = Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com'
    let portalUrl: string | null = null
    if (m.kind === 'contract') {
      const [{ data: links }, { data: slugRow }] = await Promise.all([
        admin.from('customer_portal_links').select('audience, token, revoked_at').eq('customer_id', recipient.id).is('revoked_at', null),
        admin.from('customer_portal_slugs').select('slug').eq('customer_id', recipient.id).maybeSingle(),
      ])
      portalUrl = gcContractPortalUrl((links ?? []) as { audience: string; token: string | null }[], (slugRow as { slug?: string } | null)?.slug ?? null, appOrigin, PORTAL_RETURN_SHORT_ORIGIN)
      if (!portalUrl) return refuse('noPortal')
    } else if (GC_CUSTOMER_EMAIL_PORTAL_LINE[m.kind]) {
      portalUrl = await loadPortalReturnUrl(admin, recipient.id, appOrigin, { paid: false })
    }
    // Our contract's file, read as the service role: its bytes must still be the ones the send hashed, so the email
    // carries exactly what the signature binds to (a test copy too).
    let contractAttachment: { filename: string; content: string } | null = null
    if (contractFile) {
      const { data: blob, error: fileErr } = await admin.storage.from('gc-owner-contracts').download(contractFile.path)
      if (fileErr || !blob) return refuse('failed', `The contract file was not read: ${fileErr?.message ?? 'no file'}`)
      if (blob.size > GC_CUSTOMER_EMAIL_MAX_CONTRACT_BYTES) return refuse('tooLarge')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      if ((await bytesSha256Hex(bytes.buffer)) !== contractFile.sha256) return refuse('fileChanged')
      contractAttachment = { filename: gcContractAttachmentName(contractFile.name), content: bytesBase64(bytes) }
    }
    // Pay by card (O8c): with the switch on (app_settings, `GC_CARD_BILL_SETTING_KEY`) and a bill that can still turn,
    // the portal line offers the card with its 3% fee. A bill on card already says where to pay in the window's words.
    let cardFee: number | null = null
    if (portalUrl && billId && (m.kind === 'certified' || m.kind === 'reminder')) {
      const [{ data: setting }, { data: bill }, { count: paidCount }, { data: card }] = await Promise.all([
        admin.from('app_settings').select('value_text').eq('key', GC_CARD_BILL_SETTING_KEY).maybeSingle(),
        admin.from('jobs_ledger_invoices').select('amount, status, stripe_invoice_id').eq('id', billId).maybeSingle(),
        admin.from('jobs_ledger_payments').select('id', { count: 'exact', head: true }).eq('invoice_id', billId),
        admin.from('gc_owner_card_bills').select('status').eq('invoice_id', billId).maybeSingle(),
      ])
      cardFee = gcEmailCardFee({ on: gcCardBillOn(setting?.value_text), bill: bill ?? null, paid: (paidCount ?? 0) > 0, cardStatus: card?.status ?? null })
    }
    // Our contract's portal line says they sign it there; every other kind's says they can see the bill.
    const portalWords = m.kind === 'contract' ? { portalWords: GC_CUSTOMER_EMAIL_CONTRACT_PORTAL_WORDS } : {}
    const email = buildGcCustomerEmail({ ...portalWords, subject: words.subject, lines: words.lines, signer, gc: GC_CUSTOMER_EMAIL_FROM_NAME, framed: GC_CUSTOMER_EMAIL_FRAMED[m.kind], portalUrl, cardFee })
    const subject = m.test ? gcCustomerEmailTestSubject(email.subject) : email.subject

    const from = mailboxWithName(GC_CUSTOMER_EMAIL_FROM_NAME, EMAIL_FROM)
    const attachments = contractAttachment ? [contractAttachment] : m.pdf ? [{ filename: m.pdf.filename, content: m.pdf.base64 }] : undefined
    const sent = await sendEmailViaResend(m.test ? testAddress : address, subject, email.text, email.html, resendApiKey, {
      from,
      ...(replyTo ? { replyTo } : {}),
      ...(cc.length > 0 ? { cc } : {}),
      ...(attachments ? { attachments } : {}),
      emailType: m.test ? GC_CUSTOMER_EMAIL_TEST_TYPE : 'gc_customer_email',
    })
    if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')
    // A test copy: nothing filed, nothing written back.
    if (m.test) return json({ to: String(who.name ?? ''), email: testAddress, resendEmailId: sent.resendEmailId ?? null, copied: false, test: true })

    // A reminder, a weekly report and the customer's schedule keep the email they went in (O1's column grant; U7b's and
    // 15a's by the service role, since a signed-in caller has no UPDATE on gc_weekly_reports or gc_schedule_sends): the
    // send's log row, found by its Resend id. Written before the copy is filed, so a retry after a failed write-back is as
    // unlikely as it can be.
    if ((source === 'gc_owner_pay_reminders' || source === 'gc_weekly_reports' || source === 'gc_schedule_sends') && sent.resendEmailId) {
      const { data: log } = await admin.from('email_send_log').select('id').eq('resend_email_id', sent.resendEmailId).maybeSingle()
      if (log?.id) await admin.from(source).update({ email_send_log_id: log.id }).eq('id', m.sourceId)
    }

    // Sent copies (docs/SENT_COPIES.md): the message and any form as they went, found by the row it is about and on the
    // billing job's Documents tab.
    await fileSentEmailBestEffort(
      {
        kind: GC_CUSTOMER_EMAIL_FILED_AS[m.kind],
        title: email.subject,
        recipientName: String(recipient.name ?? ''),
        customerId: recipient.id,
        jobIds: gc.billing_job_id ? [gc.billing_job_id] : [],
        source: { table: source, id: m.sourceId },
        sentBy: u.user.id,
      },
      { to: [address], ...(cc.length > 0 ? { cc } : {}), from, subject: email.subject, html: email.html, attachments, resendEmailId: sent.resendEmailId ?? null },
    )
    return json({ to: String(recipient.name ?? ''), email: address, resendEmailId: sent.resendEmailId ?? null, copied: cc.length > 0, test: false })
  } catch (e) {
    return refuse('failed', e instanceof Error ? e.message : String(e))
  }
})
