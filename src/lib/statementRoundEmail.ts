/**
 * "Your statement round" email chains kernel (v2.2771, `statement_round`
 * REPORT_SUBSCRIPTIONS stream). A subscription is NOT a table concept — it is
 * a set of repeat_weekly rows in statement_round_email_requests, one chain per
 * Central weekday per recipient (the v2.1430 standing-copies shape). This
 * kernel groups pending chains per recipient, diffs an edit into inserts +
 * cancels, and shapes the Dashboard nudge from the round RPC payload. Pure —
 * IO lives in statementRoundEmailClient.ts.
 */
import { chicagoWeekdayAndTime, nextOccurrenceIso } from './gcStatementStandingCopies'

export type StatementRoundRequestRow = {
  id: string
  requested_by: string
  recipient_user_id: string
  send_at: string
  repeat_weekly: boolean
}

export type StatementRoundChainGroup = {
  recipientUserId: string
  /** Distinct Central weekdays with a pending chain, sorted 0=Sun…6=Sat. */
  weekdays: number[]
  /** 'HH:MM' Central; when chains disagree, the earliest. */
  timeHm: string
  rowIdsByWeekday: Record<number, string[]>
  allRowIds: string[]
}

/** Group pending weekly chains by recipient. One-off (non-repeating) rows are left out. */
export function groupStatementRoundChains(rows: readonly StatementRoundRequestRow[]): StatementRoundChainGroup[] {
  const byUser = new Map<string, StatementRoundChainGroup>()
  for (const r of rows) {
    if (!r.repeat_weekly) continue
    const wt = chicagoWeekdayAndTime(r.send_at)
    if (!wt) continue
    let g = byUser.get(r.recipient_user_id)
    if (!g) {
      g = { recipientUserId: r.recipient_user_id, weekdays: [], timeHm: wt.timeHm, rowIdsByWeekday: {}, allRowIds: [] }
      byUser.set(r.recipient_user_id, g)
    }
    if (!g.weekdays.includes(wt.dow)) g.weekdays.push(wt.dow)
    ;(g.rowIdsByWeekday[wt.dow] ??= []).push(r.id)
    g.allRowIds.push(r.id)
    if (wt.timeHm < g.timeHm) g.timeHm = wt.timeHm
  }
  const groups = [...byUser.values()]
  for (const g of groups) g.weekdays.sort((a, b) => a - b)
  return groups
}

export type StatementRoundChainInsert = {
  requested_by: string
  recipient_user_id: string
  send_at: string
  repeat_weekly: true
}

export type StatementRoundChainEditPlan =
  | { ok: true; inserts: StatementRoundChainInsert[]; cancelIds: string[] }
  | { ok: false; error: string }

/**
 * Diff a subscription edit into chain inserts + cancels. A time change
 * re-creates every chain (the chain's instant IS its time); a pure weekday
 * change touches only the added/removed days. Zero weekdays = unsubscribe.
 */
export function planStatementRoundChainEdit(
  input: { requestedBy: string; recipientUserId: string; desiredWeekdays: number[]; desiredTimeHm: string; current: StatementRoundChainGroup | null },
  now: Date = new Date(),
): StatementRoundChainEditPlan {
  const desired = [...new Set(input.desiredWeekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
  const timeChanged = input.current != null && input.current.timeHm !== input.desiredTimeHm
  const currentDays = input.current?.weekdays ?? []
  const daysToAdd = timeChanged ? desired : desired.filter((d) => !currentDays.includes(d))
  const daysToCancel = timeChanged ? currentDays : currentDays.filter((d) => !desired.includes(d))
  const inserts: StatementRoundChainInsert[] = []
  for (const dow of daysToAdd) {
    const sendAt = nextOccurrenceIso(dow, input.desiredTimeHm, now)
    if (!sendAt) return { ok: false, error: 'Pick a valid time.' }
    inserts.push({ requested_by: input.requestedBy, recipient_user_id: input.recipientUserId, send_at: sendAt, repeat_weekly: true })
  }
  const cancelIds = daysToCancel.flatMap((d) => input.current?.rowIdsByWeekday[d] ?? [])
  if (inserts.length === 0 && cancelIds.length === 0) return { ok: false, error: 'Pick at least one weekday.' }
  return { ok: true, inserts, cancelIds }
}

/** What get_my_statement_round / get_statement_round_for_user return. */
export type StatementRoundPayload = {
  week_start: string
  user_id: string
  ready: Array<{ gc_id: string; gc_name: string; amount: number; job_count: number; oldest_age_days: number | null; certified_by_name: string | null }>
  held: { count: number; total: number }
  assigned_to_me: number
  sent_by_me: number
}

export function parseStatementRoundPayload(v: unknown): StatementRoundPayload | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Partial<StatementRoundPayload>
  if (!Array.isArray(p.ready) || typeof p.week_start !== 'string') return null
  return {
    week_start: p.week_start,
    user_id: typeof p.user_id === 'string' ? p.user_id : '',
    ready: p.ready.map((r) => ({
      gc_id: String(r.gc_id ?? ''),
      gc_name: String(r.gc_name ?? '—'),
      amount: Number(r.amount ?? 0),
      job_count: Number(r.job_count ?? 0),
      oldest_age_days: r.oldest_age_days == null ? null : Number(r.oldest_age_days),
      certified_by_name: r.certified_by_name == null ? null : String(r.certified_by_name),
    })),
    held: { count: Number(p.held?.count ?? 0), total: Number(p.held?.total ?? 0) },
    assigned_to_me: Number(p.assigned_to_me ?? 0),
    sent_by_me: Number(p.sent_by_me ?? 0),
  }
}

/** The Needs You row's inputs: null when nothing is waiting on this sender. */
export type StatementRoundNudge = { count: number; total: number; gcNames: string[] }

export function statementRoundNudgeFromPayload(p: StatementRoundPayload | null): StatementRoundNudge | null {
  if (!p || p.ready.length === 0) return null
  return {
    count: p.ready.length,
    total: Math.round(p.ready.reduce((t, r) => t + r.amount, 0) * 100) / 100,
    gcNames: p.ready.map((r) => r.gc_name),
  }
}
