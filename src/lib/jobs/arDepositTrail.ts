/**
 * The trail on an Accounts Receivable deposit row (v2.4274, punch list #74 PR 2).
 *
 * A deposit row said what it is — the amount, the payer, a state chip — but not
 * where the money went. The office's two questions on 2026-09-30 ("was the
 * $6,077.51 already applied?", "where did the Southern Post cheque go?") were
 * both answered by one line the row did not have:
 *
 *   → #650 ATI Schertz today 4:02 PM by Taunya · was #878 Take 5- Seguin 9/29
 *   was #878 Take 5- Seguin 9/21 by Taunya · bank failed it 9/23 · taken off, marked returned 9/24 by Taunya
 *   was #650 ATI Schertz 9/29 by Taunya · taken off today 4:02 PM by Taunya
 *
 * Input: the rows of `list_ar_deposit_trails` for one deposit — every payment
 * it ever carried, live or removed — plus what the deposit itself says (marked
 * returned, the bank's failure time). Pure; the caller passes the date words.
 * Unit-tested in arDepositTrail.test.ts.
 */

export type ArDepositTrailRow = {
  mercury_transaction_id: string
  payment_id: string
  live: boolean
  job_id: string | null
  /** "650", "" when the job has no number, null when the job is gone. */
  job_number: string | null
  job_name: string | null
  invoice_id: string | null
  amount: number | string | null
  /** When the payment was applied (its created_at). */
  applied_at: string | null
  /** Who applied it, from the job history; null when nobody was signed in. */
  applied_by: string | null
  /** When and by whom it was taken off; null on a live payment. */
  removed_at: string | null
  removed_by: string | null
}

export type ArTrailPartKind = 'on' | 'was' | 'bankFailed' | 'off'

export type ArTrailPart = {
  kind: ArTrailPartKind
  /** The job labels the part names — bold on an `on` part, struck through on a `was` part. */
  jobs: string[]
  /** The words before the job labels ("→ ", "was ") and after them (" today 4:02 PM by Taunya"). */
  before: string
  after: string
}

export type ArDepositTrail = {
  parts: ArTrailPart[]
  /** The parts as one plain sentence, " · " between them — the row's title and the tests' anchor. */
  words: string
  /** The latest of applied, removed and bank-failed times — the order All reads in (PR 3). */
  lastTouchedAt: string | null
}

/** The name the trail gives a row nobody signed for. */
export const AR_TRAIL_UNSIGNED = 'the app'

const JOB_GONE = 'a job the archive did not keep'
/** A removal and a re-add inside this window are one move, not a take-off and a fresh apply. */
const MOVE_WINDOW_MS = 5 * 60 * 1000

export function arTrailJobLabel(r: Pick<ArDepositTrailRow, 'job_number' | 'job_name'>): string {
  const name = (r.job_name ?? '').trim()
  const num = (r.job_number ?? '').trim()
  if (!name && !num) return JOB_GONE
  return num ? `#${num} ${name}`.trim() : name
}

const ms = (iso: string | null | undefined): number => {
  if (!iso) return Number.NaN
  const n = new Date(iso).getTime()
  return Number.isFinite(n) ? n : Number.NaN
}

const uniq = (xs: string[]): string[] => Array.from(new Set(xs))

export function buildArDepositTrail(args: {
  rows: ReadonlyArray<ArDepositTrailRow>
  /** Marked returned by hand, or the bank returned it. */
  returned: boolean
  /** Mercury's `failedAt`, when the bank returned the deposit. */
  bankFailedAt: string | null
  whenWords: (iso: string) => string
  unsignedName?: string
}): ArDepositTrail | null {
  const unsigned = args.unsignedName ?? AR_TRAIL_UNSIGNED
  const who = (name: string | null | undefined): string => (name ?? '').trim() || unsigned
  const when = (iso: string | null): string => (iso ? args.whenWords(iso) : '')
  const live = args.rows.filter((r) => r.live)
  const gone = args.rows.filter((r) => !r.live)
  if (!live.length && !gone.length && !args.bankFailedAt) return null

  const parts: ArTrailPart[] = []
  const times: number[] = []

  // Where the money is now: one part per (day, who), the jobs joined.
  const onGroups = new Map<string, { jobs: string[]; when: string; who: string; at: number }>()
  for (const r of [...live].sort((a, b) => ms(a.applied_at) - ms(b.applied_at))) {
    const w = when(r.applied_at)
    const by = who(r.applied_by)
    const key = `${w}|${by}`
    const g = onGroups.get(key)
    const label = arTrailJobLabel(r)
    if (g) {
      g.jobs.push(label)
      g.at = Math.max(g.at, ms(r.applied_at) || 0)
    } else onGroups.set(key, { jobs: [label], when: w, who: by, at: ms(r.applied_at) || 0 })
    if (Number.isFinite(ms(r.applied_at))) times.push(ms(r.applied_at))
  }
  for (const g of [...onGroups.values()].sort((a, b) => b.at - a.at)) {
    parts.push({ kind: 'on', jobs: uniq(g.jobs), before: '→ ', after: ` ${g.when} by ${g.who}`.replace(/^ +$/, '') })
  }

  // Where it used to be, oldest first; a removal followed by a live apply within minutes is a move.
  const offParts: ArTrailPart[] = []
  for (const r of [...gone].sort((a, b) => ms(a.applied_at) - ms(b.applied_at))) {
    const removedMs = ms(r.removed_at)
    const moved =
      !args.returned &&
      Number.isFinite(removedMs) &&
      live.some((l) => Math.abs(ms(l.applied_at) - removedMs) <= MOVE_WINDOW_MS)
    const appliedWords = [when(r.applied_at), r.applied_by ? `by ${r.applied_by}` : ''].filter(Boolean).join(' ')
    parts.push({ kind: 'was', jobs: [arTrailJobLabel(r)], before: 'was ', after: appliedWords ? ` ${appliedWords}` : '' })
    if (Number.isFinite(ms(r.applied_at))) times.push(ms(r.applied_at))
    if (Number.isFinite(removedMs)) times.push(removedMs)
    if (!moved && r.removed_at) {
      const verb = args.returned ? 'taken off, marked returned' : 'taken off'
      offParts.push({ kind: 'off', jobs: [], before: `${verb} ${when(r.removed_at)} by ${who(r.removed_by)}`, after: '' })
    }
  }
  if (args.bankFailedAt) {
    parts.push({ kind: 'bankFailed', jobs: [], before: `bank failed it ${when(args.bankFailedAt)}`, after: '' })
    if (Number.isFinite(ms(args.bankFailedAt))) times.push(ms(args.bankFailedAt))
  }
  parts.push(...offParts)

  const words = parts.map((p) => `${p.before}${p.jobs.join(', ')}${p.after}`).join(' · ')
  const last = times.length ? Math.max(...times) : Number.NaN
  return { parts, words, lastTouchedAt: Number.isFinite(last) ? new Date(last).toISOString() : null }
}

/**
 * "today 4:02 PM" on the calendar day `now` falls on in `timeZone`, else "9/29".
 * Pure given `now`; the modal passes the app's calendar zone.
 */
export function arTrailWhenWords(iso: string, now: Date, timeZone: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const dayOf = (x: Date) => x.toLocaleDateString('en-CA', { timeZone })
  if (dayOf(d) === dayOf(now)) {
    return `today ${d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })}`
  }
  return d.toLocaleDateString('en-US', { timeZone, month: 'numeric', day: 'numeric' })
}

/** Rows of one RPC call grouped by deposit. */
export function groupArDepositTrailRows(rows: ReadonlyArray<ArDepositTrailRow>): Map<string, ArDepositTrailRow[]> {
  const out = new Map<string, ArDepositTrailRow[]>()
  for (const r of rows) {
    const list = out.get(r.mercury_transaction_id)
    if (list) list.push(r)
    else out.set(r.mercury_transaction_id, [r])
  }
  return out
}

/** Mercury's `failedAt` off the raw payload — the bank's own time for a return. */
export function bankFailedAtFromRaw(raw: unknown): string | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  const v = o?.failedAt
  return typeof v === 'string' && v.trim() ? v : null
}
