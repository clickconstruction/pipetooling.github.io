import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { LienDeskItemRow } from './lienDesk'
import type { LienDeskGc, LienDeskJob } from '../../hooks/useLienDeskData'
import type { CustomerAddressRow, JobPropertyOwnerLike } from './lienProperty'
import { lienPropertyOwnerDisplayName, resolveLienProperty } from './lienProperty'
import type { LetterTwoStatus } from './lienLetterTwo'
import { parseLienDeskDraftFields, describeNoticeMonths } from './lienNoticeDraft'
import { coverLetterKindFor } from './gcOnNotice'
import { filingDeadlineForMonth } from './lienDeadlines'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { demandMoney } from '../jobsDocuments/demandLetter'
import type { CallLetterFacts } from './lienOwnerCallScript'

/**
 * Someone's calling (pure kernel, v2.3854 — to-do #47): find the sent notice a
 * caller is talking about from whatever they give the office — their name, the
 * street, the job number, the GC's name. One hit per job — the first packet,
 * the item the owner's call is recorded on — with the letter's facts the call
 * sheet puts at the top. Nothing is loaded for it: it runs over data the desk
 * already holds (the items, the jobs, the owners of record, the properties, the
 * GCs). Since v2.4731 the desk's find box is its only reader, listing the hits
 * under Also sent; v2.4741 retired the door's other halves (the jobs with
 * nothing mailed, the GC signposts, the letters out now, the words to try).
 */

export type CallerMatchInput = {
  items: ReadonlyArray<LienDeskItemRow>
  jobsById: Readonly<Record<string, LienDeskJob>>
  gcsById: Readonly<Record<string, LienDeskGc>>
  addressesById: Readonly<Record<string, CustomerAddressRow>>
  ownerByJob: Readonly<Record<string, JobPropertyOwnerLike>>
  letterTwoByJob: Readonly<Record<string, LetterTwoStatus>>
  /** The claimant's short name on the phone — "Click". */
  us: string
}

export type SentNoticeForCall = {
  jobId: string
  item: LienDeskItemRow
  facts: CallLetterFacts
  /** Lower-cased words the caller might give: owner, company, mailing address, job address, job number and name, the GC. */
  haystack: string
}

export type CallerOwnerHit = { kind: 'owner'; jobId: string; itemId: string; who: string; what: string; facts: CallLetterFacts }

export type CallerFmt = { day: (ymd: string) => string }

/** The letter's facts for one sent item — what the sheet shows at the top and the words depend on. */
export function callLetterFactsFor(input: { item: LienDeskItemRow; job: LienDeskJob | undefined; gc: LienDeskGc | undefined; address: CustomerAddressRow | null; owner: JobPropertyOwnerLike; us: string; phone?: string }): CallLetterFacts {
  const { item, job, gc } = input
  const property = resolveLienProperty(input.address, input.owner)
  const draft = parseLienDeskDraftFields(item.fields)
  const notice = draft?.notice
  const instrument: CallLetterFacts['instrument'] = item.kind === 'retainage_53_057' ? 'retainage_53_057' : 'notice_53_056'
  const letterKind: CallLetterFacts['letterKind'] = instrument === 'retainage_53_057' ? 'retainage' : draft?.letterTwo?.kind ?? coverLetterKindFor(property)
  const months = item.months.slice().sort()
  const last = months[months.length - 1]
  const jobNumber = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''
  const name = (job?.job_name ?? '').trim()
  return {
    jobLabel: name ? `${jobNumber} · ${name}` : jobNumber || item.job_id.slice(0, 8),
    property: (job?.job_address ?? '').trim() || (input.address?.address ?? '').trim(),
    ownerName: lienPropertyOwnerDisplayName(property.owner),
    gcName: gc?.name ?? notice?.originalContractorName ?? 'the general contractor',
    us: input.us,
    instrument,
    letterKind,
    mailedOn: calendarYmdInAppTzFromIso(item.sent_at ?? ''),
    amount: demandMoney(notice?.claimAmount ?? ''),
    months: instrument === 'retainage_53_057' ? '' : describeNoticeMonths(months),
    signer: notice?.contactPerson ?? '',
    phone: (input.phone ?? '').trim(),
    affidavitBy: instrument === 'notice_53_056' && last ? filingDeadlineForMonth(`${last}-01`, property.propertyKind) : '',
  }
}

/** One sent notice per job — the first packet (letter two records the call on it too) — with its search words. */
export function sentNoticesForCalls(input: CallerMatchInput): SentNoticeForCall[] {
  const sent = input.items.filter((i) => i.status === 'sent' && !i.voided_at && i.sent_at && (i.kind === 'notice_53_056' || i.kind === 'retainage_53_057'))
  const byJob = new Map<string, LienDeskItemRow>()
  for (const item of sent) {
    const firstId = input.letterTwoByJob[item.job_id]?.firstItemId
    const prev = byJob.get(item.job_id)
    if (firstId) {
      if (item.id === firstId) byJob.set(item.job_id, item)
      else if (!prev) byJob.set(item.job_id, item)
    } else if (!prev || (item.sent_at ?? '') > (prev.sent_at ?? '')) byJob.set(item.job_id, item)
  }
  const out: SentNoticeForCall[] = []
  for (const [jobId, item] of byJob) {
    const job = input.jobsById[jobId]
    const gc = job?.gc_customer_id ? input.gcsById[job.gc_customer_id] : undefined
    const address = job?.customer_address_id ? input.addressesById[job.customer_address_id] ?? null : null
    const owner = input.ownerByJob[jobId] ?? null
    const facts = callLetterFactsFor({ item, job, gc, address, owner, us: input.us })
    out.push({ jobId, item, facts, haystack: jobWords(jobId, input).haystack })
  }
  return out.sort((a, b) => (b.facts.mailedOn > a.facts.mailedOn ? 1 : b.facts.mailedOn < a.facts.mailedOn ? -1 : a.facts.jobLabel.localeCompare(b.facts.jobLabel)))
}

/** What a caller might say about one job, and its numbers (a number typed whole puts its job first). */
function jobWords(jobId: string, input: CallerMatchInput): { haystack: string; numbers: string[] } {
  const job = input.jobsById[jobId]
  const gc = job?.gc_customer_id ? input.gcsById[job.gc_customer_id] : undefined
  const address = job?.customer_address_id ? input.addressesById[job.customer_address_id] ?? null : null
  const property = resolveLienProperty(address, input.ownerByJob[jobId] ?? null)
  const number = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''
  const name = (job?.job_name ?? '').trim()
  const label = name ? `${number} · ${name}` : number || jobId.slice(0, 8)
  const street = (job?.job_address ?? '').trim() || (address?.address ?? '').trim()
  const haystack = [property.owner.ownerName, property.owner.ownerCompany, property.owner.mailingAddress, street, name, job?.hcp_number ?? '', job?.click_number ?? '', label, gc?.name ?? '']
    .join(' · ')
    .toLowerCase()
  const numbers = [job?.hcp_number ?? '', job?.click_number ?? '', number].map((n) => n.trim().toLowerCase()).filter(Boolean)
  return { haystack, numbers }
}

export const CALLER_MATCH_MIN = 2
export const CALLER_MATCH_MAX = 8
/** A word that is in no sent letter's words loses letters from its end down to this many before the box gives up. */
export const CALLER_TRIM_MIN = 3

function tokens(query: string): string[] {
  return query.toLowerCase().split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 0)
}

type IndexRow = { hit: CallerOwnerHit; haystack: string; numbers: string[] }

/** Everything the box can find, built once per desk load: the sent letters, newest first. */
export type CallerIndex = { sent: IndexRow[] }

export function callerIndex(input: CallerMatchInput, fmt: CallerFmt): CallerIndex {
  const sent: IndexRow[] = sentNoticesForCalls(input).map((n) => {
    const f = n.facts
    const what = [
      f.instrument === 'retainage_53_057' ? '§ 53.057 retainage notice' : `§ 53.056 notice · ${f.letterKind === 'paid_out' ? 'paid-out letter' : f.letterKind === 'unresponsive' ? 'unresponsive-GC letter' : `${f.letterKind} letter`}`,
      `mailed ${fmt.day(f.mailedOn)}`,
      `${f.amount}${f.months ? ` for ${f.months}` : ''}`,
      `GC ${f.gcName}`,
      `job ${f.jobLabel}`,
      f.signer ? `signed ${f.signer.split(',')[0]?.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    return { hit: { kind: 'owner', jobId: n.jobId, itemId: n.item.id, who: `${f.ownerName || 'Owner of record'} · owner of ${f.property || f.jobLabel}`, what, facts: f }, haystack: n.haystack, numbers: jobWords(n.jobId, input).numbers }
  })
  return { sent }
}

export type DeskFind = {
  /** The words that matched — the query, or the query with its last word cut back. */
  used: string
  /** True when the query as typed found nothing and a shorter last word did. */
  trimmed: boolean
  /** The first CALLER_MATCH_MAX matches. */
  sent: CallerOwnerHit[]
}

function findExact(q: string[], index: CallerIndex): DeskFind {
  const hit = index.sent.filter((r) => q.every((t) => r.haystack.includes(t)))
  // A job number typed whole comes first; the rest keep the index's order.
  const whole = (r: IndexRow) => (q.some((t) => r.numbers.includes(t)) ? 0 : 1)
  const sent = hit.map((r, i) => ({ r, i })).sort((a, b) => whole(a.r) - whole(b.r) || a.i - b.i).map((x) => x.r.hit)
  return { used: q.join(' '), trimmed: false, sent: sent.slice(0, CALLER_MATCH_MAX) }
}

/**
 * Every word of the query must be somewhere in a sent letter's words. When
 * nothing matches, each word that is in no letter's words loses letters from
 * its end (down to CALLER_TRIM_MIN) until it is somewhere — "lenn" finds
 * Lenox, and "lenoz hl" finds Lenox Hl — and `trimmed` / `used` say so. Words
 * that are each on some letter but never on the same one still find nothing.
 */
export function findOnDesk(query: string, index: CallerIndex): DeskFind {
  const q = tokens(query)
  if (q.join('').length < CALLER_MATCH_MIN) return { used: q.join(' '), trimmed: false, sent: [] }
  const first = findExact(q, index)
  if (first.sent.length) return first
  const somewhere = (t: string) => index.sent.some((r) => r.haystack.includes(t))
  const cut = q.map((t) => {
    let w = t
    while (w.length > CALLER_TRIM_MIN && !somewhere(w)) w = w.slice(0, -1)
    return somewhere(w) ? w : t
  })
  if (cut.join(' ') === q.join(' ')) return first
  const again = findExact(cut, index)
  return again.sent.length ? { ...again, trimmed: true } : first
}

function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10)
}

/**
 * The practice call's letter (v2.4249): plainly made up, dated from today so
 * the sheet's dates read like a real call — mailed eight days ago for the two
 * months before that. No job, no item: the sheet it opens saves nothing.
 */
export function practiceCallFacts(input: { us: string; todayYmd: string; signer: string; phone: string }): CallLetterFacts {
  const mailedOn = shiftYmd(input.todayYmd, -8)
  const monthBefore = (ym: string) => shiftYmd(`${ym}-01`, -1).slice(0, 7)
  const last = monthBefore(mailedOn.slice(0, 7))
  const months = [monthBefore(last), last]
  return {
    jobLabel: '000 · Practice job',
    property: '100 Practice Ln, San Antonio, TX',
    ownerName: 'Pat Sample',
    gcName: 'Sample Builders',
    us: input.us,
    instrument: 'notice_53_056',
    letterKind: 'residential',
    mailedOn,
    amount: demandMoney('4250.00'),
    months: describeNoticeMonths(months),
    signer: input.signer,
    phone: input.phone.trim(),
    affidavitBy: filingDeadlineForMonth(`${last}-01`, 'residential'),
  }
}
