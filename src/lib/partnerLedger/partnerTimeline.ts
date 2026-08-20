/**
 * Partner timeline kernel (owner-approved mockup, 2026-08-20): merges the
 * money journal with the accountability trails into ONE dated stream —
 * labor / payouts / profit shares / charges inline with NCNS incidents,
 * work-order declines, job check-offs, and statement generations.
 *
 * Dev-only lens: the partner's own surfaces never render these rows (NCNS and
 * declines in particular). Money rows carry the running balance from the
 * journal; event rows and pending charges sit inline without touching it.
 */

import type { JournalRow } from './partnerLedgerJournal'

export type PartnerTimelineKind =
  | 'labor'
  | 'addition'
  | 'deduction'
  | 'payout'
  | 'charge_pending'
  | 'ncns'
  | 'decline'
  | 'job'
  | 'stmt'

export type PartnerTimelineRow = {
  /** ymd the row sorts under */
  date: string
  kind: PartnerTimelineKind
  label: string
  sub: string | null
  /** signed; null for event rows */
  amount: number | null
  /** running balance AFTER this posting; null for events/pending */
  balance: number | null
}

export type PartnerTimelineFilter = 'all' | 'money' | 'infractions' | 'events'

export type TimelineEventInputs = {
  pendingCharges: { type: string; amount: number; occurred_date: string; description: string | null }[]
  ncns: { work_date: string; details: string | null }[]
  declines: { declined_at: string | null; decline_reason: string | null; amount: number | null }[]
  confirmedJobs: { label: string; confirmed_at: string | null }[]
  statements: { period_start: string; period_end: string; partner_ack_at: string | null; company_ack_at: string | null }[]
}

const FILTER_KINDS: Record<Exclude<PartnerTimelineFilter, 'all'>, Set<PartnerTimelineKind>> = {
  money: new Set(['labor', 'addition', 'deduction', 'payout', 'charge_pending']),
  infractions: new Set(['deduction', 'charge_pending', 'ncns', 'decline']),
  events: new Set(['job', 'stmt']),
}

/** Same-date ordering: money postings first (journal order), then events. */
const KIND_ORDER: Record<PartnerTimelineKind, number> = {
  labor: 0,
  addition: 1,
  deduction: 2,
  payout: 3,
  charge_pending: 4,
  stmt: 5,
  job: 6,
  ncns: 7,
  decline: 8,
}

const CHARGE_LABELS: Record<string, string> = {
  backcharge: 'Back-charge',
  damage: 'Damage',
  utility_overage: 'Utility overage',
  profit_share: 'Profit share',
  employee_credit: 'Credit',
}

export function chargeTypeLabel(type: string): string {
  return CHARGE_LABELS[type] ?? type
}

/**
 * Merge journal + events, newest first. Journal rows arrive oldest-first with
 * running balances (partnerLedgerJournal); their relative order is preserved.
 */
export function buildPartnerTimeline(journal: JournalRow[], events: TimelineEventInputs): PartnerTimelineRow[] {
  const rows: (PartnerTimelineRow & { seq: number })[] = []
  journal.forEach((j, i) => {
    rows.push({
      date: j.date,
      kind: j.kind,
      label: j.label,
      sub: j.detail,
      amount: j.amount,
      balance: j.balance,
      seq: i,
    })
  })
  for (const c of events.pendingCharges) {
    const positive = c.type === 'profit_share' || c.type === 'employee_credit'
    rows.push({
      date: c.occurred_date,
      kind: 'charge_pending',
      label: `${chargeTypeLabel(c.type)}${c.description ? ` — ${c.description}` : ''}`,
      sub: 'pending · attaches to the next statement',
      amount: positive ? c.amount : -Math.abs(c.amount),
      balance: null,
      seq: 0,
    })
  }
  for (const n of events.ncns) {
    rows.push({
      date: n.work_date,
      kind: 'ncns',
      label: 'No Call No Show',
      sub: n.details?.trim() ? n.details : 'no details recorded — logged in Write-ups',
      amount: null,
      balance: null,
      seq: 0,
    })
  }
  for (const d of events.declines) {
    if (!d.declined_at) continue
    rows.push({
      date: d.declined_at.slice(0, 10),
      kind: 'decline',
      label: `Declined work order${d.decline_reason?.trim() ? ` — “${d.decline_reason}”` : ''}`,
      sub: d.amount != null ? `$${Number(d.amount).toLocaleString('en-US')} offer · Sub Board` : 'Sub Board',
      amount: null,
      balance: null,
      seq: 0,
    })
  }
  for (const j of events.confirmedJobs) {
    if (!j.confirmed_at) continue
    rows.push({
      date: j.confirmed_at.slice(0, 10),
      kind: 'job',
      label: `Job #${j.label} confirmed as partner-majority`,
      sub: 'now visible to the partner',
      amount: null,
      balance: null,
      seq: 0,
    })
  }
  for (const s of events.statements) {
    rows.push({
      date: s.period_end,
      kind: 'stmt',
      label: `Statement generated (week of ${s.period_start})`,
      sub:
        s.partner_ack_at != null
          ? 'acknowledged by both'
          : s.company_ack_at != null
            ? 'company ✓ · awaiting partner'
            : 'no acknowledgments yet',
      amount: null,
      balance: null,
      seq: 0,
    })
  }
  rows.sort(
    (a, b) => b.date.localeCompare(a.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.seq - b.seq,
  )
  return rows.map(({ seq: _seq, ...r }) => r)
}

export function filterPartnerTimeline(rows: PartnerTimelineRow[], filter: PartnerTimelineFilter): PartnerTimelineRow[] {
  if (filter === 'all') return rows
  const kinds = FILTER_KINDS[filter]
  return rows.filter((r) => kinds.has(r.kind))
}
