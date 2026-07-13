import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import { KIND_LABELS } from './peopleUsersTabShared'
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { SalaryWorkScheduleSettings } from '../SalaryWorkScheduleSettings'

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
  payConfigDraft: Record<string, string>
  payConfigOfficeWageDraft: Record<string, string>
  payConfigSaving: boolean
  isDev: boolean
  salaryTemplateByPersonName: Record<string, boolean>
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
  onOfficeHourlyWageChange: (personName: string, rawValue: string) => void
}

const DEFAULT_PAY_CONFIG: Omit<PayConfigRow, 'person_name'> = {
  hourly_wage: null,
  office_hourly_wage: null,
  is_salary: false,
  show_in_hours: false,
  show_in_cost_matrix: false,
  record_hours_but_salary: false,
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

export default function PeopleEmploymentTab({
  users,
  payConfig,
  payConfigDraft,
  payConfigOfficeWageDraft,
  payConfigSaving,
  isDev,
  salaryTemplateByPersonName,
  onUpsertPayConfig,
  onHourlyWageChange,
  onOfficeHourlyWageChange,
}: PeopleEmploymentTabProps) {
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

            {(() => {
              const cfg: PayConfigRow = payConfig[selected.name] ?? { person_name: selected.name, ...DEFAULT_PAY_CONFIG }
              const nameMatches = users.filter((u) => (u.name ?? '').trim() === selected.name.trim())
              const scheduleUserId = nameMatches.length === 1 ? nameMatches[0]!.id : null
              return (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem', marginTop: '0.75rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Pay setup</div>
                    <p style={{ margin: '0 0 0.6rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      Changes save automatically after a moment. Salaried people are paid a flat 8 hours per weekday at
                      the hourly wage — clock time never changes their pay.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.6rem' }}>
                      <label>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Hourly wage ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payConfigDraft[selected.name] !== undefined ? payConfigDraft[selected.name] : (cfg.hourly_wage ?? '')}
                          onChange={(e) => onHourlyWageChange(selected.name, e.target.value)}
                          disabled={payConfigSaving}
                          style={{ width: 100, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                        />
                      </label>
                      <label>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Office wage ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            payConfigOfficeWageDraft[selected.name] !== undefined
                              ? payConfigOfficeWageDraft[selected.name]
                              : (cfg.office_hourly_wage ?? '')
                          }
                          onChange={(e) => onOfficeHourlyWageChange(selected.name, e.target.value)}
                          disabled={payConfigSaving || cfg.is_salary}
                          placeholder={cfg.is_salary ? '—' : 'same'}
                          title={
                            cfg.is_salary
                              ? 'Office rate does not apply to salaried people'
                              : 'Optional: rate for office/bid/unassigned time. Blank = same as hourly wage.'
                          }
                          style={{
                            width: 100,
                            padding: '0.3rem 0.5rem',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            background: cfg.is_salary ? 'var(--bg-muted)' : 'var(--surface)',
                          }}
                        />
                      </label>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.45rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={cfg.is_salary}
                        onChange={(e) => onUpsertPayConfig(selected.name, { is_salary: e.target.checked })}
                        disabled={payConfigSaving}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Salaried</strong> — credited 8 hours on weekdays, 0 on weekends, on all pay and cost
                        screens. Checking this also starts today&rsquo;s scheduled sessions once a workday template exists.
                        {!cfg.is_salary && salaryTemplateByPersonName[selected.name] ? (
                          <span style={{ display: 'block', color: 'var(--text-amber-800)', marginTop: '0.2rem' }}>
                            A salaried workday template still exists for this person — schedule-driven sessions may
                            continue until it is removed.
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.45rem', fontSize: '0.875rem', opacity: cfg.is_salary ? 1 : 0.55 }}>
                      <input
                        type="checkbox"
                        checked={cfg.record_hours_but_salary}
                        onChange={(e) => onUpsertPayConfig(selected.name, { record_hours_but_salary: e.target.checked })}
                        disabled={payConfigSaving || !cfg.is_salary}
                        title={!cfg.is_salary ? 'Only applies when Salaried is checked' : undefined}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Record hours anyway</strong> — their logged hours show on the Hours grids for
                        record-keeping, but pay still uses the flat salary day.
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={cfg.show_in_cost_matrix}
                        onChange={(e) => onUpsertPayConfig(selected.name, { show_in_cost_matrix: e.target.checked })}
                        disabled={payConfigSaving}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Show in Cost Matrix</strong> — include this person in the cost matrix and team totals.
                      </span>
                    </label>
                    {isDev ? (
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginTop: '0.45rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={cfg.show_in_hours}
                          onChange={(e) => onUpsertPayConfig(selected.name, { show_in_hours: e.target.checked })}
                          disabled={payConfigSaving}
                          style={{ marginTop: 2 }}
                        />
                        <span>
                          <strong>Show in Hours</strong> (dev) — include this person on the Hours tab.
                        </span>
                      </label>
                    ) : null}
                  </div>

                  {cfg.is_salary ? (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem', marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Salaried workday</div>
                      {scheduleUserId ? (
                        <SalaryWorkScheduleSettings
                          key={scheduleUserId}
                          userId={scheduleUserId}
                          userPayName={selected.name.trim()}
                          canEditPastDayOverrides
                        />
                      ) : (
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                          {nameMatches.length === 0
                            ? 'No login user matches this name, so a workday schedule cannot be set up. Fix the name or invite them first.'
                            : 'Multiple login users match this name — resolve the duplicate before editing their workday.'}
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              )
            })()}

            <p style={{ margin: '0.75rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Paid and unpaid time off moves into this tab in an upcoming update — for now it stays in Settings and the
              salaried-workdays bulk modal on the Hours tab.
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
