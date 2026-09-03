import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useLedgerDisplayPrefixes } from '../../contexts/LedgerDisplayPrefixContext'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
import { compactChicagoClockTime } from '../../lib/jobs/jobActivityLine'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'
import { AssignSessionJobPopover, type AssignSessionJobSavedPatch } from '../clock-sessions/AssignSessionJobPopover'
import { fetchSessionNotes } from '../../lib/jobs/fetchSessionNotes'
import {
  SESSION_NOTES_DEFAULT_WINDOW_DAYS,
  SESSION_NOTES_GROUPS,
  SESSION_NOTES_ROW_CAP,
  SESSION_NOTES_SCOPES,
  SESSION_NOTES_WINDOWS,
  applySessionNotesAssignment,
  buildSessionNotesJobIndex,
  buildSessionNotesLines,
  buildSessionNotesServerFilter,
  groupSessionNotesLines,
  sessionNotesSearchTokens,
  sessionNotesWindowStartYmd,
  splitSessionNotesTextByTokens,
  summarizeSessionNotesLines,
  type SessionNotesGroupBy,
  type SessionNotesJobIdentity,
  type SessionNotesLine,
  type SessionNotesRow,
  type SessionNotesScope,
  type SessionNotesWindowDays,
} from '../../lib/jobs/sessionNotesSearch'

/**
 * Pipeline "Session notes" (v2.2680): every clock session in a window as one
 * line — time · hours · person · where the time is booked · the note — so the
 * office can spot a session booked to Office that plainly belongs on a job
 * ("helped terry on 961 trim") and read a job's crew history for patterns.
 *
 * Doors: the toolbar pill (global search) and the per-job "Sessions" chip
 * beside "N Reports" / in the activity expand header (arrives pinned to the
 * job). The per-job doors go through `SessionNotesOpenerContext`
 * (sessionNotesOpenerContext.ts), provided by the tab only for office roles —
 * the same no-prop-threading move as StagesSearchMark.
 *
 * Writes: Assign/Change reuse `AssignSessionJobPopover`; the purple "961?"
 * suggestion is a one-tap version of the same `clock_sessions` update. The
 * `clock_sessions_sync_crew_assignments_tr` trigger re-syncs crew jobs when a
 * session's job changes, so approved hours follow the move with no extra code.
 */
const Z_INDEX = 1001
const POPOVER_Z_INDEX = 1250
const QUERY_DEBOUNCE_MS = 300

type Props = {
  /** Pin this job on open (the per-job door). */
  initialJob: SessionNotesJobIdentity | null
  users: ReadonlyArray<{ id: string; name: string | null }>
  jobs: ReadonlyArray<SessionNotesJobIdentity>
  onOpenJobOnBoard: (jobId: string) => void
  onClose: () => void
}

const segmentedWrap: CSSProperties = {
  display: 'inline-flex',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  overflow: 'hidden',
  background: 'var(--surface)',
}

function segmentedButtonStyle(active: boolean, last: boolean): CSSProperties {
  return {
    padding: '0.3rem 0.65rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    border: 'none',
    borderRight: last ? 'none' : '1px solid var(--border)',
    background: active ? '#2563eb' : 'transparent',
    color: active ? '#fff' : 'var(--text-700)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}

const groupLabelStyle: CSSProperties = {
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginRight: 2,
  whiteSpace: 'nowrap',
}

const thStyle: CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  fontWeight: 700,
  textAlign: 'left',
  padding: '0.45rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--surface)',
  zIndex: 1,
}

const tdStyle: CSSProperties = {
  padding: '0.35rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
  fontSize: '0.8125rem',
}

const chipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  borderRadius: 999,
  padding: '0.1rem 0.55rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  border: '1px solid var(--border-strong)',
  color: 'var(--text-700)',
  background: 'var(--surface)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  maxWidth: 260,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

function statusDot(status: SessionNotesLine['status']): { color: string; title: string; ring: boolean } {
  if (status === 'open') return { color: '#16a34a', title: 'Still clocked in — hours so far', ring: true }
  if (status === 'approved') return { color: '#16a34a', title: 'Approved', ring: false }
  return { color: '#f59e0b', title: 'Awaiting approval', ring: false }
}

function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }) {
  const segs = splitSessionNotesTextByTokens(text, tokens)
  if (segs.length === 1 && !segs[0]!.match) return <>{text}</>
  return (
    <>
      {segs.map((s, i) =>
        s.match ? (
          <mark key={i} style={{ background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 3, padding: '0 2px' }}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  )
}

export default function SessionNotesModal({ initialJob, users, jobs, onOpenJobOnBoard, onClose }: Props) {
  const isMobile = useIsMobile()
  const { prefixMap } = useLedgerDisplayPrefixes()
  useBodyScrollLock(true)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [windowDays, setWindowDays] = useState<SessionNotesWindowDays>(SESSION_NOTES_DEFAULT_WINDOW_DAYS)
  const [scope, setScope] = useState<SessionNotesScope>('all')
  const [groupBy, setGroupBy] = useState<SessionNotesGroupBy>('day')
  const [pinnedJobId, setPinnedJobId] = useState<string | null>(initialJob?.id ?? null)
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null)
  const [officeJobId, setOfficeJobId] = useState<string | null>(null)
  const [rows, setRows] = useState<SessionNotesRow[]>([])
  const [loading, setLoading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const requestSeq = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), QUERY_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    let cancelled = false
    void fetchOverheadOfficeJobLedgerIdFromAppSettings()
      .then((id) => {
        if (!cancelled) setOfficeJobId(id)
      })
      .catch(() => {
        /* no office job configured → office sessions read as "a job" */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const jobIndex = useMemo(() => buildSessionNotesJobIndex(jobs), [jobs])
  const serverFilter = useMemo(
    () => buildSessionNotesServerFilter({ query: debouncedQuery, users, jobs }),
    [debouncedQuery, users, jobs],
  )
  const serverFilterKey = serverFilter ? JSON.stringify(serverFilter) : ''

  useEffect(() => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError(null)
    const startYmd = sessionNotesWindowStartYmd(denverCalendarDayKey(Date.now()), windowDays, ymdAddDays)
    void fetchSessionNotes({ startYmd, pinnedJobId, pinnedUserId, serverFilter }).then((res) => {
      if (seq !== requestSeq.current) return
      setRows(res.rows)
      setTruncated(res.truncated)
      setError(res.error)
      setLoading(false)
    })
    // serverFilter is keyed by its JSON so a re-created but equal object doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays, pinnedJobId, pinnedUserId, serverFilterKey])

  const tokens = useMemo(() => sessionNotesSearchTokens(query), [query])
  const nowMs = Date.now()
  const lines = useMemo(
    () => buildSessionNotesLines({ rows, officeJobId, jobIndex, prefixMap, nowMs, query, scope, pinnedUserId, pinnedJobId }),
    // nowMs only matters for open sessions; recomputing on every data change is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, officeJobId, jobIndex, prefixMap, query, scope, pinnedUserId, pinnedJobId],
  )
  const groups = useMemo(() => groupSessionNotesLines(lines, groupBy), [lines, groupBy])
  const summary = useMemo(() => summarizeSessionNotesLines(lines), [lines])

  const todayYmd = denverCalendarDayKey(nowMs)
  const yesterdayYmd = ymdAddDays(todayYmd, -1)
  const groupLabel = (label: string): string => {
    if (groupBy !== 'day') return label
    const tag = label === todayYmd ? ' · today' : label === yesterdayYmd ? ' · yesterday' : ''
    return `${formatStagesNextDateLabel(label)}${tag}`
  }

  const pinnedJob = pinnedJobId ? jobIndex.byId.get(pinnedJobId) ?? null : null
  const pinnedJobLabel = pinnedJob
    ? lines.find((l) => l.jobId === pinnedJobId)?.whereLabel ?? `${(pinnedJob.hcp_number ?? pinnedJob.click_number ?? '').trim() || '—'} · ${(pinnedJob.job_name ?? '').trim() || '—'}`
    : pinnedJobId
      ? initialJob && initialJob.id === pinnedJobId
        ? `${(initialJob.hcp_number ?? initialJob.click_number ?? '').trim() || '—'} · ${(initialJob.job_name ?? '').trim() || '—'}`
        : 'job'
      : null
  const pinnedUserName = pinnedUserId
    ? users.find((u) => u.id === pinnedUserId)?.name?.trim() || lines.find((l) => l.userId === pinnedUserId)?.personName || 'person'
    : null

  const patchRow = useCallback((sessionId: string, patch: AssignSessionJobSavedPatch['selection']) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== sessionId) return r
        if (patch && patch.source !== 'job' && patch.source !== 'bid') return r
        return applySessionNotesAssignment(r, patch)
      }),
    )
  }, [])

  const assignSuggestion = useCallback(
    async (sessionId: string, jobId: string) => {
      const job = jobIndex.byId.get(jobId)
      if (!job) return
      setBusySessionId(sessionId)
      setError(null)
      try {
        await withSupabaseRetry(
          async () => await supabase.from('clock_sessions').update({ job_ledger_id: jobId, bid_id: null }).eq('id', sessionId),
          'session notes assign suggestion',
        )
        patchRow(sessionId, {
          source: 'job',
          id: job.id,
          hcp_number: job.hcp_number ?? '',
          click_number: job.click_number ?? null,
          job_name: job.job_name ?? '',
          job_address: '',
          service_type_id: job.service_type_id ?? null,
        })
      } catch (e) {
        setError(formatErrorMessage(e))
      } finally {
        setBusySessionId(null)
      }
    },
    [jobIndex, patchRow],
  )

  const whereChip = (l: SessionNotesLine) => {
    if (l.bookedTo === 'office') {
      return (
        <span style={{ ...chipStyle, cursor: 'default', background: 'var(--bg-muted)' }} title="Booked to the office job">
          Office
        </span>
      )
    }
    if (l.bookedTo === 'none') {
      return (
        <span style={{ ...chipStyle, cursor: 'default', borderStyle: 'dashed', color: 'var(--text-muted)' }} title="No job or bid on this session">
          nothing
        </span>
      )
    }
    if (l.bookedTo === 'bid') {
      return (
        <span style={{ ...chipStyle, cursor: 'default', color: '#6d3fd6', borderColor: '#6d3fd6' }} title={l.whereLabel ?? 'Bid'}>
          <Highlight text={l.whereLabel ?? 'Bid'} tokens={tokens} />
        </span>
      )
    }
    const pinned = l.jobId != null && l.jobId === pinnedJobId
    return (
      <button
        type="button"
        onClick={() => l.jobId && setPinnedJobId(pinned ? null : l.jobId)}
        title={pinned ? 'Unpin this job' : 'Show only this job’s sessions'}
        aria-pressed={pinned}
        style={{ ...chipStyle, color: 'var(--text-link)', background: 'var(--bg-blue-tint)', borderColor: pinned ? '#2563eb' : 'transparent' }}
      >
        <Highlight text={l.whereLabel ?? 'Job'} tokens={tokens} />
      </button>
    )
  }

  const scopeLabel = SESSION_NOTES_SCOPES.find((s) => s.key === scope)?.label ?? 'All'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session notes"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '1.25rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: isMobile ? 0 : 14,
          width: '100%',
          height: '100%',
          maxWidth: isMobile ? 'none' : 1180,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isMobile ? 'none' : '0 24px 70px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : 0,
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.75rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Session notes</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              One line per clock session — what people wrote, and where the time landed.
            </div>
          </div>
          {isMobile ? null : <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>esc to close</span>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close session notes"
            style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.05rem', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 16rem', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.35rem 0.6rem', background: 'var(--surface)' }}>
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, people, job number or name…"
                aria-label="Search session notes, people, and jobs"
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', fontSize: '0.875rem', color: 'var(--text-strong)' }}
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>
                  ✕
                </button>
              ) : null}
            </div>
            <span style={groupLabelStyle}>Last</span>
            <span style={segmentedWrap} role="group" aria-label="Window">
              {SESSION_NOTES_WINDOWS.map((d, i) => (
                <button key={d} type="button" aria-pressed={windowDays === d} onClick={() => setWindowDays(d)} style={segmentedButtonStyle(windowDays === d, i === SESSION_NOTES_WINDOWS.length - 1)}>
                  {d === 0 ? 'All' : `${d}d`}
                </button>
              ))}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={groupLabelStyle}>Booked to</span>
            <span style={segmentedWrap} role="group" aria-label="Where the time is booked">
              {SESSION_NOTES_SCOPES.map((s, i) => (
                <button key={s.key} type="button" aria-pressed={scope === s.key} onClick={() => setScope(s.key)} style={segmentedButtonStyle(scope === s.key, i === SESSION_NOTES_SCOPES.length - 1)}>
                  {s.label}
                </button>
              ))}
            </span>
            <span style={{ ...groupLabelStyle, marginLeft: 6 }}>Group</span>
            <span style={segmentedWrap} role="group" aria-label="Group lines by">
              {SESSION_NOTES_GROUPS.map((g, i) => (
                <button key={g.key} type="button" aria-pressed={groupBy === g.key} onClick={() => setGroupBy(g.key)} style={segmentedButtonStyle(groupBy === g.key, i === SESSION_NOTES_GROUPS.length - 1)}>
                  {g.label}
                </button>
              ))}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {pinnedUserName ? (
                <button type="button" onClick={() => setPinnedUserId(null)} title="Unpin person" style={{ ...chipStyle, color: 'var(--text-link)', background: 'var(--bg-blue-tint)', borderColor: 'transparent' }}>
                  Person: {pinnedUserName} <span aria-hidden style={{ opacity: 0.7 }}>✕</span>
                </button>
              ) : null}
              {pinnedJobLabel ? (
                <button type="button" onClick={() => setPinnedJobId(null)} title="Unpin job" style={{ ...chipStyle, color: 'var(--text-link)', background: 'var(--bg-blue-tint)', borderColor: 'transparent' }}>
                  Job: {pinnedJobLabel} <span aria-hidden style={{ opacity: 0.7 }}>✕</span>
                </button>
              ) : null}
              {!pinnedUserName && !pinnedJobLabel ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>click a person or job in a row to pin it</span>
              ) : null}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-700)', padding: '0.45rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <span>
            <strong style={{ color: 'var(--text-strong)' }}>{summary.sessions}</strong> {summary.sessions === 1 ? 'session' : 'sessions'}
          </span>
          <span>
            <strong style={{ color: 'var(--text-strong)' }}>{summary.people}</strong> {summary.people === 1 ? 'person' : 'people'}
          </span>
          <span>
            <strong style={{ color: 'var(--text-strong)' }}>{summary.hours.toFixed(1)}</strong> h
          </span>
          {summary.suggested > 0 ? (
            <span style={{ color: '#6d3fd6', fontWeight: 700 }}>
              {summary.suggested} {summary.suggested === 1 ? 'mentions' : 'mention'} a job {summary.suggested === 1 ? "it's" : "they're"} not booked to
            </span>
          ) : null}
          {loading ? <span style={{ color: 'var(--text-muted)' }}>Loading…</span> : null}
          {truncated ? (
            <span style={{ color: 'var(--text-orange-700)' }}>
              Showing the newest {SESSION_NOTES_ROW_CAP.toLocaleString()} — narrow the window or search to see the rest.
            </span>
          ) : null}
          {error ? <span style={{ color: 'var(--text-red-600)' }}>{error}</span> : null}
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>Open sessions count hours so far</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {lines.length === 0 && !loading ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {rows.length === 0
                ? `No clock sessions ${windowDays === 0 ? 'on record' : `in the last ${windowDays} days`}${pinnedJobLabel ? ` on ${pinnedJobLabel}` : ''}${query.trim() ? ` matching “${query.trim()}”` : ''}.`
                : `Nothing booked to “${scopeLabel}” matches. Try All under Booked to, or clear a pin.`}
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 880 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Time</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Hrs</th>
                  <th style={thStyle}>Person</th>
                  <th style={thStyle}>Booked to</th>
                  <th style={{ ...thStyle, minWidth: 280 }}>Note</th>
                  <th style={thStyle}>Fix</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <GroupRows
                    key={g.key}
                    label={groupBy === 'none' ? null : groupLabel(g.label)}
                    lines={g.lines}
                    tokens={tokens}
                    pinnedUserId={pinnedUserId}
                    busySessionId={busySessionId}
                    whereChip={whereChip}
                    onPinPerson={(id) => setPinnedUserId((prev) => (prev === id ? null : id))}
                    onAssignSuggestion={assignSuggestion}
                    onPatch={patchRow}
                    onError={setError}
                    onOpenJobOnBoard={onOpenJobOnBoard}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.5rem 0.9rem', borderTop: '1px solid var(--border)' }}>
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', marginRight: 5, verticalAlign: 'middle' }} />
            approved
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', marginRight: 5, verticalAlign: 'middle' }} />
            awaiting approval
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 3px var(--bg-green-tint)', marginRight: 5, verticalAlign: 'middle' }} />
            still clocked in
          </span>
          <span>
            <span style={{ color: '#6d3fd6', fontWeight: 700 }}>961?</span> the note names a job this session isn’t booked to — a prompt, never an auto-move
          </span>
          <span>(s) salary-schedule segment</span>
        </div>
      </div>
    </div>
  )
}

function GroupRows({
  label,
  lines,
  tokens,
  pinnedUserId,
  busySessionId,
  whereChip,
  onPinPerson,
  onAssignSuggestion,
  onPatch,
  onError,
  onOpenJobOnBoard,
}: {
  label: string | null
  lines: SessionNotesLine[]
  tokens: readonly string[]
  pinnedUserId: string | null
  busySessionId: string | null
  whereChip: (l: SessionNotesLine) => JSX.Element
  onPinPerson: (userId: string) => void
  onAssignSuggestion: (sessionId: string, jobId: string) => void
  onPatch: (sessionId: string, selection: AssignSessionJobSavedPatch['selection']) => void
  onError: (msg: string) => void
  onOpenJobOnBoard: (jobId: string) => void
}) {
  return (
    <>
      {label ? (
        <tr>
          <td colSpan={7} style={{ ...tdStyle, background: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', padding: '0.25rem 0.6rem' }}>
            {label}
          </td>
        </tr>
      ) : null}
      {lines.map((l) => {
        const dot = statusDot(l.status)
        const busy = busySessionId === l.id
        const personPinned = pinnedUserId === l.userId
        return (
          <tr key={l.id} data-session-notes-id={l.id}>
            <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', fontSize: '0.76rem' }}>
              <span
                title={dot.title}
                aria-label={dot.title}
                style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot.color, boxShadow: dot.ring ? '0 0 0 3px var(--bg-green-tint)' : 'none', marginRight: 6, verticalAlign: 'middle' }}
              />
              {compactChicagoClockTime(l.clockedInAt)} – {l.clockedOutAt ? compactChicagoClockTime(l.clockedOutAt) : 'now'}
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{l.hours.toFixed(1)}</td>
            <td style={tdStyle}>
              <button
                type="button"
                onClick={() => onPinPerson(l.userId)}
                aria-pressed={personPinned}
                title={personPinned ? 'Unpin this person' : 'Show only this person’s sessions'}
                style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontWeight: 600, color: personPinned ? 'var(--text-link)' : 'var(--text-strong)', cursor: 'pointer' }}
              >
                <Highlight text={l.personName} tokens={tokens} />
                {l.salarySchedule ? <span style={{ color: 'var(--text-faint)', fontWeight: 400 }}> (s)</span> : null}
              </button>
            </td>
            <td style={tdStyle}>{whereChip(l)}</td>
            <td style={{ ...tdStyle, whiteSpace: 'normal', minWidth: 280, color: l.note ? 'var(--text-strong)' : 'var(--text-faint)', lineHeight: 1.4 }}>
              {l.note ? <Highlight text={l.note} tokens={tokens} /> : <em>no note</em>}
            </td>
            <td style={tdStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {l.suggestions.map((s) => (
                  <button
                    key={s.jobId}
                    type="button"
                    disabled={busy}
                    onClick={() => onAssignSuggestion(l.id, s.jobId)}
                    title={`Move this session to ${s.label}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: '1px solid #6d3fd6',
                      color: '#6d3fd6',
                      background: 'transparent',
                      borderRadius: 999,
                      padding: '0.05rem 0.2rem 0.05rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: busy ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.label.split(' · ')[0]}?
                    <span style={{ background: '#6d3fd6', color: '#fff', borderRadius: 999, padding: '0 0.5rem', lineHeight: 1.6, fontSize: '0.68rem' }}>{busy ? '…' : 'Assign'}</span>
                  </button>
                ))}
                <AssignSessionJobPopover
                  session={{ id: l.id, job_ledger_id: l.jobId, bid_id: l.bidId }}
                  onSaved={(patch) => onPatch(l.id, patch?.selection ?? null)}
                  onError={onError}
                  popoverZIndex={POPOVER_Z_INDEX}
                  compactTrigger
                  dispatchScheduleAssigneeUserId={l.userId}
                  dispatchScheduleWorkDateYmd={l.workDate}
                />
              </span>
            </td>
            <td style={tdStyle}>
              {l.bookedTo === 'job' && l.jobId ? (
                <button
                  type="button"
                  onClick={() => onOpenJobOnBoard(l.jobId!)}
                  title="Close and flash this job on the Pipeline board"
                  style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Open on board ›
                </button>
              ) : null}
            </td>
          </tr>
        )
      })}
    </>
  )
}
