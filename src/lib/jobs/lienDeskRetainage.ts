import { daysBetweenYmd } from './billedExpectedPay'
import { LIEN_DESK_SENT_DAYS, severityForDaysLeft, type LienDeskItemRow, type LienDeskSeverity } from './lienDesk'

/**
 * The Lien desk's third kind (pure kernel, v2.3753 — punch list #33, counsel's
 * memo of 2026-09-22): the § 53.057 notice of claim for unpaid retainage. One
 * per job, due 30 days after OUR contract on the job was completed, terminated
 * or abandoned (§ 53.057(b)). The job's facts come from Edit Job → *Our contract
 * on this job*: the retainage the GC holds back (`lien_retainage_held`) and the
 * day the contract ended. A job with retainage and no end date has no clock
 * yet — it sits in *Clock not started* so the office types the date the day
 * the work is done, not when the GC declares it. The same draft → approve →
 * send flow as notices; a sent one is a `retainage_53_057` filing.
 *
 * Counsel: the retainage is also named INSIDE the § 53.056 claim while the job
 * is open (`in_claim` — a recorded notice whose form carried the retainage line),
 * because an owner may withhold on a § 53.057 notice alone only once they
 * receive a copy of the filed affidavit (§ 53.081(c)).
 */

export type LienContractEndedHow = 'complete' | 'terminated' | 'abandoned'

export const LIEN_CONTRACT_ENDED_HOW: ReadonlyArray<{ key: LienContractEndedHow; label: string; words: string }> = [
  { key: 'complete', label: 'Complete', words: 'complete' },
  { key: 'terminated', label: 'Terminated', words: 'terminated' },
  { key: 'abandoned', label: 'Abandoned', words: 'abandoned' },
]

export function parseContractEndedHow(v: unknown): LienContractEndedHow | null {
  return v === 'complete' || v === 'terminated' || v === 'abandoned' ? v : null
}

export type LienPaymentBond = 'yes' | 'no' | 'unknown'

export function parsePaymentBond(v: unknown): LienPaymentBond {
  return v === 'yes' || v === 'no' ? v : 'unknown'
}

/** "bond: unknown" / "no payment bond" / "payment bond on the project" — one wording. */
export function paymentBondWords(b: LienPaymentBond): string {
  return b === 'yes' ? 'payment bond on the project' : b === 'no' ? 'no payment bond' : 'bond: unknown'
}

export type LienRetainageRow = {
  job_id: string
  retainage_held: number
  /** 'YYYY-MM-DD' or null while the contract is open. */
  contract_ended_on: string | null
  contract_ended_how: string | null
  /** 'YYYY-MM-DD' — 30 days after the contract ended, weekend-rolled; null while open. */
  deadline: string | null
  /** A live § 53.057 filing is recorded on the job. */
  noticed: boolean
  /** A recorded § 53.056 notice already named this retainage inside its claim. */
  in_claim: boolean
  open_balance: number
  customer_id: string | null
  gc_customer_id: string | null
  property_kind: string
  has_owner: boolean
  payment_bond: string
  desk_item_id: string | null
  desk_status: string | null
}

export type LienRetainagePile = 'clock_not_started' | 'needs_owner' | 'to_draft' | 'awaiting' | 'ready' | 'held' | 'sent' | 'missed'

export const LIEN_RETAINAGE_PILES: ReadonlyArray<{ key: LienRetainagePile; label: string }> = [
  { key: 'clock_not_started', label: 'Clock not started' },
  { key: 'needs_owner', label: 'Needs the owner' },
  { key: 'to_draft', label: 'To draft' },
  { key: 'awaiting', label: 'Awaiting approval' },
  { key: 'ready', label: 'Ready to send' },
  { key: 'held', label: 'Held' },
  { key: 'sent', label: 'Sent · 30d' },
  { key: 'missed', label: 'Missed' },
]

export type LienRetainageGateKey = 'owner' | 'gc' | 'contract_ended' | 'retainage'

export type LienRetainageGate = { key: LienRetainageGateKey; ok: boolean; label: string }

export type LienRetainageEntry = {
  jobId: string
  retainageHeld: number
  contractEndedOn: string | null
  contractEndedHow: LienContractEndedHow | null
  deadline: string | null
  /** Whole days to the deadline; null while the clock has not started. */
  daysLeft: number | null
  severity: LienDeskSeverity
  noticed: boolean
  inClaim: boolean
  openBalance: number
  customerId: string | null
  gcCustomerId: string | null
  propertyKind: string
  hasOwner: boolean
  paymentBond: LienPaymentBond
  gates: LienRetainageGate[]
  ready: boolean
  item: LienDeskItemRow | null
  pile: LienRetainagePile
}

export type LienRetainageQueue = {
  entries: LienRetainageEntry[]
  piles: Record<LienRetainagePile, LienRetainageEntry[]>
  counts: Record<LienRetainagePile, number>
}

export const EMPTY_LIEN_RETAINAGE_QUEUE = (): LienRetainageQueue => ({
  entries: [],
  piles: { clock_not_started: [], needs_owner: [], to_draft: [], awaiting: [], ready: [], held: [], sent: [], missed: [] },
  counts: { clock_not_started: 0, needs_owner: 0, to_draft: 0, awaiting: 0, ready: 0, held: 0, sent: 0, missed: 0 },
})

export function retainageGates(r: Pick<LienRetainageRow, 'has_owner' | 'gc_customer_id' | 'contract_ended_on' | 'retainage_held'>): LienRetainageGate[] {
  return [
    { key: 'owner', ok: r.has_owner, label: 'Owner of record with a mailing address' },
    { key: 'gc', ok: Boolean(r.gc_customer_id), label: 'Original contractor on the job' },
    { key: 'contract_ended', ok: Boolean(r.contract_ended_on), label: r.contract_ended_on ? 'Our contract on the job has ended — the 30-day clock is running' : 'Our contract on the job has not ended — no clock yet' },
    { key: 'retainage', ok: r.retainage_held > 0, label: r.retainage_held > 0 ? 'Retainage the GC holds is recorded on the job' : 'No retainage recorded on the job' },
  ]
}

/** "complete Sep 3" / "terminated Sep 3" — the row's and the paper's words for how the clock started. */
export function contractEndedWords(how: LienContractEndedHow | null, endedOn: string | null, formatDay: (ymd: string) => string): string {
  if (!endedOn || !how) return 'our contract still open'
  return `${LIEN_CONTRACT_ENDED_HOW.find((h) => h.key === how)?.words ?? how} ${formatDay(endedOn)}`
}

function pileFor(item: LienDeskItemRow | null, r: LienRetainageRow, ready: boolean, daysLeft: number | null, sentRecently: boolean): LienRetainagePile {
  if (item && item.voided_at == null) {
    switch (item.status) {
      case 'awaiting_approval':
        return 'awaiting'
      case 'approved':
        return 'ready'
      case 'held':
        return 'held'
      case 'sent':
        return 'sent'
      case 'missed':
        return 'missed'
      default:
        break
    }
  }
  if (r.noticed || sentRecently) return 'sent'
  if (!r.contract_ended_on) return 'clock_not_started'
  if (daysLeft != null && daysLeft < 0) return 'missed'
  if (!r.has_owner) return 'needs_owner'
  return ready ? 'to_draft' : 'needs_owner'
}

/**
 * Fold the RPC rows and the stored items into one entry per job. A job with a
 * live or recently sent `retainage_53_057` item but no row (its retainage was
 * cleared after the notice went out) still shows in Sent for LIEN_DESK_SENT_DAYS.
 */
export function buildLienRetainageQueue(rows: ReadonlyArray<LienRetainageRow>, items: ReadonlyArray<LienDeskItemRow>, todayYmd: string): LienRetainageQueue {
  const live = new Map<string, LienDeskItemRow>()
  const sent = new Map<string, LienDeskItemRow>()
  for (const it of items) {
    if (it.kind !== 'retainage_53_057' || it.voided_at) continue
    if (it.status === 'sent') {
      const age = it.sent_at ? (daysBetweenYmd(it.sent_at.slice(0, 10), todayYmd) ?? 0) : 0
      if (age <= LIEN_DESK_SENT_DAYS) {
        const prev = sent.get(it.job_id)
        if (!prev || (it.sent_at ?? '') > (prev.sent_at ?? '')) sent.set(it.job_id, it)
      }
    } else if (it.status !== 'missed') {
      const prev = live.get(it.job_id)
      if (!prev || it.created_at > prev.created_at) live.set(it.job_id, it)
    }
  }
  const entries: LienRetainageEntry[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    seen.add(r.job_id)
    const item = live.get(r.job_id) ?? sent.get(r.job_id) ?? null
    const gates = retainageGates(r)
    const ready = gates.every((g) => g.ok)
    const daysLeft = r.deadline ? (daysBetweenYmd(todayYmd, r.deadline) ?? 0) : null
    const sentRecently = sent.has(r.job_id)
    // A notice recorded long ago (no recent item) is done — nothing to show.
    if (r.noticed && !sentRecently && !live.has(r.job_id)) continue
    const pile = pileFor(item, r, ready, daysLeft, sentRecently)
    entries.push({
      jobId: r.job_id,
      retainageHeld: Number(r.retainage_held) || 0,
      contractEndedOn: r.contract_ended_on,
      contractEndedHow: parseContractEndedHow(r.contract_ended_how),
      deadline: r.deadline,
      daysLeft,
      severity: pile === 'sent' || pile === 'clock_not_started' ? 'quiet' : severityForDaysLeft(daysLeft),
      noticed: r.noticed,
      inClaim: r.in_claim,
      openBalance: Number(r.open_balance) || 0,
      customerId: r.customer_id,
      gcCustomerId: r.gc_customer_id,
      propertyKind: r.property_kind,
      hasOwner: r.has_owner,
      paymentBond: parsePaymentBond(r.payment_bond),
      gates,
      ready,
      item,
      pile,
    })
  }
  // Sent items whose row is gone (retainage cleared or paid since) stay listed for the record.
  for (const [jobId, it] of sent) {
    if (seen.has(jobId)) continue
    entries.push({
      jobId,
      retainageHeld: 0,
      contractEndedOn: null,
      contractEndedHow: null,
      deadline: null,
      daysLeft: null,
      severity: 'quiet',
      noticed: true,
      inClaim: false,
      openBalance: 0,
      customerId: null,
      gcCustomerId: null,
      propertyKind: '',
      hasOwner: true,
      paymentBond: 'unknown',
      gates: [],
      ready: false,
      item: it,
      pile: 'sent',
    })
  }
  entries.sort((a, b) => {
    const ad = a.deadline ?? '9999'
    const bd = b.deadline ?? '9999'
    if (ad !== bd) return ad < bd ? -1 : 1
    return b.retainageHeld - a.retainageHeld
  })
  const piles = EMPTY_LIEN_RETAINAGE_QUEUE().piles
  for (const e of entries) piles[e.pile].push(e)
  const counts = Object.fromEntries(Object.entries(piles).map(([k, v]) => [k, v.length])) as Record<LienRetainagePile, number>
  return { entries, piles, counts }
}

/** "mail by Oct 3 · 9 days left" / "due today" / "window closed" / "clock not started" — the chip on a retainage row. */
export function retainageDeadlineWords(e: Pick<LienRetainageEntry, 'deadline' | 'daysLeft'>, formatDay: (ymd: string) => string): string {
  if (!e.deadline || e.daysLeft == null) return 'clock not started'
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'mail today'
  if (e.daysLeft === 1) return 'mail by tomorrow'
  if (e.daysLeft <= 14) return `mail in ${e.daysLeft}d`
  return `mail by ${formatDay(e.deadline)}`
}
