// @vitest-environment jsdom
/**
 * Wiring smoke for the one direct-costs list (v2.3295): the five tables render
 * as one list in kind order with a kind chip, the computed driving line sits
 * on top, edits hand the kind back, and + Add uses the picked kind.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BidsDirectCostsSection } from './BidsDirectCostsSection'

const row = (id: string, note: string, rough = 0, top = 0, trim = 0, sequence_order = 1) => ({ id, note, rough_in: rough, top_out: top, trim_set: trim, sequence_order })

function renderSection(over: Partial<Parameters<typeof BidsDirectCostsSection>[0]> = {}) {
  const onAdd = vi.fn()
  const onUpdate = vi.fn()
  const onRemove = vi.fn()
  const utils = render(
    <BidsDirectCostsSection
      tables={{ sub: [row('s2', 'Excavation', 6_500, 0, 0, 2), row('s1', 'Sawcut', 900, 0, 0, 1)], permit: [row('p1', 'City permit', 1_240)], equipment: [row('e1', 'Trench shoring', 1_900)] }}
      canAdd
      onAdd={onAdd}
      onUpdate={onUpdate}
      onRemove={onRemove}
      markCell={vi.fn()}
      cellA11y={() => ({})}
      cellSaveStyle={() => ({})}
      driving={{ drivingCost: 2_180, numTrips: 176, ratePerMile: 0.7, distance: 41, totalHours: 1_408, hrsPerTrip: 8 }}
      {...over}
    />,
  )
  return { ...utils, onAdd, onUpdate, onRemove }
}

describe('BidsDirectCostsSection', () => {
  it('lists the tables as one list in kind order with a chip per row, driving on top, and one total', () => {
    renderSection()
    const rows = screen.getAllByRole('row').slice(1) // header row first
    expect(rows[0]!.getAttribute('data-testid')).toBe('direct-cost-driving')
    expect(within(rows[0]!).getByText('88 crew-days · 176 trips (8 h each) · 41 mi · $0.70/mi')).toBeTruthy()
    expect(rows.slice(1).map((r) => r.getAttribute('data-testid'))).toEqual(['direct-cost-row-equipment', 'direct-cost-row-permit', 'direct-cost-row-sub', 'direct-cost-row-sub'])
    expect(screen.getByDisplayValue('Sawcut')).toBeTruthy() // sequence 1 before 2 within the kind
    expect(screen.getByTestId('direct-costs-total').textContent).toBe('Other direct total: $10,540.00 · subs $7,400.00 · equipment $1,900.00 · permits $1,240.00')
  })
  it('hands every edit and removal back with the kind, and adds the picked kind', () => {
    const { onAdd, onUpdate, onRemove } = renderSection()
    fireEvent.change(screen.getByDisplayValue('City permit'), { target: { value: 'City of Austin permit' } })
    expect(onUpdate).toHaveBeenCalledWith('permit', 'p1', { note: 'City of Austin permit' })
    const roughOnPermit = screen.getByLabelText('Rough In dollars — City permit (Permits, Inspections & Regulatory Fees)')
    fireEvent.change(roughOnPermit, { target: { value: '1300' } })
    expect(onUpdate).toHaveBeenCalledWith('permit', 'p1', { rough_in: 1300 })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Equipment & Tool Rental row' }))
    expect(onRemove).toHaveBeenCalledWith('equipment', 'e1')
    fireEvent.change(screen.getByLabelText('Kind of direct cost to add'), { target: { value: 'waste' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    expect(onAdd).toHaveBeenCalledWith('waste')
  })
  it('is one line when empty, and + Add waits for the cost estimate', () => {
    renderSection({ tables: {}, driving: null, canAdd: false })
    expect(screen.getByText('No direct costs on this bid yet.')).toBeTruthy()
    expect((screen.getByRole('button', { name: '+ Add' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
