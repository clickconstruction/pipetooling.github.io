import { useCallback, useEffect, useMemo, useState } from 'react'
import { MissedClockInDoor } from './clock/MissedClockInDoor'
import { supabase } from '../lib/supabase'
import { displayNameFromAuthUser } from '../lib/displayNameFromAuthUser'
import { useAuth } from '../hooks/useAuth'
import { useRealtimeChannel } from '../hooks/useRealtimeChannel'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { DashboardMyTimeDayEditorModal } from './DashboardMyTimeDayEditorModal'
import { PersonalTimeOffModal } from './PersonalTimeOffModal'
import { DashboardMyTimePicture } from './dashboard/DashboardMyTimePicture'
import { MyTimeCanWorkLine } from './dashboard/MyTimeCanWorkLine'
import { MY_TIME_WEEKS, buildMyTimeWeeks, myTimeSessionSeconds, type MyTimeDay, type MyTimeWeek } from '../lib/dashboard/myTimeWeeks'
import { payWeeksEndingAt } from '../lib/people/utilization'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerSummaryLine, formatJobLedgerSummaryLine } from '../lib/ledgerDisplayPrefixes'
import { DashboardCardHead, DashboardCardTitle } from './dashboard/DashboardCardTitle'

function formatHours(seconds: number): string {
  const hrs = seconds / 3600
  return hrs % 1 === 0 ? `${hrs.toFixed(1)} hrs` : `${hrs.toFixed(2)} hrs`
}

function renderBreakdownList(
  items: BreakdownItem[],
  expandedKeys: Set<string>,
  onToggleKey: (key: string) => void
) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {items.map((item, idx) => {
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = hasChildren && expandedKeys.has(item.key)
        const isLastItem = idx === items.length - 1
        const hasSubRows = hasChildren && isExpanded
        return (
          <li key={item.key} style={{ borderBottom: isLastItem && !hasSubRows ? 'none' : '1px solid var(--border)' }}>
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
                  <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'var(--text-muted)', minWidth: '5rem' }}>
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
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, background: 'var(--bg-page)' }}>
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
                            borderBottom: subIdx < item.children!.length - 1 ? '1px solid var(--border)' : 'none',
                          }}
                        >
                          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'var(--text-faint)', minWidth: '5rem' }}>
                            {formatHours(sub.seconds)}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={sub.notes}>
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
                <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'var(--text-muted)', minWidth: '5rem' }}>
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
  /** A salaried person: their days are the office's to change, so no day opens the day editor and no hours are asked. */
  disableDayEditor?: boolean
  /** This week's seconds, for a host that draws the section folded (v2.3891); null while loading. */
  onWeekSeconds?: (seconds: number | null) => void
}

export default function DashboardMyTimeSection({ userId, hoursDaysCorrect, disableDayEditor = false, onWeekSeconds }: Props) {
  const prefixMap = useLedgerPrefixMap()
  const { user: authUser } = useAuth()
  const myTimeSubjectDisplayName = useMemo(() => {
    if (authUser?.id === userId) return displayNameFromAuthUser(authUser)?.trim() || 'You'
    return 'User'
  }, [authUser, userId])
  const [loading, setLoading] = useState(true)
  const [totalSecondsWeek, setTotalSecondsWeek] = useState(0)
  /** Every session of the weeks the picture shows, and the moment they were read: the picture is built from both. */
  const [read, setRead] = useState<{ sessions: SessionRow[]; todayYmd: string; nowMs: number } | null>(null)
  /** The week whose days the picture draws; null follows the current week. */
  const [chosenWeek, setChosenWeek] = useState<number | null>(null)
  useEffect(() => {
    onWeekSeconds?.(loading ? null : totalSecondsWeek)
    // The number is the message; the callback's identity is not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, totalSecondsWeek])
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([])
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [breakdownLastWeek, setBreakdownLastWeek] = useState<BreakdownItem[]>([])
  const [expandedKeysLastWeek, setExpandedKeysLastWeek] = useState<Set<string>>(new Set())
  const [editorDate, setEditorDate] = useState<string | null>(null)
  const [timeOffModalOpen, setTimeOffModalOpen] = useState(false)
  const [myTimeJobLabels, setMyTimeJobLabels] = useState<Record<string, string>>({})
  const [myTimeBidLabels, setMyTimeBidLabels] = useState<Record<string, string>>({})

  const weeks: MyTimeWeek[] = useMemo(
    () => (read ? buildMyTimeWeeks({ weeks: payWeeksEndingAt(read.todayYmd, MY_TIME_WEEKS), sessions: read.sessions, todayYmd: read.todayYmd, nowMs: read.nowMs }) : []),
    [read],
  )
  const currentWeek = weeks.findIndex((w) => w.current)
  const selectedWeek = chosenWeek != null && chosenWeek >= 0 && chosenWeek < weeks.length ? chosenWeek : currentWeek
  const showsLastWeek = currentWeek > 0 && selectedWeek === currentWeek - 1

  const myTimeModalSessions = useMemo(() => (editorDate && read ? read.sessions.filter((s) => s.work_date === editorDate) : []), [editorDate, read])

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
    // One read for the picture's weeks. This week and last week are cut from it for the job breakdown, and the
    // day is the company's own, since a session's work_date is (docs/TIME_AND_ZONES.md).
    const todayYmd = todayYmdInAppTz()
    const payWeeks = payWeeksEndingAt(todayYmd, MY_TIME_WEEKS)
    const thisWeek = payWeeks[payWeeks.length - 1]!
    const lastWeek = payWeeks[payWeeks.length - 2] ?? thisWeek
    const now = Date.now()

    const { data, error } = await supabase
      .from('clock_sessions')
      .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id, approved_at, origin, salary_segment_index')
      .eq('user_id', userId)
      .is('rejected_at', null)
      .is('revoked_at', null)
      .gte('work_date', payWeeks[0]!.start)
      .lte('work_date', thisWeek.end)

    if (error) {
      setLoading(false)
      return
    }

    const all = (data ?? []) as SessionRow[]
    setRead({ sessions: all, todayYmd, nowMs: now })
    const sessions = all.filter((s) => s.work_date >= thisWeek.start && s.work_date <= thisWeek.end)
    const lastWeekSessions = lastWeek === thisWeek ? [] : all.filter((s) => s.work_date >= lastWeek.start && s.work_date <= lastWeek.end)

    const sessionSeconds = (s: SessionRow): number => myTimeSessionSeconds(s, todayYmd, now)
    setTotalSecondsWeek(sessions.reduce((sum, s) => sum + sessionSeconds(s), 0))

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
      { hcp_number: string; click_number: string; job_name: string; job_address: string; service_type_id: string | null }
    >()
    for (const j of (jobsRes.data ?? []) as Array<{
      id: string
      hcp_number: string
      click_number: string
      job_name: string
      job_address: string
      service_type_id: string | null
    }>) {
      jobsMap.set(j.id, {
        hcp_number: j.hcp_number,
        click_number: j.click_number,
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
      jobLabelRec[jid] = formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address, j.click_number)
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
          ? formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address, j.click_number)
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
          ? formatJobLedgerSummaryLine(prefixMap, j.service_type_id, j.hcp_number, j.job_name, j.job_address, j.click_number)
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

  /** A day the person can open themself: this week's, with time on it, and not one the office marked correct. */
  const canPressDay = useCallback(
    (day: MyTimeDay, week: MyTimeWeek) => !disableDayEditor && week.current && day.kind !== 'come' && day.seconds > 0 && day.sessions > 0 && !hoursDaysCorrect.has(day.ymd),
    [disableDayEditor, hoursDaysCorrect],
  )
  const shownBreakdown = selectedWeek === currentWeek ? breakdown : showsLastWeek ? breakdownLastWeek : []

  if (loading && breakdown.length === 0) {
    return (
      <div style={{ marginTop: '2rem', marginBottom: '1rem' }} role="region" aria-label="My time summary">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0, textAlign: 'center' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label="My time summary"
      style={{
        marginTop: '2rem',
        marginBottom: '1rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: '0.85rem 1rem 1rem',
      }}
    >
      {/* One My Time card (v2.1551): header, the picture of the time added up, the
          job breakdown behind the toggle, one action row. The orange clock strip
          above stays as-is (owner request). */}
      <DashboardCardHead below="0.6rem">
        <DashboardCardTitle>My Time</DashboardCardTitle>
      </DashboardCardHead>
      {/* The picture (the owner, 2026-11-23): the week's time as one figure, a column for each day and for each of the
          last eight weeks. It replaces the two tiles, the hours block and the seven lines of text. */}
      <DashboardMyTimePicture
        weeks={weeks}
        selected={selectedWeek}
        onSelect={setChosenWeek}
        canPressDay={canPressDay}
        onDayPress={disableDayEditor ? undefined : setEditorDate}
      >
        {/* The office plans the crew from the answer, so the card still asks. A salaried person's week is on pay. */}
        {disableDayEditor ? null : <MyTimeCanWorkLine userId={userId} displayName={myTimeSubjectDisplayName} />}
      </DashboardMyTimePicture>
      {/* The job-by-job fold follows the week chosen, for this week and last week. An older week shows its days only. */}
      {shownBreakdown.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setBreakdownOpen((o) => !o)}
            aria-expanded={breakdownOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0',
              margin: '0.35rem 0 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            <span aria-hidden>{breakdownOpen ? '▼' : '▶'}</span>
            {showsLastWeek ? 'Last week detail' : 'This week detail'}
          </button>
          {breakdownOpen &&
            (showsLastWeek
              ? renderBreakdownList(breakdownLastWeek, expandedKeysLastWeek, (key) => {
                  setExpandedKeysLastWeek((prev) => {
                    const next = new Set(prev)
                    if (next.has(key)) next.delete(key)
                    else next.add(key)
                    return next
                  })
                })
              : renderBreakdownList(breakdown, expandedKeys, (key) => {
                  setExpandedKeys((prev) => {
                    const next = new Set(prev)
                    if (next.has(key)) next.delete(key)
                    else next.add(key)
                    return next
                  })
                }))}
        </>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderTop: '1px solid var(--border)',
          marginTop: '0.85rem',
          paddingTop: '0.7rem',
        }}
      >
        {/* A day the clock missed (v2.4257): the person reports it, the office approves it. Not for salaried people. */}
        {disableDayEditor ? null : <MissedClockInDoor userId={userId} variant="button" />}
        {/* Personal Time Off moved here from Settings → Your account (v2.1544). */}
        <button
          type="button"
          onClick={() => setTimeOffModalOpen(true)}
          style={{
            marginLeft: 'auto',
            padding: '0.3rem 0.7rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-700)',
            cursor: 'pointer',
          }}
        >
          Personal Time Off…
        </button>
      </div>
      <PersonalTimeOffModal open={timeOffModalOpen} userId={userId} onClose={() => setTimeOffModalOpen(false)} />
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
