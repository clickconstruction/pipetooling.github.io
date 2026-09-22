/**
 * Put a GC on notice (v2.3470, PR 1 of `to-dos/gc-on-notice/`).
 *
 * The § 53.056 notice the Lien desk sends is Texas's notice of intent to
 * lien; its teeth are fund trapping (§ 53.081). This kernel folds the
 * GC-scoped RPC (`list_gc_unpaid_months` — every job with unpaid work under
 * one GC, every month with approved hours, no lead window) into one row per
 * job: the months the notice names, which of them have a closed window (named
 * as information, never hidden), the claim amount and whether it is a bill or
 * a contract balance, the owner state, the affidavit date, and whether the row
 * is ready for the run. Pure; the hook resolves owners and the modal writes.
 */
import type { LienDeskBatch, LienDeskItemRow, LienDeskQueue, LienNoticeMonthRow } from './lienDesk'
import { cleanStoredAddress } from '../displayAddress'
import { correctedClaim, type LienClaimCorrection } from './lienClaimCorrection'
import { filingDeadlineForMonth } from './lienDeadlines'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

export type GcUnpaidMonthRow = LienNoticeMonthRow & {
  is_billed: boolean
  job_status: string
  last_work_month: string
}

/** How the owner of record stands on the job's property, as the desk reads it. */
export type GcNoticeOwnerState =
  /** An owner with a mailing address is on file (record or job override), confirmed or hand-typed. */
  | 'on_file'
  /** The nightly run saved it from the roll and nobody confirmed it — the run refuses to record until Confirm. */
  | 'unconfirmed'
  | 'missing'
  /** A city, county, ISD, the State…: a lien does not attach; the remedy is a bond claim. Left out of the run. */
  | 'public'

export type GcNoticeMonth = {
  key: string
  hours: number
  /** 'YYYY-MM-DD' — the § 53.056 date; '' when the month could not be dated. */
  deadline: string
  /** The window has passed: the month's lien right is gone; the owner still learns the balance. */
  closed: boolean
}

export type GcNoticeReadiness = 'ready' | 'needs_owner' | 'unconfirmed_owner' | 'public_owner' | 'no_months' | 'already_sent'

export type GcNoticeJob = {
  jobId: string
  customerId: string | null
  gcCustomerId: string | null
  isBilled: boolean
  jobStatus: string
  /** What the notice claims: the open balance on bills, or the unpaid contract balance when nothing is billed — less the claim set by hand (v2.3684). */
  claimAmount: number
  /** The app's figure before any correction. */
  openBalance: number
  /** The claim set by hand on the desk (v2.3682), when there is one. */
  claimCorrected: boolean
  /** claimAmount − openBalance: negative under the balance, positive over it. */
  claimDelta: number
  /** Over the app's balance — the leader alone may send this one. */
  claimOver: boolean
  /** Every month with approved hours and no live notice, oldest first. */
  months: GcNoticeMonth[]
  /** Months a recorded notice already names. */
  noticedMonths: string[]
  ownerState: GcNoticeOwnerState
  propertyKind: string
  /** 'YYYY-MM-DD' — the § 53.052 affidavit date from the last month worked; '' when unknown. */
  affidavitBy: string
  item: LienDeskItemRow | null
  readiness: GcNoticeReadiness
}

export type GcNoticeSummary = {
  jobs: number
  billedJobs: number
  unbilledJobs: number
  /** Claim amounts on billed jobs. */
  openOnBills: number
  /** Claim amounts on unbilled jobs (contract balances). */
  notYetBilled: number
  unpaidMonths: number
  ownersOnFile: number
  ownersMissing: number
  ownersUnconfirmed: number
  publicOwners: number
  /** Rows the run can take right now. */
  ready: number
  /** Rows waiting on an owner (missing or unconfirmed). */
  waitingOwner: number
  /** Rows left out for good: public owners, or nothing left to name. */
  excluded: number
  /** Sum of claims on the ready rows. */
  claimTotal: number
  /** Two per ready notice: the owner of record and the original contractor. */
  envelopes: number
  /** The earliest open § 53.056 date across the ready rows, or null. */
  earliestOpenDeadline: string | null
}

export type GcNoticeReasonKey = 'not_paying_subs' | 'insolvency' | 'promise_broken_twice' | 'other'

export const GC_NOTICE_REASONS: ReadonlyArray<{ key: GcNoticeReasonKey; label: string }> = [
  { key: 'not_paying_subs', label: 'GC is not paying its subs' },
  { key: 'insolvency', label: 'GC insolvency suspected' },
  { key: 'promise_broken_twice', label: 'Payment promise broken twice' },
  { key: 'other', label: 'Other…' },
]

export function gcNoticeReasonLabel(key: GcNoticeReasonKey): string {
  return GC_NOTICE_REASONS.find((r) => r.key === key)?.label ?? key
}

/** The reason as the record keeps it: the label, then the office's note when there is one. */
export function gcNoticeBatchReason(key: GcNoticeReasonKey, note: string): string {
  const n = note.trim()
  const label = gcNoticeReasonLabel(key).replace(/…$/, '')
  return n ? `${label} — ${n}` : label
}

function readinessOf(months: GcNoticeMonth[], owner: GcNoticeOwnerState, item: LienDeskItemRow | null): GcNoticeReadiness {
  if (owner === 'public') return 'public_owner'
  if (months.length === 0) return 'no_months'
  if (item && item.status === 'approved') return 'already_sent'
  if (owner === 'missing') return 'needs_owner'
  if (owner === 'unconfirmed') return 'unconfirmed_owner'
  return 'ready'
}

/**
 * Fold the GC-scoped rows into one entry per job. `ownerStateOf` is the
 * hook's read of the property record; `items` are the live desk items
 * (any status but sent/missed) for those jobs.
 */
export function buildGcOnNotice(
  rows: ReadonlyArray<GcUnpaidMonthRow>,
  items: ReadonlyArray<LienDeskItemRow>,
  ownerStateOf: (jobId: string) => GcNoticeOwnerState,
  todayYmd: string,
  /** The claim set by hand per job (v2.3684) — the run claims the corrected figure, as the desk does. */
  correctionFor: (jobId: string) => LienClaimCorrection | null = () => null,
): { jobs: GcNoticeJob[]; summary: GcNoticeSummary } {
  const itemByJob = new Map<string, LienDeskItemRow>()
  for (const i of items) {
    if (i.kind !== 'notice_53_056' || i.voided_at || i.status === 'sent' || i.status === 'missed') continue
    const prev = itemByJob.get(i.job_id)
    if (!prev || (i.created_at ?? '') > (prev.created_at ?? '')) itemByJob.set(i.job_id, i)
  }
  const byJob = new Map<string, GcUnpaidMonthRow[]>()
  for (const r of rows) {
    const list = byJob.get(r.job_id) ?? []
    list.push(r)
    byJob.set(r.job_id, list)
  }
  const jobs: GcNoticeJob[] = []
  for (const [jobId, list] of byJob) {
    const first = list[0]!
    const sorted = list.slice().sort((a, b) => a.work_month.localeCompare(b.work_month))
    const months: GcNoticeMonth[] = []
    const noticedMonths: string[] = []
    for (const r of sorted) {
      if (r.noticed) {
        noticedMonths.push(r.work_month)
        continue
      }
      const deadline = (r.deadline ?? '').slice(0, 10)
      months.push({ key: r.work_month, hours: Number(r.approved_hours) || 0, deadline, closed: Boolean(deadline) && deadline < todayYmd })
    }
    const ownerState = ownerStateOf(jobId)
    const item = itemByJob.get(jobId) ?? null
    const lastMonth = sorted.reduce((m, r) => (r.last_work_month > m ? r.last_work_month : m), first.last_work_month ?? '')
    const openBalance = Math.max(0, Number(first.open_balance) || 0)
    const claimed = correctedClaim(openBalance, correctionFor(jobId))
    jobs.push({
      jobId,
      customerId: first.customer_id,
      gcCustomerId: first.gc_customer_id,
      isBilled: Boolean(first.is_billed),
      jobStatus: first.job_status ?? '',
      claimAmount: claimed.claim,
      openBalance,
      claimCorrected: claimed.corrected,
      claimDelta: claimed.delta,
      claimOver: claimed.over,
      months,
      noticedMonths,
      ownerState,
      propertyKind: first.property_kind ?? '',
      affidavitBy: lastMonth ? filingDeadlineForMonth(lastMonth, first.property_kind ?? '') : '',
      item,
      readiness: readinessOf(months, ownerState, item),
    })
  }
  // Biggest claim first — the eye goes to the money; ties by job id for a stable order.
  jobs.sort((a, b) => b.claimAmount - a.claimAmount || a.jobId.localeCompare(b.jobId))
  return { jobs, summary: summarizeGcOnNotice(jobs) }
}

export function summarizeGcOnNotice(jobs: ReadonlyArray<GcNoticeJob>): GcNoticeSummary {
  const s: GcNoticeSummary = {
    jobs: jobs.length,
    billedJobs: 0,
    unbilledJobs: 0,
    openOnBills: 0,
    notYetBilled: 0,
    unpaidMonths: 0,
    ownersOnFile: 0,
    ownersMissing: 0,
    ownersUnconfirmed: 0,
    publicOwners: 0,
    ready: 0,
    waitingOwner: 0,
    excluded: 0,
    claimTotal: 0,
    envelopes: 0,
    earliestOpenDeadline: null,
  }
  for (const j of jobs) {
    if (j.isBilled) {
      s.billedJobs += 1
      s.openOnBills += j.claimAmount
    } else {
      s.unbilledJobs += 1
      s.notYetBilled += j.claimAmount
    }
    s.unpaidMonths += j.months.length
    if (j.ownerState === 'on_file') s.ownersOnFile += 1
    else if (j.ownerState === 'missing') s.ownersMissing += 1
    else if (j.ownerState === 'unconfirmed') s.ownersUnconfirmed += 1
    else s.publicOwners += 1
    if (j.readiness === 'ready') {
      s.ready += 1
      s.claimTotal += j.claimAmount
      for (const m of j.months) {
        if (!m.closed && m.deadline && (!s.earliestOpenDeadline || m.deadline < s.earliestOpenDeadline)) s.earliestOpenDeadline = m.deadline
      }
    } else if (j.readiness === 'needs_owner' || j.readiness === 'unconfirmed_owner') s.waitingOwner += 1
    else s.excluded += 1
  }
  s.envelopes = s.ready * 2
  return s
}

// ---------- the cover letter, written once for all (v2.3482, PR 2) ----------

/** The blue fields the letter fills per notice. */
export const COVER_LETTER_FILLS = { property: '{{property}}', months: '{{months}}', job: '{{job}}' } as const

/**
 * The letter to owners who paid the GC in good faith: what happened, what
 * § 53.081 lets them do, that we release the moment we are paid, and the
 * offer to be paid directly. One text for the whole run; `fillCoverLetter`
 * resolves the fills per notice. The § 53.081 paragraph prints as written
 * until the attorney replaces it (owner-decisions-pending).
 */
export function defaultGcNoticeCoverLetter(input: { gcName: string; claimantName: string }): string {
  const gc = input.gcName.trim() || 'the general contractor'
  const us = input.claimantName.trim() || 'we'
  return [
    `To the owner of ${COVER_LETTER_FILLS.property},`,
    `We are the plumbing contractor on your project, working under ${gc}. ${gc} has not paid us for work we completed in ${COVER_LETTER_FILLS.months}, and we have reason to believe it is not paying its subcontractors generally.`,
    `Texas law asks us to send you the enclosed notice. It is not a claim against you, and it does not say you have done anything wrong. What it does is let you protect yourself: under Texas Property Code § 53.081, once you have this notice you may withhold from any further payment to ${gc} the amount we are owed, and you will not owe it twice.`,
    `We would rather be paid than file a lien. The moment we are, we will send you a release. If you would like to pay us directly and deduct it from what you owe ${gc}, call ${us === 'we' ? 'our office' : us} and we will arrange it.`,
  ].join('\n\n')
}

/** Resolve the fills for one notice. Unknown fills are left as typed. */
export function fillCoverLetter(template: string, fills: { property: string; months: string; job: string }): string {
  return template
    .split(COVER_LETTER_FILLS.property).join(cleanStoredAddress(fills.property) || 'your property')
    .split(COVER_LETTER_FILLS.months).join(fills.months || 'the months named')
    .split(COVER_LETTER_FILLS.job).join(fills.job || '')
}

/** The letter's paragraphs — blank lines split them; whitespace-only ones drop. */
export function coverLetterParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
}

/** "May · was due Jul 15 · window closed" style words for a month chip. */
export function gcNoticeMonthWords(m: GcNoticeMonth, monthLabel: (key: string) => string, dayLabel: (ymd: string) => string): string {
  const name = monthLabel(m.key)
  if (!m.deadline) return name
  return m.closed ? `${name} · was due ${dayLabel(m.deadline)} · window closed` : `${name} · by ${dayLabel(m.deadline)}`
}

/** The footer's first line: what the run takes now and what waits. */
export function gcNoticeFooterWords(s: GcNoticeSummary, opts: { foundOnRoll: number }): string {
  const parts: string[] = []
  parts.push(`${s.ready} ready now`)
  if (opts.foundOnRoll > 0) parts.push(`${opts.foundOnRoll} more the moment Use all found is pressed`)
  if (s.waitingOwner - opts.foundOnRoll > 0) parts.push(`${s.waitingOwner - opts.foundOnRoll} wait${s.waitingOwner - opts.foundOnRoll === 1 ? 's' : ''} on an owner`)
  if (s.publicOwners > 0) parts.push(`${s.publicOwners} left out (public owner)`)
  return parts.join(' · ')
}

/** A closed window is named, not hidden — the sentence under a row with one. */
export function closedWindowsSentence(months: ReadonlyArray<GcNoticeMonth>, monthLabel: (key: string) => string): string {
  const closed = months.filter((m) => m.closed).map((m) => monthLabel(m.key))
  if (closed.length === 0) return ''
  const list = closed.length === 1 ? closed[0]! : `${closed.slice(0, -1).join(', ')} and ${closed[closed.length - 1]}`
  return `${list} ${closed.length === 1 ? 'is' : 'are'} named as information: ${closed.length === 1 ? 'its' : 'their'} lien is gone, the owner still learns the balance.`
}

/** Days until the earliest open deadline, for the "closes tomorrow" line. */
export function daysUntil(ymd: string | null, todayYmd: string): number | null {
  if (!ymd) return null
  const a = new Date(`${todayYmd}T12:00:00Z`).getTime()
  const b = new Date(`${ymd}T12:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

// ---------- the leader's card (v2.3479, PR 3) ----------

/**
 * The runs the office prepared and sent to the leader: every awaiting item
 * whose draft carries a `batchReason`, grouped by GC — one Needs You card
 * each, opening the GC-on-notice modal where Approve all takes the set.
 */
export function lienDeskBatches(queue: Pick<LienDeskQueue, 'piles'>, gcNames: Readonly<Record<string, string>> = {}): LienDeskBatch[] {
  const by = new Map<string, LienDeskBatch>()
  for (const e of queue.piles.awaiting) {
    if (!e.item || !e.gcCustomerId) continue
    const reason = parseLienDeskDraftFields(e.item.fields)?.batchReason ?? ''
    if (!reason) continue
    const cur = by.get(e.gcCustomerId) ?? { gcId: e.gcCustomerId, gcName: gcNames[e.gcCustomerId] ?? '', jobs: 0, dollars: 0, reason, earliestDeadline: null }
    cur.jobs += 1
    cur.dollars += e.openBalance
    if (e.earliestDeadline && (!cur.earliestDeadline || e.earliestDeadline < cur.earliestDeadline)) cur.earliestDeadline = e.earliestDeadline
    by.set(e.gcCustomerId, cur)
  }
  return [...by.values()].sort((a, b) => b.dollars - a.dollars)
}
