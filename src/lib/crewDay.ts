import { effectiveJobLedgerNumber } from './ledgerDisplayPrefixes'

/**
 * Crew Day kernel (v2.2602): groups one day of crew activity — schedule
 * blocks, clock sessions, field reports, % complete notes (payload from RPC
 * `get_crew_day_payload`) — into per-person rows with per-job lines, hour
 * totals, and attention flags for the Dashboard Crew Day section.
 *
 * Hours only, never wages — the payload carries no pay data and this kernel
 * must never grow any.
 */

export type CrewDaySessionRow = {
  user_id: string
  job_id: string | null
  clocked_in_at: string
  clocked_out_at: string | null
}

export type CrewDayBlockRow = {
  user_id: string
  job_id: string | null
  bid_id: string | null
  /** "HH:MM:SS" wall-clock strings (company calendar zone). */
  time_start: string
  time_end: string
  note: string | null
}

export type CrewDayReportRow = {
  id: string
  user_id: string
  job_id: string
  created_at: string
  template_name: string
  field_values: unknown
}

export type CrewDayPctNoteRow = { job_id: string; body: string; created_at: string }
/** `role` is present since migration 20260902001331 (v2.2617) — optional so pre-push payloads still parse. */
export type CrewDayUserRow = { id: string; name: string | null; role?: string | null }
export type CrewDayJobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
  pct_complete: number | null
}

export type CrewDayPayload = {
  day: string
  sessions: CrewDaySessionRow[]
  blocks: CrewDayBlockRow[]
  reports: CrewDayReportRow[]
  pct_notes: CrewDayPctNoteRow[]
  users: CrewDayUserRow[]
  jobs: CrewDayJobRow[]
}

export type CrewDayFlag = 'no_report' | 'scheduled_no_clock' | 'unscheduled_work'

export type CrewDayPersonJob = {
  /** null for job-less rows (bid-anchored blocks / unassociated sessions). */
  jobId: string | null
  label: string
  address: string | null
  scheduled: { start: string; end: string; note: string | null }[]
  sessions: { inAt: string; outAt: string | null }[]
  reports: { id: string; createdAt: string; templateName: string; excerpt: string }[]
  hoursMs: number
  /** A session on this job is still open. */
  open: boolean
  /** Sessions exist but no block did (feeds the person's unscheduled_work flag). */
  unscheduled: boolean
}

export type CrewDayPerson = {
  userId: string
  name: string
  jobs: CrewDayPersonJob[]
  totalMs: number
  open: boolean
  reportCount: number
  flags: CrewDayFlag[]
  /** Office-role user (v2.2617) — folded by default for superintendent viewers. False when the payload predates roles. */
  office: boolean
}

export type CrewDaySummary = { people: number; jobs: number; totalMs: number; reports: number; flags: number }

export type CrewDayView = {
  day: string
  people: CrewDayPerson[]
  summary: CrewDaySummary
  /** Per job: first "% complete" note number → current jobs_ledger.pct_complete (when they differ). */
  pctMovement: Map<string, { from: number; to: number }>
}

/**
 * The office fold set (v2.2617): superintendent viewers see field crews first;
 * people with these roles fold behind "Show office staff". Same list as
 * isCrewDayEmailRole today, but a distinct predicate — the fold and the email
 * gate are separate decisions that could diverge.
 */
export function isCrewDayOfficeRole(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}

/** Summary chips over any subset of people (the office fold recomputes them for the visible set). */
export function crewDaySummaryFor(people: readonly CrewDayPerson[]): CrewDaySummary {
  const jobIds = new Set<string>()
  for (const p of people) for (const j of p.jobs) if (j.jobId != null) jobIds.add(j.jobId)
  return {
    people: people.length,
    jobs: jobIds.size,
    totalMs: people.reduce((a, p) => a + p.totalMs, 0),
    reports: people.reduce((a, p) => a + p.reportCount, 0),
    flags: people.reduce((a, p) => a + p.flags.length, 0),
  }
}

/**
 * Day-nav word for the restacked navigation (v2.2617): 'Today', 'Yesterday',
 * or "N days ago" for anything older. '' for invalid or future days (the UI
 * disables forward navigation past today anyway).
 */
export function crewDayNavWord(ymd: string, todayYmd: string): string {
  const parse = (s: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const a = parse(ymd)
  const b = parse(todayYmd)
  if (a == null || b == null || a > b) return ''
  const days = Math.round((b - a) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

/** First "N% complete" number in a thread-note body, or null. */
export function crewDayPctFromNoteBody(body: string): number | null {
  const m = /(\d{1,3})\s*%\s*complete/i.exec(body)
  if (!m?.[1]) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

/**
 * Report excerpt from reports.field_values: string values joined ' · ',
 * skipping empties and data: URLs (signature strokes), truncated with an
 * ellipsis. Junk shapes give ''.
 */
export function crewDayReportExcerpt(fieldValues: unknown, maxLen = 160): string {
  if (fieldValues == null || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) return ''
  const parts: string[] = []
  for (const v of Object.values(fieldValues as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (!t || t.startsWith('data:')) continue
    parts.push(t)
  }
  const joined = parts.join(' · ')
  if (joined.length <= maxLen) return joined
  return `${joined.slice(0, maxLen - 1).trimEnd()}…`
}

/** Elapsed ms of one session at `nowMs` (open sessions count up; never negative). */
export function crewDaySessionMs(s: CrewDaySessionRow, nowMs: number): number {
  const inMs = Date.parse(s.clocked_in_at)
  if (Number.isNaN(inMs)) return 0
  const outMs = s.clocked_out_at ? Date.parse(s.clocked_out_at) : nowMs
  if (Number.isNaN(outMs)) return 0
  return Math.max(0, outMs - inMs)
}

/** "8.2 h" (one decimal); '—' for zero. */
export function formatCrewDayHours(ms: number): string {
  if (ms <= 0) return '—'
  return `${(ms / 3_600_000).toFixed(1)} h`
}

/** "07:00:00" → "7:00a" / "15:30:00" → "3:30p"; junk gives ''. */
export function formatCrewDayBlockTime(hms: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hms ?? '')
  if (!m?.[1] || !m[2]) return ''
  const h24 = Number(m[1])
  if (!Number.isFinite(h24) || h24 > 23) return ''
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m[2]}${h24 < 12 ? 'a' : 'p'}`
}

function crewDayJobLabel(job: CrewDayJobRow | undefined, jobId: string | null): string {
  if (jobId == null) return 'No job association'
  if (!job) return 'Job'
  const num = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  const name = (job.job_name ?? '').trim() || (job.job_address ?? '').trim()
  if (num && name) return `${num} · ${name}`
  return num || name || 'Job'
}

const jobGroupKey = (jobId: string | null) => jobId ?? '∅'

/**
 * Build the section's view model. Flags per person:
 * - scheduled_no_clock — has blocks but zero sessions all day
 * - unscheduled_work   — clocked a job no block of theirs names
 * - no_report          — a closed session but zero reports (open-only days
 *                        don't flag; the day isn't over for them yet)
 */
export function buildCrewDayView(payload: CrewDayPayload, nowMs: number): CrewDayView {
  const jobsById = new Map(payload.jobs.map((j) => [j.id, j]))
  const namesById = new Map(payload.users.map((u) => [u.id, (u.name ?? '').trim()]))
  const rolesById = new Map(payload.users.map((u) => [u.id, u.role ?? null]))

  type Bucket = { jobs: Map<string, CrewDayPersonJob>; order: string[] }
  const byPerson = new Map<string, Bucket>()
  const bucketFor = (userId: string): Bucket => {
    let b = byPerson.get(userId)
    if (!b) {
      b = { jobs: new Map(), order: [] }
      byPerson.set(userId, b)
    }
    return b
  }
  const jobLineFor = (b: Bucket, jobId: string | null): CrewDayPersonJob => {
    const key = jobGroupKey(jobId)
    let line = b.jobs.get(key)
    if (!line) {
      const job = jobId != null ? jobsById.get(jobId) : undefined
      line = {
        jobId,
        label: crewDayJobLabel(job, jobId),
        address: job?.job_address ?? null,
        scheduled: [],
        sessions: [],
        reports: [],
        hoursMs: 0,
        open: false,
        unscheduled: false,
      }
      b.jobs.set(key, line)
      b.order.push(key)
    }
    return line
  }

  for (const blk of payload.blocks) {
    jobLineFor(bucketFor(blk.user_id), blk.job_id).scheduled.push({
      start: blk.time_start,
      end: blk.time_end,
      note: blk.note,
    })
  }
  for (const s of payload.sessions) {
    const line = jobLineFor(bucketFor(s.user_id), s.job_id)
    line.sessions.push({ inAt: s.clocked_in_at, outAt: s.clocked_out_at })
    line.hoursMs += crewDaySessionMs(s, nowMs)
    if (s.clocked_out_at == null) line.open = true
  }
  for (const r of payload.reports) {
    jobLineFor(bucketFor(r.user_id), r.job_id).reports.push({
      id: r.id,
      createdAt: r.created_at,
      templateName: r.template_name,
      excerpt: crewDayReportExcerpt(r.field_values),
    })
  }

  const people: CrewDayPerson[] = []
  for (const [userId, b] of byPerson) {
    const jobs = b.order.map((k) => b.jobs.get(k)).filter((j): j is CrewDayPersonJob => j != null)
    let totalMs = 0
    let open = false
    let reportCount = 0
    let anyClosedSession = false
    let anySession = false
    let anyBlock = false
    let anyUnscheduled = false
    for (const j of jobs) {
      j.unscheduled = j.sessions.length > 0 && j.scheduled.length === 0
      totalMs += j.hoursMs
      open = open || j.open
      reportCount += j.reports.length
      anySession = anySession || j.sessions.length > 0
      anyClosedSession = anyClosedSession || j.sessions.some((s) => s.outAt != null)
      anyBlock = anyBlock || j.scheduled.length > 0
      anyUnscheduled = anyUnscheduled || j.unscheduled
    }
    const flags: CrewDayFlag[] = []
    if (anyBlock && !anySession) flags.push('scheduled_no_clock')
    if (anyUnscheduled) flags.push('unscheduled_work')
    if (anyClosedSession && reportCount === 0) flags.push('no_report')
    people.push({
      userId,
      name: namesById.get(userId) || 'Unknown',
      jobs,
      totalMs,
      open,
      reportCount,
      flags,
      office: isCrewDayOfficeRole(rolesById.get(userId)),
    })
  }
  people.sort((a, b) => b.totalMs - a.totalMs || a.name.localeCompare(b.name))

  const pctMovement = new Map<string, { from: number; to: number }>()
  const firstNotePct = new Map<string, number>()
  for (const n of payload.pct_notes) {
    if (firstNotePct.has(n.job_id)) continue
    const v = crewDayPctFromNoteBody(n.body)
    if (v != null) firstNotePct.set(n.job_id, v)
  }
  for (const [jobId, from] of firstNotePct) {
    const to = jobsById.get(jobId)?.pct_complete
    if (to != null && to !== from) pctMovement.set(jobId, { from, to })
  }

  return {
    day: payload.day,
    people,
    summary: crewDaySummaryFor(people),
    pctMovement,
  }
}

/** Roles the Crew Day section renders for (RPC enforces the same set server-side). */
export function isCrewDayRole(role: string | null | undefined): boolean {
  return (
    role === 'dev' ||
    role === 'master_technician' ||
    role === 'assistant' ||
    role === 'controller' ||
    role === 'superintendent'
  )
}

/**
 * Roles that may SEND or RECEIVE the crew_day email stream — OFFICE ONLY
 * since v2.2615: superintendents see the section but never the email (owner
 * decision — the dashboard is their window). Keep in sync with SENDER_ROLES /
 * RECIPIENT_ROLES in supabase/functions/crew-day-email-dispatch/index.ts and
 * the crew_day_email_requests INSERT policy.
 */
export function isCrewDayEmailRole(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'controller'
}
