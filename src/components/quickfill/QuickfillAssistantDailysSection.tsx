import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'

/**
 * Quickfill → Assistant Dailys (v2.2285): the any-assistant daily duties that
 * used to be one person's recurring checklist tasks. One SHARED set of boxes
 * per company-calendar day — whoever does the duty checks it, the check shows
 * who and when, and the list clears overnight. Template items live in
 * app_settings.quickfill_assistant_dailys_items (dev-edited in place); per-day
 * state in quickfill_assistant_dailys_daily_checks. Clone of the
 * QuickfillOfficeSection 'arriving' pattern, plus checked-by attribution.
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

type DailyItem = { id: string; label: string }

/** Who checked a box today, for the attribution line under the label. */
type DailyCheck = { checkedByName: string | null; checkedAt: string }

function parseDailyItems(raw: string | null | undefined): DailyItem[] {
  if (raw == null || raw === '') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: DailyItem[] = []
    for (const x of parsed) {
      if (x == null || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const id = typeof o.id === 'string' ? o.id : ''
      const label = typeof o.label === 'string' ? o.label.trim() : ''
      if (id && label) out.push({ id, label })
    }
    return out
  } catch {
    return []
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

function SortableDailyRow({
  item,
  checks,
  savingDoneId,
  savingItems,
  onToggleItem,
  onRemoveItem,
}: {
  item: DailyItem
  checks: Map<string, DailyCheck>
  savingDoneId: string | null
  savingItems: boolean
  onToggleItem: (itemId: string, checked: boolean) => void
  onRemoveItem: (itemId: string) => void
}) {
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
      <input
        type="checkbox"
        id={`${DOM_PREFIX}-${item.id}`}
        checked={check != null}
        disabled={savingDoneId === item.id}
        onChange={(e) => void onToggleItem(item.id, e.target.checked)}
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <label htmlFor={`${DOM_PREFIX}-${item.id}`} style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}>
        {item.label}
        {check ? <CheckAttribution check={check} /> : null}
      </label>
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
    </li>
  )
}

export function QuickfillAssistantDailysSection() {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [items, setItems] = useState<DailyItem[]>([])
  const [checks, setChecks] = useState<Map<string, DailyCheck>>(() => new Map())
  const [workDateYmd, setWorkDateYmd] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingDoneId, setSavingDoneId] = useState<string | null>(null)
  const [savingItems, setSavingItems] = useState(false)
  const [newLabelDraft, setNewLabelDraft] = useState('')
  const [devEditMode, setDevEditMode] = useState(readDevEditFromStorage)

  const isDev = role === 'dev'
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
    setItems(parseDailyItems(list.find((r) => r.key === ITEMS_KEY)?.value_text ?? null))
    const next = new Map<string, DailyCheck>()
    for (const r of (checksRows ?? []) as Array<{
      item_id: string
      checked_at: string
      users: { name: string | null } | null
    }>) {
      next.set(r.item_id, { checkedByName: r.users?.name?.trim() || null, checkedAt: r.checked_at })
    }
    setChecks(next)
  }, [])

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

  const openCount = useMemo(
    () => (items.length === 0 ? 0 : items.filter((i) => !checks.has(i.id)).length),
    [items, checks],
  )

  useReportQuickfillSectionMetric('assistant-dailys', loading ? null : openCount, loading)

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

  async function onRemoveItem(itemId: string) {
    setSavingItems(true)
    const nextItems = items.filter((i) => i.id !== itemId)
    try {
      await withSupabaseRetry(
        async () => supabase.from('quickfill_assistant_dailys_daily_checks').delete().eq('item_id', itemId),
        'remove quickfill assistant dailys checks for item',
      )
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
        Daily office duties for whoever's in — one shared set of boxes for the whole team, cleared overnight
        (company calendar). Checking a box records who did it.
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
              {items.map((item) => (
                <SortableDailyRow
                  key={item.id}
                  item={item}
                  checks={checks}
                  savingDoneId={savingDoneId}
                  savingItems={savingItems}
                  onToggleItem={onToggleItem}
                  onRemoveItem={onRemoveItem}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {items.map((item) => {
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
                <input
                  type="checkbox"
                  id={`${DOM_PREFIX}-${item.id}`}
                  checked={check != null}
                  disabled={savingDoneId === item.id}
                  onChange={(e) => void onToggleItem(item.id, e.target.checked)}
                  style={{ flexShrink: 0, marginTop: 2 }}
                />
                <label htmlFor={`${DOM_PREFIX}-${item.id}`} style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}>
                  {item.label}
                  {check ? <CheckAttribution check={check} /> : null}
                </label>
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
