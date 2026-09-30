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
 * Someone's calling (pure kernel, v2.3854 — to-do #47): find the job a caller
 * is talking about from whatever they give the office — their name, the
 * street, the job number, the GC's name. Since v2.4249 it searches every job
 * the desk holds, in two groups: the jobs with a SENT notice (the caller can be
 * holding a letter; one hit per job — the first packet, the item the owner's
 * call is recorded on — with the letter's facts the call sheet puts at the
 * top) and the jobs with nothing mailed yet (the hit opens the job on the
 * desk). Nothing is loaded for it: it runs over data the desk already holds
 * (the items, the jobs, the owners of record, the properties, the GCs, the
 * three tabs' entries). A GC's name heads its jobs as a signpost: the GC's own
 * call goes to the master, not to the owner's sheet.
 */

/** One job the desk lists, and where: the tab, the pile's words, the money open and the next date. */
export type DeskJobRef = {
  jobId: string
  tab: 'notice' | 'affidavit' | 'retainage'
  /** The pile's label as the desk shows it — "To draft". */
  pile: string
  openBalance: number
  /** 'YYYY-MM-DD' — the next deadline on that tab, or null. */
  deadline: string | null
}

export type CallerMatchInput = {
  items: ReadonlyArray<LienDeskItemRow>
  jobsById: Readonly<Record<string, LienDeskJob>>
  gcsById: Readonly<Record<string, LienDeskGc>>
  addressesById: Readonly<Record<string, CustomerAddressRow>>
  ownerByJob: Readonly<Record<string, JobPropertyOwnerLike>>
  letterTwoByJob: Readonly<Record<string, LetterTwoStatus>>
  /** Every job on the desk's three tabs, one row per job (the first tab that lists it). */
  deskJobs: ReadonlyArray<DeskJobRef>
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
export type CallerJobHit = { kind: 'job'; jobId: string; tab: DeskJobRef['tab']; who: string; pile: string; what: string }
export type CallerGcHit = { kind: 'gc'; gcCustomerId: string; who: string; jobs: number }
export type CallerHit = CallerOwnerHit | CallerJobHit | CallerGcHit

export type CallerFmt = { day: (ymd: string) => string; money: (n: number) => string }

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
    mailedOn: (item.sent_at ?? '').slice(0, 10),
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

/** What a caller might say about one job, and the pieces the box's examples are cut from. */
function jobWords(jobId: string, input: CallerMatchInput): { haystack: string; numbers: string[]; label: string; street: string; owner: string; gcId: string | null; gcName: string } {
  const job = input.jobsById[jobId]
  const gcId = job?.gc_customer_id ?? null
  const gc = gcId ? input.gcsById[gcId] : undefined
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
  return { haystack, numbers, label, street, owner: property.owner.ownerName || property.owner.ownerCompany, gcId: gc ? gcId : null, gcName: gc?.name ?? '' }
}

export const CALLER_MATCH_MIN = 2
export const CALLER_MATCH_MAX = 8
/** A word that is nowhere on the desk loses letters from its end down to this many before the box gives up. */
export const CALLER_TRIM_MIN = 3
export const CALLER_LETTERS_OUT_MAX = 5

function tokens(query: string): string[] {
  return query.toLowerCase().split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 0)
}

type IndexRow<H extends CallerOwnerHit | CallerJobHit> = { hit: H; haystack: string; numbers: string[]; gcId: string | null; street: string; owner: string; gcName: string; open: boolean }

/** Everything the box can find, built once per desk load: the sent letters (newest first), the jobs with nothing mailed (soonest date first), and the GCs over them. */
export type CallerIndex = {
  sent: IndexRow<CallerOwnerHit>[]
  unsent: IndexRow<CallerJobHit>[]
  gcs: { id: string; name: string; jobs: number }[]
}

const DEADLINE_WORDS: Record<DeskJobRef['tab'], string> = { notice: 'notice by', affidavit: 'affidavit by', retainage: 'retainage notice by' }

export function callerIndex(input: CallerMatchInput, fmt: CallerFmt): CallerIndex {
  const openFor = (jobId: string) => {
    const job = input.jobsById[jobId]
    return !job || Number(job.revenue ?? 0) - Number(job.payments_made ?? 0) > 0
  }
  const sent: IndexRow<CallerOwnerHit>[] = sentNoticesForCalls(input).map((n) => {
    const f = n.facts
    const w = jobWords(n.jobId, input)
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
    return { hit: { kind: 'owner', jobId: n.jobId, itemId: n.item.id, who: `${f.ownerName || 'Owner of record'} · owner of ${f.property || f.jobLabel}`, what, facts: f }, haystack: n.haystack, numbers: w.numbers, gcId: w.gcId, street: w.street, owner: w.owner, gcName: w.gcName, open: openFor(n.jobId) }
  })
  const hasLetter = new Set(sent.map((r) => r.hit.jobId))
  const dateOf = new Map<string, string>()
  const unsent: IndexRow<CallerJobHit>[] = []
  for (const ref of input.deskJobs) {
    if (hasLetter.has(ref.jobId) || dateOf.has(ref.jobId)) continue
    dateOf.set(ref.jobId, ref.deadline ?? '9999-12-31')
    const w = jobWords(ref.jobId, input)
    const what = [w.gcName ? `GC ${w.gcName}` : '', ref.openBalance > 0 ? fmt.money(ref.openBalance) : '', ref.deadline ? `${DEADLINE_WORDS[ref.tab]} ${fmt.day(ref.deadline)}` : ''].filter(Boolean).join(' · ')
    unsent.push({ hit: { kind: 'job', jobId: ref.jobId, tab: ref.tab, who: w.label, pile: ref.pile, what }, haystack: w.haystack, numbers: w.numbers, gcId: w.gcId, street: w.street, owner: w.owner, gcName: w.gcName, open: true })
  }
  unsent.sort((a, b) => (dateOf.get(a.hit.jobId) ?? '').localeCompare(dateOf.get(b.hit.jobId) ?? '') || a.hit.who.localeCompare(b.hit.who))
  const counts = new Map<string, number>()
  for (const r of [...sent, ...unsent]) if (r.gcId) counts.set(r.gcId, (counts.get(r.gcId) ?? 0) + 1)
  const gcs = [...counts].map(([id, jobs]) => ({ id, name: input.gcsById[id]!.name, jobs })).sort((a, b) => a.name.localeCompare(b.name))
  return { sent, unsent, gcs }
}

export type DeskFind = {
  /** The words that matched — the query, or the query with its last word cut back. */
  used: string
  /** True when the query as typed found nothing and a shorter last word did. */
  trimmed: boolean
  gcs: CallerGcHit[]
  sent: CallerOwnerHit[]
  /** Matches past the first CALLER_MATCH_MAX. */
  sentMore: number
  unsent: CallerJobHit[]
  unsentMore: number
}

const NOTHING = (used: string): DeskFind => ({ used, trimmed: false, gcs: [], sent: [], sentMore: 0, unsent: [], unsentMore: 0 })

function findExact(q: string[], index: CallerIndex): DeskFind {
  const pick = <H extends CallerOwnerHit | CallerJobHit>(rows: IndexRow<H>[]): H[] => {
    const hit = rows.filter((r) => q.every((t) => r.haystack.includes(t)))
    // A job number typed whole comes first; the rest keep the index's order.
    const whole = (r: IndexRow<H>) => (q.some((t) => r.numbers.includes(t)) ? 0 : 1)
    return hit.map((r, i) => ({ r, i })).sort((a, b) => whole(a.r) - whole(b.r) || a.i - b.i).map((x) => x.r.hit)
  }
  const sent = pick(index.sent)
  const unsent = pick(index.unsent)
  const gcs: CallerGcHit[] = index.gcs.filter((g) => q.every((t) => g.name.toLowerCase().includes(t))).map((g) => ({ kind: 'gc', gcCustomerId: g.id, who: g.name, jobs: g.jobs }))
  return { used: q.join(' '), trimmed: false, gcs, sent: sent.slice(0, CALLER_MATCH_MAX), sentMore: Math.max(0, sent.length - CALLER_MATCH_MAX), unsent: unsent.slice(0, CALLER_MATCH_MAX), unsentMore: Math.max(0, unsent.length - CALLER_MATCH_MAX) }
}

export function deskFindIsEmpty(f: DeskFind): boolean {
  return f.gcs.length === 0 && f.sent.length === 0 && f.unsent.length === 0
}

/**
 * Every word of the query must be somewhere in a job's words. When nothing
 * matches, each word that is nowhere on the desk loses letters from its end
 * (down to CALLER_TRIM_MIN) until it is somewhere — "lenn" finds Lenox, and
 * "lenoz hl" finds Lenox Hl — and `trimmed` / `used` say so. Words that are
 * each on the desk but never on the same job still find nothing.
 */
export function findOnDesk(query: string, index: CallerIndex): DeskFind {
  const q = tokens(query)
  if (q.join('').length < CALLER_MATCH_MIN) return NOTHING(q.join(' '))
  const first = findExact(q, index)
  if (!deskFindIsEmpty(first)) return first
  const rows = [...index.sent, ...index.unsent]
  const somewhere = (t: string) => rows.some((r) => r.haystack.includes(t))
  const cut = q.map((t) => {
    let w = t
    while (w.length > CALLER_TRIM_MIN && !somewhere(w)) w = w.slice(0, -1)
    return somewhere(w) ? w : t
  })
  if (cut.join(' ') === q.join(' ')) return first
  const again = findExact(cut, index)
  return deskFindIsEmpty(again) ? first : { ...again, trimmed: true }
}

/** The letters an owner could be holding right now: sent, and the job still has money open. Newest first. */
export function lettersOutNow(index: CallerIndex, max: number = CALLER_LETTERS_OUT_MAX): { hits: CallerOwnerHit[]; total: number } {
  const out = index.sent.filter((r) => r.open)
  return { hits: out.slice(0, max).map((r) => r.hit), total: out.length }
}

export type CallerTryWord = { word: string; kind: 'job' | 'street' | 'owner' | 'GC' }

const STREET_SKIP = new Set(['north', 'south', 'east', 'west', 'road', 'street', 'drive', 'lane', 'suite', 'unit', 'blvd', 'highway', 'county'])

/** Four words to try, cut from jobs on the desk — each one finds something when pressed, and they come from different jobs where they can. */
export function callerTryWords(index: CallerIndex): CallerTryWord[] {
  const rows = [...index.unsent, ...index.sent]
  const word = (text: string, min: number, skip?: ReadonlySet<string>) => text.split(/[^A-Za-z]+/).find((w) => w.length >= min && !skip?.has(w.toLowerCase())) ?? ''
  const cut: Record<CallerTryWord['kind'], (r: (typeof rows)[number]) => string> = {
    job: (r) => r.numbers.find((n) => n.length >= CALLER_MATCH_MIN) ?? '',
    street: (r) => word((r.street.split(',')[0] ?? '').replace(/^\s*\d+\s*/, ''), 4, STREET_SKIP),
    owner: (r) => word(r.owner, 3),
    GC: (r) => word(r.gcName, 3),
  }
  const used = new Set<string>()
  const out: CallerTryWord[] = []
  for (const kind of ['job', 'street', 'owner', 'GC'] as const) {
    const finds = (r: (typeof rows)[number]) => {
      const w = cut[kind](r)
      return w && !deskFindIsEmpty(findExact(tokens(w), index)) ? w : ''
    }
    const row = rows.find((r) => !used.has(r.hit.jobId) && finds(r)) ?? rows.find((r) => finds(r))
    if (!row) continue
    used.add(row.hit.jobId)
    out.push({ word: cut[kind](row), kind })
  }
  return out
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
