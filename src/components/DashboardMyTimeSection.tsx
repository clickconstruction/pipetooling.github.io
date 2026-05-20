import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { displayNameFromAuthUser } from '../lib/displayNameFromAuthUser'
import { useAuth } from '../hooks/useAuth'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { getDefaultWeekRange, getLastWeekRange } from '../utils/dateUtils'
import { DashboardMyTimeDayEditorModal } from './DashboardMyTimeDayEditorModal'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerSummaryLine, formatJobLedgerSummaryLine } from '../lib/ledgerDisplayPrefixes'

function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

function formatHours(seconds: number): string {
  const hrs = seconds / 3600
  return hrs % 1 === 0 ? `${hrs.toFixed(1)} hrs` : `${hrs.toFixed(2)} hrs`
}

/** Split `formatHours` output so the numeric part can be styled bold and ` hrs` stays normal weight. */
function formatHoursBoldParts(seconds: number): { value: string; suffix: string } {
  const s = formatHours(seconds)
  const idx = s.indexOf(' hrs')
  if (idx === -1) return { value: s, suffix: '' }
  return { value: s.slice(0, idx), suffix: s.slice(idx) }
}

function renderBreakdownList(
  items: BreakdownItem[],
  expandedKeys: Set<string>,
  onToggleKey: (key: string) => void
) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      {items.map((item, idx) => {
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = hasChildren && expandedKeys.has(item.key)
        const isLastItem = idx === items.length - 1
        const hasSubRows = hasChildren && isExpanded
        return (
          <li key={item.key} style={{ borderBottom: isLastItem && !hasSubRows ? 'none' : '1px solid #f3f4f6' }}>
            {hasChildren ? (
              <>
                <button
                  type="button"
                  onClick={() => onToggleKey(item.key)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    margin: 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#6b7280', minWidth: '5rem' }}>
                    {formatHours(item.seconds)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                    <span aria-hidden style={{ flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
                      {item.label}
                    </span>
                  </span>
                </button>
                {hasSubRows && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, background: '#fafafa' }}>
                    {item.children!.map((sub, subIdx) => {
                      const truncated = sub.notes.length > 50 ? sub.notes.slice(0, 47) + '…' : sub.notes
                      return (
                        <li
                          key={`${item.key}-${sub.notes}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.3rem 0.75rem 0.3rem 1.25rem',
                            fontSize: '0.8125rem',
                            borderBottom: subIdx < item.children!.length - 1 ? '1px solid #f3f4f6' : 'none',
                          }}
                        >
                          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#9ca3af', minWidth: '5rem' }}>
                            {formatHours(sub.seconds)}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }} title={sub.notes}>
                            {truncated}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#6b7280', minWidth: '5rem' }}>
                  {formatHours(item.seconds)}
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
                  {item.label}
                </span>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type HoursByDayOptions = {
  sessionCountByDay?: Map<string, number>
  onDayClick?: (dateStr: string) => void
  editableRange?: { start: string; end: string }
  /** Days marked correct in People → Hours; those cells are not clickable. */
  hoursDaysCorrect?: Set<string>
  /** Salaried Dashboard UX: show “On Shift” instead of numeric hours when the day has time. */
  useOnShiftDayLabel?: boolean
}

function renderHoursByDay(weekStart: string, secondsByDay: Map<string, number>, options?: HoursByDayOptions) {
  const dates: string[] = []
  const d = new Date(weekStart + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    dates.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  const { sessionCountByDay, onDayClick, editableRange, hoursDaysCorrect, useOnShiftDayLabel } =
    options ?? {}

  return (
    <div className="hoursByDayGrid">
      {dates.map((dateStr, i) => {
        const sec = secondsByDay.get(dateStr) ?? 0
        const d2 = new Date(dateStr + 'T00:00:00')
        const label = `${DAY_NAMES[i]} ${d2.getMonth() + 1}/${d2.getDate()}`
        const parts = sec > 0 ? formatHoursBoldParts(sec) : null
        const showOnShift = Boolean(useOnShiftDayLabel && sec > 0)
        const count = sessionCountByDay?.get(dateStr) ?? 0
        const inRange =
          editableRange != null && dateStr >= editableRange.start && dateStr <= editableRange.end
        const dayLocked = Boolean(hoursDaysCorrect?.has(dateStr))
        const isInteractive =
          Boolean(onDayClick && sessionCountByDay && inRange && sec > 0 && count > 0 && !dayLocked)

        const hoursLabel = showOnShift ? 'On Shift' : parts ? `${parts.value}${parts.suffix}` : '—'

        const inner = (
          <>
            <span className="hoursByDayDateLine">{label}:</span>
            <span className="hoursByDayHoursLine">
              {showOnShift ? (
                <span style={{ fontWeight: 600 }}>On Shift</span>
              ) : parts ? (
                <>
                  <strong style={{ fontWeight: 600 }}>{parts.value}</strong>
                  {parts.suffix}
                </>
              ) : (
                '—'
              )}
            </span>
            {isInteractive ? (
              <span className="hoursByDayGoalsLine">{count === 1 ? '1 pending' : `${count} pending`}</span>
            ) : null}
          </>
        )

        if (isInteractive && onDayClick) {
          return (
            <button
              key={dateStr}
              type="button"
              className="hoursByDayCell hoursByDayCell--interactive"
              aria-label={`Edit time for ${label.replace(':', '')}, ${hoursLabel}, ${count} sessions`}
              onClick={() => onDayClick(dateStr)}
            >
              {inner}
            </button>
          )
        }

        return (
          <span key={dateStr} className="hoursByDayCell">
            {inner}
          </span>
        )
      })}
    </div>
  )
}

type SessionRow = {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
  origin: string
  salary_segment_index: number | null
}

type SubItem = { notes: string; seconds: number }

type BreakdownItem = {
  key: string
  type: 'job' | 'bid' | 'focus'
  label: string
  seconds: number
  jobId?: string
  bidId?: string
  children?: SubItem[]
}

type Props = {
  userId: string
  hoursDaysCorrect: Set<string>
  /** When true (e.g. salaried pay config), week day cells do not open the My Time day editor. */
  disableDayEditor?: boolean
}

export default function DashboardMyTimeSection({ userId, hoursDaysCorrect, disableDayEditor = false }: Props) {
  const prefixMap = useLedgerPrefixMap()
  const { user: authUser } = useAuth()
  const myTimeSubjectDisplayName = useMemo(() => {
    if (authUser?.id === userId) return displayNameFromAuthUser(authUser)?.trim() || 'You'
    return 'User'
  }, [authUser, userId])
  const [loading, setLoading] = useState(true)
  const [totalSecondsToday, setTotalSecondsToday] = useState(0)
  const [totalSecondsWeek, setTotalSecondsWeek] = useState(0)
  const [totalSecondsLastWeek, setTotalSecondsLastWeek] = useState(0)
  const [showLastWeek, setShowLastWeek] = useState(false)
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([])
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [breakdownLastWeek, setBreakdownLastWeek] = useState<BreakdownItem[]>([])
  const [expandedKeysLastWeek, setExpandedKeysLastWeek] = useState<Set<string>>(new Set())
  const [secondsByDayThisWeek, setSecondsByDayThisWeek] = useState<Map<string, number>>(new Map())
  const [secondsByDayLastWeek, setSecondsByDayLastWeek] = useState<Map<string, number>>(new Map())
  const [rawSessionsThisWeek, setRawSessionsThisWeek] = useState<SessionRow[]>([])
  const [rawSessionsLastWeek, setRawSessionsLastWeek] = useState<SessionRow[]>([])
  const [editorDate, setEditorDate] = useState<string | null>(null)
  const [myTimeJobLabels, setMyTimeJobLabels] = useState<Record<string, string>>({})
  const [myTimeBidLabels, setMyTimeBidLabels] = useState<Record<string, string>>({})

  const sessionCountByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of rawSessionsThisWeek) {
      m.set(s.work_date, (m.get(s.work_date) ?? 0) + 1)
    }
    return m
  }, [rawSessionsThisWeek])

  const sessionCountByDayLastWeek = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of rawSessionsLastWeek) {
      m.set(s.work_date, (m.get(s.work_date) ?? 0) + 1)
    }
    return m
  }, [rawSessionsLastWeek])

  const myTimeModalSessions = useMemo(() => {
    if (!editorDate) return []
    const { start, end } = getDefaultWeekRange()
    if (editorDate >= start && editorDate <= end) {
      return rawSessionsThisWeek.filter((s) => s.work_date === editorDate)
    }
    const { start: ls, end: le } = getLastWeekRange()
    if (editorDate >= ls && editorDate <= le) {
      return rawSessionsLastWeek.filter((s) => s.work_date === editorDate)
    }
    return []
  }, [editorDate, rawSessionsThisWeek, rawSessionsLastWeek])

  useEffect(() => {
    if (editorDate && hoursDaysCorrect.has(editorDate)) {
      setEditorDate(null)
    }
  }, [editorDate, hoursDaysCorrect])

  useEffect(() => {
    if (disableDayEditor && editorDate) setEditorDate(null)
  }, [disableDayEditor, editorDate])

  const loadData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const today = toLocalDateString(new Date())
    const { start, end } = getDefaultWeekRange()
    const { start: lastStart, end: lastEnd } = getLastWeekRange()
    const now = Date.now()

    const [{ data, error }, { data: lastWeekData }] = await Promise.all([
      supabase
        .from('clock_sessions')
        .select(
          'id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at, origin, salary_segment_index'
        )
        .eq('user_id', userId)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .gte('work_date', start)
        .lte('work_date', end),
      supabase
        .from('clock_sessions')
        .select(
          'id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at, origin, salary_segment_index'
        )
        .eq('user_id', userId)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .gte('work_date', lastStart)
        .lte('work_date', lastEnd),
    ])

    if (error) {
      setLoading(false)
      return
    }

    const sessions = (data ?? []) as SessionRow[]
    setRawSessionsThisWeek(sessions)
    const lastWeekSessions = (lastWeekData ?? []) as SessionRow[]
    setRawSessionsLastWeek(lastWeekSessions)

    function sessionSeconds(s: SessionRow): number {
      const inMs = new Date(s.clocked_in_at).getTime()
      const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : now
      return Math.floor((outMs - inMs) / 1000)
    }

    const todaySeconds = sessions
      .filter((s) => s.work_date === today)
      .reduce((sum, s) => sum + sessionSeconds(s), 0)
    const weekSeconds = sessions.reduce((sum, s) => sum + sessionSeconds(s), 0)
    const lastWeekSeconds = lastWeekSessions.reduce((sum, s) => sum + sessionSeconds(s), 0)

    setTotalSecondsToday(todaySeconds)
    setTotalSecondsWeek(weekSeconds)
    setTotalSecondsLastWeek(lastWeekSeconds)

    const secondsByDay = new Map<string, number>()
    for (const s of sessions) {
      const cur = secondsByDay.get(s.work_date) ?? 0
      secondsByDay.set(s.work_date, cur + sessionSeconds(s))
    }
    setSecondsByDayThisWeek(secondsByDay)

    const secondsByDayLW = new Map<string, number>()
    for (const s of lastWeekSessions) {
      const cur = secondsByDayLW.get(s.work_date) ?? 0
      secondsByDayLW.set(s.work_date, cur + sessionSeconds(s))
    }
    setSecondsByDayLastWeek(secondsByDayLW)

    type ParentGroup = { type: 'job' | 'bid'; jobId?: string; bidId?: string; byNotes: Map<string, number> }
    const parentGroups = new Map<string, ParentGroup>()
    const focusItems = new Map<string, { label: string; seconds: number }>()

    for (const s of sessions) {
      const sec = sessionSeconds(s)
      const notesKey = (s.notes || '').trim() || 'Unspecified'
      if (s.job_ledger_id) {
        const key = `job:${s.job_ledger_id}`
        let group = parentGroups.get(key)
        if (!group) {
          group = { type: 'job', jobId: s.job_ledger_id, byNotes: new Map() }
          parentGroups.set(key, group)
        }
        const cur = group.byNotes.get(notesKey) ?? 0
        group.byNotes.set(notesKey, cur + sec)
      } else if (s.bid_id) {
        const key = `bid:${s.bid_id}`
        let group = parentGroups.get(key)
        if (!group) {
          group = { type: 'bid', bidId: s.bid_id, byNotes: new Map() }
          parentGroups.set(key, group)
        }
        const cur = group.byNotes.get(notesKey) ?? 0
        group.byNotes.set(notesKey, cur + sec)
      } else {
        const truncated = notesKey.length > 50 ? notesKey.slice(0, 47) + '…' : notesKey
        const key = `focus:${notesKey}`
        const cur = focusItems.get(key)
        focusItems.set(key, { label: truncated, seconds: (cur?.seconds ?? 0) + sec })
      }
    }

    const parentGroupsLastWeek = new Map<string, ParentGroup>()
    const focusItemsLastWeek = new Map<string, { label: string; seconds: number }>()
    for (const s of lastWeekSessions) {
      const sec = sessionSeconds(s)
      const notesKey = (s.notes || '').trim() || 'Unspecified'
      if (s.job_ledger_id) {
        const key = `job:${s.job_ledger_id}`
        let group = parentGroupsLastWeek.get(key)
        if (!group) {
          group = { type: 'job', jobId: s.job_ledger_id, byNotes: new Map() }
          parentGroupsLastWeek.set(key, group)
        }
        const cur = group.byNotes.get(notesKey) ?? 0
        group.byNotes.set(notesKey, cur + sec)
      } else if (s.bid_id) {
        const key = `bid:${s.bid_id}`
        let group = parentGroupsLastWeek.get(key)
        if (!group) {
          group = { type: 'bid', bidId: s.bid_id, byNotes: new Map() }
          parentGroupsLastWeek.set(key, group)
        }
        const cur = group.byNotes.get(notesKey) ?? 0
        group.byNotes.set(notesKey, cur + sec)
      } else {
        const truncated = notesKey.length > 50 ? notesKey.slice(0, 47) + '…' : notesKey
        const key = `focus:${notesKey}`
        const cur = focusItemsLastWeek.get(key)
        focusItemsLastWeek.set(key, { label: truncated, seconds: (cur?.seconds ?? 0) + sec })
      }
    }

    const jobIds = [...parentGroups.values()].filter((v) => v.jobId).map((v) => v.jobId!)
    const bidIds = [...parentGroups.values()].filter((v) => v.bidId).map((v) => v.bidId!)
    const jobIdsLastWeek = [...parentGroupsLastWeek.values()].filter((v) => v.jobId).map((v) => v.jobId!)
    const bidIdsLastWeek = [...parentGroupsLastWeek.values()].filter((v) => v.bidId).map((v) => v.bidId!)
    const allJobIds = [...new Set([...jobIds, ...jobIdsLastWeek])]
    const allBidIds = [...new Set([...bidIds, ...bidIdsLastWeek])]

    const [jobsRes, bidsRes] = await Promise.all([
      allJobIds.length > 0 ? supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: allJobIds }) : { data: [] },
      allBidIds.length > 0 ? supabase.rpc('get_bids_by_ids', { p_bid_ids: allBidIds }) : { data: [] },
    ])

    const jobsMap = new Map<
      string,
      { hcp_number: string; job_name: string; job_address: string; service_type_id: string | null }
    >()
    for (const j of (jobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      job_name: string
      job_address: string
      service_type_id: string | null
    }>) {
      jobsMap.set(j.id, {
        hcp_number: j.hcp_number,
        job_name: j.job_name,
        job_address: j.job_address,
        service_type_id: j.service_type_id,
      })
    }
    const bidsMap = new Map<
      string,
      { bid_number: string; project_name: string; address: string; service_type_id: string | null }
    >()
    for (const b of (bidsRes.data ?? []) as Array<{
      id: string
      bid_number: string
      project_name: string
      address: string
      service_type_id: string | null
    }>) {
      bidsMap.set(b.id, {
        bid_number: b.bid_number,
        project_name: b.project_name,
        address: b.address,
        service_type_id: b.service_type_id,
      })
    }

    const jobLabelRec: Record<string, string> = {}
    for (const [jid, j] of jobsMap) {
      jobLabelRec[jid] = formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address)
    }
    const bidLabelRec: Record<string, string> = {}
    for (const [bid, b] of bidsMap) {
      bidLabelRec[bid] = formatBidLedgerSummaryLine(
        prefixMap,
        b.service_type_id,
        b.bid_number,
        b.project_name,
        b.address,
      )
    }
    setMyTimeJobLabels(jobLabelRec)
    setMyTimeBidLabels(bidLabelRec)

    const parentItems: BreakdownItem[] = []
    for (const [key, group] of parentGroups) {
      const totalSeconds = [...group.byNotes.values()].reduce((a, b) => a + b, 0)
      const children: SubItem[] = [...group.byNotes.entries()]
        .map(([notes, seconds]) => ({ notes, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
      let label = ''
      if (group.type === 'job' && group.jobId) {
        const j = jobsMap.get(group.jobId)
        label = j
          ? formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address)
          : `Job ${group.jobId.slice(0, 8)}…`
      } else if (group.type === 'bid' && group.bidId) {
        const b = bidsMap.get(group.bidId)
        label = b
          ? formatBidLedgerSummaryLine(prefixMap, b.service_type_id, b.bid_number, b.project_name, b.address)
          : `Bid ${group.bidId.slice(0, 8)}…`
      }
      parentItems.push({
        key,
        type: group.type,
        label,
        seconds: totalSeconds,
        jobId: group.jobId,
        bidId: group.bidId,
        children,
      })
    }

    const focusBreakdownItems: BreakdownItem[] =
      focusItems.size > 0
        ? [
            {
              key: 'focus:all',
              type: 'focus' as const,
              label: 'No job or bid',
              seconds: [...focusItems.values()].reduce((a, v) => a + v.seconds, 0),
              children: [...focusItems.entries()]
                .map(([, v]) => ({ notes: v.label, seconds: v.seconds }))
                .sort((a, b) => b.seconds - a.seconds),
            },
          ]
        : []

    const items: BreakdownItem[] = [...parentItems, ...focusBreakdownItems].sort((a, b) => b.seconds - a.seconds)

    const parentItemsLastWeek: BreakdownItem[] = []
    for (const [key, group] of parentGroupsLastWeek) {
      const totalSeconds = [...group.byNotes.values()].reduce((a, b) => a + b, 0)
      const children: SubItem[] = [...group.byNotes.entries()]
        .map(([notes, seconds]) => ({ notes, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
      let label = ''
      if (group.type === 'job' && group.jobId) {
        const j = jobsMap.get(group.jobId)
        label = j
          ? formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address)
          : `Job ${group.jobId.slice(0, 8)}…`
      } else if (group.type === 'bid' && group.bidId) {
        const b = bidsMap.get(group.bidId)
        label = b
          ? formatBidLedgerSummaryLine(prefixMap, b.service_type_id, b.bid_number, b.project_name, b.address)
          : `Bid ${group.bidId.slice(0, 8)}…`
      }
      parentItemsLastWeek.push({
        key,
        type: group.type,
        label,
        seconds: totalSeconds,
        jobId: group.jobId,
        bidId: group.bidId,
        children,
      })
    }
    const focusBreakdownItemsLastWeek: BreakdownItem[] =
      focusItemsLastWeek.size > 0
        ? [
            {
              key: 'focus:all',
              type: 'focus' as const,
              label: 'No job or bid',
              seconds: [...focusItemsLastWeek.values()].reduce((a, v) => a + v.seconds, 0),
              children: [...focusItemsLastWeek.entries()]
                .map(([, v]) => ({ notes: v.label, seconds: v.seconds }))
                .sort((a, b) => b.seconds - a.seconds),
            },
          ]
        : []
    const itemsLastWeek: BreakdownItem[] = [...parentItemsLastWeek, ...focusBreakdownItemsLastWeek].sort(
      (a, b) => b.seconds - a.seconds
    )

    setBreakdown(items)
    setBreakdownLastWeek(itemsLastWeek)
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      for (const i of items) {
        if (i.children) next.add(i.key)
      }
      return next
    })
    setExpandedKeysLastWeek((prev) => {
      const next = new Set(prev)
      for (const i of itemsLastWeek) {
        if (i.children) next.add(i.key)
      }
      return next
    })
    setLoading(false)
  }, [userId, prefixMap])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Server-side filter so we only receive this user's clock_sessions events.
  // Previously we filtered the payload client-side which still required every
  // user's row event to land in the browser.
  const myTimeFilters = useMemo(
    () => (userId
      ? [{ event: '*' as const, schema: 'public', table: 'clock_sessions', filter: `user_id=eq.${userId}` }]
      : []),
    [userId],
  )
  useRealtimeChannel(
    !!userId,
    'dashboard-my-time-clock-sessions',
    myTimeFilters,
    () => {
      void loadData()
    },
    { debounceMs: 500 },
  )

  const handleToggleLastWeek = () => setShowLastWeek((prev) => !prev)

  if (loading && breakdown.length === 0) {
    return (
      <div style={{ marginTop: '2rem', marginBottom: '1rem' }} role="region" aria-label="My time summary">
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
      <div
        role="region"
        aria-label="My time summary"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', textAlign: 'center' }}
      >
        <span style={{ fontSize: '1rem', fontVariantNumeric: 'tabular-nums', fontWeight: 500, lineHeight: 1.25 }}>
          Today: {formatElapsed(totalSecondsToday)} | Week: {formatElapsed(totalSecondsWeek)}
        </span>
      </div>
      {breakdown.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setBreakdownOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0',
              margin: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            <span aria-hidden>{breakdownOpen ? '▼' : '▶'}</span>
            This week detail
          </button>
          {breakdownOpen && (
            <>
              {renderHoursByDay(getDefaultWeekRange().start, secondsByDayThisWeek, {
                sessionCountByDay,
                onDayClick: disableDayEditor ? undefined : setEditorDate,
                editableRange: getDefaultWeekRange(),
                hoursDaysCorrect,
                useOnShiftDayLabel: disableDayEditor,
              })}
              {renderBreakdownList(breakdown, expandedKeys, (key) => {
                setExpandedKeys((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              })}
            </>
          )}
        </>
      )}
      <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleToggleLastWeek}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0',
              margin: 0,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            <span aria-hidden>{showLastWeek ? '▼' : '▶'}</span>
            {showLastWeek ? 'Hide last week detail' : 'Last week detail'}
          </button>
        </div>
        {showLastWeek && (
          <>
            <div className="myTimeLastWeekSummary">
              <div style={{ marginTop: '0.5rem', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                Last week: {formatElapsed(totalSecondsLastWeek)}
              </div>
              {renderHoursByDay(getLastWeekRange().start, secondsByDayLastWeek, {
                sessionCountByDay: sessionCountByDayLastWeek,
                useOnShiftDayLabel: disableDayEditor,
              })}
            </div>
            {breakdownLastWeek.length > 0 &&
              renderBreakdownList(breakdownLastWeek, expandedKeysLastWeek, (key) => {
                setExpandedKeysLastWeek((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              })}
          </>
        )}
      </div>
      {!loading && breakdown.length === 0 && totalSecondsWeek === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No time logged this week.</p>
      )}
      {editorDate && !disableDayEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={editorDate}
          sessions={myTimeModalSessions}
          subjectUserId={userId}
          subjectDisplayName={myTimeSubjectDisplayName}
          jobLabels={myTimeJobLabels}
          bidLabels={myTimeBidLabels}
          clockTimesReadOnly
          onClose={() => setEditorDate(null)}
          onSaved={() => void loadData()}
        />
      )}
    </div>
  )
}
