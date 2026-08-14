import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { fetchDispatchScheduledJobsForAssigneeDay, type DispatchScheduledJobForAssign } from '../../lib/jobScheduleBlocks'
import {
  buildSessionMatchSuggestions,
  isMatchableUnassignedSession,
  singleDispatchSuggestion,
  extractCandidateJobNumbersFromNote,
  type MatchableClockSession,
  type MatchBidIdentity,
  type MatchJobIdentity,
  type SessionMatchSuggestion,
} from '../../lib/matchClockSessions'
import { AssignSessionJobPopover } from '../clock-sessions/AssignSessionJobPopover'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import { APP_CALENDAR_TZ, denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'

/**
 * The "Match sessions" flow: every clock session in the last 7 days with no
 * job or bid, grouped by person, each led by one-tap suggestions from the
 * matchClockSessions kernel (dispatch / crew / note). Assign writes the same
 * `clock_sessions.job_ledger_id` / `bid_id` update the assign popover does;
 * the popover itself is the search fallback. Salary-materialized segments are
 * excluded (they legitimately carry no job).
 *
 * Two hosts share the state hook + card list below:
 * - `MatchClockSessionsModal` — People → Hours (opened from the Currently
 *   clocked in header), unchanged since v2.1584.
 * - `MatchClockSessionsInline` — Quickfill's Unassigned field time section
 *   renders the same content spread out on the page instead of behind a
 *   button (owner request), hidden entirely when the window is clear.
 */

const WINDOW_DAYS = 7

type SessionWithName = MatchableClockSession & { users: { name: string | null } | null }

const SESSION_SELECT =
  'id, user_id, work_date, clocked_in_at, clocked_out_at, notes, job_ledger_id, bid_id, salary_segment_index, users:user_id(name)'

function windowStartYmd(nowMs: number): string {
  return ymdAddDays(denverCalendarDayKey(nowMs), -(WINDOW_DAYS - 1))
}

/** Shared filters for the list and the header-button count. */
function unassignedWindowQuery(startYmd: string) {
  return supabase
    .from('clock_sessions')
    .select('id', { count: 'exact', head: true })
    .gte('work_date', startYmd)
    .is('rejected_at', null)
    .is('revoked_at', null)
    .is('job_ledger_id', null)
    .is('bid_id', null)
    .is('salary_segment_index', null)
}

/** Count for the "Match sessions" header button badge. */
export async function fetchUnassignedClockSessionCount(): Promise<number> {
  try {
    const { count, error } = await unassignedWindowQuery(windowStartYmd(Date.now()))
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

function formatDayLabel(workDateYmd: string, todayYmd: string): string {
  if (workDateYmd === todayYmd) return 'Today'
  const dt = new Date(`${workDateYmd}T12:00:00`)
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

function durationLabel(s: MatchableClockSession, nowMs: number): string {
  const inMs = new Date(s.clocked_in_at).getTime()
  const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : nowMs
  const mins = Math.max(0, Math.round((outMs - inMs) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function windowSummaryLabel(count: number): string {
  return `${count} session${count === 1 ? '' : 's'} in the last ${WINDOW_DAYS} days ${count === 1 ? 'has' : 'have'} no job or bid`
}

const tradePillStyle: CSSProperties = {
  display: 'inline-block',
  borderRadius: 3,
  fontSize: '0.65rem',
  fontWeight: 700,
  padding: '0.05rem 0.3rem',
  marginRight: '0.35rem',
  verticalAlign: '1px',
  color: '#fff',
}

const SUG_EDGE: Record<SessionMatchSuggestion['kind'], string> = {
  dispatch: '#16a34a',
  crew: '#3b82f6',
  note: '#8b5cf6',
}

const SUG_KIND_LABEL: Record<SessionMatchSuggestion['kind'], string> = {
  dispatch: 'Dispatch',
  crew: 'Crew that day',
  note: 'From note',
}

function suggestionTargetLabel(s: SessionMatchSuggestion): { pill: { tag: string; color: string } | null; text: string } {
  if (s.target.type === 'job') {
    const j = s.target.job
    const num = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()
    return {
      pill: getBidServiceTypeTag(j.service_type_name),
      text: `${num ? `${num} · ` : ''}${(j.job_name ?? '').trim() || 'Job'}`,
    }
  }
  const b = s.target.bid
  return {
    pill: getBidServiceTypeTag(b.service_type_name),
    text: `B${(b.bid_number ?? '').trim() || '—'} · ${(b.project_name ?? '').trim() || 'Bid'}`,
  }
}

type MatchedInfo = { label: string }

/** All match-sessions state + actions, shared by the modal and inline hosts. */
function useMatchClockSessions(active: boolean, onSessionsChanged?: () => void) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionWithName[]>([])
  const [dispatchBySessionId, setDispatchBySessionId] = useState<Map<string, DispatchScheduledJobForAssign[]>>(new Map())
  const [jobsById, setJobsById] = useState<Map<string, MatchJobIdentity>>(new Map())
  const [bidsById, setBidsById] = useState<Map<string, MatchBidIdentity>>(new Map())
  const [jobsByNumber, setJobsByNumber] = useState<Map<string, MatchJobIdentity>>(new Map())
  const [matched, setMatched] = useState<Map<string, MatchedInfo>>(new Map())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const nowMs = Date.now()
  const todayYmd = denverCalendarDayKey(nowMs)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const startYmd = windowStartYmd(Date.now())
      const rows = (await withSupabaseRetry(
        async () =>
          await supabase
            .from('clock_sessions')
            .select(SESSION_SELECT)
            .gte('work_date', startYmd)
            .is('rejected_at', null)
            .is('revoked_at', null)
            .order('work_date', { ascending: false })
            .order('clocked_in_at', { ascending: true }),
        'match sessions: load window',
      )) as unknown as SessionWithName[]
      const all = rows ?? []
      const unassigned = all.filter(isMatchableUnassignedSession)
      setSessions(all)

      // Dispatch picks per unique person+day among the unassigned sessions.
      const pairs = [...new Map(unassigned.map((s) => [`${s.user_id}|${s.work_date}`, s])).values()]
      const dispatchEntries = await Promise.all(
        pairs.map(async (s) => {
          const { data } = await fetchDispatchScheduledJobsForAssigneeDay(s.user_id, s.work_date)
          return [`${s.user_id}|${s.work_date}`, data] as const
        }),
      )
      const dispatchByPair = new Map(dispatchEntries)
      setDispatchBySessionId(
        new Map(unassigned.map((s) => [s.id, dispatchByPair.get(`${s.user_id}|${s.work_date}`) ?? []])),
      )

      // Job identities: sibling-assigned jobs + dispatch jobs + note numbers.
      const jobIds = new Set<string>()
      const noteNumbers = new Set<string>()
      const bidIds = new Set<string>()
      for (const s of all) {
        if (s.job_ledger_id) jobIds.add(s.job_ledger_id)
        if (s.bid_id) bidIds.add(s.bid_id)
      }
      for (const picks of dispatchByPair.values()) for (const p of picks) jobIds.add(p.jobId)
      for (const s of unassigned) for (const n of extractCandidateJobNumbersFromNote(s.notes)) noteNumbers.add(n)

      const [jobRows, noteJobRows, bidRows] = await Promise.all([
        jobIds.size
          ? withSupabaseRetry(
              async () =>
                await supabase
                  .from('jobs_ledger')
                  .select('id, hcp_number, click_number, job_name, service_types:service_type_id(name)')
                  .in('id', [...jobIds]),
              'match sessions: jobs by id',
            )
          : Promise.resolve([]),
        noteNumbers.size
          ? withSupabaseRetry(
              async () =>
                await supabase
                  .from('jobs_ledger')
                  .select('id, hcp_number, click_number, job_name, service_types:service_type_id(name)')
                  .in('hcp_number', [...noteNumbers]),
              'match sessions: jobs by note number',
            )
          : Promise.resolve([]),
        bidIds.size
          ? withSupabaseRetry(
              async () =>
                await supabase
                  .from('bids')
                  .select('id, bid_number, project_name, service_types:service_type_id(name)')
                  .in('id', [...bidIds]),
              'match sessions: bids by id',
            )
          : Promise.resolve([]),
      ])

      type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; service_types: { name: string } | null }
      const toJob = (r: JobRow): MatchJobIdentity => ({
        id: r.id,
        hcp_number: r.hcp_number,
        click_number: r.click_number,
        job_name: r.job_name,
        service_type_name: r.service_types?.name ?? null,
      })
      const byId = new Map<string, MatchJobIdentity>()
      for (const r of [...((jobRows ?? []) as JobRow[]), ...((noteJobRows ?? []) as JobRow[])]) byId.set(r.id, toJob(r))
      setJobsById(byId)

      // Numbers resolving to exactly one job — ambiguous numbers suggest nothing.
      const byNumber = new Map<string, MatchJobIdentity | 'ambiguous'>()
      for (const r of (noteJobRows ?? []) as JobRow[]) {
        const n = (r.hcp_number ?? '').trim()
        if (!n) continue
        byNumber.set(n, byNumber.has(n) ? 'ambiguous' : toJob(r))
      }
      setJobsByNumber(new Map([...byNumber].filter(([, v]) => v !== 'ambiguous') as [string, MatchJobIdentity][]))

      type BidRow = { id: string; bid_number: string | null; project_name: string | null; service_types: { name: string } | null }
      setBidsById(
        new Map(
          ((bidRows ?? []) as BidRow[]).map((r) => [
            r.id,
            { id: r.id, bid_number: r.bid_number, project_name: r.project_name, service_type_name: r.service_types?.name ?? null },
          ]),
        ),
      )
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    setMatched(new Map())
    setSkipped(new Set())
    void load()
  }, [active, load])

  const unassigned = useMemo(() => sessions.filter(isMatchableUnassignedSession), [sessions])

  const suggestionsBySessionId = useMemo(() => {
    const out = new Map<string, SessionMatchSuggestion[]>()
    for (const s of unassigned) {
      out.set(
        s.id,
        buildSessionMatchSuggestions({
          session: s,
          dispatchPicks: dispatchBySessionId.get(s.id) ?? [],
          sameDaySessions: sessions.filter((x) => x.user_id === s.user_id && x.work_date === s.work_date && x.id !== s.id),
          jobsById,
          bidsById,
          jobsByNumber,
          formatSiblingTime: formatTimeShort,
        }),
      )
    }
    return out
  }, [unassigned, sessions, dispatchBySessionId, jobsById, bidsById, jobsByNumber])

  const visible = useMemo(() => unassigned.filter((s) => !skipped.has(s.id)), [unassigned, skipped])

  const groups = useMemo(() => {
    const byPerson = new Map<string, SessionWithName[]>()
    for (const s of visible) {
      const name = s.users?.name?.trim() || 'Unknown'
      const list = byPerson.get(name) ?? []
      list.push(s)
      byPerson.set(name, list)
    }
    return [...byPerson.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visible])

  const applySuggestion = useCallback(
    async (s: MatchableClockSession, sug: SessionMatchSuggestion) => {
      setSavingId(s.id)
      setError(null)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('clock_sessions')
              .update({
                job_ledger_id: sug.target.type === 'job' ? sug.target.job.id : null,
                bid_id: sug.target.type === 'bid' ? sug.target.bid.id : null,
              })
              .eq('id', s.id),
          'match sessions: assign',
        )
        const { text } = suggestionTargetLabel(sug)
        setMatched((m) => new Map(m).set(s.id, { label: text }))
        onSessionsChanged?.()
      } catch (e) {
        setError(formatErrorMessage(e))
      } finally {
        setSavingId(null)
      }
    },
    [onSessionsChanged],
  )

  const undoMatch = useCallback(
    async (sessionId: string) => {
      setSavingId(sessionId)
      setError(null)
      try {
        await withSupabaseRetry(
          async () => supabase.from('clock_sessions').update({ job_ledger_id: null, bid_id: null }).eq('id', sessionId),
          'match sessions: undo',
        )
        setMatched((m) => {
          const next = new Map(m)
          next.delete(sessionId)
          return next
        })
        onSessionsChanged?.()
      } catch (e) {
        setError(formatErrorMessage(e))
      } finally {
        setSavingId(null)
      }
    },
    [onSessionsChanged],
  )

  const markMatchedViaSearch = useCallback(
    (sessionId: string) => {
      setMatched((m) => new Map(m).set(sessionId, { label: 'a job or bid (via search)' }))
      onSessionsChanged?.()
    },
    [onSessionsChanged],
  )

  const skip = useCallback((sessionId: string) => {
    setSkipped((prev) => new Set(prev).add(sessionId))
  }, [])

  const bulkTargets = useMemo(
    () =>
      visible
        .filter((s) => !matched.has(s.id))
        .map((s) => ({ s, sug: singleDispatchSuggestion(suggestionsBySessionId.get(s.id) ?? []) }))
        .filter((x): x is { s: SessionWithName; sug: SessionMatchSuggestion } => x.sug != null),
    [visible, matched, suggestionsBySessionId],
  )

  const applyBulk = useCallback(async () => {
    // Sequential on purpose — each write confirms before the next starts.
    for (const { s, sug } of bulkTargets) {
      await applySuggestion(s, sug)
    }
  }, [bulkTargets, applySuggestion])

  return {
    loading,
    error,
    setError,
    unassignedCount: unassigned.length,
    visible,
    groups,
    suggestionsBySessionId,
    matched,
    savingId,
    nowMs,
    todayYmd,
    applySuggestion,
    undoMatch,
    markMatchedViaSearch,
    skip,
    bulkTargets,
    applyBulk,
  }
}

type MatchState = ReturnType<typeof useMatchClockSessions>

/**
 * The per-person session cards, shared by both hosts. `layout: 'grid'` spreads
 * the person groups across the page width (inline host); `'list'` stacks them
 * (modal). `popoverZIndex` keeps the search popover above a modal overlay.
 */
function MatchSessionGroups({ st, layout, popoverZIndex }: { st: MatchState; layout: 'list' | 'grid'; popoverZIndex?: number }) {
  return (
    <>
      {st.error ? (
        <p style={{ color: 'var(--text-red-600)', fontSize: '0.8125rem' }}>{st.error}</p>
      ) : null}
      <div
        style={
          layout === 'grid'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', columnGap: 14, alignItems: 'start' }
            : undefined
        }
      >
        {st.groups.map(([person, list]) => (
          <div key={person} style={{ padding: '0.5rem 0 0.1rem' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
              {person}
            </div>
            {list.map((s) => {
              const done = st.matched.get(s.id)
              const sugs = st.suggestionsBySessionId.get(s.id) ?? []
              const isOpenSession = s.clocked_out_at == null
              return (
                <div key={s.id} style={{ border: '1px solid var(--border)', background: 'var(--bg-subtle)', borderRadius: 10, padding: '0.6rem 0.75rem', marginBottom: 10 }}>
                  {done ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text-green-800)' }}>
                      ✓ Matched to {done.label}
                      <button
                        type="button"
                        onClick={() => void st.undoMatch(s.id)}
                        disabled={st.savingId === s.id}
                        style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        Undo
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 650, fontSize: '0.875rem' }}>
                          {formatDayLabel(s.work_date, st.todayYmd)} · {formatTimeShort(s.clocked_in_at)}
                          {s.clocked_out_at ? ` – ${formatTimeShort(s.clocked_out_at)}` : ' →'}
                        </span>
                        {isOpenSession ? (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-green-800)', fontWeight: 650 }}>
                            ● still clocked in · {durationLabel(s, st.nowMs)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>{durationLabel(s, st.nowMs)}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.notes.trim() ? `"${s.notes.trim()}"` : 'no clock note'}
                      </div>
                      {sugs.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                          {sugs.map((sug, i) => {
                            const { pill, text } = suggestionTargetLabel(sug)
                            return (
                              <div
                                key={i}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderLeft: `3px solid ${SUG_EDGE[sug.kind]}`, borderRadius: 8, padding: '0.35rem 0.5rem 0.35rem 0.6rem', background: 'var(--surface)', minWidth: 0 }}
                              >
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: SUG_EDGE[sug.kind], flexShrink: 0 }}>
                                  {SUG_KIND_LABEL[sug.kind]}
                                </span>
                                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem' }} title={`${text} · ${sug.detail}`}>
                                  {pill ? <span style={{ ...tradePillStyle, background: pill.color }}>{pill.tag}</span> : null}
                                  {text} <span style={{ color: 'var(--text-muted)' }}>· {sug.detail}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void st.applySuggestion(s, sug)}
                                  disabled={st.savingId != null}
                                  style={{ marginLeft: 'auto', flexShrink: 0, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 650, cursor: st.savingId != null ? 'not-allowed' : 'pointer' }}
                                >
                                  {st.savingId === s.id ? '…' : 'Assign'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                        <AssignSessionJobPopover
                          session={{ id: s.id, job_ledger_id: s.job_ledger_id, bid_id: s.bid_id }}
                          onSaved={() => st.markMatchedViaSearch(s.id)}
                          onError={(msg) => st.setError(msg)}
                          popoverZIndex={popoverZIndex}
                          assignTriggerLabel="Search jobs & bids…"
                          dispatchScheduleAssigneeUserId={s.user_id}
                          dispatchScheduleWorkDateYmd={s.work_date}
                        />
                        <button
                          type="button"
                          onClick={() => st.skip(s.id)}
                          style={{ fontSize: '0.75rem', color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Skip
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

/** The "N sessions have exactly one Dispatch match — Apply all" row. */
function BulkApplyControls({ st }: { st: MatchState }) {
  if (st.bulkTargets.length === 0) return null
  return (
    <>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {st.bulkTargets.length} session{st.bulkTargets.length === 1 ? ' has' : 's have'} exactly one Dispatch match
      </span>
      <button
        type="button"
        onClick={() => void st.applyBulk()}
        disabled={st.savingId != null}
        style={{ background: 'none', border: '1px solid #16a34a', color: 'var(--text-green-800)', borderRadius: 8, padding: '0.3rem 0.75rem', fontSize: '0.8125rem', fontWeight: 650, cursor: 'pointer' }}
      >
        Apply {st.bulkTargets.length === 1 ? 'it' : `all ${st.bulkTargets.length}`}
      </button>
    </>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  /** Fires after any assign/undo so hosts can refresh strips + the button count. */
  onSessionsChanged?: () => void
}

export function MatchClockSessionsModal({ open, onClose, onSessionsChanged }: Props) {
  const st = useMatchClockSessions(open, onSessionsChanged)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Match sessions to jobs"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 'min(640px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '0.85rem 1.1rem 0.7rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Match sessions to jobs</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {st.loading ? 'Loading sessions…' : windowSummaryLabel(st.visible.length)}
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.5rem 1.1rem', flex: 1 }}>
          {!st.loading && st.visible.length === 0 && !st.error ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '0.75rem 0' }}>
              Nothing to match — every session in the window has a job or bid. 🎉
            </p>
          ) : null}
          <MatchSessionGroups st={st} layout="list" popoverZIndex={1250} />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 1.1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BulkApplyControls st={st} />
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.3rem 0.9rem', fontSize: '0.8125rem', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Inline host (Quickfill → Unassigned field time): the modal's contents spread
 * out on the page. Renders nothing when the window has no sessions to match;
 * matched/skipped cards behave exactly as in the modal.
 */
export function MatchClockSessionsInline({ onSessionsChanged }: { onSessionsChanged?: () => void }) {
  const st = useMatchClockSessions(true, onSessionsChanged)

  if (!st.loading && st.unassignedCount === 0 && !st.error) return null

  return (
    <div aria-label="Match sessions to jobs" style={{ margin: '0 0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Match sessions to jobs</span>
        <span style={{ fontSize: '0.8125rem', color: st.visible.length > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>
          {st.loading ? 'Loading sessions…' : windowSummaryLabel(st.visible.length)}
        </span>
      </div>
      {!st.loading && st.visible.length === 0 && st.unassignedCount > 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
          Every session here is matched or skipped.
        </p>
      ) : null}
      <MatchSessionGroups st={st} layout="grid" />
      {st.bulkTargets.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <BulkApplyControls st={st} />
        </div>
      ) : null}
    </div>
  )
}
