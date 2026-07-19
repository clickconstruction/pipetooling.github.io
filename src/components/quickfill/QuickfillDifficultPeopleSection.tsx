import { useCallback, useEffect, useMemo, useState } from 'react'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import type { Database } from '../../types/database'

type ItemRow = Database['public']['Tables']['quickfill_difficult_people_items']['Row']
type ItemWithJoins = ItemRow & {
  people: { id: string; name: string } | null
}

type PersonOption = { id: string; name: string }

const SECTION_METRIC_ID = 'difficult-people'
const DOM_PREFIX = 'quickfill-difficult-people'

export function QuickfillDifficultPeopleSection() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const [workDateYmd, setWorkDateYmd] = useState(() => denverCalendarDayKey(Date.now()))
  const [items, setItems] = useState<ItemWithJoins[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [peopleLoading, setPeopleLoading] = useState(false)

  const [addPersonId, setAddPersonId] = useState<string>('')
  const [addAction, setAddAction] = useState('')
  const [addReason, setAddReason] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const [savingCheckId, setSavingCheckId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [editRowId, setEditRowId] = useState<string | null>(null)
  const [editPersonId, setEditPersonId] = useState('')
  const [editAction, setEditAction] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const isDev = role === 'dev'

  const loadData = useCallback(async () => {
    if (!authUser?.id) return
    const ymd = denverCalendarDayKey(Date.now())
    setWorkDateYmd(ymd)
    setLoading(true)
    try {
      const [itemsData, checksData] = await Promise.all([
        withSupabaseRetry(
          async () =>
            await supabase
              .from('quickfill_difficult_people_items')
              .select(
                `
                *,
                people ( id, name )
              `,
              )
              .order('created_at', { ascending: false }),
          'load quickfill difficult people items',
        ),
        withSupabaseRetry(
          async () =>
            await supabase
              .from('quickfill_difficult_people_daily_checks')
              .select('item_id')
              .eq('work_date', ymd),
          'load quickfill difficult people daily checks',
        ),
      ])
      setItems((itemsData as ItemWithJoins[]) ?? [])
      const rows = (checksData as { item_id: string }[] | null) ?? []
      setCheckedIds(new Set(rows.map((r) => r.item_id)))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load difficult people'), 'error')
      setItems([])
      setCheckedIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [authUser?.id, showToast])

  const loadPeople = useCallback(async () => {
    if (!authUser?.id || !isDev) return
    setPeopleLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('people')
            .select('id, name')
            .is('archived_at', null)
            .order('name', { ascending: true }),
        'load people for difficult people quickfill',
      )
      setPeople((data as PersonOption[]) ?? [])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load people'), 'error')
      setPeople([])
    } finally {
      setPeopleLoading(false)
    }
  }, [authUser?.id, isDev, showToast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadPeople()
  }, [loadPeople])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadData()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadData])

  const uncheckedCount = useMemo(() => {
    if (items.length === 0) return 0
    return items.filter((i) => !checkedIds.has(i.id)).length
  }, [items, checkedIds])

  const personSelectOptions = useMemo<SearchableSelectOption[]>(
    () => people.map((p) => ({ value: p.id, label: p.name?.trim() ? p.name : p.id })),
    [people],
  )

  useReportQuickfillSectionMetric(SECTION_METRIC_ID, uncheckedCount, loading)

  async function onToggleCheck(itemId: string, checked: boolean) {
    setSavingCheckId(itemId)
    try {
      if (checked) {
        await withSupabaseRetry(
          async () =>
            await supabase.from('quickfill_difficult_people_daily_checks').insert({
              item_id: itemId,
              work_date: workDateYmd,
            }),
          'insert difficult people daily check',
        )
        setCheckedIds((prev) => new Set([...prev, itemId]))
      } else {
        await withSupabaseRetry(
          async () =>
            await supabase
              .from('quickfill_difficult_people_daily_checks')
              .delete()
              .eq('item_id', itemId)
              .eq('work_date', workDateYmd),
          'delete difficult people daily check',
        )
        setCheckedIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    } catch (e) {
      showToast(formatErrorMessage(e, checked ? 'Could not check' : 'Could not uncheck'), 'error')
      await loadData()
    } finally {
      setSavingCheckId(null)
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addPersonId.trim() || !addAction.trim() || !addReason.trim()) {
      showToast('Choose a person and fill in action and reason.', 'warning')
      return
    }
    setAddSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('quickfill_difficult_people_items').insert({
            person_id: addPersonId,
            action_text: addAction.trim(),
            reason_text: addReason.trim(),
          }),
        'insert difficult people item',
      )
      showToast('Item added.', 'success')
      setAddPersonId('')
      setAddAction('')
      setAddReason('')
      await loadData()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add item'), 'error')
    } finally {
      setAddSaving(false)
    }
  }

  async function onDelete(id: string) {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id)
      return
    }
    setDeletingId(id)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('quickfill_difficult_people_items').delete().eq('id', id),
        'delete difficult people item',
      )
      showToast('Deleted.', 'success')
      setEditRowId(null)
      setDeleteConfirmId(null)
      await loadData()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function startEdit(row: ItemWithJoins) {
    setDeleteConfirmId(null)
    setEditRowId(row.id)
    setEditPersonId(row.person_id)
    setEditAction(row.action_text)
    setEditReason(row.reason_text)
  }

  function cancelEdit() {
    setEditRowId(null)
    setDeleteConfirmId(null)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editRowId || !editPersonId.trim() || !editAction.trim() || !editReason.trim()) {
      showToast('Fill in person, action, and reason.', 'warning')
      return
    }
    setEditSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('quickfill_difficult_people_items')
            .update({
              person_id: editPersonId,
              action_text: editAction.trim(),
              reason_text: editReason.trim(),
            })
            .eq('id', editRowId),
        'update difficult people item',
      )
      showToast('Saved.', 'success')
      setEditRowId(null)
      await loadData()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save'), 'error')
    } finally {
      setEditSaving(false)
    }
  }

  if (loading && items.length === 0) {
    return <p style={{ color: 'var(--text-slate-500)', fontSize: '0.875rem' }}>Loading…</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {isDev && (
        <form
          onSubmit={onAdd}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-page)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Add item</div>
          <div>
            <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', color: 'var(--text-700)' }}>Person</div>
            <SearchableSelect
              value={addPersonId}
              onChange={(v) => setAddPersonId(v)}
              options={personSelectOptions}
              placeholder={peopleLoading ? 'Loading people…' : 'Search people…'}
              disabled={peopleLoading || addSaving}
              listAriaLabel="Person for difficult people item"
            />
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Action</span>
            <textarea
              value={addAction}
              onChange={(ev) => setAddAction(ev.target.value)}
              rows={2}
              disabled={addSaving}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Reason</span>
            <textarea
              value={addReason}
              onChange={(ev) => setAddReason(ev.target.value)}
              rows={2}
              disabled={addSaving}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
            />
          </label>
          <button
            type="submit"
            disabled={addSaving || peopleLoading}
            style={{
              alignSelf: 'flex-start',
              padding: '0.5rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: '#1d4ed8',
              color: '#fff',
              cursor: addSaving ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {addSaving ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}

      <div>
        {items.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-slate-500)', fontSize: '0.875rem' }}>
            {isDev ? 'No items yet. Add one above.' : 'No items yet. A dev can add checklist lines.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {items.map((row) => (
              <li
                key={row.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.6rem 0.85rem',
                  background: 'var(--surface)',
                }}
              >
                {isDev && editRowId === row.id ? (
                  <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <SearchableSelect
                      value={editPersonId}
                      onChange={(v) => setEditPersonId(v)}
                      options={personSelectOptions}
                      placeholder="Person"
                      disabled={editSaving}
                      listAriaLabel="Edit person for difficult people item"
                    />
                    <textarea
                      value={editAction}
                      onChange={(ev) => setEditAction(ev.target.value)}
                      rows={2}
                      disabled={editSaving}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
                    />
                    <textarea
                      value={editReason}
                      onChange={(ev) => setEditReason(ev.target.value)}
                      rows={2}
                      disabled={editSaving}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border-strong)' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="submit"
                        disabled={editSaving}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: 6,
                          border: 'none',
                          background: '#1d4ed8',
                          color: '#fff',
                          cursor: editSaving ? 'wait' : 'pointer',
                        }}
                      >
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={cancelEdit} disabled={editSaving} style={{ padding: '0.35rem 0.75rem', borderRadius: 6 }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.15rem 0',
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`${DOM_PREFIX}-${row.id}`}
                        checked={checkedIds.has(row.id)}
                        disabled={savingCheckId === row.id}
                        onChange={(e) => void onToggleCheck(row.id, e.target.checked)}
                        style={{ flexShrink: 0, marginTop: '0.15rem' }}
                      />
                      <label
                        htmlFor={`${DOM_PREFIX}-${row.id}`}
                        style={{ flex: 1, cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1.4 }}
                        title={row.reason_text}
                      >
                        <span style={{ fontWeight: 600 }}>{row.people?.name?.trim() ? row.people.name : 'Person'}</span>
                        <span style={{ color: 'var(--text-slate-500)' }}> — </span>
                        {row.action_text}
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-slate-500)', marginTop: '0.2rem' }}>Reason: {row.reason_text}</div>
                      </label>
                    </div>
                    {isDev && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem', paddingLeft: '1.6rem' }}>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={savingCheckId != null || deletingId != null}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--bg-slate-tint)' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(row.id)}
                          disabled={deletingId === row.id}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: 6,
                            border: deleteConfirmId === row.id ? '2px solid #b91c1c' : '1px solid #fecaca',
                            background: 'var(--bg-red-tint)',
                            color: 'var(--text-red-700)',
                          }}
                        >
                          {deletingId === row.id ? 'Deleting…' : deleteConfirmId === row.id ? 'Confirm delete' : 'Delete'}
                        </button>
                        {deleteConfirmId === row.id && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            style={{ padding: '0.35rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}
                          >
                            Cancel delete
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
