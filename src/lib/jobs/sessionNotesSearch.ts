import { extractCandidateJobNumbersFromNote } from '../matchClockSessions'
import {
  formatBidLedgerShortLine,
  formatJobLedgerShortLine,
  type LedgerPrefixMap,
} from '../ledgerDisplayPrefixes'

/**
 * Pure logic for the Pipeline "Session notes" view: every clock session in a
 * window as ONE line — time, hours, person, where the time was booked, the
 * note — searchable across all of it, scoped by where the time is booked, and
 * flagged when the note names a job the session isn't booked to. The component
 * owns fetching and writes; everything here is data in, view-model out.
 *
 * "Focus" in the clock UI is a session: Update Focus closes the current row
 * and opens a new one, so `clock_sessions.notes` is exactly the per-focus text.
 */

export type SessionNotesRow = {
  id: string
  user_id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string | null
  origin: string | null
  salary_segment_index: number | null
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
  rejected_at: string | null
  revoked_at: string | null
  users: { name: string | null } | null
  jobs_ledger: {
    hcp_number: string | null
    click_number?: string | null
    job_name: string | null
    service_type_id?: string | null
  } | null
  bids: {
    bid_number: string | null
    project_name: string | null
    service_type_id?: string | null
  } | null
}

/** Where a session's time is booked. Office = the overhead office job from Settings. */
export type SessionNotesBookedTo = 'office' | 'none' | 'job' | 'bid'
export type SessionNotesScope = 'all' | SessionNotesBookedTo
export type SessionNotesGroupBy = 'day' | 'person' | 'job' | 'none'
export type SessionNotesStatus = 'open' | 'approved' | 'pending'

/** 0 = no window (all time). */
export type SessionNotesWindowDays = 7 | 30 | 90 | 0
export const SESSION_NOTES_WINDOWS: readonly SessionNotesWindowDays[] = [7, 30, 90, 0]
/** Owner call (2026-09-03): misfiles surface at approval time, which runs weeks behind. */
export const SESSION_NOTES_DEFAULT_WINDOW_DAYS: SessionNotesWindowDays = 30
/** Newest-first cap on one fetch; the view says when it hit the cap. */
export const SESSION_NOTES_ROW_CAP = 1000

export const SESSION_NOTES_SCOPES: ReadonlyArray<{ key: SessionNotesScope; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'office', label: 'Office' },
  { key: 'none', label: 'Nothing' },
  { key: 'job', label: 'A job' },
  { key: 'bid', label: 'A bid' },
]

export const SESSION_NOTES_GROUPS: ReadonlyArray<{ key: SessionNotesGroupBy; label: string }> = [
  { key: 'day', label: 'Day' },
  { key: 'person', label: 'Person' },
  { key: 'job', label: 'Job' },
  { key: 'none', label: 'None' },
]

export type SessionNotesJobIdentity = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  service_type_id?: string | null
}

export type SessionNotesJobIndex = {
  byId: Map<string, SessionNotesJobIdentity>
  /** Trimmed HCP / Click numbers → jobs carrying that number (two jobs can share one). */
  byNumber: Map<string, SessionNotesJobIdentity[]>
}

export function buildSessionNotesJobIndex(jobs: readonly SessionNotesJobIdentity[]): SessionNotesJobIndex {
  const byId = new Map<string, SessionNotesJobIdentity>()
  const byNumber = new Map<string, SessionNotesJobIdentity[]>()
  for (const j of jobs) {
    byId.set(j.id, j)
    for (const raw of [j.hcp_number, j.click_number]) {
      const n = (raw ?? '').trim()
      if (!n) continue
      const list = byNumber.get(n) ?? []
      if (!list.some((x) => x.id === j.id)) list.push(j)
      byNumber.set(n, list)
    }
  }
  return { byId, byNumber }
}

export type SessionNotesSuggestion = { jobId: string; label: string }

export type SessionNotesLine = {
  id: string
  userId: string
  personName: string
  /** Muted "(s)" marker: a salary-schedule segment the system materialized. */
  salarySchedule: boolean
  workDate: string
  clockedInAt: string
  clockedOutAt: string | null
  /** Decimal hours; open sessions count time so far. */
  hours: number
  status: SessionNotesStatus
  bookedTo: SessionNotesBookedTo
  jobId: string | null
  bidId: string | null
  /** "JP961 · Smith residence" / "BP12 · Cedar Ridge" — null for office/nothing. */
  whereLabel: string | null
  note: string
  /** Jobs named in the note that this session is NOT booked to. */
  suggestions: SessionNotesSuggestion[]
}

export function sessionNotesBookedTo(
  row: Pick<SessionNotesRow, 'job_ledger_id' | 'bid_id'>,
  officeJobId: string | null,
): SessionNotesBookedTo {
  if (row.job_ledger_id) return officeJobId && row.job_ledger_id === officeJobId ? 'office' : 'job'
  if (row.bid_id) return 'bid'
  return 'none'
}

export function sessionNotesHours(
  row: Pick<SessionNotesRow, 'clocked_in_at' | 'clocked_out_at'>,
  nowMs: number,
): number {
  const inMs = new Date(row.clocked_in_at).getTime()
  const outMs = row.clocked_out_at ? new Date(row.clocked_out_at).getTime() : nowMs
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0
  const ms = outMs - inMs
  return ms > 0 ? ms / 3_600_000 : 0
}

export function sessionNotesStatus(
  row: Pick<SessionNotesRow, 'clocked_out_at' | 'approved_at'>,
): SessionNotesStatus {
  if (!row.clocked_out_at) return 'open'
  return row.approved_at ? 'approved' : 'pending'
}

/** Whitespace-separated, lower-cased, deduped search tokens. */
export function sessionNotesSearchTokens(query: string): string[] {
  const out: string[] = []
  for (const t of query.trim().toLowerCase().split(/\s+/)) {
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}

/**
 * The one token pushed to the server as a coarse prefilter (the client applies
 * the full every-token match). Longest wins — it is the most selective.
 */
export function sessionNotesAnchorToken(tokens: readonly string[]): string | null {
  let best: string | null = null
  for (const t of tokens) if (!best || t.length > best.length) best = t
  return best
}

export type SessionNotesServerFilter = {
  /** Sanitized for a PostgREST `ilike` value (no reserved punctuation). */
  anchor: string
  userIds: string[]
  jobIds: string[]
}

/**
 * Coarse server-side prefilter for a query: notes containing the anchor token,
 * OR sessions by people whose name contains it, OR sessions booked to jobs
 * whose number/name contains it. Null when there is no query (fetch the window).
 */
export function buildSessionNotesServerFilter(args: {
  query: string
  users: ReadonlyArray<{ id: string; name: string | null }>
  jobs: ReadonlyArray<SessionNotesJobIdentity>
}): SessionNotesServerFilter | null {
  const tokens = sessionNotesSearchTokens(args.query)
  const anchorRaw = sessionNotesAnchorToken(tokens)
  if (!anchorRaw) return null
  const anchor = anchorRaw.replace(/[,()"\\*%]/g, '')
  const userIds = args.users
    .filter((u) => (u.name ?? '').toLowerCase().includes(anchorRaw))
    .map((u) => u.id)
  const jobIds = args.jobs
    .filter((j) => {
      const hay = `${j.hcp_number ?? ''} ${j.click_number ?? ''} ${j.job_name ?? ''}`.toLowerCase()
      return hay.includes(anchorRaw)
    })
    .map((j) => j.id)
  return { anchor, userIds, jobIds }
}

/** Every token must appear somewhere on the line (person, note, where, date). */
export function sessionNotesLineMatches(line: SessionNotesLine, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true
  const hay = [line.personName, line.note, line.whereLabel ?? '', line.workDate].join(' ').toLowerCase()
  return tokens.every((t) => hay.includes(t))
}

function whereLabelFor(row: SessionNotesRow, bookedTo: SessionNotesBookedTo, prefixMap: LedgerPrefixMap): string | null {
  if (bookedTo === 'job' && row.jobs_ledger) {
    const jl = row.jobs_ledger
    return formatJobLedgerShortLine(prefixMap, jl.service_type_id ?? null, jl.hcp_number, jl.job_name, jl.click_number ?? null)
  }
  if (bookedTo === 'job') return 'Job'
  if (bookedTo === 'bid' && row.bids) {
    const b = row.bids
    return formatBidLedgerShortLine(prefixMap, b.service_type_id ?? null, b.bid_number, b.project_name)
  }
  if (bookedTo === 'bid') return 'Bid'
  return null
}

/**
 * Jobs a note names that the session isn't booked to. Never auto-applied —
 * "961 change order paperwork" on an Office session is real office work.
 */
export function sessionNotesSuggestions(
  row: Pick<SessionNotesRow, 'notes' | 'job_ledger_id'>,
  jobIndex: SessionNotesJobIndex,
  prefixMap: LedgerPrefixMap,
): SessionNotesSuggestion[] {
  const out: SessionNotesSuggestion[] = []
  for (const n of extractCandidateJobNumbersFromNote(row.notes)) {
    for (const j of jobIndex.byNumber.get(n) ?? []) {
      if (j.id === row.job_ledger_id) continue
      if (out.some((s) => s.jobId === j.id)) continue
      out.push({
        jobId: j.id,
        label: formatJobLedgerShortLine(prefixMap, j.service_type_id ?? null, j.hcp_number, j.job_name, j.click_number ?? null),
      })
    }
  }
  return out
}

export function buildSessionNotesLines(args: {
  rows: readonly SessionNotesRow[]
  officeJobId: string | null
  jobIndex: SessionNotesJobIndex
  prefixMap: LedgerPrefixMap
  nowMs: number
  query: string
  scope: SessionNotesScope
  pinnedUserId?: string | null
  pinnedJobId?: string | null
}): SessionNotesLine[] {
  const tokens = sessionNotesSearchTokens(args.query)
  const lines: SessionNotesLine[] = []
  for (const row of args.rows) {
    // Revoked rows are excluded by the fetch; rejected time is voided — neither reads as work.
    if (row.revoked_at || row.rejected_at) continue
    if (args.pinnedUserId && row.user_id !== args.pinnedUserId) continue
    if (args.pinnedJobId && row.job_ledger_id !== args.pinnedJobId) continue
    const bookedTo = sessionNotesBookedTo(row, args.officeJobId)
    if (args.scope !== 'all' && bookedTo !== args.scope) continue
    const line: SessionNotesLine = {
      id: row.id,
      userId: row.user_id,
      personName: (row.users?.name ?? '').trim() || 'Unknown',
      salarySchedule: row.origin === 'salary_schedule',
      workDate: row.work_date,
      clockedInAt: row.clocked_in_at,
      clockedOutAt: row.clocked_out_at,
      hours: sessionNotesHours(row, args.nowMs),
      status: sessionNotesStatus(row),
      bookedTo,
      jobId: row.job_ledger_id,
      bidId: row.bid_id,
      whereLabel: whereLabelFor(row, bookedTo, args.prefixMap),
      note: (row.notes ?? '').trim(),
      suggestions: sessionNotesSuggestions(row, args.jobIndex, args.prefixMap),
    }
    if (!sessionNotesLineMatches(line, tokens)) continue
    lines.push(line)
  }
  lines.sort((a, b) => (a.clockedInAt < b.clockedInAt ? 1 : a.clockedInAt > b.clockedInAt ? -1 : 0))
  return lines
}

export type SessionNotesGroup = { key: string; label: string; lines: SessionNotesLine[] }

/**
 * Groups preserve the newest-first line order; day/person/job keys appear in
 * the order their first line does. `label` is raw (a ymd for days) — the
 * component formats it.
 */
export function groupSessionNotesLines(lines: readonly SessionNotesLine[], groupBy: SessionNotesGroupBy): SessionNotesGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: '', lines: [...lines] }]
  const groups = new Map<string, SessionNotesGroup>()
  for (const l of lines) {
    let key: string
    let label: string
    if (groupBy === 'day') {
      key = l.workDate
      label = l.workDate
    } else if (groupBy === 'person') {
      key = l.userId
      label = l.personName
    } else {
      key = l.jobId ?? l.bidId ?? `__${l.bookedTo}`
      label = l.whereLabel ?? (l.bookedTo === 'office' ? 'Office' : 'Booked to nothing')
    }
    const g = groups.get(key)
    if (g) g.lines.push(l)
    else groups.set(key, { key, label, lines: [l] })
  }
  const out = [...groups.values()]
  if (groupBy === 'person') out.sort((a, b) => a.label.localeCompare(b.label))
  if (groupBy === 'job') {
    // Real jobs and bids alphabetically, then Office, then the unbooked pile.
    const rank = (g: SessionNotesGroup): number => (g.key === '__office' ? 1 : g.key === '__none' ? 2 : 0)
    out.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
  }
  return out
}

export type SessionNotesSummary = {
  sessions: number
  people: number
  hours: number
  /** Lines whose note names a job they aren't booked to. */
  suggested: number
}

export function summarizeSessionNotesLines(lines: readonly SessionNotesLine[]): SessionNotesSummary {
  const people = new Set<string>()
  let hours = 0
  let suggested = 0
  for (const l of lines) {
    people.add(l.userId)
    hours += l.hours
    if (l.suggestions.length > 0) suggested += 1
  }
  return { sessions: lines.length, people: people.size, hours, suggested }
}

export type SessionNotesTextSegment = { text: string; match: boolean }

/** Case-insensitive highlight of every token occurrence; no tokens → one plain segment. */
export function splitSessionNotesTextByTokens(text: string, tokens: readonly string[]): SessionNotesTextSegment[] {
  const toks = tokens.filter(Boolean)
  if (!text || toks.length === 0) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const flags = new Array<boolean>(text.length).fill(false)
  for (const t of toks) {
    let pos = 0
    while (pos < lower.length) {
      const hit = lower.indexOf(t, pos)
      if (hit === -1) break
      for (let i = hit; i < hit + t.length; i++) flags[i] = true
      pos = hit + t.length
    }
  }
  const out: SessionNotesTextSegment[] = []
  let start = 0
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || flags[i] !== flags[start]) {
      out.push({ text: text.slice(start, i), match: flags[start] === true })
      start = i
    }
  }
  return out
}

/** `days` back from today inclusive; 0 → null (no lower bound). */
export function sessionNotesWindowStartYmd(todayYmd: string, days: SessionNotesWindowDays, addDays: (ymd: string, delta: number) => string): string | null {
  if (days === 0) return null
  return addDays(todayYmd, -(days - 1))
}

/** Row patch after an Assign/Change so the line re-renders without a refetch. */
export function applySessionNotesAssignment(
  row: SessionNotesRow,
  selection:
    | { source: 'job'; id: string; hcp_number: string; click_number?: string | null; job_name: string; service_type_id?: string | null }
    | { source: 'bid'; id: string; bid_number: string; project_name: string; service_type_id?: string | null }
    | null,
): SessionNotesRow {
  if (!selection) return { ...row, job_ledger_id: null, bid_id: null, jobs_ledger: null, bids: null }
  if (selection.source === 'job') {
    return {
      ...row,
      job_ledger_id: selection.id,
      bid_id: null,
      bids: null,
      jobs_ledger: {
        hcp_number: selection.hcp_number,
        click_number: selection.click_number ?? null,
        job_name: selection.job_name,
        service_type_id: selection.service_type_id ?? null,
      },
    }
  }
  return {
    ...row,
    job_ledger_id: null,
    jobs_ledger: null,
    bid_id: selection.id,
    bids: { bid_number: selection.bid_number, project_name: selection.project_name, service_type_id: selection.service_type_id ?? null },
  }
}
