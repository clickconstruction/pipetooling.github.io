import { useState, type CSSProperties } from 'react'
import { formatCurrency } from '../../lib/format'
import { LABOR_STAGE_LABELS, laborCellAriaLabel } from '../../lib/bids/laborCellSaveState'
import { DIRECT_COST_KINDS, DIRECT_COST_KIND_LABELS, DIRECT_COST_KIND_WORDS, directCostKindWords, flattenDirectCostTables, sumDirectCosts, type DirectCostKind } from '../../lib/bids/costEstimateDirectCosts'

/**
 * DIRECT COSTS as one list (the Labor refresh PR 4b, v2.3295). Five identical
 * amber sections — equipment, permits, subs, waste, other — were "a dollar
 * amount by stage with a reason" five times over; the kind is now a chip on
 * the row, adding one is one row with a kind picker, and the empty state is
 * one line. The five tables stay: the section takes their rows and hands
 * every edit back with the kind, and the tab writes the table the kind names.
 * Driving sits at the top as a computed line (crew-days · trips · miles), read-only.
 *
 * Cell save-state keys are `${kind}:${row.id}:${stage}` (the tab's `markCell`
 * / `cellA11y` / `cellSaveStyle` plumbing, shared with the labor grid).
 */

export type DirectCostStageRow = { id: string; note: string | null; rough_in: number; top_out: number; trim_set: number; sequence_order: number }
type Stage = 'rough_in' | 'top_out' | 'trim_set'
const STAGES: Stage[] = ['rough_in', 'top_out', 'trim_set']

export type BidsDirectCostsSectionProps = {
  tables: Partial<Record<DirectCostKind, ReadonlyArray<DirectCostStageRow>>>
  /** False until the cost estimate row exists (nothing to attach a line to). */
  canAdd: boolean
  onAdd: (kind: DirectCostKind) => void | Promise<void>
  onUpdate: (kind: DirectCostKind, rowId: string, updates: Partial<Pick<DirectCostStageRow, 'note' | 'rough_in' | 'top_out' | 'trim_set'>>) => void
  onRemove: (kind: DirectCostKind, rowId: string) => void | Promise<void>
  markCell: (key: string) => void
  cellA11y: (key: string, label: string) => Record<string, unknown>
  cellSaveStyle: (key: string) => CSSProperties
  /** The computed driving line (from the cost kernel); null hides it. */
  driving?: { drivingCost: number; numTrips: number; ratePerMile: number; distance: number; totalHours: number; hrsPerTrip: number } | null
}

const kindChip = (kind: DirectCostKind): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  border: '1px solid var(--border-strong)',
  color: kind === 'sub' ? 'var(--text-blue-700)' : 'var(--text-700)',
  background: 'var(--surface)',
})
const input: CSSProperties = { width: '100%', padding: '0.375rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', background: 'var(--surface)', color: 'inherit', boxSizing: 'border-box' }

export function BidsDirectCostsSection(p: BidsDirectCostsSectionProps) {
  const [addKind, setAddKind] = useState<DirectCostKind>('sub')
  const list = flattenDirectCostTables(p.tables)
  const totals = sumDirectCosts(list.map((l) => ({ kind: l.kind, rough_in: l.row.rough_in, top_out: l.row.top_out, trim_set: l.row.trim_set })))
  const driving = p.driving && p.driving.drivingCost > 0 ? p.driving : null
  const crewDays = driving ? driving.totalHours / 16 : 0

  return (
    <div data-testid="labor-direct-costs">
      <h3 id="labor-direct-costs" style={{ margin: '1.5rem 0 0.75rem', fontSize: '1rem', textAlign: 'center', scrollMarginTop: '1rem' }}>DIRECT COSTS</h3>
      <div style={{ padding: '0.75rem', background: 'var(--bg-amber-100)', borderRadius: 4, border: '1px solid var(--border-amber-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: list.length > 0 || driving ? '0.5rem' : 0 }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Equipment, permits, subs, waste and other — a dollar amount by stage with a reason. The kind is a chip; the money goes to the same table it always did.</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <select value={addKind} onChange={(e) => setAddKind(e.target.value as DirectCostKind)} aria-label="Kind of direct cost to add" style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.75rem', background: 'var(--surface)', color: 'inherit' }}>
              {DIRECT_COST_KINDS.map((k) => (
                <option key={k} value={k}>{DIRECT_COST_KIND_LABELS[k]}</option>
              ))}
            </select>
            <button type="button" onClick={() => void p.onAdd(addKind)} disabled={!p.canAdd} style={{ padding: '0.25rem 0.6rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: p.canAdd ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 500 }}>
              + Add
            </button>
          </span>
        </div>
        {list.length === 0 && !driving ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No direct costs on this bid yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '7.5rem' }}>Kind</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500 }}>What</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Rough In ($)</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Top Out ($)</th>
                <th style={{ padding: '0.25rem 0.5rem', fontWeight: 500, width: '6.5rem' }}>Trim Set ($)</th>
                <th style={{ width: '2rem' }} />
              </tr>
            </thead>
            <tbody>
              {driving ? (
                <tr data-testid="direct-cost-driving">
                  <td style={{ padding: '0.2rem 0.5rem' }}>
                    <span style={kindChip('other')} title="Computed from the labor hours, the hours-per-trip box, the $/mile box and the bid's distance to the office — edit those above">driving</span>
                  </td>
                  <td style={{ padding: '0.2rem 0.5rem', color: 'var(--text-700)' }}>
                    {crewDays.toLocaleString('en-US', { maximumFractionDigits: 1 })} crew-days · {driving.numTrips.toLocaleString('en-US', { maximumFractionDigits: 1 })} trips ({driving.hrsPerTrip} h each) · {driving.distance.toLocaleString('en-US', { maximumFractionDigits: 0 })} mi · ${driving.ratePerMile.toFixed(2)}/mi
                  </td>
                  <td colSpan={3} style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    ${formatCurrency(driving.drivingCost)} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.75rem' }}>computed · in the total</span>
                  </td>
                  <td />
                </tr>
              ) : null}
              {list.map(({ kind, row }) => (
                <tr key={`${kind}:${row.id}`} data-testid={`direct-cost-row-${kind}`}>
                  <td style={{ padding: '0.2rem 0.5rem' }}>
                    <span style={kindChip(kind)} title={DIRECT_COST_KIND_LABELS[kind]}>{DIRECT_COST_KIND_WORDS[kind] === 'subs' ? 'sub' : DIRECT_COST_KIND_WORDS[kind].replace(/s$/, '')}</span>
                  </td>
                  <td style={{ padding: '0.2rem 0.5rem' }}>
                    <input type="text" value={row.note ?? ''} onChange={(e) => p.onUpdate(kind, row.id, { note: e.target.value })} placeholder="What is it for" aria-label={`${DIRECT_COST_KIND_LABELS[kind]} description`} style={input} />
                  </td>
                  {STAGES.map((stage) => {
                    const key = `${kind}:${row.id}:${stage}`
                    const label = laborCellAriaLabel(`${LABOR_STAGE_LABELS[stage]} dollars`, row.note, DIRECT_COST_KIND_LABELS[kind])
                    return (
                      <td key={stage} style={{ padding: '0.2rem 0.5rem' }}>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={row[stage] === 0 ? '' : String(row[stage])}
                          onChange={(e) => {
                            p.markCell(key)
                            p.onUpdate(kind, row.id, { [stage]: e.target.value === '' ? 0 : parseFloat(e.target.value) } as Partial<Pick<DirectCostStageRow, Stage>>)
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          aria-label={label}
                          {...p.cellA11y(key, label)}
                          placeholder="0.00"
                          style={{ ...input, textAlign: 'right', ...p.cellSaveStyle(key) }}
                        />
                      </td>
                    )
                  })}
                  <td style={{ padding: '0.2rem 0.25rem', textAlign: 'center' }}>
                    <button type="button" onClick={() => void p.onRemove(kind, row.id)} title="Remove row" aria-label={`Remove ${DIRECT_COST_KIND_LABELS[kind]} row`} style={{ background: 'none', border: 'none', color: 'var(--text-red-700)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {list.length > 0 ? (
          <p style={{ margin: '0.5rem 0 0', textAlign: 'right', fontWeight: 600, fontSize: '0.875rem' }} data-testid="direct-costs-total">
            Other direct total: ${formatCurrency(totals.total)}
            {totals.rowCount > 1 ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {directCostKindWords(totals, (n) => `$${formatCurrency(n)}`)}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default BidsDirectCostsSection
