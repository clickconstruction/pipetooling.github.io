import type { DispatchScheduledJobForAssign } from './jobScheduleBlocks'

/**
 * Pure logic for the People → Hours "Match sessions" modal (Currently clocked
 * in section): rank one-tap suggestions for clock sessions that have no job or
 * bid, from three signals the app already records —
 *
 *   dispatch — the person had a `job_schedule_blocks` row for that job that
 *              day (strongest; same quick-pick AssignSessionJobPopover loads)
 *   crew     — another of the SAME person's sessions that day already carries
 *              a job/bid (split days: the rest of the day says where they were)
 *   note     — a 3–4 digit job number typed into the clock note ("961 trim")
 *
 * Suggestions dedupe by target (first kind wins, in that confidence order) and
 * cap at three. The component layer owns all fetching and writes.
 */

export type MatchableClockSession = {
  id: string
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  salary_segment_index: number | null
}

export type MatchJobIdentity = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  service_type_name: string | null
}

export type MatchBidIdentity = {
  id: string
  bid_number: string | null
  project_name: string | null
  service_type_name: string | null
}

export type SessionMatchSuggestion = {
  kind: 'dispatch' | 'crew' | 'note'
  target: { type: 'job'; job: MatchJobIdentity } | { type: 'bid'; bid: MatchBidIdentity }
  /** Muted context after the label — "scheduled 8 AM–12 PM", "their 6:32 AM session is on it", '"961" in the clock note'. */
  detail: string
}

/** True for sessions the modal should list: no job/bid, not a salary-materialized segment. */
export function isMatchableUnassignedSession(s: MatchableClockSession): boolean {
  return s.job_ledger_id == null && s.bid_id == null && s.salary_segment_index == null
}

/**
 * Candidate job numbers from a clock note: standalone 3–4 digit runs, deduped
 * in note order, capped at 3. Longer runs (phone numbers, zips) are ignored.
 */
export function extractCandidateJobNumbersFromNote(note: string | null | undefined): string[] {
  const out: string[] = []
  for (const m of (note ?? '').matchAll(/(?<![\d-])(\d{3,4})(?![\d-])/g)) {
    const n = m[1]
    if (n && !out.includes(n)) out.push(n)
    if (out.length >= 3) break
  }
  return out
}

export function buildSessionMatchSuggestions(args: {
  session: MatchableClockSession
  /** Dispatch schedule jobs for this person + work date (already deduped per job). */
  dispatchPicks: DispatchScheduledJobForAssign[]
  /** The SAME person's other sessions on the same work_date (any assignment state). */
  sameDaySessions: MatchableClockSession[]
  jobsById: Map<string, MatchJobIdentity>
  bidsById: Map<string, MatchBidIdentity>
  /** hcp_number → job, built only from numbers that resolve to exactly one job. */
  jobsByNumber: Map<string, MatchJobIdentity>
  /** Formats a sibling session's clock-in for the crew detail line (component passes a TZ-correct formatter). */
  formatSiblingTime?: (clockedInAt: string) => string
}): SessionMatchSuggestion[] {
  const { session, dispatchPicks, sameDaySessions, jobsById, bidsById, jobsByNumber, formatSiblingTime } = args
  const out: SessionMatchSuggestion[] = []
  const seen = new Set<string>()
  const push = (s: SessionMatchSuggestion) => {
    const key = s.target.type === 'job' ? `job:${s.target.job.id}` : `bid:${s.target.bid.id}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(s)
  }

  for (const p of dispatchPicks) {
    push({
      kind: 'dispatch',
      target: {
        type: 'job',
        job: jobsById.get(p.jobId) ?? {
          id: p.jobId,
          hcp_number: p.hcp_number,
          click_number: p.click_number,
          job_name: p.job_name,
          service_type_name: null,
        },
      },
      detail: p.windowsLabel ? `scheduled ${p.windowsLabel}` : 'on their Dispatch schedule',
    })
  }

  for (const sib of sameDaySessions) {
    if (sib.id === session.id || sib.user_id !== session.user_id || sib.work_date !== session.work_date) continue
    const when = formatSiblingTime ? formatSiblingTime(sib.clocked_in_at) : null
    const detail = when ? `their ${when} session is on it` : 'another session that day is on it'
    if (sib.job_ledger_id) {
      const job = jobsById.get(sib.job_ledger_id)
      if (job) push({ kind: 'crew', target: { type: 'job', job }, detail })
    } else if (sib.bid_id) {
      const bid = bidsById.get(sib.bid_id)
      if (bid) push({ kind: 'crew', target: { type: 'bid', bid }, detail })
    }
  }

  for (const num of extractCandidateJobNumbersFromNote(session.notes)) {
    const job = jobsByNumber.get(num)
    if (job) push({ kind: 'note', target: { type: 'job', job }, detail: `"${num}" in the clock note` })
  }

  return out.slice(0, 3)
}

/**
 * Bulk-apply eligibility: the one dispatch-kind suggestion when EXACTLY one
 * exists — never guesses across multiple scheduled jobs.
 */
export function singleDispatchSuggestion(suggestions: SessionMatchSuggestion[]): SessionMatchSuggestion | null {
  const dispatch = suggestions.filter((s) => s.kind === 'dispatch')
  return dispatch.length === 1 ? dispatch[0]! : null
}
