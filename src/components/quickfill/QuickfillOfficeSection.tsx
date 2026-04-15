import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export type QuickfillOfficeSectionVariant = 'arriving' | 'leaving'

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

export function QuickfillOfficeSection({ variant }: { variant: QuickfillOfficeSectionVariant }) {
  const { itemsKey, doneKey, metricSectionId } = VARIANT_KEYS[variant]
  const domPrefix = `quickfill-office-${variant}`
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [items, setItems] = useState<OfficeItem[]>([])
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [savingDoneId, setSavingDoneId] = useState<string | null>(null)
  const [savingItems, setSavingItems] = useState(false)
  const [newLabelDraft, setNewLabelDraft] = useState('')

  const isDev = role === 'dev'

  const loadOfficeSettings = useCallback(async () => {
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
  }, [itemsKey, doneKey, variant])

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

  useEffect(() => {
    const channel = supabase
      .channel(`quickfill-office-${variant}-app-settings`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          const row = payload.new as { key?: string; value_text?: string | null } | null
          if (!row?.key) return
          if (row.key === itemsKey || row.key === doneKey) {
            void loadOfficeSettings()
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadOfficeSettings, itemsKey, doneKey, variant])

  const openCount = useMemo(() => {
    if (items.length === 0) return 0
    return items.filter((i) => !done[i.id]).length
  }, [items, done])

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
      await persistItems(nextItems)
      await persistDone(nextDone)
      setItems(nextItems)
      setDone(nextDone)
    } catch (e: unknown) {
      showToast(formatErrorMessage(e, 'Could not remove task'), 'error')
    } finally {
      setSavingItems(false)
    }
  }

  const intro =
    variant === 'arriving'
      ? 'Start the day with the workspace ready—clear surfaces, systems on, and a calm first impression for anyone walking in.'
      : 'Before you head out, leave the office tidy and predictable for tomorrow—reset shared spaces so the team can pick up smoothly.'

  const emptyNonDev =
    variant === 'arriving'
      ? 'No arriving tasks configured yet. A dev can add checklist items in Quickfill.'
      : 'No leaving tasks configured yet. A dev can add checklist items in Quickfill.'

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.45 }}>{intro}</p>
      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          {isDev ? 'No tasks yet. Add checklist items below.' : emptyNonDev}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                padding: '0.35rem 0',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <input
                type="checkbox"
                id={`${domPrefix}-${item.id}`}
                checked={done[item.id] === true}
                disabled={savingDoneId === item.id}
                onChange={(e) => void onToggleItem(item.id, e.target.checked)}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <label
                htmlFor={`${domPrefix}-${item.id}`}
                style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer', paddingTop: 2 }}
              >
                {item.label}
              </label>
              {isDev ? (
                <button
                  type="button"
                  onClick={() => void onRemoveItem(item.id)}
                  disabled={savingItems}
                  title="Remove task"
                  style={{
                    flexShrink: 0,
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.75rem',
                    color: '#b91c1c',
                    background: '#fef2f2',
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
      {isDev ? (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
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
                border: '1px solid #d1d5db',
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
                background: savingItems || !newLabelDraft.trim() ? '#e5e7eb' : '#2563eb',
                color: savingItems || !newLabelDraft.trim() ? '#9ca3af' : 'white',
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
    </div>
  )
}
