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
import { monthFromCreation, type LienDeskBatch, type LienDeskItemRow, type LienDeskQueue, type LienNoticeMonthRow } from './lienDesk'
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
  /** The month is the job's creation month — no approved hours (v2.3747). */
  fromCreation: boolean
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
  /** Every month with approved hours and no live notice, oldest first — or, for a job with no approved hours, its creation month (v2.3747). */
  months: GcNoticeMonth[]
  /** The job has no approved clock hours: its one month is the month it was created, and the row says so (v2.3747). */
  datedFromCreation: boolean
  /** Months a recorded notice already names. */
  noticedMonths: string[]
  ownerState: GcNoticeOwnerState
  /** The owner's envelope — `envelopeKey(name, mailing address)`, '' when unknown; jobs sharing it share one envelope in the run (v2.3720). */
  ownerKey?: string
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
  /** What the run will mail: one envelope per owner at one address across the ready rows (jobs at one property share it), plus one to the original contractor with every notice inside (v2.3720). Zero with nothing ready. */
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
  if (months.length === 0 || months.every((m) => m.closed)) return 'no_months'
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
  /** The owner's envelope key per job (v2.3720) — the hook's read of the property record; '' when no owner is on file. */
  ownerKeyOf: (jobId: string) => string = () => '',
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
      months.push({ key: r.work_month, hours: Number(r.approved_hours) || 0, deadline, closed: Boolean(deadline) && deadline < todayYmd, fromCreation: monthFromCreation(r) })
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
      datedFromCreation: sorted.every(monthFromCreation),
      noticedMonths,
      ownerState,
      ownerKey: ownerKeyOf(jobId),
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
  const ownerEnvelopes = new Set<string>()
  let ownersAlone = 0
  for (const j of jobs) {
    if (j.readiness !== 'ready') continue
    if (j.ownerKey) ownerEnvelopes.add(j.ownerKey)
    else ownersAlone += 1
  }
  s.envelopes = s.ready > 0 ? ownerEnvelopes.size + ownersAlone + 1 : 0
  return s
}

// ---------- the cover letter (v2.3482, PR 2; counsel's wording v2.3745) ----------

/** The blue fields the letter fills per notice. */
export const COVER_LETTER_FILLS = {
  property: '{{property}}',
  months: '{{months}}',
  job: '{{job}}',
  /** The claim on the form — timely months only, as money. */
  amount: '{{amount}}',
  /** One sentence naming stale-month dollars as information, or nothing. */
  staleNote: '{{stale_note}}',
  /** The signer, who takes the call. */
  contact: '{{contact}}',
  phone: '{{phone}}',
  /** "fourth" on commercial work, "third" on residential — the § 53.052 affidavit month. */
  affidavitMonth: '{{affidavit_month}}',
} as const

/** Which letter a job gets: counsel's three, by the saved property. */
export type CoverLetterKind = 'commercial' | 'residential' | 'homestead'

export const COVER_LETTER_KINDS: ReadonlyArray<{ key: CoverLetterKind; label: string }> = [
  { key: 'commercial', label: 'Commercial' },
  { key: 'residential', label: 'Residential' },
  { key: 'homestead', label: 'Homestead' },
]

export function coverLetterKindFor(property: { propertyKind: string; homestead: boolean } | null | undefined): CoverLetterKind {
  if (!property) return 'commercial'
  if (property.homestead) return 'homestead'
  if (property.propertyKind === 'residential') return 'residential'
  return 'commercial'
}

/** The § 53.052 affidavit month the letter names: the fourth month after the last work month on commercial work, the third on residential. */
export function affidavitMonthWord(kind: CoverLetterKind): 'fourth' | 'third' {
  return kind === 'commercial' ? 'fourth' : 'third'
}

/**
 * Counsel's letters (memo of 2026-09-22): owner-protective, one number (the
 * timely claim), one real deadline ("before the next payment to the GC"),
 * three doors and none of them a joint check, the release promised the day
 * funds clear, the master plumber as the person to call. Never on this page:
 * "pay us directly and deduct it", "not paying subcontractors generally",
 * fee or theft-of-service language, or stale-month dollars in the claim.
 * `gcUnresponsive` swaps in the letter for a GC that is not answering — it
 * names the affidavit date so the owner knows this does not sit forever.
 * The fills stay unresolved in the stored text; `fillCoverLetter` resolves
 * them per notice. Each list item is its own paragraph so it prints on its
 * own line.
 */
export function defaultGcNoticeCoverLetter(input: { gcName: string; claimantName: string; kind?: CoverLetterKind; gcUnresponsive?: boolean }): string {
  const gc = input.gcName.trim() || 'the general contractor'
  const us = input.claimantName.trim() || 'us'
  const F = COVER_LETTER_FILLS
  if (input.gcUnresponsive) {
    return [
      `To the owner of ${F.property},`,
      `This page is a cover letter. The enclosed notice is given under Texas Property Code § 53.056.`,
      `We are the plumbing contractor on your project under ${gc}. ${gc} has not paid us ${F.amount} for work in ${F.months} and has not responded to us. A copy of this letter is going to ${gc} at every address we have. ${F.staleNote}`,
      `You did not hire us, and this is not a lawsuit. It is the notice the Code requires if we are going to keep lien rights. Because ${gc} is not answering, please do not send ${gc} another payment that includes our ${F.amount}. You may withhold that amount from any further payment to ${gc} the day you receive this (§ 53.081). If you pay ${gc} that money anyway, those dollars can follow the property (§ 53.084).`,
      `We cannot deposit a joint check. We also cannot take a check from you that still belongs to ${gc} unless ${gc} authorizes it. With ${gc} silent, these are the ways this actually ends:`,
      `1. ${gc} pays ${us} ${F.amount}, payable only to ${us}. We send you a release the day it clears.`,
      `2. You withhold ${F.amount} and call ${F.contact} at ${F.phone} so we know it is trapped. Hold it. Do not release it to ${gc}.`,
      `3. If you decide to clear the property yourself while ${gc} stays silent, call us first. We will take ${F.amount} payable only to ${us}, send you a release the same day, and mail a copy to ${gc}. That is your decision on your contract with ${gc}. The Code does not require you to do it.`,
      `If ${F.amount} is not paid, we will file the lien affidavit in the county records within the time § 53.052 allows — the 15th day of the ${F.affidavitMonth} month after our last work month on this job. A recorded affidavit is harder to take off than this notice. We would rather pick up a check.`,
      `Call ${F.contact} at ${F.phone} before you make the next payment to ${gc}. If you have already paid ${gc} in full, say so on that call. There may be nothing left to withhold except retainage.`,
    ].join('\n\n')
  }
  const kind = input.kind ?? 'commercial'
  if (kind === 'homestead') {
    return [
      `To the owner of ${F.property},`,
      `This page is a cover letter. The enclosed notice is given under Texas Property Code § 53.056. Because this property appears to be your homestead, the notice also includes the statement required by § 53.254(g).`,
      `We did the plumbing on your home under ${gc}. ${gc} has not paid us ${F.amount} for work in ${F.months}. ${F.staleNote}`,
      `This is not a lawsuit and you did not hire us. It is the notice the Code requires if we are going to keep homestead lien rights. After you receive it, your homestead can be reached if:`,
      `(1) you do not withhold from ${gc} enough to cover this unpaid claim until the dispute is resolved; or`,
      `(2) during construction and for 30 days after ${gc} finishes, you do not reserve 10% of the contract price or 10% of the value of ${gc}’s work.`,
      `That is the homestead rule in the enclosed statement. The practical point is the same: do not send ${gc} another draw that includes our ${F.amount} until this is cleared.`,
      `The clean ways to finish it, before the next payment to ${gc}:`,
      `• ${gc} pays us ${F.amount} this week, payable only to ${us}, and we send you a release;`,
      `• you withhold ${F.amount} and call ${F.contact} at ${F.phone}; or`,
      `• ${gc} writes that you may pay ${us} directly, and you send us ${F.amount}. We cannot deposit a joint check.`,
      `We would rather pick up a check than put an affidavit on a homestead. Please call before the next payment to ${gc}.`,
    ].join('\n\n')
  }
  if (kind === 'residential') {
    return [
      `To the owner of ${F.property},`,
      `This page is a cover letter. The enclosed notice is given under Texas Property Code § 53.056.`,
      `We installed the plumbing on your project under ${gc}. ${gc} has not paid us ${F.amount} for work in ${F.months}. ${F.staleNote}`,
      `You hired ${gc}, not us. This notice is not a lawsuit. It is the paper Texas requires if we are going to keep the right to a lien. After you have it:`,
      `• You may hold back ${F.amount} from anything else you still owe ${gc}, in addition to the 10% retainage the Code already tells you to reserve.`,
      `• If you pay ${gc} that amount anyway, those dollars can come back against the property if a lien is later perfected.`,
      `We would rather be paid than file a lien on a house. Before you make the next payment to ${gc}, do one of the following:`,
      `1. Tell ${gc} to pay us ${F.amount} this week, payable only to ${us}. We will send you a release the day it clears.`,
      `2. Hold back ${F.amount} from the next payment to ${gc} and call ${F.contact} at ${F.phone} so we know it is trapped.`,
      `3. If ${gc} writes that you may pay ${us} directly, send us ${F.amount}. We cannot deposit a joint check, so please do not send one.`,
      `Do not send ${us} a check on your own unless ${gc} has agreed in writing.`,
    ].join('\n\n')
  }
  return [
    `To the owner of ${F.property},`,
    `This page is a cover letter. The enclosed Notice of Claim for Unpaid Labor or Materials is given under Texas Property Code § 53.056.`,
    `We are the plumbing contractor on your project, working under ${gc}. ${gc} has not paid us ${F.amount} for work completed in ${F.months}. ${F.staleNote}`,
    `You did not hire us, and this is not a lawsuit. It is the notice Texas law requires us to send if we are going to keep lien rights. Once you have it, two things are true:`,
    `1. You may withhold ${F.amount} from any further payment to ${gc} (§ 53.081), on top of retainage you already hold.`,
    `2. If you pay ${gc} that money anyway, and a lien is later perfected, those further payments can follow the property (§ 53.084).`,
    `The cheapest way to close this is to get us paid before the next draw leaves your account. Any one of these works. We cannot deposit a joint check, so please do not send one.`,
    `• Have ${gc} pay us ${F.amount} this week by check or wire payable only to ${us}. The day it clears we will send you a release of this notice.`,
    `• Withhold ${F.amount} from the next payment to ${gc} and call us so we know the funds are trapped until ${gc} pays us.`,
    `• If ${gc} emails ${F.contact} written authorization for you to pay ${us} directly, you may send us ${F.amount} and deduct it from what you still owe ${gc}. We will send the release the same day.`,
    `Please do not send ${us} a check on your own. Without ${gc}’s written okay, that payment sits in the wrong contract.`,
    `Call ${F.contact} at ${F.phone} before the next payment to ${gc}. We would rather pick up a check than file a lien on your property.`,
  ].join('\n\n')
}

export type CoverLetterFills = {
  property: string
  months: string
  job: string
  /** "$1,800.00" — the form's Claim amount. */
  amount?: string
  staleNote?: string
  contact?: string
  phone?: string
  affidavitMonth?: 'fourth' | 'third' | ''
}

/** Resolve the fills for one notice. Unknown fills are left as typed; a blank stale note leaves no gap. */
export function fillCoverLetter(template: string, fills: CoverLetterFills): string {
  const F = COVER_LETTER_FILLS
  const out = template
    .split(F.property).join(cleanStoredAddress(fills.property) || 'your property')
    .split(F.months).join(fills.months || 'the months named')
    .split(F.job).join(fills.job || '')
    .split(F.amount).join(fills.amount || 'the amount on the enclosed notice')
    .split(F.staleNote).join((fills.staleNote ?? '').trim())
    .split(F.contact).join(fills.contact || 'our office')
    .split(F.phone).join(fills.phone || 'the number on our letterhead')
    .split(F.affidavitMonth).join(fills.affidavitMonth || 'fourth')
  // A blank stale note leaves "… {{months}}. " with a trailing space: tidy it.
  return out.replace(/[ \t]+$/gm, '')
}

/**
 * The claim the notice may carry (counsel, answer 6): the dollars for months
 * whose § 53.056 window is still open. A month the office priced by hand
 * (v2.3682) keeps its figure; otherwise the job's claim is spread by approved
 * hours (evenly when no hours are known). The stale remainder is named in the
 * letter's footnote only — never on the form.
 */
export function timelyClaim(
  months: ReadonlyArray<GcNoticeMonth>,
  claim: number,
  split: ReadonlyArray<{ month: string; amount: number }> | null,
): { timely: number; stale: number; timelyMonths: string[]; staleMonths: string[] } {
  const timelyMonths = months.filter((m) => !m.closed).map((m) => m.key)
  const staleMonths = months.filter((m) => m.closed).map((m) => m.key)
  if (staleMonths.length === 0) return { timely: claim, stale: 0, timelyMonths, staleMonths }
  if (timelyMonths.length === 0) return { timely: 0, stale: claim, timelyMonths, staleMonths }
  let timely: number
  if (split) {
    const by = new Map(split.map((s) => [s.month, s.amount]))
    timely = timelyMonths.reduce((sum, m) => sum + (by.get(m) ?? 0), 0)
  } else {
    const total = months.reduce((sum, m) => sum + Math.max(0, m.hours), 0)
    const open = months.filter((m) => !m.closed).reduce((sum, m) => sum + Math.max(0, m.hours), 0)
    const share = total > 0 ? open / total : timelyMonths.length / months.length
    timely = Math.round(claim * share * 100) / 100
  }
  timely = Math.min(claim, Math.max(0, timely))
  return { timely, stale: Math.round((claim - timely) * 100) / 100, timelyMonths, staleMonths }
}

/** "A further $1,200.00 for April and June 2026 is unpaid but outside the statutory notice window for those months and is not in the claim amount on the enclosed form." — or '' when nothing is stale. */
export function staleNoteWords(stale: number, staleMonths: ReadonlyArray<string>, describeMonths: (months: ReadonlyArray<string>) => string): string {
  if (stale <= 0 || staleMonths.length === 0) return ''
  const money = stale.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return `A further ${money} for ${describeMonths(staleMonths)} is unpaid but outside the statutory notice window for ${staleMonths.length === 1 ? 'that month' : 'those months'} and is not in the claim amount on the enclosed form.`
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
