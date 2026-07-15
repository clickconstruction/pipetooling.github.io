import { Fragment, useEffect, useState } from 'react'
import type { PayConfigRow } from '../../types/peoplePayConfig'

export type PeoplePayConfigRosterSection = { label: string; names: string[] }

export type PeoplePayConfigModalProps = {
  open: boolean
  onClose: () => void
  rosterSections: PeoplePayConfigRosterSection[]
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigOfficeWageDraft: Record<string, string>
  payConfigSaving: boolean
  /** Roster name → user still has salary_work_schedule_templates (materialized schedule). */
  salaryTemplateByPersonName: Record<string, boolean>
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
  onOfficeHourlyWageChange: (personName: string, rawValue: string) => void
}

function PayConfigRowTr({
  n,
  payConfig,
  payConfigDraft,
  payConfigOfficeWageDraft,
  payConfigSaving,
  salaryTemplateActive,
  onUpsertPayConfig,
  onHourlyWageChange,
  onOfficeHourlyWageChange,
}: {
  n: string
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigOfficeWageDraft: Record<string, string>
  payConfigSaving: boolean
  salaryTemplateActive: boolean
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
  onOfficeHourlyWageChange: (personName: string, rawValue: string) => void
}) {
  const c = payConfig[n] ?? {
    person_name: n,
    hourly_wage: null,
    office_hourly_wage: null,
    is_salary: false,
    show_in_hours: false,
    record_hours_but_salary: false,
  }
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '0.5rem 0.75rem' }}>{n}</td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={payConfigDraft[n] !== undefined ? payConfigDraft[n] : (c.hourly_wage ?? '')}
          onChange={(e) => onHourlyWageChange(n, e.target.value)}
          disabled={payConfigSaving}
          style={{ width: 80, padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
        />
      </td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={payConfigOfficeWageDraft[n] !== undefined ? payConfigOfficeWageDraft[n] : (c.office_hourly_wage ?? '')}
          onChange={(e) => onOfficeHourlyWageChange(n, e.target.value)}
          disabled={payConfigSaving || c.is_salary}
          placeholder={c.is_salary ? '—' : 'same'}
          title={c.is_salary ? 'Office rate does not apply to salaried people' : 'Optional: rate for office/bid/unassigned time. Blank = same as hourly wage.'}
          style={{ width: 80, padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: c.is_salary ? 'var(--bg-muted)' : 'var(--surface)' }}
        />
      </td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <input
            type="checkbox"
            checked={c.is_salary}
            onChange={(e) => onUpsertPayConfig(n, { is_salary: e.target.checked })}
            disabled={payConfigSaving}
          />
          {!c.is_salary && salaryTemplateActive ? (
            <span
              role="img"
              title="Salaried workday template still exists for this login user—schedule-driven sessions may continue until removed. Unchecking Salary runs cleanup when names match users.name."
              aria-label="Salaried workday template still exists; materialized salary sessions may continue."
              style={{ display: 'inline-flex', color: '#d97706', flexShrink: 0 }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={18} height={18} fill="currentColor" aria-hidden>
                <path d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z" />
              </svg>
            </span>
          ) : null}
        </div>
      </td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={c.record_hours_but_salary}
          onChange={(e) => onUpsertPayConfig(n, { record_hours_but_salary: e.target.checked })}
          disabled={payConfigSaving || !c.is_salary}
          title={!c.is_salary ? 'Only applies when Salary is checked' : undefined}
        />
      </td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={c.show_in_hours}
          onChange={(e) => onUpsertPayConfig(n, { show_in_hours: e.target.checked })}
          disabled={payConfigSaving}
        />
      </td>
    </tr>
  )
}

export function PeoplePayConfigModal({
  open,
  onClose,
  rosterSections,
  payConfig,
  payConfigDraft,
  payConfigOfficeWageDraft,
  payConfigSaving,
  salaryTemplateByPersonName,
  onUpsertPayConfig,
  onHourlyWageChange,
  onOfficeHourlyWageChange,
}: PeoplePayConfigModalProps) {
  const [nameSearch, setNameSearch] = useState('')

  useEffect(() => {
    if (!open) {
      setNameSearch('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const q = nameSearch.trim().toLowerCase()
  const totalRosterNames = rosterSections.reduce((sum, s) => sum + s.names.length, 0)

  const sectionBlocks = rosterSections
    .map((section) => {
      const filteredNames = q ? section.names.filter((n) => n.toLowerCase().includes(q)) : section.names
      return { section, filteredNames }
    })
    .filter(({ filteredNames }) => filteredNames.length > 0)

  const emptyMessage =
    totalRosterNames === 0 ? 'No people in roster.' : q ? 'No names match this filter.' : 'No people in roster.'

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-pay-config-modal-title"
        aria-describedby="people-pay-config-modal-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(960px, calc(100vw - 2rem))',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 1.25rem',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}
        >
          <h2 id="people-pay-config-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            People pay config
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.45rem 0.85rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p id="people-pay-config-modal-desc" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          Set hourly wage, Salary (8 hrs/day), and Include in Hours &amp; crew costing (Hours tab, crew rosters, team labor totals).
        </p>
        <label htmlFor="people-pay-config-modal-name-filter" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-700)', marginBottom: '0.35rem', flexShrink: 0 }}>
          Filter by name
        </label>
        <input
          id="people-pay-config-modal-name-filter"
          type="search"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="Type to narrow the list…"
          aria-label="Filter people in pay config by name"
          autoComplete="off"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 320,
            marginBottom: '0.75rem',
            padding: '0.45rem 0.65rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Name</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Hourly wage ($)</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }} title="Optional second rate for office/bid/unassigned time. Blank = same as hourly wage.">Office wage ($)</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Salary</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }} title="Record hours for tracking (salary still used for pay)">Record hours</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }} title="Show on the Hours tab and in crew-costing rosters and team labor totals">Include in Hours &amp; crew costing</th>
              </tr>
            </thead>
            <tbody>
              {sectionBlocks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sectionBlocks.map(({ section, filteredNames }) => (
                  <Fragment key={section.label}>
                    <tr style={{ background: 'var(--bg-muted)' }}>
                      <td
                        colSpan={7}
                        style={{
                          padding: '0.5rem 0.75rem',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          color: 'var(--text-700)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {section.label}
                      </td>
                    </tr>
                    {filteredNames.map((n) => (
                      <PayConfigRowTr
                        key={n}
                        n={n}
                        payConfig={payConfig}
                        payConfigDraft={payConfigDraft}
                        payConfigOfficeWageDraft={payConfigOfficeWageDraft}
                        payConfigSaving={payConfigSaving}
                        salaryTemplateActive={salaryTemplateByPersonName[n] === true}
                        onUpsertPayConfig={onUpsertPayConfig}
                        onHourlyWageChange={onHourlyWageChange}
                        onOfficeHourlyWageChange={onOfficeHourlyWageChange}
                      />
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
