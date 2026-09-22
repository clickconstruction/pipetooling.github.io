import type { Database } from '../../types/database'
import { daysBetweenYmd } from './billedExpectedPay'
import { NOTICE_CLOSING_DAYS, NOTICE_DUE_DAYS } from './forecastWorkMonths'
import { ownerKind } from './ownerConfirm'

/**
 * The Lien desk (pure kernel): the queue of § 53.056 notices the law says
 * are due per unpaid work month on sub jobs, and where each job sits in it.
 *
 * "Due" is derived — the `list_lien_notice_months()` RPC hands back every
 * (sub job, approved work month) with money open inside the lead window; a
 * `job_lien_desk_items` row exists only from `drafted` on. This kernel folds
 * the two into one entry per job with a pile, a severity, the months a
 * notice would name, and the reason a leader is being asked (or not).
 */

export type LienNoticeMonthRow = {
  job_id: string
  /** 'YYYY-MM' */
  work_month: string
  approved_hours: number
  /** 'YYYY-MM-DD' — the statutory deadline, weekend-rolled. */
  deadline: string
  /** A live notice on the job already names this month. */
  noticed: boolean
  open_balance: number
  customer_id: string | null
  gc_customer_id: string | null
  property_kind: string
  /** An owner of record with a mailing address is on file (job override or property record). */
  has_owner: boolean
  desk_item_id: string | null
  desk_status: string | null
  desk_months: string[] | null
}

export type LienDeskItemRow = Database['public']['Tables']['job_lien_desk_items']['Row']

export type LienNoticePolicy = 'ask' | 'send' | 'hold'

export const LIEN_NOTICE_POLICIES: ReadonlyArray<{ key: LienNoticePolicy; label: string; hint: string }> = [
  { key: 'ask', label: 'Ask me each time', hint: 'Every notice for this GC comes to you before it goes out.' },
  { key: 'send', label: 'Send notices without asking', hint: 'From the second notice on — the first one to a GC always comes to you. The office sends on schedule; you see each send in your FYI list.' },
  { key: 'hold', label: "Hold — I'll call first", hint: 'Every month parks until you say so; the desk re-asks three days before each deadline.' },
]

export function parseLienNoticePolicy(v: unknown): LienNoticePolicy {
  return v === 'send' || v === 'hold' ? v : 'ask'
}

export type LienDeskPile = 'needs_owner' | 'to_draft' | 'awaiting' | 'ready' | 'held' | 'sent' | 'missed'

export const LIEN_DESK_PILES: ReadonlyArray<{ key: LienDeskPile; label: string }> = [
  { key: 'needs_owner', label: 'Needs the owner' },
  { key: 'to_draft', label: 'To draft' },
  { key: 'awaiting', label: 'Awaiting approval' },
  { key: 'ready', label: 'Ready to send' },
  { key: 'held', label: 'Held' },
  { key: 'sent', label: 'Sent · 30d' },
  { key: 'missed', label: 'Missed' },
]

export type LienDeskSeverity = 'red' | 'amber' | 'quiet'

export type LienDeskMonth = {
  key: string
  approvedHours: number
  deadline: string
  /** Whole days from today to the deadline (negative once past). */
  daysLeft: number
  noticed: boolean
}

export type LienDeskEntry = {
  jobId: string
  customerId: string | null
  gcCustomerId: string | null
  openBalance: number
  hasOwner: boolean
  propertyKind: string
  /** Every month the RPC returned for the job, chronological. */
  months: LienDeskMonth[]
  /** Unnoticed months whose window is still open — what a new notice would name. */
  dueMonths: string[]
  /** Unnoticed months whose window closed — the RPC keeps one a week, or until someone records it if nothing has been (v2.3680). */
  missedMonths: string[]
  /** Of those, the ones nobody has recorded — no skip, no noted miss (v2.3679). These are the silent losses the Dashboard names. */
  missedUnrecorded: string[]
  /** Earliest open deadline among `dueMonths` (or the item's months), null when none. */
  earliestDeadline: string | null
  daysLeft: number | null
  severity: LienDeskSeverity
  item: LienDeskItemRow | null
  policy: LienNoticePolicy
  pile: LienDeskPile
}

export type LienDeskQueue = {
  entries: LienDeskEntry[]
  piles: Record<LienDeskPile, LienDeskEntry[]>
  counts: Record<LienDeskPile, number>
}

/** How far ahead the desk looks (certified mail and the owner lookup take days). */
export const LIEN_DESK_LEAD_DAYS = 30
/** Sent items stay listed this long. */
export const LIEN_DESK_SENT_DAYS = 30
/** A held item re-asks this many days before the earliest deadline. */
export const LIEN_DESK_HOLD_REASK_DAYS = 3

const EMPTY_PILES = (): Record<LienDeskPile, LienDeskEntry[]> => ({
  needs_owner: [],
  to_draft: [],
  awaiting: [],
  ready: [],
  held: [],
  sent: [],
  missed: [],
})

export function severityForDaysLeft(daysLeft: number | null): LienDeskSeverity {
  if (daysLeft == null) return 'quiet'
  if (daysLeft <= NOTICE_DUE_DAYS) return 'red'
  if (daysLeft <= NOTICE_CLOSING_DAYS) return 'amber'
  return 'quiet'
}

function ymdShift(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) + days * 86_400_000).toISOString().slice(0, 10)
}

function itemIsLive(item: LienDeskItemRow): boolean {
  return item.voided_at == null && item.status !== 'sent' && item.status !== 'missed'
}

function pileForItem(item: LienDeskItemRow, hasOwner: boolean): LienDeskPile {
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
      return hasOwner ? 'to_draft' : 'needs_owner'
  }
}

/**
 * Fold the RPC rows and the stored items into one entry per job. Jobs whose
 * every month is already noticed and that have no live item are left out —
 * nothing to do. `items` may include sent rows: those stay for
 * LIEN_DESK_SENT_DAYS after `sent_at`.
 */
export function buildLienDeskQueue(
  rows: ReadonlyArray<LienNoticeMonthRow>,
  items: ReadonlyArray<LienDeskItemRow>,
  policyByCustomer: Readonly<Record<string, LienNoticePolicy>>,
  todayYmd: string,
): LienDeskQueue {
  const byJob = new Map<string, LienNoticeMonthRow[]>()
  for (const r of rows) {
    const list = byJob.get(r.job_id) ?? []
    list.push(r)
    byJob.set(r.job_id, list)
  }
  const itemByJob = new Map<string, LienDeskItemRow>()
  const sentByJob = new Map<string, LienDeskItemRow>()
  for (const it of items) {
    if (it.kind !== 'notice_53_056' || it.voided_at) continue
    if (itemIsLive(it)) {
      const prev = itemByJob.get(it.job_id)
      if (!prev || it.created_at > prev.created_at) itemByJob.set(it.job_id, it)
    } else if (it.status === 'sent' && it.sent_at) {
      const age = daysBetweenYmd(it.sent_at.slice(0, 10), todayYmd) ?? 0
      if (age <= LIEN_DESK_SENT_DAYS) {
        const prev = sentByJob.get(it.job_id)
        if (!prev || it.sent_at > (prev.sent_at ?? '')) sentByJob.set(it.job_id, it)
      }
    }
  }
  // A closed window someone recorded — a skip, or a noted miss (v2.3679) — is no longer silent.
  const recordedClosedByJob = new Map<string, Set<string>>()
  for (const it of items) {
    if (it.kind !== 'notice_53_056' || it.voided_at || it.status !== 'missed') continue
    const set = recordedClosedByJob.get(it.job_id) ?? new Set<string>()
    for (const m of it.months) set.add(m)
    recordedClosedByJob.set(it.job_id, set)
  }
  const entries: LienDeskEntry[] = []
  const jobIds = new Set<string>([...byJob.keys(), ...itemByJob.keys(), ...sentByJob.keys()])
  for (const jobId of jobIds) {
    const jobRows = (byJob.get(jobId) ?? []).slice().sort((a, b) => (a.work_month < b.work_month ? -1 : 1))
    const first = jobRows[0]
    const months: LienDeskMonth[] = jobRows.map((r) => ({
      key: r.work_month,
      approvedHours: Number(r.approved_hours) || 0,
      deadline: r.deadline,
      daysLeft: daysBetweenYmd(todayYmd, r.deadline) ?? 0,
      noticed: r.noticed,
    }))
    const dueMonths = months.filter((m) => !m.noticed && m.daysLeft >= 0).map((m) => m.key)
    const missedMonths = months.filter((m) => !m.noticed && m.daysLeft < 0).map((m) => m.key)
    const missedUnrecorded = missedMonths.filter((m) => !recordedClosedByJob.get(jobId)?.has(m))
    const item = itemByJob.get(jobId) ?? sentByJob.get(jobId) ?? null
    const hasOwner = first?.has_owner ?? false
    const customerId = first?.customer_id ?? item?.job_id ?? null
    const gcCustomerId = first?.gc_customer_id ?? null
    const policy = parseLienNoticePolicy(gcCustomerId ? policyByCustomer[gcCustomerId] : undefined)
    // The deadline the entry is judged by: the item's months when it has
    // them (a draft names its months), else what a new notice would name.
    const named = item && itemIsLive(item) && item.months.length > 0 ? item.months : dueMonths
    const deadlines = months.filter((m) => named.includes(m.key)).map((m) => m.deadline)
    const earliestDeadline = deadlines.length ? deadlines.slice().sort()[0]! : null
    const daysLeft = earliestDeadline ? daysBetweenYmd(todayYmd, earliestDeadline) : null
    let pile: LienDeskPile
    if (item && itemIsLive(item)) pile = pileForItem(item, hasOwner)
    else if (item && item.status === 'sent') pile = 'sent'
    else if (dueMonths.length > 0) pile = hasOwner ? 'to_draft' : 'needs_owner'
    else if (missedMonths.length > 0) pile = 'missed'
    else continue
    entries.push({
      jobId,
      customerId,
      gcCustomerId,
      openBalance: Number(first?.open_balance ?? 0) || 0,
      hasOwner,
      propertyKind: first?.property_kind ?? '',
      months,
      dueMonths,
      missedMonths,
      missedUnrecorded,
      earliestDeadline,
      daysLeft,
      severity: pile === 'sent' ? 'quiet' : severityForDaysLeft(daysLeft),
      item,
      policy,
      pile,
    })
  }
  entries.sort((a, b) => {
    const ad = a.earliestDeadline ?? '9999'
    const bd = b.earliestDeadline ?? '9999'
    if (ad !== bd) return ad < bd ? -1 : 1
    return b.openBalance - a.openBalance
  })
  const piles = EMPTY_PILES()
  for (const e of entries) piles[e.pile].push(e)
  const counts = Object.fromEntries(Object.entries(piles).map(([k, v]) => [k, v.length])) as Record<LienDeskPile, number>
  // Missed is a lens, not only a pile (v2.3679): a job with open months and a closed one sits in To draft, and the count still names it.
  counts.missed = entries.filter((e) => e.pile === 'missed' || e.missedMonths.length > 0).length
  return { entries, piles, counts }
}

// ---------- who may do what (v2.3470: one home; the desk and the affidavit pane read these) ----------

/** The leader: approves, holds, sets a standing rule. */
export function isLienLeader(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician'
}
/** The office: drafts, sends for approval, skips, runs. A master is office too. */
export function isLienOffice(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}
/** Records the leader's spoken word. Deliberately not the master — he clicks Approve instead. */
export function canSendLienOnWord(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'assistant' || role === 'controller'
}

// ---------- the leader's decision ----------

export type LienAskReason = 'no_rule' | 'first_notice' | 'promise_live' | 'held_before' | 'claim_by_hand'

export const LIEN_ASK_REASON_LABELS: Record<LienAskReason, string> = {
  no_rule: 'no standing rule for this GC yet',
  first_notice: "first notice we've sent this GC",
  promise_live: 'they promised a payment date',
  held_before: 'you held this GC before',
  claim_by_hand: 'the claim is set by hand (v2.3682) — over the balance, or carried and not looked at since the last notice',
}

export type LienSubmitOutcome =
  | { status: 'approved'; approval_mode: 'rule' }
  | { status: 'awaiting_approval'; reason: LienAskReason }
  | { status: 'held'; hold_reason: 'rule'; hold_until: string }

/**
 * A "send" rule waits on a first notice (v2.3469): the rule only takes effect
 * once a notice to that GC has actually gone out and been recorded — the
 * office has then proved the owner, the addresses and the GC's copy on real
 * mail. Until then the desk asks the leader, naming the first notice as why.
 */
export function ruleWaitsOnFirstNotice(policy: LienNoticePolicy, gcHasPriorNotice: boolean): boolean {
  return policy === 'send' && !gcHasPriorNotice
}

/**
 * What submitting a draft does, given the GC's standing rule. A live promise
 * always comes back to the leader, even under "send" — the decision is
 * "paper, or their word"; so does the first notice we have ever sent the GC
 * (`ruleWaitsOnFirstNotice`). "hold" parks it with a re-ask date.
 */
export function submitOutcome(
  entry: Pick<LienDeskEntry, 'policy' | 'earliestDeadline'>,
  ctx: { promiseYmd: string | null; gcHasPriorNotice: boolean; gcHeldBefore: boolean },
  todayYmd: string,
): LienSubmitOutcome {
  if (entry.policy === 'hold') {
    return { status: 'held', hold_reason: 'rule', hold_until: holdUntilFor('call_first', entry.earliestDeadline, null, todayYmd) }
  }
  if (ctx.promiseYmd) return { status: 'awaiting_approval', reason: 'promise_live' }
  if (ruleWaitsOnFirstNotice(entry.policy, ctx.gcHasPriorNotice)) return { status: 'awaiting_approval', reason: 'first_notice' }
  if (entry.policy === 'send') return { status: 'approved', approval_mode: 'rule' }
  if (ctx.gcHeldBefore) return { status: 'awaiting_approval', reason: 'held_before' }
  if (!ctx.gcHasPriorNotice) return { status: 'awaiting_approval', reason: 'first_notice' }
  return { status: 'awaiting_approval', reason: 'no_rule' }
}

/**
 * When a held item comes back: on the promise date (if it lands before the
 * re-ask point), else LIEN_DESK_HOLD_REASK_DAYS before the earliest deadline,
 * never earlier than today.
 */
export function holdUntilFor(
  reason: 'promised' | 'call_first' | 'rule',
  earliestDeadline: string | null,
  promiseYmd: string | null,
  todayYmd: string,
): string {
  const reask = earliestDeadline ? ymdShift(earliestDeadline, -LIEN_DESK_HOLD_REASK_DAYS) : ymdShift(todayYmd, 7)
  const floor = reask < todayYmd ? todayYmd : reask
  if (reason === 'promised' && promiseYmd && promiseYmd < floor) return promiseYmd < todayYmd ? todayYmd : promiseYmd
  return floor
}

/** A held item whose hold_until has arrived is asked again. */
export function holdExpired(item: Pick<LienDeskItemRow, 'status' | 'hold_until'>, todayYmd: string): boolean {
  return item.status === 'held' && Boolean(item.hold_until) && (item.hold_until as string) <= todayYmd
}

// ---------- the Dashboard lines ----------

export type LienDeskNeedsYou = {
  office: {
    /** Jobs with a notice to draft (to_draft + needs_owner), and the months across them. */
    jobs: number
    months: number
    dollars: number
    needsOwner: number
    earliestDeadline: string | null
    /** Approved notices waiting for the run. */
    ready: number
    /** The next deadline on the office's pile (v2.3704) — what the Dashboard's one lien card leads with. */
    next: LienDeskNextDeadline
  }
  leader: {
    jobs: number
    dollars: number
    earliestDeadline: string | null
    /** Put a GC on notice (v2.3479): awaiting items the office prepared as one run per GC, one card each for the leader. Set by the hooks (`lienDeskBatches`). */
    batches?: LienDeskBatch[]
  }
  held: number
  /** Windows that closed with nothing recorded (v2.3679) — the loss the Dashboard names until someone notes it. */
  missed: {
    jobs: number
    months: number
    dollars: number
    /** One line per job, worst first; `label` is filled by the hook (the kernel has no job names). */
    lines: LienDeskMissedLine[]
  }
}

/** The office's next deadline (v2.3704): every drafting-pile job whose earliest window closes that day. `gcNames` is filled by the hook. */
export type LienDeskNextDeadline = {
  deadline: string | null
  notices: number
  dollars: number
  gcIds: string[]
  gcNames: string[]
  /** In To draft (drafting, or drafted and saved). */
  toDraft: number
  /** Still waiting on the owner of record. */
  needsOwner: number
}

/** A job with a closed, unrecorded window — the Dashboard's line and the desk's deep link (v2.3679). */
export type LienDeskMissedLine = {
  jobId: string
  gcCustomerId: string | null
  months: string[]
  openBalance: number
  label: string
}

/** A run the office prepared for one GC and sent to the leader — every awaiting item carrying the same batch reason. */
export type LienDeskBatch = {
  gcId: string
  gcName: string
  jobs: number
  dollars: number
  reason: string
  earliestDeadline: string | null
}

export function summarizeLienDeskForNeedsYou(queue: LienDeskQueue): LienDeskNeedsYou {
  const draftPile = [...queue.piles.needs_owner, ...queue.piles.to_draft]
  const draftDeadlines = draftPile.map((e) => e.earliestDeadline).filter((d): d is string => Boolean(d)).sort()
  const awaitingDeadlines = queue.piles.awaiting.map((e) => e.earliestDeadline).filter((d): d is string => Boolean(d)).sort()
  return {
    office: {
      jobs: draftPile.length,
      months: draftPile.reduce((s, e) => s + (e.item?.months.length || e.dueMonths.length), 0),
      dollars: draftPile.reduce((s, e) => s + e.openBalance, 0),
      needsOwner: queue.piles.needs_owner.length,
      earliestDeadline: draftDeadlines[0] ?? null,
      ready: queue.piles.ready.length,
      next: lienDeskNextDeadline(queue),
    },
    leader: {
      jobs: queue.piles.awaiting.length,
      dollars: queue.piles.awaiting.reduce((s, e) => s + e.openBalance, 0),
      earliestDeadline: awaitingDeadlines[0] ?? null,
    },
    held: queue.piles.held.length,
    missed: lienDeskMissedSummary(queue),
  }
}

/** The office's next deadline (v2.3704): the drafting-pile jobs whose earliest window is the soonest one. */
export function lienDeskNextDeadline(queue: LienDeskQueue): LienDeskNextDeadline {
  const pile = [...queue.piles.needs_owner, ...queue.piles.to_draft].filter((e) => e.earliestDeadline)
  const deadline = pile.map((e) => e.earliestDeadline as string).sort()[0] ?? null
  const at = deadline ? pile.filter((e) => e.earliestDeadline === deadline) : []
  const gcIds = [...new Set(at.map((e) => e.gcCustomerId).filter((v): v is string => Boolean(v)))]
  return {
    deadline,
    notices: at.length,
    dollars: at.reduce((s, e) => s + e.openBalance, 0),
    gcIds,
    gcNames: [],
    toDraft: at.filter((e) => e.pile === 'to_draft').length,
    needsOwner: at.filter((e) => e.pile === 'needs_owner').length,
  }
}

/** Every job with a closed window nobody recorded, biggest balance first (v2.3679). */
export function lienDeskMissedSummary(queue: LienDeskQueue): LienDeskNeedsYou['missed'] {
  const lines: LienDeskMissedLine[] = queue.entries
    .filter((e) => e.missedUnrecorded.length > 0)
    .map((e) => ({ jobId: e.jobId, gcCustomerId: e.gcCustomerId, months: e.missedUnrecorded.slice(), openBalance: e.openBalance, label: '' }))
    .sort((a, b) => b.openBalance - a.openBalance)
  return {
    jobs: lines.length,
    months: lines.reduce((s, l) => s + l.months.length, 0),
    dollars: lines.reduce((s, l) => s + l.openBalance, 0),
    lines,
  }
}

// ---------- the office's draft: what blocks it (v2.3450) ----------

export type LienDraftBlockReason = 'no_gc' | 'no_owner' | 'public_owner' | 'no_months'

export type LienDraftReadiness = { ready: true; reason: null } | { ready: false; reason: LienDraftBlockReason }

/**
 * Whether a notice can be drafted and sent for this entry, and the first
 * reason it cannot. A public owner (a city, county, ISD, the State — see
 * `ownerKind`) is never drafted: a mechanic's lien does not attach to public
 * property; the remedy is a claim on the GC's payment bond. The order is the
 * order the pane lists its checks: GC, owner, months.
 */
export function draftReadiness(input: { gcName: string; ownerName: string; ownerMailingAddress: string; monthsCount: number }): LienDraftReadiness {
  if (!input.gcName.trim()) return { ready: false, reason: 'no_gc' }
  if (!input.ownerName.trim() || !input.ownerMailingAddress.trim()) return { ready: false, reason: 'no_owner' }
  if (ownerKind(input.ownerName) === 'public') return { ready: false, reason: 'public_owner' }
  if (input.monthsCount <= 0) return { ready: false, reason: 'no_months' }
  return { ready: true, reason: null }
}

/** The sentence the desk shows on a public-owner item (attorney-facing wording from the second-pass design). */
export const PUBLIC_OWNER_DESK_SENTENCE = "Public property — a mechanic's lien does not attach; the remedy is a claim on the GC's payment bond. Talk to the attorney."
