import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getDefaultWeekRange, getLastWeekRange } from '../utils/dateUtils'

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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                    <span aria-hidden style={{ flexShrink: 0 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
                      {item.label}
                    </span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#6b7280' }}>
                    {formatHours(item.seconds)}
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
                            padding: '0.35rem 0.75rem 0.35rem 1.25rem',
                            fontSize: '0.8125rem',
                            borderBottom: subIdx < item.children!.length - 1 ? '1px solid #f3f4f6' : 'none',
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280' }} title={sub.notes}>
                            {truncated}
                          </span>
                          <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#9ca3af' }}>
                            {formatHours(sub.seconds)}
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
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>
                  {item.label}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: '#6b7280' }}>
                  {formatHours(item.seconds)}
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
}

export default function DashboardMyTimeSection({ userId }: Props) {
  const [loading, setLoading] = useState(true)
  const [totalSecondsToday, setTotalSecondsToday] = useState(0)
  const [totalSecondsWeek, setTotalSecondsWeek] = useState(0)
  const [totalSecondsLastWeek, setTotalSecondsLastWeek] = useState(0)
  const [showLastWeek, setShowLastWeek] = useState(false)
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([])
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [breakdownLastWeek, setBreakdownLastWeek] = useState<BreakdownItem[]>([])
  const [lastWeekBreakdownOpen, setLastWeekBreakdownOpen] = useState(false)
  const [expandedKeysLastWeek, setExpandedKeysLastWeek] = useState<Set<string>>(new Set())

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
        .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id')
        .eq('user_id', userId)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .gte('work_date', start)
        .lte('work_date', end),
      supabase
        .from('clock_sessions')
        .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id')
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
    const lastWeekSessions = (lastWeekData ?? []) as SessionRow[]

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

    const jobsMap = new Map<string, { hcp_number: string; job_name: string; job_address: string }>()
    for (const j of (jobsRes.data ?? []) as { id: string; hcp_number: string; job_name: string; job_address: string }[]) {
      jobsMap.set(j.id, { hcp_number: j.hcp_number, job_name: j.job_name, job_address: j.job_address })
    }
    const bidsMap = new Map<string, { bid_number: string; project_name: string; address: string }>()
    for (const b of (bidsRes.data ?? []) as { id: string; bid_number: string; project_name: string; address: string }[]) {
      bidsMap.set(b.id, { bid_number: b.bid_number, project_name: b.project_name, address: b.address })
    }

    const parentItems: BreakdownItem[] = []
    for (const [key, group] of parentGroups) {
      const totalSeconds = [...group.byNotes.values()].reduce((a, b) => a + b, 0)
      const children: SubItem[] = [...group.byNotes.entries()]
        .map(([notes, seconds]) => ({ notes, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
      let label = ''
      if (group.type === 'job' && group.jobId) {
        const j = jobsMap.get(group.jobId)
        label = j ? `J${(j.hcp_number || '').trim() || '—'} · ${j.job_name || '—'} - ${j.job_address || '—'}` : `Job ${group.jobId.slice(0, 8)}…`
      } else if (group.type === 'bid' && group.bidId) {
        const b = bidsMap.get(group.bidId)
        label = b ? `B${(b.bid_number || '').trim() || '—'} · ${b.project_name || '—'} - ${b.address || '—'}` : `Bid ${group.bidId.slice(0, 8)}…`
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

    const focusBreakdownItems: BreakdownItem[] = [...focusItems.entries()].map(([key, v]) => ({
      key,
      type: 'focus' as const,
      label: v.label,
      seconds: v.seconds,
    }))

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
        label = j ? `J${(j.hcp_number || '').trim() || '—'} · ${j.job_name || '—'} - ${j.job_address || '—'}` : `Job ${group.jobId.slice(0, 8)}…`
      } else if (group.type === 'bid' && group.bidId) {
        const b = bidsMap.get(group.bidId)
        label = b ? `B${(b.bid_number || '').trim() || '—'} · ${b.project_name || '—'} - ${b.address || '—'}` : `Bid ${group.bidId.slice(0, 8)}…`
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
    const focusBreakdownItemsLastWeek: BreakdownItem[] = [...focusItemsLastWeek.entries()].map(([key, v]) => ({
      key,
      type: 'focus' as const,
      label: v.label,
      seconds: v.seconds,
    }))
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
  }, [userId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!userId) return
    const raw = localStorage.getItem(`dashboard_my_time_show_last_week_${userId}`)
    setShowLastWeek(raw === 'true')
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('dashboard-my-time-clock-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_sessions' }, (payload) => {
        const row = payload.new as { user_id?: string } | null
        if (row?.user_id === userId) void loadData()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, loadData])

  const handleToggleLastWeek = () => {
    const next = !showLastWeek
    setShowLastWeek(next)
    if (userId) localStorage.setItem(`dashboard_my_time_show_last_week_${userId}`, String(next))
  }

  if (loading && breakdown.length === 0) {
    return (
      <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>My Time</h2>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>My Time</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
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
              padding: 0,
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
            This week
          </button>
          {breakdownOpen &&
            renderBreakdownList(breakdown, expandedKeys, (key) => {
              setExpandedKeys((prev) => {
                const next = new Set(prev)
                if (next.has(key)) next.delete(key)
                else next.add(key)
                return next
              })
            })}
        </>
      )}
      <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end' }}>
        <button
          type="button"
          onClick={handleToggleLastWeek}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: 0,
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
          {showLastWeek ? 'Hide last week' : 'Show last week'}
        </button>
        {showLastWeek && (
          <>
            <div style={{ marginTop: '0.35rem', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              Last week: {formatElapsed(totalSecondsLastWeek)}
            </div>
            {breakdownLastWeek.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setLastWeekBreakdownOpen((o) => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: 0,
                    margin: '0.5rem 0 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    fontWeight: 500,
                  }}
                >
                  <span aria-hidden>{lastWeekBreakdownOpen ? '▼' : '▶'}</span>
                  Last week
                </button>
                {lastWeekBreakdownOpen &&
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
          </>
        )}
      </div>
      {!loading && breakdown.length === 0 && totalSecondsWeek === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No time logged this week.</p>
      )}
    </div>
  )
}
