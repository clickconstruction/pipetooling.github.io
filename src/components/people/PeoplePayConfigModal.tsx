import { Fragment, useEffect, useState } from 'react'
import type { PayConfigRow } from '../../types/peoplePayConfig'

export type PeoplePayConfigRosterSection = { label: string; names: string[] }

export type PeoplePayConfigModalProps = {
  open: boolean
  onClose: () => void
  rosterSections: PeoplePayConfigRosterSection[]
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigSaving: boolean
  isDev: boolean
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
}

function PayConfigRowTr({
  n,
  payConfig,
  payConfigDraft,
  payConfigSaving,
  isDev,
  onUpsertPayConfig,
  onHourlyWageChange,
}: {
  n: string
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigSaving: boolean
  isDev: boolean
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
}) {
  const c = payConfig[n] ?? {
    person_name: n,
    hourly_wage: null,
    is_salary: false,
    show_in_hours: false,
    show_in_cost_matrix: false,
    record_hours_but_salary: false,
  }
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.5rem 0.75rem' }}>{n}</td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={payConfigDraft[n] !== undefined ? payConfigDraft[n] : (c.hourly_wage ?? '')}
          onChange={(e) => onHourlyWageChange(n, e.target.value)}
          disabled={payConfigSaving}
          style={{ width: 80, padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
        />
      </td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={c.is_salary}
          onChange={(e) => onUpsertPayConfig(n, { is_salary: e.target.checked })}
          disabled={payConfigSaving}
        />
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
          disabled={payConfigSaving || !isDev}
          title={!isDev ? 'Only dev can change this' : undefined}
        />
      </td>
      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
        <input
          type="checkbox"
          checked={c.show_in_cost_matrix}
          onChange={(e) => onUpsertPayConfig(n, { show_in_cost_matrix: e.target.checked })}
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
  payConfigSaving,
  isDev,
  onUpsertPayConfig,
  onHourlyWageChange,
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
          background: 'white',
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
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
        <p id="people-pay-config-modal-desc" style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 0.75rem', flexShrink: 0 }}>
          Set hourly wage, Salary (8 hrs/day), Show in Hours (include in Hours tab), and Show in Cost Matrix (include in cost matrix and teams).
        </p>
        <label htmlFor="people-pay-config-modal-name-filter" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#374151', marginBottom: '0.35rem', flexShrink: 0 }}>
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
            border: '1px solid #d1d5db',
            borderRadius: 4,
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1, minHeight: 0, border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Name</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>Hourly wage ($)</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Salary</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }} title="Record hours for tracking (salary still used for pay)">Record hours</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Show in Hours</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Show in Cost Matrix</th>
              </tr>
            </thead>
            <tbody>
              {sectionBlocks.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0.75rem', color: '#6b7280' }}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sectionBlocks.map(({ section, filteredNames }) => (
                  <Fragment key={section.label}>
                    <tr style={{ background: '#f3f4f6' }}>
                      <td
                        colSpan={6}
                        style={{
                          padding: '0.5rem 0.75rem',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          color: '#374151',
                          borderBottom: '1px solid #e5e7eb',
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
                        payConfigSaving={payConfigSaving}
                        isDev={isDev}
                        onUpsertPayConfig={onUpsertPayConfig}
                        onHourlyWageChange={onHourlyWageChange}
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
