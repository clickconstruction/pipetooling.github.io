/**
 * Checklist → History: the grid of repeating tasks over the ledger of one-offs on a wide screen, the day ledger
 * on a phone, the person and months filters, and the owner's edit mode. It was a component inside
 * `pages/Checklist.tsx` until v2.7754 and moved here whole; its four date keys read `localCalendarDayKey`, the
 * tested twin of the page's own helper. The grid's rules are `lib/checklistHistorySplit.ts` (CHECKLIST_TABS map).
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { activeUsersQuery } from '../../lib/people/fetchActiveUsers'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { ChecklistTitleWithLinks } from '../ChecklistTitleWithLinks'
import { ChecklistHistoryLedger } from './ChecklistHistoryLedger'
import { HISTORY_NO_REPEATING_WORDS, historyCellStatus, historyGridDates, historyInstanceIndex, historyRateLabel, historyRowRate, historyShortDate, splitHistoryItems } from '../../lib/checklistHistorySplit'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { EmptyState } from '../EmptyState'
import { HISTORY_MONTHS_MAX, checklistHistoryEmptyWords } from '../../lib/checklistEmptyWords'
import { localCalendarDayKey } from '../../utils/dateUtils'
import type { PersonDayRow } from '../../lib/tasks/personDay'

/** One task on one day, as the day's read shapes it. */
type ChecklistInstance = PersonDayRow

export function ChecklistHistoryTab({ authUserId, canViewOthers, canEditHistory, setError }: { authUserId: string | null; canViewOthers: boolean; canEditHistory: boolean; setError: (s: string | null) => void }) {
  const confirmDialog = useConfirmDialog()
  const isNarrow = useIsNarrowScreen()
  const [instances, setInstances] = useState<ChecklistInstance[]>([])
  const [loading, setLoading] = useState(true)
  // Phones default to 1 month — the day-ledger reads top-down and a season of
  // scrollback buries last week; desktop keeps the 6-month grid default.
  const [monthsBack, setMonthsBack] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 1 : 6,
  )
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [selectedUserId, setSelectedUserId] = useState<string>(authUserId ?? '')
  const [editMode, setEditMode] = useState(false)
  const [cyclingCell, setCyclingCell] = useState<string | null>(null)
  const [deletedCells, setDeletedCells] = useState<Set<string>>(new Set())

  useEffect(() => {
    setSelectedUserId((prev) => (authUserId && !prev ? authUserId : prev))
  }, [authUserId])

  useEffect(() => {
    if (canViewOthers) {
      // Tier-2 #19 (J30-2): person pickers = active people (no twins); dev rows stay.
      activeUsersQuery('id, name, email', { includeDev: true, withLogin: true })
        .then(({ data }) => {
        setUsers((data ?? []) as Array<{ id: string; name: string; email: string }>)
      })
    }
  }, [canViewOthers])

  useEffect(() => {
    setDeletedCells(new Set())
    if (!selectedUserId) {
      setLoading(false)
      return
    }
    loadHistory()
  }, [selectedUserId, monthsBack])

  async function loadHistory() {
    if (!selectedUserId) return
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - monthsBack)
    const startStr = localCalendarDayKey(start)
    const endStr = localCalendarDayKey(end)
    const { data, error } = await supabase
      .from('checklist_instances')
      .select('id, checklist_item_id, scheduled_date, completed_at, completed_by_user_id, notes, created_at, reviewed_at, reviewed_by, checklist_items(title, links, due_date, repeat_type, created_at), checklist_instance_assignees!inner(user_id)')
      .eq('checklist_instance_assignees.user_id', selectedUserId)
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr)
      .order('scheduled_date', { ascending: true })
    if (error) {
      setLoading(false)
      return
    }
    setInstances((data ?? []) as ChecklistInstance[])
    setLoading(false)
  }

  if (loading) return <p>Loading…</p>

  // Repeating rows keep the grid (starting at each task's birthday); one-offs
  // move to the created → done ledger below it (v2.2091).
  const { repeating, oneOffs } = splitHistoryItems(instances, selectedUserId, localCalendarDayKey(new Date()))

  // Grid columns come from repeating instances only — a one-off's lone date no
  // longer mints a column of dashed boxes for every other row.
  const visibleDates = historyGridDates(repeating)

  const instanceByKey = historyInstanceIndex(instances)

  async function handleCycleStatus(itemId: string, date: string) {
    if (!editMode || cyclingCell || !selectedUserId) return
    // Edit mode rewrites prod rows on a single click — make it a two-step.
    const proceed = await confirmDialog({
      message: `Change ${date} for this item? (cycles completed → missed → not due)`,
      confirmLabel: 'Change',
    })
    if (!proceed) return
    const key = `${itemId}-${date}`
    const cellInst = instances.find((i) => i.checklist_item_id === itemId && i.scheduled_date === date)
    const rawStatus = cellInst ? historyCellStatus(cellInst, selectedUserId) : undefined
    const status = deletedCells.has(key) ? undefined : rawStatus
    setCyclingCell(key)
    setError(null)
    try {
      if (status === 'incomplete') {
        const inst = instanceByKey.get(key)
        if (!inst) return
        const { error: err } = await supabase.from('checklist_instances').delete().eq('id', inst.id)
        if (err) {
          setError(err.message)
          return
        }
        setDeletedCells((prev) => new Set(prev).add(key))
        setCyclingCell(null)
        setTimeout(() => {
          loadHistory()
          setDeletedCells((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        }, 2000)
        return
      } else if (status === 'completed') {
        const inst = instanceByKey.get(key)
        if (!inst) return
        const { error: delErr } = await supabase.from('checklist_instances').delete().eq('id', inst.id)
        if (delErr) {
          setError(delErr.message)
          return
        }
        const { data: newInst, error: insErr } = await supabase.from('checklist_instances').insert({
          checklist_item_id: itemId,
          scheduled_date: date,
        }).select('id').single()
        if (insErr) {
          setError(insErr.message)
          return
        }
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: selectedUserId })
        }
      } else {
        const { data: newInst, error: err } = await supabase.from('checklist_instances').insert({
          checklist_item_id: itemId,
          scheduled_date: date,
          completed_at: new Date().toISOString(),
        }).select('id').single()
        if (err) {
          setError(err.message)
          return
        }
        if (newInst?.id) {
          await supabase.from('checklist_instance_assignees').insert({ checklist_instance_id: newInst.id, user_id: selectedUserId })
        }
        setDeletedCells((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
      await loadHistory()
    } finally {
      setCyclingCell(null)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {canViewOthers && users.length > 0 && (
          <label>
            <span style={{ marginRight: '0.5rem' }}>View history for:</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', minWidth: 160 }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span style={{ marginRight: '0.5rem' }}>Months:</span>
          <select
            value={monthsBack}
            onChange={(e) => setMonthsBack(Number(e.target.value))}
            style={{ padding: '0.35rem 0.5rem' }}
          >
            {[1, 3, 6, 12].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        {canEditHistory && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
            <span style={{ fontSize: '0.875rem' }}>Edit mode</span>
          </label>
        )}
        {!isNarrow && (
          <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, background: '#22c55e', color: 'var(--text-on-bright-solid)' }}>✓ You</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }}>✓ Someone else</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }}>✗ Missed</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 7, border: '1px dashed var(--border-400)', color: 'var(--text-muted)' }}>Not due</span>
          </span>
        )}
      </div>
      {!isNarrow && (repeating.length > 0 || oneOffs.length > 0) ? (
        <p style={{ margin: '0 0 0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          REPEATING <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· {repeating.length} task{repeating.length === 1 ? '' : 's'} · rows start at each task’s creation</span>
        </p>
      ) : null}
      {isNarrow ? (
        <ChecklistHistoryLedger
          instances={instances}
          selectedUserId={selectedUserId}
          currentUserId={authUserId}
          todayStr={localCalendarDayKey(new Date())}
          setError={setError}
          onAfterReopen={() => void loadHistory()}
          empty={checklistHistoryEmptyWords(monthsBack, () => setMonthsBack(HISTORY_MONTHS_MAX))}
        />
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)' }}>Item</th>
              {visibleDates.map((d, i, arr) => {
                const parts = d.slice(5).split('-')
                const month = parts[0] ?? ''
                const day = parts[1] ?? ''
                const monthBoundary = i > 0 && (arr[i - 1] ?? '').slice(5, 7) !== d.slice(5, 7)
                return (
                  <th key={d} style={{ padding: '0.15rem', borderBottom: '1px solid var(--border)', minWidth: 26, fontSize: '0.6875rem', lineHeight: 1.15, ...(monthBoundary ? { borderLeft: '2px solid var(--border-400)' } : {}) }} title={d}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}><span style={{ color: 'var(--text-muted)' }}>{month}</span><span>{day}</span></div>
                  </th>
                )
              })}
              <th style={{ padding: '0.15rem 0.4rem', borderBottom: '1px solid var(--border)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>rate</th>
            </tr>
          </thead>
          <tbody>
            {repeating.map(({ itemId, title, links, sinceYmd, dates }) => {
              const rate = historyRowRate(dates, visibleDates, (d) => deletedCells.has(`${itemId}-${d}`))
              const birthIndex = visibleDates.findIndex((d) => d >= sinceYmd)
              return (
              <tr key={itemId}>
                <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)' }} title={`${title} — created ${sinceYmd}`}>
                  <ChecklistTitleWithLinks title={title} links={links} />
                  <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-faint)' }}>since {historyShortDate(sinceYmd)}</span>
                </td>
                {visibleDates.map((d, i, arr) => {
                  const monthBoundaryEarly = i > 0 && (arr[i - 1] ?? '').slice(5, 7) !== d.slice(5, 7)
                  // Before the task existed there is nothing to grade — no box at all.
                  if (d < sinceYmd) {
                    return <td key={d} style={{ padding: 2, borderBottom: '1px solid var(--border)', ...(monthBoundaryEarly ? { borderLeft: '2px solid var(--border-400)' } : {}) }} />
                  }
                  const isBirth = i === birthIndex && i > 0
                  const rawStatus = dates[d]
                  const status = deletedCells.has(`${itemId}-${d}`) ? undefined : rawStatus
                  const cellKey = `${itemId}-${d}`
                  const isCycling = cyclingCell === cellKey
                  const isClickable = editMode && !isCycling
                  const monthBoundary = i > 0 && (arr[i - 1] ?? '').slice(5, 7) !== d.slice(5, 7)
                  const cellStyle = {
                    width: 24,
                    height: 24,
                    borderRadius: 5,
                    display: 'flex' as const,
                    alignItems: 'center' as const,
                    justifyContent: 'center' as const,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    boxSizing: 'border-box' as const,
                    cursor: isClickable ? 'pointer' : undefined,
                    opacity: isCycling ? 0.6 : 1,
                    ...(status === 'completed'
                      ? { background: '#22c55e', color: 'white' }
                      : status === 'completed_by_other'
                        ? { background: 'var(--bg-amber-tint)', border: '1px solid #d97706', color: 'var(--text-amber-800)' }
                        : status === 'incomplete'
                          ? { background: 'var(--bg-red-100)', border: '1px solid #dc2626', color: 'var(--text-red-700)' }
                          : { border: '1.5px dashed var(--border-400)' }),
                  }
                  return (
                    <td key={d} style={{ padding: 2, borderBottom: '1px solid var(--border)', ...(monthBoundary ? { borderLeft: '2px solid var(--border-400)' } : {}), ...(isBirth ? { borderLeft: '2px solid #2563eb' } : {}) }} title={isBirth ? `created ${sinceYmd}` : undefined}>
                      <div
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                        onClick={isClickable ? () => handleCycleStatus(itemId, d) : undefined}
                        onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCycleStatus(itemId, d) } } : undefined}
                        style={cellStyle}
                        title={`${d}: ${status || 'not due'}${editMode ? ' (click to cycle)' : ''}`}
                      >
                        {status === 'completed' || status === 'completed_by_other' ? '✓' : status === 'incomplete' ? '✗' : ''}
                      </div>
                    </td>
                  )
                })}
                <td style={{ padding: '0.15rem 0.4rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 600, color: rate.due > 0 && rate.done === rate.due ? 'var(--text-green-800)' : 'var(--text-700)' }}>
                  {historyRateLabel(rate)}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
      {!isNarrow && repeating.length === 0 && oneOffs.length > 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{HISTORY_NO_REPEATING_WORDS}</p>
      )}
      {!isNarrow && oneOffs.length > 0 && (
        <div style={{ marginTop: '1.1rem', maxWidth: '46rem' }}>
          <p style={{ margin: '0 0 0.3rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            ONE-OFF TASKS{' '}
            <span style={{ fontWeight: 400, letterSpacing: 0 }}>
              · {oneOffs.length} in this window · {oneOffs.filter((o) => o.status === 'done' || o.status === 'done_by_other').length} done · newest first
            </span>
          </p>
          {oneOffs.map((o) => {
            const cellKey = `${o.itemId}-${o.scheduledYmd}`
            const status = deletedCells.has(cellKey) ? 'open' : o.status
            const chip =
              status === 'done'
                ? { label: '✓ done', style: { background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)' } }
                : status === 'done_by_other'
                  ? { label: '✓ else', style: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid #d97706' } }
                  : status === 'missed'
                    ? { label: '✗ missed', style: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' } }
                    : { label: 'open', style: { border: '1px dashed var(--border-strong)', color: 'var(--text-muted)' } }
            const meta =
              status === 'done' || status === 'done_by_other'
                ? `created ${o.createdYmd ? historyShortDate(o.createdYmd) : '—'} → done ${o.completedYmd ? historyShortDate(o.completedYmd) : historyShortDate(o.scheduledYmd)}${status === 'done_by_other' ? ' by someone else' : ''}`
                : status === 'missed'
                  ? `created ${o.createdYmd ? historyShortDate(o.createdYmd) : '—'} · due ${historyShortDate(o.scheduledYmd)}, never done`
                  : `created ${o.createdYmd ? historyShortDate(o.createdYmd) : '—'} · still open`
            const clickable = editMode && cyclingCell !== cellKey
            return (
              <div key={o.instanceId} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.4rem 0.1rem', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                <span
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => handleCycleStatus(o.itemId, o.scheduledYmd) : undefined}
                  onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCycleStatus(o.itemId, o.scheduledYmd) } } : undefined}
                  title={editMode ? 'Click to cycle status' : undefined}
                  style={{ flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, padding: '0.14rem 0.5rem', borderRadius: 999, width: '4.8rem', textAlign: 'center', boxSizing: 'border-box', cursor: clickable ? 'pointer' : undefined, opacity: cyclingCell === cellKey ? 0.6 : 1, ...chip.style }}
                >
                  {chip.label}
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <ChecklistTitleWithLinks title={o.title} links={o.links} />
                </span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>{meta}</span>
              </div>
            )
          })}
        </div>
      )}
      {!isNarrow && repeating.length === 0 && oneOffs.length === 0 && <EmptyState {...checklistHistoryEmptyWords(monthsBack, () => setMonthsBack(HISTORY_MONTHS_MAX))} />}
    </div>
  )
}
