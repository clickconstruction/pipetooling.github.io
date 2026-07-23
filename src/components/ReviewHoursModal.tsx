import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { AssignFocusModal } from './AssignFocusModal'
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

function shiftWeek(start: string, end: string, delta: number): { start: string; end: string } {
  const d = new Date(start + 'T12:00:00')
  const endD = new Date(end + 'T12:00:00')
  const days = Math.round((endD.getTime() - d.getTime()) / (24 * 60 * 60 * 1000)) + 1
  d.setDate(d.getDate() + delta * 7)
  const newEnd = new Date(d)
  newEnd.setDate(newEnd.getDate() + days - 1)
  return { start: d.toLocaleDateString('en-CA'), end: newEnd.toLocaleDateString('en-CA') }
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

type SubItemWithIds = { notes: string; seconds: number; sessionIds: string[] }

type BreakdownItem = {
  key: string
  type: 'job' | 'bid' | 'focus'
  label: string
  seconds: number
  jobId?: string
  bidId?: string
  children?: SubItemWithIds[]
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day = dayNames[d.getDay()]
  return `${day} ${d.getMonth() + 1}/${d.getDate()}`
}

type Props = {
  people: string[]
  initialPersonIndex: number
  initialStartDate: string
  initialEndDate: string
  hoursRowsForPerson: (personName: string) => { work_date: string; hours: number }[]
  canAddToJob: boolean
  canMarkReviewed?: boolean
  onReviewedChange?: () => void
  onClose: () => void
}

export function ReviewHoursModal({
  people,
  initialPersonIndex,
  initialStartDate,
  initialEndDate,
  hoursRowsForPerson,
  canAddToJob,
  canMarkReviewed = false,
  onReviewedChange,
  onClose,
}: Props) {
  const { user: authUser } = useAuth()
  const prefixMap = useLedgerPrefixMap()
  const [personIndex, setPersonIndex] = useState(initialPersonIndex)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [loading, setLoading] = useState(true)
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [secondsByDay, setSecondsByDay] = useState<Map<string, number>>(new Map())
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([])
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [noUser, setNoUser] = useState(false)
  const [assignFocusSub, setAssignFocusSub] = useState<SubItemWithIds | null>(null)
  const [isReviewed, setIsReviewed] = useState(false)
  const [togglingReviewed, setTogglingReviewed] = useState(false)

  const personName = people[personIndex] ?? people[0] ?? ''
  const hoursRows = hoursRowsForPerson(personName)

  const loadData = useCallback(async () => {
    if (!personName) return
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
    type FocusItemVal = { label: string; seconds: number; sessionIds: string[] }
    const focusItems = new Map<string, FocusItemVal>()

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
        const prevIds = cur?.sessionIds ?? []
        focusItems.set(key, {
          label: truncated,
          seconds: (cur?.seconds ?? 0) + sec,
          sessionIds: [...prevIds, s.id],
        })
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

    const parentItems: BreakdownItem[] = []
    for (const [key, group] of parentGroups) {
      const totalSecondsGroup = [...group.byNotes.values()].reduce((a, b) => a + b, 0)
      const children: SubItemWithIds[] = [...group.byNotes.entries()]
        .map(([notes, seconds]) => ({ notes, seconds, sessionIds: [] }))
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
                .map(([, v]) => ({ notes: v.label, seconds: v.seconds, sessionIds: v.sessionIds }))
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

  const fetchReviewedStatus = useCallback(async () => {
    if (!personName || !startDate) return
    const { data } = await supabase
      .from('hours_reviewed')
      .select('id')
      .eq('person_name', personName)
      .eq('start_date', startDate)
      .maybeSingle()
    setIsReviewed(!!data)
  }, [personName, startDate])

  useEffect(() => {
    void fetchReviewedStatus()
  }, [fetchReviewedStatus])

  const handleToggleReviewed = useCallback(async () => {
    if (!authUser?.id || !personName || togglingReviewed) return
    setTogglingReviewed(true)
    try {
      if (isReviewed) {
        await withSupabaseRetry(
          async () =>
            supabase.from('hours_reviewed').delete().eq('person_name', personName).eq('start_date', startDate),
          'unmark hours reviewed'
        )
        setIsReviewed(false)
      } else {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('hours_reviewed')
              .upsert(
                { person_name: personName, start_date: startDate, end_date: endDate, reviewed_by: authUser.id },
                { onConflict: 'person_name,start_date' }
              ),
          'mark hours reviewed'
        )
        setIsReviewed(true)
      }
      onReviewedChange?.()
    } finally {
      setTogglingReviewed(false)
    }
  }, [authUser?.id, personName, startDate, endDate, isReviewed, togglingReviewed, onReviewedChange])

  const daysInRange = getDaysInRange(startDate, endDate)
  const hoursRowsMap = new Map(hoursRows.map((r) => [r.work_date, r.hours]))

  const handlePrevPerson = () => setPersonIndex((i) => Math.max(0, i - 1))
  const handleNextPerson = () => setPersonIndex((i) => Math.min(people.length - 1, i + 1))
  const handlePrevWeek = () => {
    const { start, end } = shiftWeek(startDate, endDate, -1)
    setStartDate(start)
    setEndDate(end)
  }
  const handleNextWeek = () => {
    const { start, end } = shiftWeek(startDate, endDate, 1)
    setStartDate(start)
    setEndDate(end)
  }

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
          position: 'relative',
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrevWeek}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              ← Prev week
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {startDate} to {endDate}
            </span>
            <button
              type="button"
              onClick={handleNextWeek}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              Next week →
            </button>
          </div>
          <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>{personName}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            padding: 0,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: 1,
            color: 'var(--text-muted)',
          }}
        >
          ×
        </button>

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
                <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  {breakdown.map((item, idx) => {
                    const hasChildren = item.children && item.children.length > 0
                    const isExpanded = hasChildren && expandedKeys.has(item.key)
                    const isLastItem = idx === breakdown.length - 1
                    const hasSubRows = hasChildren && isExpanded
                    const isFocus = item.type === 'focus'
                    return (
                      <li key={item.key} style={{ borderBottom: isLastItem && !hasSubRows ? 'none' : '1px solid var(--border)' }}>
                        {hasChildren ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedKeys((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(item.key)) next.delete(item.key)
                                  else next.add(item.key)
                                  return next
                                })
                              }
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
                              <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'var(--text-muted)' }}>
                                {formatHours(item.seconds)}
                              </span>
                            </button>
                            {hasSubRows && (
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0, background: 'var(--bg-page)' }}>
                                {item.children!.map((sub, subIdx) => {
                                  const truncated = sub.notes.length > 50 ? sub.notes.slice(0, 47) + '…' : sub.notes
                                  const subWithIds = sub as SubItemWithIds
                                  const canAdd = isFocus && canAddToJob && subWithIds.sessionIds.length > 0
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
                                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }} title={sub.notes}>
                                        {truncated}
                                      </span>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'var(--text-faint)' }}>
                                          {formatHours(sub.seconds)}
                                        </span>
                                        {canAdd && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setAssignFocusSub(subWithIds)
                                            }}
                                            style={{
                                              padding: '0.15rem 0.4rem',
                                              fontSize: '0.75rem',
                                              border: '1px solid #3b82f6',
                                              borderRadius: 4,
                                              background: 'var(--bg-blue-tint)',
                                              color: 'var(--text-link)',
                                              cursor: 'pointer',
                                            }}
                                          >
                                            Add
                                          </button>
                                        )}
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
                            <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'var(--text-muted)' }}>
                              {formatHours(item.seconds)}
                            </span>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </>
        )}

        {canMarkReviewed && !noUser && personName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: togglingReviewed ? 'not-allowed' : 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={isReviewed}
                disabled={togglingReviewed}
                onChange={() => void handleToggleReviewed()}
                style={{ width: 16, height: 16 }}
              />
              Mark as reviewed
            </label>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={handlePrevPerson}
            disabled={personIndex === 0}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: personIndex === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: personIndex === 0 ? 0.5 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ flex: 1, fontWeight: 600, fontSize: '1rem', textAlign: 'center' }}>{personName}</span>
          <button
            type="button"
            onClick={handleNextPerson}
            disabled={personIndex >= people.length - 1}
            style={{
              padding: '0.25rem 0.5rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              background: 'var(--surface)',
              cursor: personIndex >= people.length - 1 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: personIndex >= people.length - 1 ? 0.5 : 1,
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {assignFocusSub && (
        <AssignFocusModal
          sessionIds={assignFocusSub.sessionIds}
          label={`${assignFocusSub.notes} (${formatHours(assignFocusSub.seconds)})`}
          onSaved={() => {
            setAssignFocusSub(null)
            void loadData()
          }}
          onClose={() => setAssignFocusSub(null)}
        />
      )}
    </div>
  )
}
