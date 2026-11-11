import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { daysBetweenYmd } from './billedExpectedPay'
import { LIEN_DESK_SENT_DAYS, severityForDaysLeft, type LienDeskItemRow, type LienDeskSeverity } from './lienDesk'
import { monthFromCreation, type LienMonthSource, monthSetByHand } from './lienDesk'
import { HOMESTEAD_QUESTION_GATE_LABEL, homesteadAnsweredOnRow, homesteadQuestionOpen } from '../customers/homesteadAnswer'

/**
 * The Lien desk's second kind (pure kernel): the § 53.052 affidavit — one
 * date per job, the 15th of the 4th month after the LAST month worked (3rd
 * residential). Sub jobs need a recorded § 53.056 notice first; every job
 * needs the owner of record, the county and legal description, and must not
 * be a homestead (§ 53.254 — attorney territory). A job under a general
 * contractor also needs that contractor's address on file (punch list #305):
 * § 53.054(a)(4) and (a)(5) ask for the hiring party's and the original
 * contractor's last known address, as the app reads them, and on a job under
 * a GC both are the GC. A residential property also needs the homestead
 * question answered, yes or no: the flag is false by default, and nobody asked
 * must not read as no. The same draft → approve → file flow as notices;
 * "sent" means the affidavit was filed with the clerk.
 */

export type LienAffidavitRow = {
  job_id: string
  /** 'YYYY-MM' */
  last_month: string
  deadline: string
  is_sub: boolean
  noticed: boolean
  filed: boolean
  open_balance: number
  customer_id: string | null
  gc_customer_id: string | null
  property_kind: string
  has_owner: boolean
  has_legal: boolean
  homestead: boolean
  /**
   * Whether the general contractor's customer row holds an address (punch list #305). Not from the RPC: the desk
   * fills it from the GC rows it reads (`withContractorAddress`). Absent, nobody read the row and the gate does
   * not judge, as on the firm's portal.
   */
  has_contractor_address?: boolean | null
  /**
   * Whether a person answered the homestead question on the job's property record (punch list #305, migration
   * 20261111160000). Not from the RPC: the desk fills it from the property rows it reads (`withHomesteadAnswer`).
   * Absent, nobody read the answer and the gate does not judge, as before the migration is pushed.
   */
  homestead_answered?: boolean | null
  desk_item_id: string | null
  desk_status: string | null
  /** 'job_created' when the job has no approved hours and last_month is its creation month (v2.3747). Absent on an older RPC. */
  month_source?: LienMonthSource | null
}

export type LienAffidavitPile = 'needs_property' | 'to_draft' | 'awaiting' | 'ready' | 'held' | 'filed' | 'missed'

export const LIEN_AFFIDAVIT_PILES: ReadonlyArray<{ key: LienAffidavitPile; label: string }> = [
  { key: 'needs_property', label: 'Needs the property facts' },
  { key: 'to_draft', label: 'To draft' },
  { key: 'awaiting', label: 'Awaiting approval' },
  { key: 'ready', label: 'Ready to file' },
  { key: 'held', label: 'Held' },
  { key: 'filed', label: 'Filed · 30d' },
  { key: 'missed', label: 'Missed' },
]

export type LienAffidavitGateKey = 'owner' | 'legal' | 'contractor' | 'notice' | 'homestead' | 'homestead_answer'

export type LienAffidavitGate = { key: LienAffidavitGateKey; ok: boolean; label: string }

/**
 * The words of the contractor's-address gate, one place for the desk's list and the Lien window's tab (punch list
 * #305). On a job under a general contractor the paper names that contractor as the hiring party and the original
 * contractor, with its last known address (§ 53.054(a)(4) and (a)(5), the app's reading). On a job contracted with
 * the owner the hiring party is the owner, whose mailing address the owner gate already needs, and the original
 * contractor is our own company. `hasAddress` absent means nobody read the GC's row: the gate does not judge.
 */
export function contractorAddressGate(f: { isSub: boolean; hasAddress: boolean | null | undefined }): LienAffidavitGate {
  if (!f.isSub) return { key: 'contractor', ok: true, label: 'No general contractor to name (contracted with the owner)' }
  if (f.hasAddress === false) return { key: 'contractor', ok: false, label: 'The general contractor has no address on its customer record. The affidavit gives its last known address (§ 53.054)' }
  return { key: 'contractor', ok: true, label: "The general contractor's last known address" }
}

/**
 * The homestead slot of the gate list (punch list #305), one line with three answers. Marked homestead: the hold
 * that was always there, the attorney's (`homestead`). A residential property nobody answered for: a hold of its
 * own (`homestead_answer`), cleared by a yes or a no on the property record; a yes then holds as a homestead.
 * Otherwise *Not a homestead*. The key says which hold it is, so what reads `homestead` (the courtesy notice, the
 * share) never takes an unanswered question for a homestead.
 */
export function homesteadGate(f: { homestead: boolean; propertyKind: string | null | undefined; answered: boolean | null | undefined }): LienAffidavitGate {
  if (f.homestead) return { key: 'homestead', ok: false, label: 'Homestead — lien rights need a pre-work contract signed by both spouses and recorded (§ 53.254); talk to your attorney' }
  if (homesteadQuestionOpen(f)) return { key: 'homestead_answer', ok: false, label: HOMESTEAD_QUESTION_GATE_LABEL }
  return { key: 'homestead', ok: true, label: 'Not a homestead' }
}

/** A closed gate in the list row's *missing …* words: the gate's own key, except the contractor's, which is its address, and the homestead question's, which is its answer. */
export function affidavitGateMissingWord(key: LienAffidavitGateKey): string {
  return key === 'contractor' ? "the GC's address" : key === 'homestead_answer' ? 'the homestead answer' : key
}

/**
 * A row with the homestead answer filled from the property rows the desk read: the job's linked record, by the
 * link the RPC joins on (`jobs_ledger.customer_address_id`). A job with no linked record, or whose record was not
 * read, is left as it was, and so is every row when the records do not carry the column yet.
 */
export function withHomesteadAnswer<R extends Pick<LienAffidavitRow, 'job_id'>>(rows: ReadonlyArray<R>, addressIdByJob: Readonly<Record<string, string | null | undefined>>, addressesById: Readonly<Record<string, unknown>>): Array<R & { homestead_answered?: boolean | null }> {
  return rows.map((r) => {
    const addressId = addressIdByJob[r.job_id]
    const answered = addressId ? homesteadAnsweredOnRow(addressesById[addressId]) : null
    return answered == null ? { ...r } : { ...r, homestead_answered: answered }
  })
}

/** A row with the GC's address fact filled from the GC rows the desk read. A job with no GC is left as it was. */
export function withContractorAddress<R extends Pick<LienAffidavitRow, 'gc_customer_id'>>(rows: ReadonlyArray<R>, gcAddressById: Readonly<Record<string, { address?: string | null } | undefined>>): Array<R & { has_contractor_address?: boolean | null }> {
  return rows.map((r) => (r.gc_customer_id ? { ...r, has_contractor_address: Boolean((gcAddressById[r.gc_customer_id]?.address ?? '').trim()) } : { ...r }))
}

export type LienAffidavitEntry = {
  jobId: string
  isSub: boolean
  lastMonth: string
  /** last_month is the job's creation month — no approved hours (v2.3747). */
  lastMonthFromCreation: boolean
  /** last_month is the last day of work set by hand (v2.4676). */
  lastMonthByHand?: boolean
  deadline: string
  daysLeft: number
  severity: LienDeskSeverity
  openBalance: number
  customerId: string | null
  gcCustomerId: string | null
  propertyKind: string
  gates: LienAffidavitGate[]
  ready: boolean
  item: LienDeskItemRow | null
  pile: LienAffidavitPile
}

export type LienAffidavitQueue = {
  entries: LienAffidavitEntry[]
  piles: Record<LienAffidavitPile, LienAffidavitEntry[]>
  counts: Record<LienAffidavitPile, number>
}

const EMPTY = (): Record<LienAffidavitPile, LienAffidavitEntry[]> => ({ needs_property: [], to_draft: [], awaiting: [], ready: [], held: [], filed: [], missed: [] })

export function affidavitGates(r: Pick<LienAffidavitRow, 'is_sub' | 'noticed' | 'has_owner' | 'has_legal' | 'homestead' | 'has_contractor_address'> & Partial<Pick<LienAffidavitRow, 'property_kind' | 'homestead_answered'>>): LienAffidavitGate[] {
  return [
    { key: 'owner', ok: r.has_owner, label: 'Owner of record with a mailing address' },
    { key: 'legal', ok: r.has_legal, label: 'County + legal description on the property record' },
    contractorAddressGate({ isSub: r.is_sub, hasAddress: r.has_contractor_address }),
    { key: 'notice', ok: !r.is_sub || r.noticed, label: r.is_sub ? 'A § 53.056 notice recorded on the job — a late one counts while this window is open' : 'No monthly notice required (contracted with the owner)' },
    homesteadGate({ homestead: r.homestead, propertyKind: r.property_kind, answered: r.homestead_answered }),
  ]
}

function pileFor(item: LienDeskItemRow | null, ready: boolean, filed: boolean, daysLeft: number): LienAffidavitPile {
  if (item && item.voided_at == null) {
    switch (item.status) {
      case 'awaiting_approval':
        return 'awaiting'
      case 'approved':
        return 'ready'
      case 'held':
        return 'held'
      case 'sent':
        return 'filed'
      case 'missed':
        return 'missed'
      default:
        return ready ? 'to_draft' : 'needs_property'
    }
  }
  if (filed) return 'filed'
  if (daysLeft < 0) return 'missed'
  return ready ? 'to_draft' : 'needs_property'
}

export function buildLienAffidavitQueue(rows: ReadonlyArray<LienAffidavitRow>, items: ReadonlyArray<LienDeskItemRow>, todayYmd: string): LienAffidavitQueue {
  const live = new Map<string, LienDeskItemRow>()
  const sent = new Map<string, LienDeskItemRow>()
  for (const it of items) {
    if (it.kind !== 'affidavit' || it.voided_at) continue
    if (it.status === 'sent') {
      const age = it.sent_at ? (daysBetweenYmd(calendarYmdInAppTzFromIso(it.sent_at), todayYmd) ?? 0) : 0
      if (age <= LIEN_DESK_SENT_DAYS) sent.set(it.job_id, it)
    } else if (it.status !== 'missed') {
      const prev = live.get(it.job_id)
      if (!prev || it.created_at > prev.created_at) live.set(it.job_id, it)
    }
  }
  const entries: LienAffidavitEntry[] = []
  for (const r of rows) {
    const item = live.get(r.job_id) ?? sent.get(r.job_id) ?? null
    const gates = affidavitGates(r)
    const ready = gates.every((g) => g.ok)
    const daysLeft = daysBetweenYmd(todayYmd, r.deadline) ?? 0
    const filed = r.filed || (item?.status === 'sent')
    if (filed && !sent.has(r.job_id) && !live.has(r.job_id) && r.filed) continue // filed long ago, nothing to show
    const pile = pileFor(item, ready, filed, daysLeft)
    entries.push({
      jobId: r.job_id,
      isSub: r.is_sub,
      lastMonth: r.last_month,
      lastMonthFromCreation: monthFromCreation(r),
      lastMonthByHand: monthSetByHand(r),
      deadline: r.deadline,
      daysLeft,
      severity: pile === 'filed' ? 'quiet' : severityForDaysLeft(daysLeft),
      openBalance: Number(r.open_balance) || 0,
      customerId: r.customer_id,
      gcCustomerId: r.gc_customer_id,
      propertyKind: r.property_kind,
      gates,
      ready,
      item,
      pile,
    })
  }
  entries.sort((a, b) => (a.deadline !== b.deadline ? (a.deadline < b.deadline ? -1 : 1) : b.openBalance - a.openBalance))
  const piles = EMPTY()
  for (const e of entries) piles[e.pile].push(e)
  const counts = Object.fromEntries(Object.entries(piles).map(([k, v]) => [k, v.length])) as Record<LienAffidavitPile, number>
  return { entries, piles, counts }
}
