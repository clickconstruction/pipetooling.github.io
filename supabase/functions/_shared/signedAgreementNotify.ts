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
import {
  AUTO_CREATE_TWIN_WINDOW_DAYS,
  decideAutoCreateJob,
  type AutoCreateJobDecision,
  type AutoCreateJobGuardCandidateJob,
} from './autoCreateJobGuard.ts'

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

type JobRef = { id: string; hcpNumber: string }
type GuardEstimateRow = {
  id: string
  doc_kind: string | null
  job_ledger_id: string | null
  bid_id: string | null
  customer_id: string | null
  title: string | null
  total_cents: number | null
  estimate_number: number | null
}
type CandidateRow = {
  id: string
  bid_id: string | null
  customer_id: string | null
  gc_customer_id: string | null
  job_name: string | null
  revenue: number | null
  created_at: string | null
}

async function loadJobRef(admin: SupabaseClient, jobId: string): Promise<JobRef | null> {
  const { data: j } = await admin.from('jobs_ledger').select('id, hcp_number').eq('id', jobId).maybeSingle()
  return j ? { id: (j as { id: string }).id, hcpNumber: String((j as { hcp_number: string | null }).hcp_number ?? '') } : null
}

/**
 * The jobs the guard compares against: any job carrying this estimate's bid, plus the customer's
 * jobs from the last 90 days (the hand-typed-twin window). Bounded; never the whole ledger.
 */
async function loadCandidateJobs(admin: SupabaseClient, est: GuardEstimateRow): Promise<AutoCreateJobGuardCandidateJob[]> {
  const cols = 'id, bid_id, customer_id, gc_customer_id, job_name, revenue, created_at'
  const rows: CandidateRow[] = []
  if (est.bid_id) {
    const { data } = await admin.from('jobs_ledger').select(cols).eq('bid_id', est.bid_id).order('created_at', { ascending: false }).limit(50)
    rows.push(...((data ?? []) as CandidateRow[]))
  }
  if (est.customer_id) {
    const since = new Date(Date.now() - AUTO_CREATE_TWIN_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('jobs_ledger')
      .select(cols)
      .or(`customer_id.eq.${est.customer_id},gc_customer_id.eq.${est.customer_id}`)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200)
    rows.push(...((data ?? []) as CandidateRow[]))
  }
  const seen = new Set<string>()
  return rows
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({
      id: r.id,
      bidId: r.bid_id,
      customerId: r.customer_id,
      gcCustomerId: r.gc_customer_id,
      jobName: r.job_name,
      revenue: r.revenue,
      createdAt: r.created_at,
    }))
}

/**
 * Decide (pure kernel), then act: create through the RPC, link a same-bid job, or skip. One
 * structured log line per decision — `signed_agreement_auto_create_decision` — is the skip
 * telemetry (`skipped_reason` ∈ switch_off | already_linked | change_order |
 * duplicate_by_name_value); a real create also leaves a job_activity_events row (SQL side).
 */
async function decideAndCreateJob(admin: SupabaseClient, args: SignedAgreementNotifyArgs, autoCreateOn: boolean): Promise<JobRef | null> {
  const { data: estRaw } = await admin
    .from('estimates')
    .select('id, doc_kind, job_ledger_id, bid_id, customer_id, title, total_cents, estimate_number')
    .eq('id', args.estimateId)
    .maybeSingle()
  const est = estRaw as GuardEstimateRow | null
  if (!est) return null
  const candidateJobs = autoCreateOn && !est.job_ledger_id ? await loadCandidateJobs(admin, est) : []
  const decision: AutoCreateJobDecision = decideAutoCreateJob({
    estimate: {
      id: est.id,
      docKind: est.doc_kind,
      jobLedgerId: est.job_ledger_id,
      bidId: est.bid_id,
      customerId: est.customer_id,
      title: est.title,
      totalCents: est.total_cents,
    },
    candidateJobs,
    now: new Date(),
    switchOn: autoCreateOn,
  })
  console.log(
    JSON.stringify({
      event: 'signed_agreement_auto_create_decision',
      kind: args.kind,
      estimate_id: est.id,
      estimate_number: est.estimate_number,
      doc_kind: est.doc_kind,
      outcome: decision.create ? 'create' : 'skip',
      skipped_reason: decision.create ? null : decision.reason,
      matched_job_id: decision.matchedJobId,
      via: decision.via,
      candidates: candidateJobs.length,
    }),
  )

  if (decision.create) {
    const { data: jobId, error } = await admin.rpc('auto_create_job_from_signed_estimate', { p_estimate_id: args.estimateId })
    if (error) {
      console.error('signed-agreement auto-create', error)
      return null
    }
    return typeof jobId === 'string' && jobId ? await loadJobRef(admin, jobId) : null
  }
  if (decision.reason === 'already_linked' && decision.via === 'bid_link' && decision.matchedJobId) {
    // v2.2743 behaviour kept: a job someone already made for this bid is linked, never duplicated.
    // The RPC does the link (and the v2.2741 trigger stamps the bid); it returns the same job.
    const { data: jobId, error } = await admin.rpc('auto_create_job_from_signed_estimate', { p_estimate_id: args.estimateId })
    if (error) console.error('signed-agreement link same-bid job', error)
    return await loadJobRef(admin, typeof jobId === 'string' && jobId ? jobId : decision.matchedJobId)
  }
  if (decision.matchedJobId && decision.via === 'estimate_link') return await loadJobRef(admin, decision.matchedJobId)
  // change_order (unlinked) and duplicate_by_name_value: no job in the letter, so it offers
  // "Create the job" — which for a change order opens the Apply-to-job window. Never
  // apply_estimate_to_job automatically: the office picks the job and owns the revenue move.
  return null
}

/** Runs the auto-create guard (when its toggle is on) and sends the stream email. Never throws. */
export async function notifySignedAgreement(args: SignedAgreementNotifyArgs): Promise<SignedAgreementNotifyResult> {
  const { admin } = args
  let job: JobRef | null = null
  let autoCreateOn = false
  try {
    autoCreateOn = await readFlag(admin, SIGNED_AGREEMENTS_AUTO_CREATE_KEYS[args.kind])
    job = await decideAndCreateJob(admin, args, autoCreateOn)
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
