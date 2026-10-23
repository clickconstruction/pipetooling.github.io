import type { CSSProperties } from 'react'
import { VEHICLE_COST_UNITS, VEHICLE_SERVICE_TYPES, type VehicleDecision, type VehicleFillInRow } from '../../lib/needsYou/fillInVehicles'
import type { InsuranceCostUnit } from '../../lib/vehicleInsuranceCost'

/**
 * The vehicle kind's fields on the Fill them in deck (v2.5775, punch list #145): one block per
 * missing record, and nothing for a record the vehicle has. Insurance asks the plan when the
 * vehicle is off one, and the cost in the unit the carrier quotes; registration the same way;
 * service the type, the day, the miles and a note, as the Vehicles tab's Log service does.
 */
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0.45rem 0.6rem',
  font: 'inherit',
  fontSize: '0.875rem',
  minHeight: 36,
}

const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }
const blockTitle: CSSProperties = { fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }

function CostInput({ raw, unit, onRaw, onUnit, disabled, placeholder, label }: { raw: string; unit: InsuranceCostUnit; onRaw: (v: string) => void; onUnit: (u: InsuranceCostUnit) => void; disabled: boolean; placeholder: string; label: string }) {
  return (
    <label>
      <span style={labelStyle}>{label}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        <input value={raw} inputMode="decimal" disabled={disabled} onChange={(e) => onRaw(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, flex: '1 1 auto' }} aria-label={label} />
        <select value={unit} disabled={disabled} onChange={(e) => onUnit(e.target.value as InsuranceCostUnit)} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }} aria-label={`${label} unit`}>
          {VEHICLE_COST_UNITS.map((u) => (
            <option key={u.key} value={u.key}>
              {u.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  )
}

export function VehicleFields({ row, decision, onChange, disabled }: { row: VehicleFillInRow; decision: VehicleDecision; onChange: (d: VehicleDecision) => void; disabled: boolean }) {
  const set = (patch: Partial<VehicleDecision>) => onChange({ ...decision, ...patch })
  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {row.missing.includes('insurance') ? (
        <div data-vehicle-part="insurance">
          <div style={blockTitle}>{row.insuranceOnPlan ? 'What does its insurance cost?' : 'Which plan is it on, and what does it cost?'}</div>
          <div style={grid}>
            {!row.insuranceOnPlan ? (
              <>
                <label>
                  <span style={labelStyle}>Plan</span>
                  <select value={decision.planId} disabled={disabled} onChange={(e) => set({ planId: e.target.value })} style={inputStyle} aria-label="Plan">
                    <option value="">Pick a plan</option>
                    {row.plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>On the plan since</span>
                  <input type="date" value={decision.planStartYmd} disabled={disabled} onChange={(e) => set({ planStartYmd: e.target.value })} style={inputStyle} aria-label="On the plan since" />
                </label>
              </>
            ) : null}
            <CostInput label="Insurance cost" raw={decision.insuranceCostRaw} unit={decision.insuranceUnit} onRaw={(v) => set({ insuranceCostRaw: v })} onUnit={(u) => set({ insuranceUnit: u })} disabled={disabled} placeholder="What the carrier charges" />
          </div>
          {row.plans.length === 0 && !row.insuranceOnPlan ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>No insurance plan exists yet. Make one on People → Vehicles first.</div> : null}
        </div>
      ) : null}
      {row.missing.includes('registration') ? (
        <div data-vehicle-part="registration">
          <div style={blockTitle}>What does its registration cost?</div>
          <div style={grid}>
            <CostInput label="Registration cost" raw={decision.registrationCostRaw} unit={decision.registrationUnit} onRaw={(v) => set({ registrationCostRaw: v })} onUnit={(u) => set({ registrationUnit: u })} disabled={disabled} placeholder="What the state charges" />
          </div>
        </div>
      ) : null}
      {row.missing.includes('service') ? (
        <div data-vehicle-part="service">
          <div style={blockTitle}>When was it last serviced?</div>
          <div style={grid}>
            <label>
              <span style={labelStyle}>What was done</span>
              <select value={decision.serviceType} disabled={disabled} onChange={(e) => set({ serviceType: e.target.value })} style={inputStyle} aria-label="What was done">
                {VEHICLE_SERVICE_TYPES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={labelStyle}>Date</span>
              <input type="date" value={decision.serviceDateYmd} disabled={disabled} onChange={(e) => set({ serviceDateYmd: e.target.value })} style={inputStyle} aria-label="Service date" />
            </label>
            <label>
              <span style={labelStyle}>Odometer</span>
              <input value={decision.odometerRaw} inputMode="numeric" disabled={disabled} onChange={(e) => set({ odometerRaw: e.target.value })} placeholder={decision.serviceType === 'oil_change' ? 'Miles, for the oil clock' : 'Miles, if known'} style={inputStyle} aria-label="Odometer" />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: '0.6rem' }}>
            <span style={labelStyle}>Note</span>
            <input value={decision.serviceNote} disabled={disabled} onChange={(e) => set({ serviceNote: e.target.value })} placeholder="Oil, filters, rear brakes" style={inputStyle} aria-label="Service note" />
          </label>
        </div>
      ) : null}
    </div>
  )
}
