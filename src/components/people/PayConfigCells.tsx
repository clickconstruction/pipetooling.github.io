import type { PayConfigRow } from '../../types/peoplePayConfig'
import { VEHICLE_ARRANGEMENT_OPTIONS, parseVehicleArrangement } from '../../lib/people/wheels'

/**
 * One person's pay setup as a row of cells (People spine PR 5, v2.3702) — the inputs the
 * People pay config modal had, lifted so the Users tab's Pay lens renders them per roster
 * row. Same saves: the parent's debounced `people_pay_config` upsert with the salary side
 * effects (`usePayConfig`).
 */
export type PayConfigCellsProps = {
  n: string
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigOfficeWageDraft: Record<string, string>
  payConfigSaving: boolean
  /** The login user still has a salary_work_schedule_templates row (materialized schedule). */
  salaryTemplateActive: boolean
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
  onOfficeHourlyWageChange: (personName: string, rawValue: string) => void
}

/** Column widths the header and every row share, in px: wage · office · salary · record · vehicle. */
export const PAY_CELL_WIDTHS = { wage: 84, office: 84, salary: 56, record: 56, vehicle: 176 } as const

const INPUT = { padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem' } as const

export function payConfigRowOrEmpty(payConfig: Record<string, PayConfigRow>, n: string): PayConfigRow {
  return payConfig[n] ?? { person_name: n, hourly_wage: null, office_hourly_wage: null, is_salary: false, record_hours_but_salary: false, vehicle_arrangement: 'none' }
}

export function PayConfigCells({ n, payConfig, payConfigDraft, payConfigOfficeWageDraft, payConfigSaving, salaryTemplateActive, onUpsertPayConfig, onHourlyWageChange, onOfficeHourlyWageChange }: PayConfigCellsProps) {
  const c = payConfigRowOrEmpty(payConfig, n)
  return (
    <>
      <span style={{ width: PAY_CELL_WIDTHS.wage, flexShrink: 0 }}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={payConfigDraft[n] !== undefined ? payConfigDraft[n] : (c.hourly_wage ?? '')}
          onChange={(e) => onHourlyWageChange(n, e.target.value)}
          disabled={payConfigSaving}
          aria-label={`Hourly wage for ${n}`}
          style={{ ...INPUT, width: '100%', textAlign: 'right' }}
        />
      </span>
      <span style={{ width: PAY_CELL_WIDTHS.office, flexShrink: 0 }}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={payConfigOfficeWageDraft[n] !== undefined ? payConfigOfficeWageDraft[n] : (c.office_hourly_wage ?? '')}
          onChange={(e) => onOfficeHourlyWageChange(n, e.target.value)}
          disabled={payConfigSaving || c.is_salary}
          placeholder={c.is_salary ? '—' : 'same'}
          aria-label={`Office wage for ${n}`}
          title={c.is_salary ? 'Office rate does not apply to salaried people' : 'Optional: rate for office/bid/unassigned time. Blank = same as hourly wage.'}
          style={{ ...INPUT, width: '100%', textAlign: 'right', background: c.is_salary ? 'var(--bg-muted)' : 'var(--surface)' }}
        />
      </span>
      <span style={{ width: PAY_CELL_WIDTHS.salary, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <input type="checkbox" checked={c.is_salary} onChange={(e) => onUpsertPayConfig(n, { is_salary: e.target.checked })} disabled={payConfigSaving} aria-label={`Salaried: ${n}`} />
        {!c.is_salary && salaryTemplateActive ? (
          <span
            role="img"
            title="Salaried workday template still exists for this login user—schedule-driven sessions may continue until removed. Unchecking Salary runs cleanup when names match users.name."
            aria-label="Salaried workday template still exists; materialized salary sessions may continue."
            style={{ display: 'inline-flex', color: '#d97706', flexShrink: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
              <path d="M320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320C64 178.6 178.6 64 320 64zM296 184L296 320C296 328 300 335.5 306.7 340L402.7 404C413.7 411.4 428.6 408.4 436 397.3C443.4 386.2 440.4 371.4 429.3 364L344 307.2L344 184C344 170.7 333.3 160 320 160C306.7 160 296 170.7 296 184z" />
            </svg>
          </span>
        ) : null}
      </span>
      <span style={{ width: PAY_CELL_WIDTHS.record, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <input
          type="checkbox"
          checked={c.record_hours_but_salary}
          onChange={(e) => onUpsertPayConfig(n, { record_hours_but_salary: e.target.checked })}
          disabled={payConfigSaving || !c.is_salary}
          aria-label={`Record hours while salaried: ${n}`}
          title={!c.is_salary ? 'Only applies when Salary is checked' : undefined}
        />
      </span>
      <span style={{ width: PAY_CELL_WIDTHS.vehicle, flexShrink: 0 }}>
        {/* Wheels on Labor (v2.2733): the deal decides where fuel and truck cost land on Review. */}
        <select
          value={parseVehicleArrangement(c.vehicle_arrangement)}
          onChange={(e) => onUpsertPayConfig(n, { vehicle_arrangement: parseVehicleArrangement(e.target.value) })}
          disabled={payConfigSaving}
          aria-label={`Vehicle arrangement for ${n}`}
          title="Own vehicle · fuel paid: their fuel counts as part of their labor. Company truck: the truck they hold on Vehicles is priced per field hour. Rates show on People → Vehicles → Wheels."
          style={{ ...INPUT, width: '100%', background: 'var(--surface)', color: 'var(--text-base)' }}
        >
          {VEHICLE_ARRANGEMENT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.icon ? `${o.icon} ` : ''}
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </>
  )
}
