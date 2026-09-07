/** Crew Jobs / Bids — what the `+` may do for a person on a day (v2.2962).
 *
 * The per-person day split (`people_crew_jobs` / `people_crew_bids`) is owned by
 * approved clock sessions: `sync_crew_jobs_from_clock` rewrites it from session
 * durations whenever a session's job/bid link changes. Hand-written splits drift
 * from the sessions and get silently overwritten, so the block no longer writes
 * them. Instead the `+` links the person's approved, still-unlinked sessions to
 * the picked job or bid and lets the trigger compute the split.
 *
 * Rule (owner, 2026-09-06): there is never a split unless the person has a clock
 * session that day. No session → nothing to assign here.
 */

export type CrewDaySession = {
  id: string
  user_id: string
  job_ledger_id: string | null
  bid_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
  users: { name: string | null } | null
}

export type PersonDaySessions = {
  userId: string
  /** Approved, closed sessions with neither a job nor a bid — what `+` links. */
  unlinkedIds: string[]
  unlinkedHours: number
  /** Approved, closed sessions already anchored to a job or bid. */
  linkedCount: number
}

export type CrewAssignCellState =
  /** No approved session that day: no split may be created here. */
  | { kind: 'no-clock' }
  /** Unlinked sessions exist: `+` links every one of them to the pick. */
  | { kind: 'link'; unlinkedIds: string[]; unlinkedHours: number; linkedCount: number }
  /** Every session is linked: the split is the sessions'; change it by splitting a session. */
  | { kind: 'locked'; linkedCount: number }

function sessionHours(s: Pick<CrewDaySession, 'clocked_in_at' | 'clocked_out_at'>): number {
  if (!s.clocked_out_at) return 0
  const ms = Date.parse(s.clocked_out_at) - Date.parse(s.clocked_in_at)
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return ms / 3_600_000
}

/**
 * Group the day's approved closed sessions by the crew-row key — the trimmed
 * `users.name`, the same join `sync_crew_jobs_from_clock` uses. Rows with no
 * name or no clock-out are skipped (the caller's query already excludes open,
 * rejected and revoked sessions; this is the belt to that suspenders).
 */
export function groupCrewDaySessionsByPerson(rows: readonly CrewDaySession[]): Record<string, PersonDaySessions> {
  const out: Record<string, PersonDaySessions> = {}
  for (const s of rows) {
    const name = s.users?.name?.trim()
    if (!name || !s.clocked_out_at) continue
    const cur = out[name] ?? { userId: s.user_id, unlinkedIds: [], unlinkedHours: 0, linkedCount: 0 }
    if (s.job_ledger_id || s.bid_id) cur.linkedCount += 1
    else {
      cur.unlinkedIds.push(s.id)
      cur.unlinkedHours += sessionHours(s)
    }
    out[name] = cur
  }
  return out
}

export function crewAssignCellState(p: PersonDaySessions | undefined): CrewAssignCellState {
  if (!p || (p.unlinkedIds.length === 0 && p.linkedCount === 0)) return { kind: 'no-clock' }
  if (p.unlinkedIds.length > 0) {
    return { kind: 'link', unlinkedIds: p.unlinkedIds, unlinkedHours: p.unlinkedHours, linkedCount: p.linkedCount }
  }
  return { kind: 'locked', linkedCount: p.linkedCount }
}

/** The `clock_sessions` patch for a pick — a job clears any bid and vice versa (mutually exclusive columns). */
export function crewLinkPatch(pick: { type: 'job' | 'bid'; id: string }): { job_ledger_id: string | null; bid_id: string | null } {
  return pick.type === 'job' ? { job_ledger_id: pick.id, bid_id: null } : { job_ledger_id: null, bid_id: pick.id }
}

export function formatCrewLinkHours(hours: number): string {
  return `${(Math.round(hours * 100) / 100).toFixed(2)} h`
}

/** Button label: "Link 2 sessions (3.40 h)". */
export function crewLinkButtonLabel(state: Extract<CrewAssignCellState, { kind: 'link' }>): string {
  const n = state.unlinkedIds.length
  return `Link ${n} ${n === 1 ? 'session' : 'sessions'} (${formatCrewLinkHours(state.unlinkedHours)})`
}

/** Toast after a link: "Linked 2 sessions (3.40 h) to J523 · Mission Hills — split recomputed from the clock". */
export function crewLinkSuccessMessage(count: number, hours: number, pickLabel: string): string {
  return `Linked ${count} ${count === 1 ? 'session' : 'sessions'} (${formatCrewLinkHours(hours)}) to ${pickLabel} — split recomputed from the clock`
}
