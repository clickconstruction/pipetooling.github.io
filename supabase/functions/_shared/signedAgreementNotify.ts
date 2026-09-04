/**
 * Signed agreements stream — the IO half (v2.2743): resolve recipients, optionally auto-create
 * the job, build the letter, send. Used by accept-estimate and sign-bid-room. Best-effort: a
 * failure here is logged, never surfaced to the customer who just signed.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from './resendSendEmail.ts'
import { logEmailSendBestEffort } from './logEmailSend.ts'
import { EMAIL_FROM } from './emailFrom.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'
import { buildSignedAgreementEmail, type SignedAgreementEmailInput } from './signedAgreementEmail.ts'

export const SIGNED_AGREEMENTS_AUTO_CREATE_KEYS = {
  estimate: 'signed_agreements_auto_create_job_estimates',
  bid: 'signed_agreements_auto_create_job_bids',
} as const

export type SignedAgreementNotifyArgs = {
  admin: SupabaseClient
  kind: 'estimate' | 'bid'
  estimateId: string
  masterUserId: string
  /** Per-record picks (estimates.accept_notify_user_ids) — unioned with the stream list. */
  extraRecipientIds?: string[] | null
  origin: string
  email: Omit<SignedAgreementEmailInput, 'origin' | 'job' | 'autoCreateOn' | 'signedAtLabel' | 'kind'>
}

export type SignedAgreementNotifyResult = { job: { id: string; hcpNumber: string } | null; autoCreateOn: boolean; recipients: number }

async function readFlag(admin: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await admin.from('app_settings').select('value_text').eq('key', key).maybeSingle()
  const v = String((data as { value_text?: string | null } | null)?.value_text ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

/** Runs the auto-create (when its toggle is on) and sends the stream email. Never throws. */
export async function notifySignedAgreement(args: SignedAgreementNotifyArgs): Promise<SignedAgreementNotifyResult> {
  const { admin } = args
  let job: { id: string; hcpNumber: string } | null = null
  let autoCreateOn = false
  try {
    autoCreateOn = await readFlag(admin, SIGNED_AGREEMENTS_AUTO_CREATE_KEYS[args.kind])
    if (autoCreateOn) {
      const { data: jobId, error } = await admin.rpc('auto_create_job_from_signed_estimate', { p_estimate_id: args.estimateId })
      if (error) console.error('signed-agreement auto-create', error)
      else if (typeof jobId === 'string' && jobId) {
        const { data: j } = await admin.from('jobs_ledger').select('id, hcp_number').eq('id', jobId).maybeSingle()
        if (j) job = { id: (j as { id: string }).id, hcpNumber: String((j as { hcp_number: string | null }).hcp_number ?? '') }
      }
    }
    if (!job) {
      // Already linked by hand (or by a previous run)? Show it rather than offering to create another.
      const { data: est } = await admin.from('estimates').select('job_ledger_id, jobs_ledger:job_ledger_id(id, hcp_number)').eq('id', args.estimateId).maybeSingle()
      const linked = (est as { jobs_ledger?: { id: string; hcp_number: string | null } | null } | null)?.jobs_ledger ?? null
      if (linked) job = { id: linked.id, hcpNumber: String(linked.hcp_number ?? '') }
    }
  } catch (e) {
    console.error('signed-agreement auto-create (non-fatal)', e)
  }

  let recipients = 0
  try {
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return { job, autoCreateOn, recipients }
    const { data: streamIds, error: rErr } = await admin.rpc('signed_agreement_notify_recipients', { p_master_user_id: args.masterUserId })
    if (rErr) console.error('signed_agreement_notify_recipients', rErr)
    const extras = (args.extraRecipientIds ?? []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    let extraOk: string[] = []
    if (extras.length > 0) {
      const { data: ok } = await admin.rpc('estimate_accept_notify_filter_eligible_user_ids', { p_master_user_id: args.masterUserId, p_candidate_ids: extras })
      extraOk = Array.isArray(ok) ? (ok as string[]) : []
    }
    const ids = [...new Set([...(Array.isArray(streamIds) ? (streamIds as string[]) : []), ...extraOk])]
    if (ids.length === 0) return { job, autoCreateOn, recipients }
    const { data: users } = await admin.from('users').select('id, email').in('id', ids)
    const signedAtLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      .format(new Date())
      .replace(', ', ' · ')
    const mail = buildSignedAgreementEmail({ ...args.email, kind: args.kind, origin: args.origin, job, autoCreateOn, signedAtLabel })
    for (const u of (users ?? []) as Array<{ email: string | null }>) {
      const em = (u.email ?? '').trim()
      if (!em) continue
      const sent = await sendEmailViaResend(em, mail.subject, mail.text, mail.html, key)
      if (sent.success) {
        recipients += 1
        await logEmailSendBestEffort({ resendEmailId: sent.resendEmailId ?? null, to: [em], from: EMAIL_FROM, subject: mail.subject, emailType: 'signed_agreement_staff' })
      } else console.error('signed-agreement email', { to: em, error: sent.error })
    }
  } catch (e) {
    console.error('signed-agreement notify (non-fatal)', e)
  }
  return { job, autoCreateOn, recipients }
}
