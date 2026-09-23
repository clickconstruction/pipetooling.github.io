import { daysBetweenYmd } from './billedExpectedPay'
import { LIEN_DESK_SENT_DAYS, severityForDaysLeft, type LienDeskItemRow, type LienDeskSeverity } from './lienDesk'
import { monthFromCreation, type LienMonthSource } from './lienDesk'

/**
 * The Lien desk's second kind (pure kernel): the § 53.052 affidavit — one
 * date per job, the 15th of the 4th month after the LAST month worked (3rd
 * residential). Sub jobs need a recorded § 53.056 notice first; every job
 * needs the owner of record, the county and legal description, and must not
 * be a homestead (§ 53.254 — attorney territory). The same draft → approve →
 * file flow as notices; "sent" means the affidavit was filed with the clerk.
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

export type LienAffidavitGate = { key: 'owner' | 'legal' | 'notice' | 'homestead'; ok: boolean; label: string }

export type LienAffidavitEntry = {
  jobId: string
  isSub: boolean
  lastMonth: string
  /** last_month is the job's creation month — no approved hours (v2.3747). */
  lastMonthFromCreation: boolean
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

export function affidavitGates(r: Pick<LienAffidavitRow, 'is_sub' | 'noticed' | 'has_owner' | 'has_legal' | 'homestead'>): LienAffidavitGate[] {
  return [
    { key: 'owner', ok: r.has_owner, label: 'Owner of record with a mailing address' },
    { key: 'legal', ok: r.has_legal, label: 'County + legal description on the property record' },
    { key: 'notice', ok: !r.is_sub || r.noticed, label: r.is_sub ? 'A § 53.056 notice recorded on the job' : 'No monthly notice required (contracted with the owner)' },
    { key: 'homestead', ok: !r.homestead, label: r.homestead ? 'Homestead — lien rights need a pre-work contract signed by both spouses and recorded (§ 53.254); talk to your attorney' : 'Not a homestead' },
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
      const age = it.sent_at ? (daysBetweenYmd(it.sent_at.slice(0, 10), todayYmd) ?? 0) : 0
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
