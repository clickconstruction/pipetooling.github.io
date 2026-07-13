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

export type QuickfillOfficeSectionVariant = 'arriving' | 'leaving'

const QUICKFILL_OFFICE_DEV_EDIT_STORAGE_KEY: Record<QuickfillOfficeSectionVariant, string> = {
  arriving: 'quickfill_office_arriving_dev_edit',
  leaving: 'quickfill_office_leaving_dev_edit',
}

function readDevOfficeEditFromStorage(variant: QuickfillOfficeSectionVariant): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(QUICKFILL_OFFICE_DEV_EDIT_STORAGE_KEY[variant]) === '1'
  } catch {
    return false
  }
}

const VARIANT_KEYS: Record<
  QuickfillOfficeSectionVariant,
  { itemsKey: string; doneKey: string; metricSectionId: 'office-arriving' | 'office-leaving' }
> = {
  arriving: {
    itemsKey: 'quickfill_office_arriving_items',
    doneKey: 'quickfill_office_arriving_done',
    metricSectionId: 'office-arriving',
  },
  leaving: {
    itemsKey: 'quickfill_office_leaving_items',
    doneKey: 'quickfill_office_leaving_done',
    metricSectionId: 'office-leaving',
  },
}

type OfficeItem = { id: string; label: string }

function parseOfficeItems(raw: string | null | undefined): OfficeItem[] {
  if (raw == null || raw === '') return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: OfficeItem[] = []
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

function parseOfficeDone(raw: string | null | undefined): Record<string, boolean> {
  if (raw == null || raw === '') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && k && v === true) out[k] = true
    }
    return out
  } catch {
    return {}
  }
}

function SortableOfficeChecklistRow({
  item,
  domPrefix,
  done,
  savingDoneId,
  savingItems,
  onToggleItem,
  onRemoveItem,
}: {
  item: OfficeItem
  domPrefix: string
  done: Record<string, boolean>
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
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0',
    borderBottom: '1px solid #f3f4f6',
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
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
        {'\u22EE\u22EE'}
      </button>
      <input
        type="checkbox"
        id={`${domPrefix}-${item.id}`}
        checked={done[item.id] === true}
        disabled={savingDoneId === item.id}
        onChange={(e) => void onToggleItem(item.id, e.target.checked)}
        style={{ flexShrink: 0 }}
      />
      <label
        htmlFor={`${domPrefix}-${item.id}`}
        style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}
      >
        {item.label}
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

export function QuickfillOfficeSection({ variant }: { variant: QuickfillOfficeSectionVariant }) {
  const { itemsKey, doneKey, metricSectionId } = VARIANT_KEYS[variant]
  const isArriving = variant === 'arriving'
  const domPrefix = `quickfill-office-${variant}`
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [items, setItems] = useState<OfficeItem[]>([])
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [arrivingCheckedIds, setArrivingCheckedIds] = useState<Set<string>>(() => new Set())
  const [arrivingWorkDateYmd, setArrivingWorkDateYmd] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingDoneId, setSavingDoneId] = useState<string | null>(null)
  const [savingItems, setSavingItems] = useState(false)
  const [newLabelDraft, setNewLabelDraft] = useState('')
  const [devOfficeChecklistEditMode, setDevOfficeChecklistEditMode] = useState(() =>
    readDevOfficeEditFromStorage(variant),
  )

  const isDev = role === 'dev'
  const officeSortable = isDev && devOfficeChecklistEditMode && items.length > 0
  const showDevOfficeItemTools = isDev && devOfficeChecklistEditMode
  const officeDragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const loadOfficeSettings = useCallback(async () => {
    if (isArriving) {
      const ymd = denverCalendarDayKey(Date.now())
      setArrivingWorkDateYmd(ymd)
      const [settingsRows, checksRows] = await Promise.all([
        withSupabaseRetry(
          async () => supabase.from('app_settings').select('key, value_text').eq('key', itemsKey),
          `load quickfill office arriving items`,
        ),
        withSupabaseRetry(
          async () =>
            supabase.from('quickfill_office_arriving_daily_checks').select('item_id').eq('work_date', ymd),
          `load quickfill office arriving daily checks`,
        ),
      ])
      const list = (settingsRows ?? []) as Array<{ key: string; value_text: string | null }>
      const itemsText = list.find((r) => r.key === itemsKey)?.value_text ?? null
      setItems(parseOfficeItems(itemsText))
      setDone({})
      const checkList = (checksRows ?? []) as { item_id: string }[]
      setArrivingCheckedIds(new Set(checkList.map((r) => r.item_id)))
      return
    }
    const rows = await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').select('key, value_text').in('key', [itemsKey, doneKey]),
      `load quickfill office ${variant} settings`,
    )
    const list = (rows ?? []) as Array<{ key: string; value_text: string | null }>
    let itemsText: string | null = null
    let doneText: string | null = null
    for (const r of list) {
      if (r.key === itemsKey) itemsText = r.value_text
      else if (r.key === doneKey) doneText = r.value_text
    }
    setItems(parseOfficeItems(itemsText))
    setDone(parseOfficeDone(doneText))
  }, [itemsKey, doneKey, variant, isArriving])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadOfficeSettings()
      .catch((e: unknown) => {
        if (!cancelled) showToast(formatErrorMessage(e, 'Could not load Office checklist'), 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadOfficeSettings, showToast])

  // quickfill_office_arriving_daily_checks was dropped from the supabase_realtime
  // publication (migration 20260624160100) to shed an idle Realtime channel.
  // (app_settings was never in the publication, so its listener was always a
  // no-op.) The daily checklist is refreshed by the visibility/focus handler
  // below instead of live — acceptable for a once-per-day office list.
  useEffect(() => {
    if (!isArriving) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadOfficeSettings()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [isArriving, loadOfficeSettings])

  const openCount = useMemo(() => {
    if (items.length === 0) return 0
    if (isArriving) return items.filter((i) => !arrivingCheckedIds.has(i.id)).length
    return items.filter((i) => !done[i.id]).length
  }, [items, isArriving, arrivingCheckedIds, done])

  const effectiveDone = useMemo(() => {
    if (!isArriving) return done
    const out: Record<string, boolean> = {}
    for (const id of arrivingCheckedIds) out[id] = true
    return out
  }, [isArriving, done, arrivingCheckedIds])

  useReportQuickfillSectionMetric(metricSectionId, loading ? null : openCount, loading)

  async function persistDone(next: Record<string, boolean>) {
    await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').update({ value_text: JSON.stringify(next) }).eq('key', doneKey),
      `save quickfill office ${variant} done`,
    )
  }

  async function persistItems(next: OfficeItem[]) {
    await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').upsert({ key: itemsKey, value_text: JSON.stringify(next) }, { onConflict: 'key' }),
      `save quickfill office ${variant} items`,
    )
  }

  async function onToggleItem(itemId: string, checked: boolean) {
    if (isArriving) {
      const ymd = arrivingWorkDateYmd || denverCalendarDayKey(Date.now())
      setSavingDoneId(itemId)
      try {
        if (checked) {
          await withSupabaseRetry(
            async () =>
              supabase.from('quickfill_office_arriving_daily_checks').insert({
                item_id: itemId,
                work_date: ymd,
              }),
            'save quickfill office arriving check',
          )
          setArrivingCheckedIds((prev) => new Set([...prev, itemId]))
        } else {
          await withSupabaseRetry(
            async () =>
              supabase
                .from('quickfill_office_arriving_daily_checks')
                .delete()
                .eq('item_id', itemId)
                .eq('work_date', ymd),
            'clear quickfill office arriving check',
          )
          setArrivingCheckedIds((prev) => {
            const next = new Set(prev)
            next.delete(itemId)
            return next
          })
        }
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Could not update checklist'), 'error')
      } finally {
        setSavingDoneId(null)
      }
      return
    }
    setSavingDoneId(itemId)
    const next = { ...done }
    if (checked) next[itemId] = true
    else delete next[itemId]
    try {
      await persistDone(next)
      setDone(next)
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
    const nextDone = { ...done }
    delete nextDone[itemId]
    try {
      if (isArriving) {
        await withSupabaseRetry(
          async () =>
            supabase.from('quickfill_office_arriving_daily_checks').delete().eq('item_id', itemId),
          'remove quickfill office arriving checks for item',
        )
      }
      await persistItems(nextItems)
      if (isArriving) {
        setArrivingCheckedIds((prev) => {
          const n = new Set(prev)
          n.delete(itemId)
          return n
        })
      } else {
        await persistDone(nextDone)
        setDone(nextDone)
      }
      setItems(nextItems)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not remove task'), 'error')
    } finally {
      setSavingItems(false)
    }
  }

  async function onOfficeItemsDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const a = String(active.id)
    const o = String(over.id)
    const oldIndex = items.findIndex((i) => i.id === a)
    const newIndex = items.findIndex((i) => i.id === o)
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

  const intro =
    variant === 'arriving'
      ? 'Start the day with the workspace ready—clear surfaces, systems on, and a calm first impression for anyone walking in. Checkboxes apply to today only (company calendar) and clear overnight.'
      : 'Before you head out, leave the office tidy and predictable for tomorrow—reset shared spaces so the team can pick up smoothly.'

  const emptyNonDev =
    variant === 'arriving'
      ? 'No arriving tasks configured yet. A dev can add checklist items in Quickfill.'
      : 'No leaving tasks configured yet. A dev can add checklist items in Quickfill.'

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-600)', lineHeight: 1.45 }}>{intro}</p>
      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          {isDev && !devOfficeChecklistEditMode
            ? 'No tasks yet. Turn on Edit checklist below to add items.'
            : isDev
              ? 'No tasks yet. Add checklist items below.'
              : emptyNonDev}
        </p>
      ) : officeSortable ? (
        <DndContext sensors={officeDragSensors} onDragEnd={(e) => void onOfficeItemsDragEnd(e)}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
              {items.map((item) => (
                <SortableOfficeChecklistRow
                  key={item.id}
                  item={item}
                  domPrefix={domPrefix}
                  done={effectiveDone}
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
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <input
                type="checkbox"
                id={`${domPrefix}-${item.id}`}
                checked={effectiveDone[item.id] === true}
                disabled={savingDoneId === item.id}
                onChange={(e) => void onToggleItem(item.id, e.target.checked)}
                style={{ flexShrink: 0 }}
              />
              <label
                htmlFor={`${domPrefix}-${item.id}`}
                style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                {item.label}
              </label>
              {showDevOfficeItemTools ? (
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
          ))}
        </ul>
      )}
      {showDevOfficeItemTools ? (
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
              placeholder="e.g. Counters cleared, dishes done"
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
            aria-pressed={devOfficeChecklistEditMode}
            onClick={() => {
              setDevOfficeChecklistEditMode((prev) => {
                const next = !prev
                try {
                  localStorage.setItem(QUICKFILL_OFFICE_DEV_EDIT_STORAGE_KEY[variant], next ? '1' : '0')
                } catch {
                  /* ignore quota / private mode */
                }
                return next
              })
            }}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.8125rem',
              border: devOfficeChecklistEditMode ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              borderRadius: 4,
              background: devOfficeChecklistEditMode ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: devOfficeChecklistEditMode ? 'var(--text-blue-700)' : 'var(--text-700)',
              cursor: 'pointer',
              fontWeight: devOfficeChecklistEditMode ? 600 : 400,
            }}
          >
            {devOfficeChecklistEditMode ? 'Done editing' : 'Edit checklist'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
