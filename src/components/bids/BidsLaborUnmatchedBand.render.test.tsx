// @vitest-environment jsdom
/**
 * The Labor tab's band of set-aside hours (bid history PR 0b): nothing when nothing is set aside;
 * a row's name, hours and day; Use for <fixture> once a counted fixture is picked; Remove.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { BidsLaborUnmatchedBand } from './BidsLaborUnmatchedBand'
import type { CostEstimateUnmatchedLaborRow } from '../../lib/bids/bidPricingEngineTypes'

const parked: CostEstimateUnmatchedLaborRow = {
  id: 'p1',
  cost_estimate_id: 'ce1',
  fixture: '[Break room] WC',
  count: 2,
  rough_in_hrs_per_unit: 1.5,
  top_out_hrs_per_unit: 2,
  trim_set_hrs_per_unit: 1,
  is_fixed: false,
  kind: 'fixture',
  unit: 'each',
  source: null,
  source_note: null,
  labor_row_id: 'l9',
  parked_at: '2026-10-07T17:00:00Z',
}
const laborRows = [{ id: 'l1', fixture: 'WC' }, { id: 'l2', fixture: 'Lav' }]

describe('BidsLaborUnmatchedBand', () => {
  it('draws nothing when nothing is set aside', () => {
    const { container } = render(<BidsLaborUnmatchedBand rows={[]} laborRows={laborRows} onUse={vi.fn()} onRemove={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('lists a set-aside row with its hours and the day it was set aside', () => {
    render(<BidsLaborUnmatchedBand rows={[parked]} laborRows={laborRows} onUse={vi.fn()} onRemove={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Hours not on the counts' })).toBeTruthy()
    expect(screen.getByText('[Break room] WC')).toBeTruthy()
    expect(screen.getByText(/Rough In 1\.5 · Top Out 2 · Trim Set 1 hrs each · Set aside Oct 7/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Use for/ })).toBeNull()
  })

  it('Use for <fixture> appears once a counted fixture is picked, and sends both ids', async () => {
    const onUse = vi.fn().mockResolvedValue(true)
    render(<BidsLaborUnmatchedBand rows={[parked]} laborRows={laborRows} onUse={onUse} onRemove={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox', { name: /Use the hours of \[Break room\] WC/ }), { target: { value: 'l1' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Use for WC' })) })
    expect(onUse).toHaveBeenCalledWith('p1', 'l1')
  })

  it('Remove sends the set-aside row', async () => {
    const onRemove = vi.fn().mockResolvedValue(true)
    render(<BidsLaborUnmatchedBand rows={[parked]} laborRows={laborRows} onUse={vi.fn()} onRemove={onRemove} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove' })) })
    expect(onRemove).toHaveBeenCalledWith('p1')
  })
})
