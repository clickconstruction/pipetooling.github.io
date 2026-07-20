import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerSummaryLine, formatJobLedgerSummaryLine } from '../lib/ledgerDisplayPrefixes'

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  while (d <= endD) {
    days.push(d.toLocaleDateString('en-CA'))
    d.setDate(d.getDate() + 1)
  }
  return days
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

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = dayNames[d.getDay()]
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`
}

type Props = {
  personName: string
  startDate: string
  endDate: string
  hoursRows?: { work_date: string; hours: number }[]
  onClose: () => void
}

export function PersonTimeDetailModal({ personName, startDate, endDate, hoursRows = [], onClose }: Props) {
  const prefixMap = useLedgerPrefixMap()
  const [loading, setLoading] = useState(true)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [secondsByDay, setSecondsByDay] = useState<Map<string, number>>(new Map())
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [noUser, setNoUser] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.from('users').select('id').eq('name', personName).maybeSingle()
    const resolvedUserId = (userData as { id: string } | null)?.id ?? null

    if (!resolvedUserId) {
      setNoUser(true)
      setTotalSeconds(0)
      setSecondsByDay(new Map())
      setBreakdown([])
      setLoading(false)
      return
    }

    setNoUser(false)
    const now = Date.now()

    const { data, error } = await supabase
      .from('clock_sessions')
      .select('id, clocked_in_at, clocked_out_at, work_date, notes, job_ledger_id, bid_id')
      .eq('user_id', resolvedUserId)
      .is('rejected_at', null)
      .is('revoked_at', null)
      .gte('work_date', startDate)
      .lte('work_date', endDate)

    if (error) {
      setLoading(false)
      return
    }

    const sessions = (data ?? []) as SessionRow[]

    function sessionSeconds(s: SessionRow): number {
      const inMs = new Date(s.clocked_in_at).getTime()
      const outMs = s.clocked_out_at ? new Date(s.clocked_out_at).getTime() : now
      return Math.floor((outMs - inMs) / 1000)
    }

    const total = sessions.reduce((sum, s) => sum + sessionSeconds(s), 0)
    setTotalSeconds(total)

    const byDay = new Map<string, number>()
    for (const s of sessions) {
      const cur = byDay.get(s.work_date) ?? 0
      byDay.set(s.work_date, cur + sessionSeconds(s))
    }
    setSecondsByDay(byDay)

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

    const jobIds = [...parentGroups.values()].filter((v) => v.jobId).map((v) => v.jobId!)
    const bidIds = [...parentGroups.values()].filter((v) => v.bidId).map((v) => v.bidId!)

    const [jobsRes, bidsRes] = await Promise.all([
      jobIds.length > 0 ? supabase.rpc('get_jobs_ledger_by_ids', { p_job_ids: jobIds }) : { data: [] },
      bidIds.length > 0 ? supabase.rpc('get_bids_by_ids', { p_bid_ids: bidIds }) : { data: [] },
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

    const parentItems: BreakdownItem[] = []
    for (const [key, group] of parentGroups) {
      const totalSecondsGroup = [...group.byNotes.values()].reduce((a, b) => a + b, 0)
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
        seconds: totalSecondsGroup,
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
    setBreakdown(items)
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      for (const i of items) {
        if (i.children) next.add(i.key)
      }
      return next
    })
    setLoading(false)
  }, [personName, startDate, endDate, prefixMap])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const daysInRange = getDaysInRange(startDate, endDate)
  const hoursRowsMap = new Map(hoursRows.map((r) => [r.work_date, r.hours]))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
            {personName} — {startDate} to {endDate}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Close
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
        ) : noUser ? (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No clock sessions for this person.</p>
            {hoursRows.length > 0 && (
              <div style={{ marginTop: '1rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem', fontWeight: 500 }}>Hours from timesheet</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {daysInRange.map((d) => {
                    const hrs = hoursRowsMap.get(d) ?? 0
                    if (hrs === 0) return null
                    return (
                      <li
                        key={d}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.3rem 0.75rem',
                          fontSize: '0.875rem',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <span>{formatDateLabel(d)}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{hrs} hrs</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
        ) : totalSeconds === 0 && breakdown.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No clock sessions in this period.</p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>Period: {formatElapsed(totalSeconds)}</span>
            </div>

            <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>By day</div>
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-page)', borderRadius: 6, border: '1px solid var(--border)' }}>
              {daysInRange.map((d) => {
                const sec = secondsByDay.get(d) ?? 0
                return (
                  <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', fontSize: '0.8125rem' }}>
                    <span>{formatDateLabel(d)}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sec === 0 ? '—' : formatHours(sec)}</span>
                  </div>
                )
              })}
            </div>

            {breakdown.length > 0 && (
              <>
                <div style={{ marginBottom: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Breakdown</div>
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
      </div>
    </div>
  )
}
