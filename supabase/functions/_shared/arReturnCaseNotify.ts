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
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { buildBankReturnNoticeEmail, buildBankReturnNoticePush, noticeInputFromCase, type ArReturnCaseRow } from './bankReturnedDeposits.ts'
import type { sendEmailViaResend } from './resendSendEmail.ts'
import { REAL_ACCOUNT } from './realAccount.ts'

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
type PushSubRow = { id: string; user_id: string; endpoint: string; p256dh_key: string; auth_key: string }

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

export type CaseNoticeResult = { sent: boolean; reason?: 'already_told' | 'dry_run'; recipients?: number; emails?: number; pushes?: number }

/**
 * Tell the office about one case, once. `dryRun` builds the words and touches nothing.
 * Best-effort per channel: a failed email does not stop the push.
 */
export async function sendReturnCaseNotice(
  admin: Admin,
  row: ArReturnCaseRow,
  opts: { appOrigin: string; sendEmail: SendEmail; dryRun?: boolean; log?: (event: Record<string, unknown>) => void },
): Promise<CaseNoticeResult> {
  if (row.notified_at) return { sent: false, reason: 'already_told' }
  const input = noticeInputFromCase(row, opts.appOrigin)
  const mail = buildBankReturnNoticeEmail(input)
  const push = buildBankReturnNoticePush(input, row.mercury_transaction_id)
  if (opts.dryRun) {
    opts.log?.({ event: 'bank_return_notice_dry_run', tx: row.mercury_transaction_id, subject: mail.subject, situation: input.situation })
    return { sent: false, reason: 'dry_run' }
  }

  // Insert first: the row IS the decision to send. 23505 = the office already heard about this deposit.
  const { error: ledgerErr } = await admin
    .from('mercury_bank_return_notices')
    .insert({ mercury_transaction_id: row.mercury_transaction_id, payment_ids: (row.live_payments ?? []).map((p) => p.payment_id) })
  if (ledgerErr && isUniqueViolation(ledgerErr)) return { sent: false, reason: 'already_told' }
  if (ledgerErr) throw ledgerErr

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

  let pushesSent = 0
  const pushed = new Set<string>()
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (vapidPublicKey && vapidPrivateKey && recipients.length > 0) {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh_key, auth_key')
      .in('user_id', recipients.map((r) => r.id))
    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)
    for (const sub of (subs ?? []) as PushSubRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          JSON.stringify(push),
          { TTL: 86400 },
        )
        pushesSent += 1
        pushed.add(sub.user_id)
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
        else console.error('bank-return push', sub.user_id, e instanceof Error ? e.message : String(e))
      }
    }
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

  await admin
    .from('mercury_bank_return_notices')
    .update({ recipient_count: recipients.length, emails_sent: emailsSent, pushes_sent: pushesSent })
    .eq('mercury_transaction_id', row.mercury_transaction_id)
  opts.log?.({
    event: 'bank_return_notified',
    tx: row.mercury_transaction_id,
    situation: input.situation,
    recipients: recipients.length,
    emails: emailsSent,
    pushes: pushesSent,
  })
  return { sent: true, recipients: recipients.length, emails: emailsSent, pushes: pushesSent }
}
