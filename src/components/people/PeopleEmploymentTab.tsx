import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import { KIND_LABELS } from './peopleUsersTabShared'
import type { PersonKind } from '../../hooks/usePeopleRoster'

type EmploymentPersonRow = {
  id: string
  name: string
  kind: string
  archived_at: string | null
  account_user_id: string | null
  start_date: string | null
  end_date: string | null
}

type EmploymentUserRow = { id: string; name: string | null }

export type PeopleEmploymentTabProps = {
  users: EmploymentUserRow[]
  payConfig: Record<string, PayConfigRow>
  salaryTemplateByPersonName: Record<string, boolean>
}

/** Login-user linkage for a roster row: explicit account_user_id vs the trimmed-name match the pay tables use. */
function linkHealth(person: EmploymentPersonRow, users: EmploymentUserRow[]): { label: string; warn: boolean } | null {
  const nameMatch = users.find((u) => (u.name ?? '').trim() === person.name.trim())
  if (person.account_user_id) {
    if (nameMatch && nameMatch.id !== person.account_user_id) {
      return { label: 'Name matches a different login user', warn: true }
    }
    return null
  }
  if (nameMatch) return { label: 'Linked by name only', warn: false }
  return { label: 'No login user', warn: false }
}

export default function PeopleEmploymentTab({ users, payConfig, salaryTemplateByPersonName }: PeopleEmploymentTabProps) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<EmploymentPersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('people')
            .select('id, name, kind, archived_at, account_user_id, start_date, end_date')
            .order('name'),
        'employment roster',
      )
      setRows((data ?? []) as EmploymentPersonRow[])
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'Failed to load roster'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])

  useEffect(() => {
    setDraftStart(selected?.start_date ?? '')
    setDraftEnd(selected?.end_date ?? '')
  }, [selected])

  const searchLower = search.trim().toLowerCase()
  const matches = useCallback(
    (r: EmploymentPersonRow) => searchLower === '' || r.name.toLowerCase().includes(searchLower),
    [searchLower],
  )
  const activeRows = rows.filter((r) => !r.archived_at).filter(matches)
  const archivedRows = rows.filter((r) => r.archived_at).filter(matches)

  const datesDirty = selected != null && ((selected.start_date ?? '') !== draftStart || (selected.end_date ?? '') !== draftEnd)

  async function saveDates() {
    if (!selected) return
    const start = draftStart || null
    const end = draftEnd || null
    if (start && end && end < start) {
      showToast('End date must be on or after start date', 'warning')
      return
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () => supabase.from('people').update({ start_date: start, end_date: end }).eq('id', selected.id),
        'employment dates save',
      )
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, start_date: start, end_date: end } : r)))
      showToast('Employment dates saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Save failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function renderChips(r: EmploymentPersonRow) {
    const cfg = payConfig[r.name]
    const health = linkHealth(r, users)
    return (
      <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {cfg?.is_salary ? (
          <span style={chipStyle('var(--text-blue-700)', 'var(--bg-blue-50)')}>
            Salaried{salaryTemplateByPersonName[r.name] ? '' : ' · no workday template'}
          </span>
        ) : null}
        {cfg?.is_salary && cfg?.record_hours_but_salary ? (
          <span style={chipStyle('var(--text-muted)', 'var(--bg-page)')}>records hours</span>
        ) : null}
        {health ? (
          <span
            style={chipStyle(health.warn ? '#92400e' : 'var(--text-muted)', health.warn ? '#fef3c7' : 'var(--bg-page)')}
            title="How pay tables find this person's login user: an explicit account link, or an exact (trimmed) name match."
          >
            {health.label}
          </span>
        ) : null}
      </span>
    )
  }

  function renderRow(r: EmploymentPersonRow) {
    const isSelected = r.id === selectedId
    return (
      <li key={r.id}>
        <button
          type="button"
          onClick={() => setSelectedId(r.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.2rem',
            width: '100%',
            textAlign: 'left',
            padding: '0.45rem 0.6rem',
            border: '1px solid ' + (isSelected ? 'var(--text-blue-700)' : 'var(--border)'),
            borderRadius: 6,
            background: isSelected ? 'var(--bg-blue-50)' : 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {r.name}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.8125rem' }}>
              {KIND_LABELS[r.kind as PersonKind] ?? r.kind}
            </span>
          </span>
          {renderChips(r)}
        </button>
      </li>
    )
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading roster…</p>
  if (loadError) return <p style={{ color: 'var(--text-red-700)' }}>{loadError}</p>

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px', minWidth: 240, maxWidth: 420 }}>
        <input
          type="search"
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.4rem 0.6rem', marginBottom: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
        />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {activeRows.length === 0 ? <li style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matching people.</li> : activeRows.map(renderRow)}
        </ul>
        {archivedRows.length > 0 ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setArchivedOpen((v) => !v)}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}
            >
              {archivedOpen ? '▾' : '▸'} Archived ({archivedRows.length})
            </button>
            {archivedOpen ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.4rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.75 }}>
                {archivedRows.map(renderRow)}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ flex: '2 1 340px', minWidth: 300 }}>
        {!selected ? (
          <p style={{ color: 'var(--text-muted)' }}>Select a person to manage their employment details.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.9rem' }}>
            <h3 style={{ margin: '0 0 0.15rem 0' }}>{selected.name}</h3>
            <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {KIND_LABELS[selected.kind as PersonKind] ?? selected.kind}
              {selected.archived_at ? ' · archived' : ''}
              {payConfig[selected.name]?.is_salary ? ' · salaried' : ''}
            </p>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Employment dates</div>
              <p style={{ margin: '0 0 0.6rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Company-calendar dates, inclusive. Leave end date empty while the person still works here. Salaried
                payroll credit will be limited to this window.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Start</span>
                  <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} style={{ padding: '0.35rem' }} />
                </label>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>End</span>
                  <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} style={{ padding: '0.35rem' }} />
                </label>
                <button
                  type="button"
                  disabled={!datesDirty || saving}
                  onClick={() => void saveDates()}
                  style={{
                    padding: '0.45rem 0.9rem',
                    fontWeight: 600,
                    color: 'white',
                    background: !datesDirty || saving ? 'var(--text-faint-300)' : '#2563eb',
                    border: 'none',
                    borderRadius: 6,
                    cursor: !datesDirty || saving ? 'default' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <p style={{ margin: '0.75rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Pay setup, salaried workday, and time off move into this tab in upcoming updates — for now they stay in
              the Hours tab and Settings.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function chipStyle(color: string, background: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '0.05rem 0.45rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    color,
    background,
    border: '1px solid var(--border)',
  }
}
