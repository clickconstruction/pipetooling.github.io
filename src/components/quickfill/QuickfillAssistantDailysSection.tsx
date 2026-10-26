import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useQuickfillSectionMetricsSnapshot, useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, denverCalendarDayKey } from '../../utils/dateUtils'
import { renameChecklistItem } from '../../lib/quickfill/checklistItems'
import { formatMarkTime } from '../../lib/quickfill/markHistory'
import {
  DAILYS_READ_OPTIONS,
  DAILYS_TIME_OFF_WINDOW_DAYS,
  TIME_OFF_NOT_READABLE,
  dailysMarkNote,
  dailysNextLine,
  dailysOpenCount,
  dailysRows,
  parseDailyItems,
  setDailyItemRead,
  type DailyCheck,
  type DailyItem,
  type DailysRead,
  type DailysRow,
  type StationMarkLike,
  type TimeOffRow,
} from '../../lib/quickfill/dailysRead'
import { QuickfillChecklistRenameField } from './QuickfillChecklistRenameField'

/**
 * Quickfill → Assistant Dailys (v2.2285): the any-assistant daily duties that
 * used to be one person's recurring checklist tasks. One SHARED set of boxes
 * per company-calendar day — whoever does the duty checks it, the check shows
 * who and when, and the list clears overnight. Template items live in
 * app_settings.quickfill_assistant_dailys_items (dev-edited in place); per-day
 * state in quickfill_assistant_dailys_daily_checks. Clone of the
 * QuickfillOfficeSection 'arriving' pattern, plus checked-by attribution.
 *
 * Since v2.5884 (punch list #180) a box can read instead of being ticked: a box a dev marks as
 * reading the Schedule, Email or Physical inbox station is done when that station was marked
 * today, by anyone, and shows its live count; a box reading time off lists who is off in the next
 * two weeks and stays a tick (Told the lead), done on its own when nobody is. The count, the Next
 * line and the note the Mark saves come from `lib/quickfill/dailysRead.ts`.
 */

const ITEMS_KEY = 'quickfill_assistant_dailys_items'
const DEV_EDIT_STORAGE_KEY = 'quickfill_assistant_dailys_dev_edit'
const DOM_PREFIX = 'quickfill-assistant-dailys'

function readDevEditFromStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(DEV_EDIT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function checkTimeLabel(checkedAt: string): string {
  const d = new Date(checkedAt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function CheckAttribution({ check }: { check: DailyCheck }) {
  return (
    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>
      ✓ {check.checkedByName ?? 'someone'} · {checkTimeLabel(check.checkedAt)}
    </span>
  )
}

/** The box: a checkbox for a tick, a dashed read mark for a station row (nobody ticks a read). */
function RowBox({ row, check, savingDoneId, onToggleItem }: { row: DailysRow; check: DailyCheck | undefined; savingDoneId: string | null; onToggleItem: (itemId: string, checked: boolean) => void }) {
  if (row.kind === 'station') {
    return (
      <span
        role="img"
        aria-label={row.satisfied ? `${row.stationLabel} marked today` : `${row.stationLabel} not marked today`}
        data-dailys-read={row.satisfied ? 'done' : 'open'}
        style={{ flexShrink: 0, marginTop: 2, width: 13, height: 13, borderRadius: 3, border: `1px dashed ${row.satisfied ? 'var(--text-green-800)' : 'var(--border-strong)'}`, background: row.satisfied ? 'var(--bg-green-100)' : 'var(--surface)', color: 'var(--text-green-800)', fontSize: '0.6rem', lineHeight: '11px', textAlign: 'center', fontWeight: 700 }}
      >
        {row.satisfied ? '✓' : ''}
      </span>
    )
  }
  const nobodyOff = row.kind === 'time-off' && row.people.length === 0 && row.words !== TIME_OFF_NOT_READABLE
  return (
    <input
      type="checkbox"
      id={`${DOM_PREFIX}-${row.item.id}`}
      checked={check != null}
      disabled={savingDoneId === row.item.id || nobodyOff}
      title={nobodyOff ? 'Nobody is off, so there is nothing to pass on.' : undefined}
      onChange={(e) => void onToggleItem(row.item.id, e.target.checked)}
      style={{ flexShrink: 0, marginTop: 2 }}
    />
  )
}

/** The words: the box's label, then what the read found. */
function RowWords({ row, check, onOpenStation }: { row: DailysRow; check: DailyCheck | undefined; onOpenStation?: (sectionId: string) => void }) {
  const small: CSSProperties = { display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }
  if (row.kind === 'station') {
    return (
      <span style={{ flex: 1, fontSize: '0.875rem' }} data-dailys-station={row.station}>
        {row.item.label}
        <span style={small}>
          {row.countWords ? <>{row.countWords} · </> : null}
          {row.markedWords ? <span style={{ color: 'var(--text-green-800)', fontWeight: 600 }}>{row.markedWords}</span> : <span>not marked today</span>}
          {onOpenStation ? (
            <>
              {' · '}
              <button type="button" onClick={() => onOpenStation(row.station)} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer' }}>
                {row.satisfied ? 'Open →' : 'Open the station →'}
              </button>
            </>
          ) : null}
        </span>
      </span>
    )
  }
  return (
    <label htmlFor={`${DOM_PREFIX}-${row.item.id}`} style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}>
      {row.item.label}
      {row.kind === 'time-off' ? (
        <span style={{ ...small, color: row.people.length > 0 ? 'var(--text-700)' : 'var(--text-muted)' }} data-dailys-time-off={row.people.length}>
          {row.words}
        </span>
      ) : null}
      {check ? <CheckAttribution check={check} /> : null}
    </label>
  )
}

function SortableDailyRow({
  item,
  checks,
  savingDoneId,
  savingItems,
  onToggleItem,
  onRemoveItem,
  onRenameItem,
  onSetRead,
  row,
  onOpenStation,
}: {
  item: DailyItem
  checks: Map<string, DailyCheck>
  savingDoneId: string | null
  savingItems: boolean
  onToggleItem: (itemId: string, checked: boolean) => void
  onRemoveItem: (itemId: string) => void
  /** Resolves true once the new words are saved (v2.5829). */
  onRenameItem: (itemId: string, label: string) => Promise<boolean>
  /** What the box reads (v2.5884): a station, time off, or '' for a plain tick. */
  onSetRead: (itemId: string, reads: DailysRead | '') => void
  row: DailysRow
  onOpenStation?: (sectionId: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.35rem 0',
    borderBottom: '1px solid var(--border)',
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
  const check = checks.get(item.id)
  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={savingItems}
        aria-label={`Drag to reorder: ${item.label}`}
        title="Drag to reorder"
        style={{
          flexShrink: 0,
          cursor: savingItems ? 'not-allowed' : 'grab',
          touchAction: 'none',
          padding: '0.25rem 0.45rem',
          border: '1px solid var(--border-strong)',
          borderRadius: 4,
          background: 'var(--surface)',
          color: 'var(--text-slate-500)',
          fontSize: '0.75rem',
          lineHeight: 1,
          letterSpacing: '-0.05em',
        }}
      >
        {'⋮⋮'}
      </button>
      <RowBox row={row} check={check} savingDoneId={savingDoneId} onToggleItem={onToggleItem} />
      {renaming ? (
        <QuickfillChecklistRenameField
          label={item.label}
          saving={savingItems}
          onCancel={() => setRenaming(false)}
          onSave={(next) => void onRenameItem(item.id, next).then((saved) => (saved ? setRenaming(false) : undefined))}
        />
      ) : (
        <RowWords row={row} check={check} onOpenStation={onOpenStation} />
      )}
      {renaming ? null : (
        <select
          aria-label={`What “${item.label}” reads`}
          value={item.reads ?? ''}
          disabled={savingItems}
          onChange={(e) => onSetRead(item.id, e.target.value as DailysRead | '')}
          style={{ flexShrink: 0, maxWidth: '11rem', padding: '0.2rem 0.3rem', fontSize: '0.75rem', color: 'var(--text-700)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4 }}
        >
          {DAILYS_READ_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {renaming ? null : (
        <button
          type="button"
          onClick={() => setRenaming(true)}
          disabled={savingItems}
          title="Change this box's words in place. Its ticks stay with it."
          style={{ flexShrink: 0, padding: '0.2rem 0.45rem', fontSize: '0.75rem', color: 'var(--text-700)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: savingItems ? 'not-allowed' : 'pointer' }}
        >
          Rename
        </button>
      )}
      {renaming ? null : (
        <button
          type="button"
          onClick={() => void onRemoveItem(item.id)}
          disabled={savingItems}
          title="Remove task"
          style={{
            flexShrink: 0,
            padding: '0.2rem 0.45rem',
            fontSize: '0.75rem',
            color: 'var(--text-red-700)',
            background: 'var(--bg-red-tint)',
            border: '1px solid #fecaca',
            borderRadius: 4,
            cursor: savingItems ? 'not-allowed' : 'pointer',
          }}
        >
          Remove
        </button>
      )}
    </li>
  )
}

export function QuickfillAssistantDailysSection({
  siblingMarks = {},
  onOpenStation,
}: {
  /** The page's station marks (v2.5884): a box that reads a station is done when that station was marked today. */
  siblingMarks?: Readonly<Record<string, StationMarkLike | undefined>>
  /** Opens a station on the page (the box's door). */
  onOpenStation?: (sectionId: string) => void
} = {}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const metrics = useQuickfillSectionMetricsSnapshot()
  const [items, setItems] = useState<DailyItem[]>([])
  const [checks, setChecks] = useState<Map<string, DailyCheck>>(() => new Map())
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([])
  const [workDateYmd, setWorkDateYmd] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingDoneId, setSavingDoneId] = useState<string | null>(null)
  const [savingItems, setSavingItems] = useState(false)
  const [newLabelDraft, setNewLabelDraft] = useState('')
  const [devEditMode, setDevEditMode] = useState(readDevEditFromStorage)

  const isDev = role === 'dev'
  const canReadTimeOff = role === 'dev' || role === 'master_technician' || role === 'assistant'
  const sortable = isDev && devEditMode && items.length > 0
  const showDevItemTools = isDev && devEditMode
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const loadSection = useCallback(async () => {
    const ymd = denverCalendarDayKey(Date.now())
    setWorkDateYmd(ymd)
    const [settingsRows, checksRows] = await Promise.all([
      withSupabaseRetry(
        async () => supabase.from('app_settings').select('key, value_text').eq('key', ITEMS_KEY),
        'load quickfill assistant dailys items',
      ),
      withSupabaseRetry(
        async () =>
          supabase
            .from('quickfill_assistant_dailys_daily_checks')
            .select('item_id, checked_at, users:checked_by(name)')
            .eq('work_date', ymd),
        'load quickfill assistant dailys checks',
      ),
    ])
    const list = (settingsRows ?? []) as Array<{ key: string; value_text: string | null }>
    const parsed = parseDailyItems(list.find((r) => r.key === ITEMS_KEY)?.value_text ?? null)
    setItems(parsed)
    // Who is off in the window, for a box that reads time off (v2.5884). The table's policy shows every row to a
    // dev, an assistant and a pay-approved master and only their own to anyone else, so the read is theirs alone;
    // another role keeps the tick and is told so. Fail-soft: the ticks still draw.
    if (parsed.some((i) => i.reads === 'time-off') && canReadTimeOff) {
      const end = new Date(`${ymd}T00:00:00`)
      end.setDate(end.getDate() + DAILYS_TIME_OFF_WINDOW_DAYS)
      const endYmd = denverCalendarDayKey(end.getTime())
      try {
        const rows = await withSupabaseRetry(
          async () => supabase.from('user_time_off').select('user_id, start_date, end_date, users!user_time_off_user_id_fkey(name)').lte('start_date', endYmd).gte('end_date', ymd),
          'load time off for the assistant dailys',
        )
        setTimeOff(
          ((rows ?? []) as unknown as Array<{ user_id: string; start_date: string; end_date: string; users: { name: string | null } | { name: string | null }[] | null }>).map((r) => {
            const u = Array.isArray(r.users) ? r.users[0] : r.users
            return { user_id: r.user_id, start_date: r.start_date, end_date: r.end_date, name: u?.name ?? null }
          }),
        )
      } catch {
        setTimeOff([])
      }
    } else {
      setTimeOff([])
    }
    const next = new Map<string, DailyCheck>()
    for (const r of (checksRows ?? []) as Array<{
      item_id: string
      checked_at: string
      users: { name: string | null } | null
    }>) {
      next.set(r.item_id, { checkedByName: r.users?.name?.trim() || null, checkedAt: r.checked_at })
    }
    setChecks(next)
  }, [canReadTimeOff])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadSection()
      .catch((e: unknown) => {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load Assistant Dailys'), 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadSection, showToast])

  // Deliberately not in the realtime publication (same call as the Office
  // Arriving table, whose channel was shed in 20260624160100) — refresh when
  // the tab becomes visible instead; fine for a once-a-day list.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadSection()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadSection])

  const rows = useMemo(
    () =>
      dailysRows(items, {
        todayYmd: workDateYmd || denverCalendarDayKey(Date.now()),
        checks,
        marks: siblingMarks,
        metrics,
        timeOff,
        timeOffReadable: canReadTimeOff,
        ymdOf: calendarYmdInAppTzFromIso,
        timeOf: formatMarkTime,
      }),
    [items, checks, siblingMarks, metrics, timeOff, workDateYmd, canReadTimeOff],
  )
  const openCount = useMemo(() => dailysOpenCount(rows), [rows])

  useReportQuickfillSectionMetric('assistant-dailys', loading ? null : openCount, loading, null, loading ? null : dailysMarkNote(rows), loading ? null : dailysNextLine(rows))

  async function persistItems(next: DailyItem[]) {
    await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').upsert({ key: ITEMS_KEY, value_text: JSON.stringify(next) }, { onConflict: 'key' }),
      'save quickfill assistant dailys items',
    )
  }

  async function onToggleItem(itemId: string, checked: boolean) {
    const ymd = workDateYmd || denverCalendarDayKey(Date.now())
    setSavingDoneId(itemId)
    try {
      if (checked) {
        await withSupabaseRetry(
          async () =>
            supabase.from('quickfill_assistant_dailys_daily_checks').insert({ item_id: itemId, work_date: ymd }),
          'save quickfill assistant dailys check',
        )
        // Attribution refreshes with the real name on the next load; "you" is
        // implied meanwhile since you just clicked it.
        await loadSection()
      } else {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('quickfill_assistant_dailys_daily_checks')
              .delete()
              .eq('item_id', itemId)
              .eq('work_date', ymd),
          'clear quickfill assistant dailys check',
        )
        setChecks((prev) => {
          const next = new Map(prev)
          next.delete(itemId)
          return next
        })
      }
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not update checklist'), 'error')
    } finally {
      setSavingDoneId(null)
    }
  }

  async function onAddItem() {
    const label = newLabelDraft.trim()
    if (!label) {
      showToast('Enter a task label.', 'error')
      return
    }
    setSavingItems(true)
    const next = [...items, { id: crypto.randomUUID(), label }]
    try {
      await persistItems(next)
      setItems(next)
      setNewLabelDraft('')
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not add task'), 'error')
    } finally {
      setSavingItems(false)
    }
  }

  /** A box's words changed in place: same id, so its ticks stay with it (v2.5829). */
  async function onRenameItem(itemId: string, label: string): Promise<boolean> {
    const next = renameChecklistItem(items, itemId, label)
    if (!next) return false
    setSavingItems(true)
    try {
      await persistItems(next)
      setItems(next)
      return true
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not rename task'), 'error')
      return false
    } finally {
      setSavingItems(false)
    }
  }

  /** What a box reads (v2.5884): a dev's pick, saved in the same list. */
  async function onSetRead(itemId: string, reads: DailysRead | '') {
    const next = setDailyItemRead(items, itemId, reads)
    if (!next) return
    setSavingItems(true)
    try {
      await persistItems(next)
      setItems(next)
      if (reads === 'time-off') await loadSection()
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not change what the box reads'), 'error')
    } finally {
      setSavingItems(false)
    }
  }

  // Removing a box drops it from the list and leaves its tick rows where they are (v2.5829):
  // until then this deleted every tick the box ever had, so a reworded box lost its past.
  async function onRemoveItem(itemId: string) {
    setSavingItems(true)
    const nextItems = items.filter((i) => i.id !== itemId)
    try {
      await persistItems(nextItems)
      setChecks((prev) => {
        const next = new Map(prev)
        next.delete(itemId)
        return next
      })
      setItems(nextItems)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not remove task'), 'error')
    } finally {
      setSavingItems(false)
    }
  }

  async function onItemsDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === String(active.id))
    const newIndex = items.findIndex((i) => i.id === String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setSavingItems(true)
    try {
      await persistItems(next)
      setItems(next)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not reorder tasks'), 'error')
    } finally {
      setSavingItems(false)
    }
  }

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>
        Daily office duties for whoever is in. One shared set of boxes for the whole team, cleared overnight on the
        company calendar. Checking a box records who did it. A box that reads a station is done when that station is
        marked today, by anyone.
      </p>
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          {isDev && !devEditMode
            ? 'No tasks yet. Turn on Edit checklist below to add items.'
            : isDev
              ? 'No tasks yet. Add checklist items below.'
              : 'No daily tasks configured yet. A dev can add checklist items in Quickfill.'}
        </p>
      ) : sortable ? (
        <DndContext sensors={dragSensors} onDragEnd={(e) => void onItemsDragEnd(e)}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
              {rows.map((row) => (
                <SortableDailyRow
                  key={row.item.id}
                  item={row.item}
                  row={row}
                  checks={checks}
                  savingDoneId={savingDoneId}
                  savingItems={savingItems}
                  onToggleItem={onToggleItem}
                  onRemoveItem={onRemoveItem}
                  onRenameItem={onRenameItem}
                  onSetRead={onSetRead}
                  onOpenStation={onOpenStation}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {rows.map((row) => {
            const item = row.item
            const check = checks.get(item.id)
            return (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  padding: '0.35rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <RowBox row={row} check={check} savingDoneId={savingDoneId} onToggleItem={onToggleItem} />
                <RowWords row={row} check={check} onOpenStation={onOpenStation} />
                {showDevItemTools ? (
                  <button
                    type="button"
                    onClick={() => void onRemoveItem(item.id)}
                    disabled={savingItems}
                    title="Remove task"
                    style={{
                      flexShrink: 0,
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-red-700)',
                      background: 'var(--bg-red-tint)',
                      border: '1px solid #fecaca',
                      borderRadius: 4,
                      cursor: savingItems ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {showDevItemTools ? (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
            Dev: add checklist item
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={newLabelDraft}
              onChange={(e) => setNewLabelDraft(e.target.value)}
              placeholder="e.g. Check the schedule for conflicts"
              disabled={savingItems}
              style={{
                flex: '1 1 200px',
                minWidth: 0,
                padding: '0.4rem 0.5rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void onAddItem()
                }
              }}
            />
            <button
              type="button"
              onClick={() => void onAddItem()}
              disabled={savingItems || !newLabelDraft.trim()}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.875rem',
                background: savingItems || !newLabelDraft.trim() ? 'var(--bg-200)' : '#2563eb',
                color: savingItems || !newLabelDraft.trim() ? 'var(--text-faint)' : 'white',
                border: 'none',
                borderRadius: 4,
                cursor: savingItems || !newLabelDraft.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
      {isDev ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            aria-pressed={devEditMode}
            onClick={() => {
              setDevEditMode((prev) => {
                const next = !prev
                try {
                  localStorage.setItem(DEV_EDIT_STORAGE_KEY, next ? '1' : '0')
                } catch {
                  /* ignore quota / private mode */
                }
                return next
              })
            }}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.8125rem',
              border: devEditMode ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: devEditMode ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: devEditMode ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
              fontWeight: devEditMode ? 600 : 400,
            }}
          >
            {devEditMode ? 'Done editing' : 'Edit checklist'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
