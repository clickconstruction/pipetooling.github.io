import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import {
  formatBlockDurationMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
} from '../../lib/dispatchAddBlockTime'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useAuth } from '../../hooks/useAuth'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../../lib/scheduleDispatchEditRoles'
import QuickAssignSheet from './QuickAssignSheet'
import {
  dispatchModeAddDays,
  dispatchModeAgendaHeading,
  dispatchModeMonthTitle,
  dispatchModeTwoWeekGrid,
  fetchDispatchModeBusyDays,
  fetchDispatchModeDayBlocks,
  type DispatchModeAgendaBlock,
} from '../../lib/dispatchModeSchedule'

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const headerBtn: CSSProperties = {
  padding: '0.35rem 0.6rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  color: 'var(--text-link)',
  fontSize: '0.9375rem',
  fontWeight: 600,
}

/** Dispatch Mode → Schedule tab: month mini-calendar + all-people day agenda. */
export default function DispatchModeSchedule({ selfUserId }: { selfUserId?: string } = {}) {
  const jobDetailModal = useJobDetailModal()

  const { role } = useAuth()
  const canQuickAssign = !selfUserId && role != null && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)
  const [quickAssignOpen, setQuickAssignOpen] = useState(false)
  const todayYmd = denverCalendarDayKey(Date.now())
  const [selectedYmd, setSelectedYmd] = useState<string>(todayYmd)
  /** Anchor for the visible two-week window; ‹ › shift it ±14 days across months. */
  const [anchorYmd, setAnchorYmd] = useState<string>(todayYmd)
  const isMobile = useIsMobile()

  /** Anchor's week + the next (Sunday-first) — the visible strip. */
  const weeks = useMemo(() => dispatchModeTwoWeekGrid(anchorYmd), [anchorYmd])
  const gridStart = weeks[0]?.[0]?.ymd ?? todayYmd
  const gridEnd = weeks[weeks.length - 1]?.[6]?.ymd ?? todayYmd

  const [busyDays, setBusyDays] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    let cancelled = false
    void fetchDispatchModeBusyDays(gridStart, gridEnd, selfUserId).then(({ data }) => {
      if (!cancelled) setBusyDays(data)
    })
    return () => {
      cancelled = true
    }
  }, [gridStart, gridEnd, selfUserId])

  const [blocks, setBlocks] = useState<DispatchModeAgendaBlock[]>([])
  /** Empty set = everyone. Person ids survive day switches; absent people just contribute nothing. */
  const [personFilter, setPersonFilter] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDay = useCallback(
    async (ymd: string) => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await fetchDispatchModeDayBlocks(ymd, selfUserId)
      setBlocks(data)
      setError(err)
      setLoading(false)
    },
    [selfUserId],
  )

  useEffect(() => {
    void loadDay(selectedYmd)
  }, [selectedYmd, loadDay])

  const goToday = () => {
    setSelectedYmd(todayYmd)
    setAnchorYmd(todayYmd)
  }

  const shiftWindow = (deltaDays: number) => {
    const nextAnchor = dispatchModeAddDays(anchorYmd, deltaDays)
    setAnchorYmd(nextAnchor)
    const nextWeeks = dispatchModeTwoWeekGrid(nextAnchor)
    const flat = nextWeeks.flat()
    if (!flat.some((d) => d.ymd === selectedYmd)) {
      setSelectedYmd(flat[0]?.ymd ?? nextAnchor)
    }
  }

  const monthLabel = useMemo(() => {
    const first = weeks[0]?.[0]?.ymd
    const last = weeks[weeks.length - 1]?.[6]?.ymd
    if (!first || !last) return ''
    const a = dispatchModeMonthTitle(first)
    const b = dispatchModeMonthTitle(last)
    if (a === b) return a
    // "July – August 2026" (drop the first year when both match)
    const [am, ay] = a.split(' ')
    const [bm, by] = b.split(' ')
    return ay === by ? `${am} – ${bm} ${by}` : `${a} – ${b}`
  }, [weeks])

  /** Unique assignees on the selected day, alphabetical — the filter chip row. */
  const dayPeople = useMemo(() => {
    const byId = new Map<string, string>()
    for (const b of blocks) byId.set(b.assigneeUserId, b.assigneeName)
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [blocks])

  const visibleBlocks = useMemo(
    () => (personFilter.size === 0 ? blocks : blocks.filter((b) => personFilter.has(b.assigneeUserId))),
    [blocks, personFilter],
  )

  const togglePerson = (id: string) => {
    setPersonFilter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header: bell (note to dispatch) · Schedule · Today */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <button
            type="button"
            aria-label="Previous two weeks"
            onClick={() => shiftWindow(-14)}
            style={{ ...headerBtn, padding: '0.35rem 0.4rem' }}
          >
            ‹
          </button>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-700)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next two weeks"
            onClick={() => shiftWindow(14)}
            style={{ ...headerBtn, padding: '0.35rem 0.4rem' }}
          >
            ›
          </button>
        </div>
        <h1 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-strong)' }}>Schedule</h1>
        <button type="button" onClick={goToday} style={headerBtn}>
          Today
        </button>
      </div>

      {/* This week + next week strip */}
      <div style={{ padding: '0 0.75rem 0.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
          {WEEKDAY_LETTERS.map((w, i) => (
            <span
              key={`${w}-${i}`}
              aria-hidden="true"
              style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}
            >
              {w}
            </span>
          ))}
          {weeks.flat().map((day) => {
            const selected = day.ymd === selectedYmd
            const isToday = day.ymd === todayYmd
            return (
              <button
                key={day.ymd}
                type="button"
                aria-label={`Show schedule for ${day.ymd}`}
                aria-pressed={selected}
                onClick={() => setSelectedYmd(day.ymd)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '0.15rem 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    fontSize: '0.9375rem',
                    fontWeight: isToday || selected ? 700 : 400,
                    background: selected ? '#2563eb' : 'transparent',
                    color: selected
                      ? '#fff'
                      : day.inMonth
                        ? isToday
                          ? 'var(--text-link)'
                          : 'var(--text-strong)'
                        : 'var(--text-faint)',
                  }}
                >
                  {day.dayNum}
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: busyDays.has(day.ymd) ? 'var(--text-muted)' : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* Person filter */}
      {!selfUserId && dayPeople.length > 1 ? (
        <div
          role="group"
          aria-label="Filter schedule by person"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            overflowX: 'auto',
            padding: '0 0.75rem 0.5rem',
          }}
        >
          <button
            type="button"
            aria-pressed={personFilter.size === 0}
            onClick={() => setPersonFilter(new Set())}
            style={{
              flexShrink: 0,
              padding: '0.25rem 0.7rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              border: personFilter.size === 0 ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 999,
              background: personFilter.size === 0 ? '#2563eb' : 'var(--surface)',
              color: personFilter.size === 0 ? '#fff' : 'var(--text-700)',
              cursor: 'pointer',
            }}
          >
            Everyone
          </button>
          {dayPeople.map((p) => {
            const active = personFilter.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => togglePerson(p.id)}
                style={{
                  flexShrink: 0,
                  padding: '0.25rem 0.7rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  border: active ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                  borderRadius: 999,
                  background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: active ? 'var(--text-blue-700)' : 'var(--text-700)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </button>
            )
          })}
        </div>
      ) : null}

      {/* Agenda */}
      <div
        style={{
          background: 'var(--bg-subtle)',
          padding: '0.5rem 0.75rem',
          fontSize: '0.9375rem',
          fontWeight: 700,
          color: 'var(--text-strong)',
        }}
      >
        {dispatchModeAgendaHeading(selectedYmd, todayYmd)}
      </div>
      {loading ? (
        <p style={{ margin: 0, padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Loading schedule…
        </p>
      ) : error ? (
        <p style={{ margin: 0, padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : visibleBlocks.length === 0 ? (
        <p style={{ margin: 0, padding: '1rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {blocks.length === 0 ? 'Nothing scheduled.' : 'Nothing scheduled for the selected people.'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {visibleBlocks.map((b) => {
            const durationMin = Math.max(
              0,
              timeInputToMinutesSafe(b.timeEnd) - timeInputToMinutesSafe(b.timeStart),
            )
            const num = effectiveJobLedgerNumber(b.hcpNumber, b.clickNumber) || '—'
            const pill = buildServiceTypeTradePill(b.serviceTypeName)
            return (
              <li key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => jobDetailModal?.openJobDetail({ jobId: b.jobId })}
                  aria-label={`Open job detail for ${num} · ${b.jobName}`}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.7rem 0.75rem',
                    border: 'none',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    minWidth: 0,
                  }}
                >
                  <span style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, width: 74 }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                      {formatDispatchQuickTimeLabel(b.timeStart)}
                    </span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-faint)' }}>
                      {formatBlockDurationMinutes(durationMin)}
                    </span>
                  </span>
                  <span
                    style={{
                      minWidth: 0,
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      borderLeft: '2px solid var(--border-strong)',
                      paddingLeft: '0.65rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      {pill ? (
                        <span aria-label={`Service type ${pill.label}`} style={{ ...pill.style, marginTop: 0, flexShrink: 0 }}>
                          {pill.label}
                        </span>
                      ) : null}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9375rem',
                          color: 'var(--text-strong)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {num} · {b.jobName}
                      </span>
                    </span>
                    {b.customerName ? (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-600)' }}>{b.customerName}</span>
                    ) : null}
                    {b.jobAddress ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{b.jobAddress}</span>
                    ) : null}
                    {isMobile ? (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-blue-700)', fontWeight: 600 }}>
                        {b.assigneeName}
                      </span>
                    ) : null}
                  </span>
                  {!isMobile ? (
                    <span
                      style={{
                        flexShrink: 0,
                        alignSelf: 'center',
                        fontSize: '0.875rem',
                        color: 'var(--text-blue-700)',
                        fontWeight: 600,
                        maxWidth: '10rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.assigneeName}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {canQuickAssign ? (
        <button
          type="button"
          onClick={() => setQuickAssignOpen(true)}
          aria-label="Assign work — pick a job, people, and a time"
          title="Assign work"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '1.6rem',
            lineHeight: 1,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            zIndex: 1001,
          }}
        >
          +
        </button>
      ) : null}
      {canQuickAssign ? (
        <QuickAssignSheet
          open={quickAssignOpen}
          onClose={() => setQuickAssignOpen(false)}
          onScheduled={() => void loadDay(selectedYmd)}
        />
      ) : null}
    </div>
  )
}
