/**
 * Telling the office about a check that came back — one notice per case (v2.4320,
 * punch list #76 PR 2). Moved out of mercury-webhook (v2.3804), which only told the
 * office while a recorded payment still carried the check; now `mercury-webhook`
 * calls this the moment it stores a bank return, and the hourly `ar-returned-checks`
 * sweep calls it for every open case nobody has been told about — a return the
 * Banking page's Sync stored, a rejected check that a recorded payment matches.
 *
 * Insert-first on `mercury_bank_return_notices` (keyed on the deposit): the row IS the
 * decision to send, so a retry or a second caller never sends twice. The caller hands in
 * the email sender (`sendEmailViaResend`), so every function that emails names it in its
 * own source — the What customers see registry finds senders that way. Recipients: the
 * Payment made stream (Settings → Email streams), else the office roles. The words come
 * from `bankReturnedDeposits.ts` (`noticeInputFromCase`, `buildBankReturnNoticeEmail`,
 * `buildBankReturnNoticePush`). Deno only.
 *
 * A person's hours (punch list #141 PR 5, v2.6217): the push goes through `pushHoursSend.ts`,
 * which pushes the people on and holds one outside their Push me hours, writing the row as
 * `held` and sending nothing; the email goes now as before. Three functions bundle this file:
 * `mercury-webhook`, `stripe-webhook`, `ar-returned-checks`.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { arCaseNoticeClaim, arCaseNoticeDue, buildBankReturnNoticeEmail, buildBankReturnNoticePush, noticeInputFromCase, type ArReturnCaseRow } from './bankReturnedDeposits.ts'
import { sendPushHonouringHours } from './pushHoursSend.ts'
import type { sendEmailViaResend } from './resendSendEmail.ts'
import { REAL_ACCOUNT } from './realAccount.ts'
import { webPushSender } from './webPushSend.ts'

/** The caller's `sendEmailViaResend`. */
export type SendEmail = typeof sendEmailViaResend

// The service-role client, untyped by schema (the functions carry no generated types).
// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>

/** The people told when a payment lands (Settings → Email streams → Payment made); a returned check is that news reversed. */
const PAYMENT_RECIPIENTS_SETTING_KEY = 'payment_made_email_recipients_v1'
/** When that list is empty, the office itself — the roles that read Accounts Receivable. */
const OFFICE_ROLES = ['dev', 'master_technician', 'assistant', 'controller']
const BANK_RETURN_EMAIL_TYPE = 'bank_return'

type NoticeRecipient = { id: string; email: string | null; name: string | null; role: string | null }

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === '23505'
}

export async function loadBankReturnRecipients(admin: Admin): Promise<NoticeRecipient[]> {
  const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', PAYMENT_RECIPIENTS_SETTING_KEY).maybeSingle()
  let ids: string[] = []
  try {
    const parsed = JSON.parse((setting as { value_text?: string | null } | null)?.value_text ?? '[]')
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    ids = []
  }
  let q = admin.from('users').select('id, email, name, role').match(REAL_ACCOUNT).is('archived_at', null)
  q = ids.length > 0 ? q.in('id', ids) : q.in('role', OFFICE_ROLES)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as NoticeRecipient[]
}

/** The open cases, as the office sees them. Service role: the RPC lets it through. */
export async function loadOpenReturnCases(admin: Admin): Promise<ArReturnCaseRow[]> {
  const { data, error } = await admin.rpc('list_ar_return_cases', { p_include_closed: false })
  if (error) throw error
  return (data ?? []) as ArReturnCaseRow[]
}

export type CaseNoticeResult = { sent: boolean; reason?: 'already_told' | 'dry_run'; recipients?: number; emails?: number; pushes?: number; held?: number }

/**
 * Tell the office about one case, once. `dryRun` builds the words and touches nothing.
 * Best-effort per channel: a failed email does not stop the push.
 */
export async function sendReturnCaseNotice(
  admin: Admin,
  row: ArReturnCaseRow,
  opts: { appOrigin: string; sendEmail: SendEmail; dryRun?: boolean; log?: (event: Record<string, unknown>) => void },
): Promise<CaseNoticeResult> {
  if (!arCaseNoticeDue(row)) return { sent: false, reason: 'already_told' }
  const input = noticeInputFromCase(row, opts.appOrigin)
  const mail = buildBankReturnNoticeEmail(input)
  const push = buildBankReturnNoticePush(input, row.mercury_transaction_id)
  if (opts.dryRun) {
    opts.log?.({ event: 'bank_return_notice_dry_run', tx: row.mercury_transaction_id, subject: mail.subject, situation: input.situation })
    return { sent: false, reason: 'dry_run' }
  }

  // Claim first: the claim IS the decision to send. A check typed in by hand that never reached the
  // bank (v2.4902) and a Stripe case (v2.4950) have no deposit to key the ledger on, so the case row
  // carries the claim: the update takes only while its column is empty (a lost dispute's second
  // notice fills lost_notified_at). Every other case inserts into the deposit ledger, where
  // 23505 = the office already heard about this deposit.
  const claim = arCaseNoticeClaim(row)
  const caseRowClaim = claim.table !== 'mercury_bank_return_notices'
  if (claim.table !== 'mercury_bank_return_notices') {
    const now = new Date().toISOString()
    const { data: claimed, error: claimErr } = await admin
      .from(claim.table)
      .update(claim.column === 'lost_notified_at' && !row.notified_at ? { lost_notified_at: now, notified_at: now } : { [claim.column]: now })
      .eq('id', row.mercury_transaction_id)
      .is(claim.column, null)
      .select('id')
    if (claimErr) throw claimErr
    if (!claimed || claimed.length === 0) return { sent: false, reason: 'already_told' }
  } else {
    const { error: ledgerErr } = await admin
      .from('mercury_bank_return_notices')
      .insert({ mercury_transaction_id: row.mercury_transaction_id, payment_ids: (row.live_payments ?? []).map((p) => p.payment_id) })
    if (ledgerErr && isUniqueViolation(ledgerErr)) return { sent: false, reason: 'already_told' }
    if (ledgerErr) throw ledgerErr
  }

  const recipients = await loadBankReturnRecipients(admin)

  let emailsSent = 0
  const emailed = new Set<string>()
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (resendApiKey) {
    for (const r of recipients) {
      const to = (r.email ?? '').trim()
      if (!to) continue
      const res = await opts.sendEmail(to, mail.subject, mail.text, mail.html, resendApiKey, { emailType: BANK_RETURN_EMAIL_TYPE })
      if (res.success) {
        emailsSent += 1
        emailed.add(r.id)
      } else console.error('bank-return email', r.id, res.error)
    }
  } else console.error('bank-return: RESEND_API_KEY missing — no email sent')

  // Through each person's hours (#141 PR 5): the people on are pushed, one off is held with a row and no push. The
  // record of the email and the push is written here, so the helper keeps none.
  let pushesSent = 0
  let heldCount = 0
  const pushed = new Set<string>()
  if (recipients.length > 0) {
    const result = await sendPushHonouringHours(
      admin,
      { userIds: recipients.map((r) => r.id), title: push.title, body: push.body, url: push.url, tag: push.tag, templateType: BANK_RETURN_EMAIL_TYPE },
      webPushSender(admin, 'bank-return'),
      { record: 'none' },
    )
    pushesSent = result.devices
    heldCount = result.held.length
    for (const id of result.sent) pushed.add(id)
  }

  const history = recipients
    .filter((r) => emailed.has(r.id) || pushed.has(r.id))
    .map((r) => ({
      recipient_user_id: r.id,
      template_type: BANK_RETURN_EMAIL_TYPE,
      title: push.title,
      body_preview: push.body.slice(0, 200),
      channel: emailed.has(r.id) && pushed.has(r.id) ? 'both' : emailed.has(r.id) ? 'email' : 'push',
    }))
  if (history.length > 0) await admin.from('notification_history').insert(history)

  if (!caseRowClaim) {
    await admin
      .from('mercury_bank_return_notices')
      .update({ recipient_count: recipients.length, emails_sent: emailsSent, pushes_sent: pushesSent })
      .eq('mercury_transaction_id', row.mercury_transaction_id)
  }
  opts.log?.({
    event: 'bank_return_notified',
    tx: row.mercury_transaction_id,
    situation: input.situation,
    recipients: recipients.length,
    emails: emailsSent,
    pushes: pushesSent,
    held: heldCount,
  })
  return { sent: true, recipients: recipients.length, emails: emailsSent, pushes: pushesSent, held: heldCount }
}
