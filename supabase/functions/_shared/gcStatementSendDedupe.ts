/**
 * Send-time dedupe for GC statement emails (journey-map Tier-2 #45 / J20-F5).
 *
 * Three lanes can email the same GC the same statement — the Draft Message
 * dialog (send-gc-statement-email), a scheduled request (gc-statement-email-
 * dispatch), and a chain someone else set up that the sender cannot see. Until
 * now neither edge function looked before it sent. Both now read the recent
 * `gc_statement_emails` audit rows for the recipient and ask this kernel; a
 * match inside the window is skipped with a logged reason, never sent twice.
 *
 * Identity is (entity, recipient) — lane-agnostic on purpose: the double-send
 * we are preventing is exactly the cross-lane one. Entity = the GC customer id
 * when there is one; development and whole-report ("all") statements carry no
 * id in the audit table, so they key on group_by + the snapshotted name.
 *
 * Pure: no Deno, no Supabase. `src/lib/gcStatementSendDedupe.ts` re-exports
 * this file so the client and both functions run one rule.
 */

/** EMAIL_CATALOG ids (src/lib/emailCatalog.ts) the two app-send lanes stamp on email_send_log. */
export const GC_STATEMENT_EMAIL_TYPES = {
  manual: 'gc_statement_manual',
  scheduled: 'gc_statement_scheduled',
} as const

export type GcStatementEmailType = (typeof GC_STATEMENT_EMAIL_TYPES)[keyof typeof GC_STATEMENT_EMAIL_TYPES]

/**
 * Dedupe windows.
 * - `attended` (Draft Message, a person clicking Send): 10 minutes — catches a
 *   double-click, a retry after a slow response, or two people sending within
 *   minutes of each other. Anything older is the sender's call, informed by the
 *   GC's "What went out" list.
 * - `unattended` (the cron dispatcher): 12 hours — a scheduled statement that
 *   would land the same half-day as one the GC already got (by any lane) is
 *   skipped; its weekly chain still advances.
 */
export const GC_STATEMENT_DEDUPE_WINDOW_MS = {
  attended: 10 * 60_000,
  unattended: 12 * 60 * 60_000,
} as const

export type StatementSendIdentity = {
  gcCustomerId: string | null
  /** 'gc' | 'development' | 'all' */
  groupBy: string
  /** gc_statement_emails.gc_name — the display snapshot ("Knight Contracting", "All GCs"). */
  gcName: string
  sentTo: string
}

export type RecentStatementSend = StatementSendIdentity & {
  /** ISO timestamp the audit row carries. */
  sentAt: string
}

/** Stable key for "the same statement": the GC's id when known, else group + snapshotted name. */
export function statementEntityKey(x: Pick<StatementSendIdentity, 'gcCustomerId' | 'groupBy' | 'gcName'>): string {
  const id = typeof x.gcCustomerId === 'string' ? x.gcCustomerId.trim() : ''
  if (id) return `gc:${id}`
  const group = (x.groupBy || 'gc').trim().toLowerCase()
  return `${group}:${(x.gcName || '').trim().toLowerCase()}`
}

function normalizeEmail(e: string | null | undefined): string {
  return (e ?? '').trim().toLowerCase()
}

/**
 * The most recent prior send of the same statement to the same address inside
 * `windowMs`, or null. Rows with unparsable timestamps, other recipients,
 * other entities, or timestamps in the future are ignored.
 */
export function findDuplicateStatementSend(
  recent: ReadonlyArray<RecentStatementSend>,
  candidate: StatementSendIdentity,
  windowMs: number,
  nowMs: number = Date.now(),
): RecentStatementSend | null {
  if (!(windowMs > 0)) return null
  const key = statementEntityKey(candidate)
  const to = normalizeEmail(candidate.sentTo)
  if (!to) return null
  let best: RecentStatementSend | null = null
  let bestAt = -Infinity
  for (const r of recent) {
    if (normalizeEmail(r.sentTo) !== to) continue
    if (statementEntityKey(r) !== key) continue
    const at = new Date(r.sentAt).getTime()
    if (!Number.isFinite(at)) continue
    const age = nowMs - at
    if (age < 0 || age > windowMs) continue
    if (at > bestAt) {
      bestAt = at
      best = r
    }
  }
  return best
}

export function isDuplicateStatementSend(
  recent: ReadonlyArray<RecentStatementSend>,
  candidate: StatementSendIdentity,
  windowMs: number,
  nowMs: number = Date.now(),
): boolean {
  return findDuplicateStatementSend(recent, candidate, windowMs, nowMs) !== null
}

/** "4 minutes ago" / "1 hour ago" / "just now" — for skip reasons and the dialog line. */
export function describeAgo(sentAtIso: string, nowMs: number = Date.now()): string {
  const at = new Date(sentAtIso).getTime()
  if (!Number.isFinite(at)) return 'recently'
  const mins = Math.floor(Math.max(0, nowMs - at) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

/**
 * One sentence for the request row's `error`, the function log, and the Draft
 * Message dialog: "skipped: duplicate — Knight Contracting already went to
 * ap@knight.com 4 minutes ago".
 */
export function describeDuplicateStatementSkip(dup: RecentStatementSend, nowMs: number = Date.now()): string {
  const name = (dup.gcName || '').trim() || 'This statement'
  return `skipped: duplicate — ${name} already went to ${normalizeEmail(dup.sentTo)} ${describeAgo(dup.sentAt, nowMs)}`
}

/** ISO lower bound for the audit-table read: now − window. */
export function dedupeSinceIso(windowMs: number, nowMs: number = Date.now()): string {
  return new Date(nowMs - Math.max(0, windowMs)).toISOString()
}
