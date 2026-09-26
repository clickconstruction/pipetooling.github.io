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
 * caller is holding from whatever they give the office — their name, the
 * street, the job number, the GC's name. Matches the desk's SENT items only,
 * over data the desk already holds (the items, the jobs, the owners of record,
 * the properties, the GCs); nothing is loaded for it. One hit per job — the
 * first packet, the item the owner's call is recorded on — with the letter's
 * facts the call sheet puts at the top. A GC's name matches too, as a
 * signpost: the GC's call goes to the master, not to the owner's sheet.
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

export type CallerHit =
  | { kind: 'owner'; jobId: string; itemId: string; who: string; what: string; facts: CallLetterFacts }
  | { kind: 'gc'; gcCustomerId: string; who: string; what: string }

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
    const property = resolveLienProperty(address, owner)
    const haystack = [property.owner.ownerName, property.owner.ownerCompany, property.owner.mailingAddress, job?.job_address ?? '', job?.job_name ?? '', job?.hcp_number ?? '', job?.click_number ?? '', facts.jobLabel, gc?.name ?? '']
      .join(' · ')
      .toLowerCase()
    out.push({ jobId, item, facts, haystack })
  }
  return out.sort((a, b) => (b.facts.mailedOn > a.facts.mailedOn ? 1 : b.facts.mailedOn < a.facts.mailedOn ? -1 : a.facts.jobLabel.localeCompare(b.facts.jobLabel)))
}

export const CALLER_MATCH_MIN = 2
export const CALLER_MATCH_MAX = 8

function tokens(query: string): string[] {
  return query.toLowerCase().split(/[\s,]+/).map((t) => t.trim()).filter((t) => t.length > 0)
}

/** Owners first (newest packet first), then a GC signpost when the words match a GC. */
export function matchCaller(query: string, input: CallerMatchInput, fmt: { day: (ymd: string) => string }): CallerHit[] {
  const q = tokens(query)
  if (q.join('').length < CALLER_MATCH_MIN) return []
  const notices = sentNoticesForCalls(input)
  const hits: CallerHit[] = []
  for (const n of notices) {
    if (!q.every((t) => n.haystack.includes(t))) continue
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
    hits.push({ kind: 'owner', jobId: n.jobId, itemId: n.item.id, who: `${f.ownerName || 'Owner of record'} · owner of ${f.property || f.jobLabel}`, what, facts: f })
    if (hits.length >= CALLER_MATCH_MAX) break
  }
  // A GC's name: how many envelopes went out under it — the signpost.
  const gcCounts = new Map<string, number>()
  for (const n of notices) {
    const job = input.jobsById[n.jobId]
    const gcId = job?.gc_customer_id
    const gc = gcId ? input.gcsById[gcId] : undefined
    if (!gcId || !gc) continue
    if (q.every((t) => gc.name.toLowerCase().includes(t))) gcCounts.set(gcId, (gcCounts.get(gcId) ?? 0) + 1)
  }
  for (const [gcId, count] of gcCounts) {
    const gc = input.gcsById[gcId]!
    hits.push({ kind: 'gc', gcCustomerId: gcId, who: `${gc.name} · original contractor`, what: `copies of ${count} notice${count === 1 ? '' : 's'} — a GC’s call goes to the master, not this sheet` })
  }
  return hits
}
