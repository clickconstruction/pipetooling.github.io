// @vitest-environment jsdom
/**
 * Render smoke for Choose from the takeoff (v2.4107): the three groups with their default
 * ticks, the bar, untick / tick-all, and Confirm handing back the ticked rows and every tick.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SubmittalTakeoffPicker } from './SubmittalTakeoffPicker'
import type { TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'

const cand = (p: Partial<TakeoffCandidate> & { countRowId: string; fixture: string; group: TakeoffCandidate['group'] }): TakeoffCandidate => ({
  count: 1, tagText: '', tags: [], product: null, partId: null, supplyHouseId: null, supplyHouseName: null, defaultTicked: p.group === 'fixtures', storedTick: null, ticked: p.group === 'fixtures', alreadyOn: false, canSplit: (p.tags?.length ?? 0) > 1, storedSplit: null, split: false, ...p,
})
const cands = [
  cand({ countRowId: 'c-wc', fixture: 'WC 1&2', tagText: 'WC-1, WC-2', tags: ['WC-1', 'WC-2'], group: 'fixtures', product: 'TOTO wall-hung bowl', supplyHouseName: 'Reece', count: 10 }),
  cand({ countRowId: 'c-hb', fixture: 'HB-3', tagText: 'HB-3', tags: ['HB-3'], group: 'fixtures', product: 'Woodford hose bibb', supplyHouseName: 'Reece', count: 2 }),
  cand({ countRowId: 'c-lav', fixture: 'LAV 1', tagText: 'LAV-1', tags: ['LAV-1'], group: 'fixtures', product: 'Kohler lav', supplyHouseName: 'Moore', alreadyOn: true }),
  cand({ countRowId: 'c-us', fixture: 'UTILITY SINK', group: 'no_part' }),
  cand({ countRowId: 'c-pipe', fixture: 'ft of 3/4IN WATER', group: 'pipe_allowance', product: '3/4IN TYPE L COPPER', count: 140 }),
]

describe('SubmittalTakeoffPicker', () => {
  it('ticks fixtures by default, leaves pipe and unpriced rows out, and hands back the ticked rows on Confirm', () => {
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={cands} onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getByTestId('takeoff-group-fixtures').textContent).toContain('Fixtures & equipment · 2 ticked of 3')
    expect(screen.getByTestId('takeoff-group-no_part').textContent).toContain('No part on the takeoff yet · 0 ticked of 1')
    expect(screen.getByTestId('takeoff-group-pipe_allowance').textContent).toContain('Pipe, sawcutting and allowances · 0 ticked of 1')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('2 rows will go on Rev 1 · 2 with a product · 2 left out · 1 already on it')
    expect((screen.getByLabelText('LAV-1') as HTMLInputElement).disabled).toBe(true)
    // Prune the hose bibb, add the utility sink to type later.
    fireEvent.click(screen.getByLabelText('HB-3'))
    fireEvent.click(screen.getByLabelText('UTILITY SINK'))
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('2 rows will go on Rev 1 · 1 with a product, 1 to type · 2 left out · 1 already on it')
    expect(screen.getByTestId('takeoff-confirm').textContent).toBe('Build Rev 1 with 2 rows')
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [rows, ticks] = onConfirm.mock.calls[0] as [TakeoffCandidate[], Map<string, boolean>]
    expect(rows.map((r) => r.countRowId)).toEqual(['c-wc', 'c-us'])
    expect([...ticks.entries()]).toEqual([['c-wc', true], ['c-hb', false], ['c-lav', false], ['c-us', true], ['c-pipe', false]])
  })

  it('Tick all with a product ticks the pipe row too, and add mode words the button for the draft', () => {
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 2" candidates={cands} onConfirm={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tick all with a product' }))
    expect(within(screen.getByTestId('takeoff-group-pipe_allowance')).getByLabelText('ft of 3/4IN WATER')).toHaveProperty('checked', true)
    expect(screen.getByTestId('takeoff-confirm').textContent).toBe('Add 3 rows to Rev 2')
  })

  it('v2.4114 · the Split switch shows only on a row whose name spells out two tags; on, the bar counts a row per tag and Confirm hands the split back', () => {
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={cands} onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getAllByTestId('takeoff-split')).toHaveLength(1)
    expect(screen.queryByTestId('takeoff-split-rows')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Split WC-1, WC-2' }))
    expect(screen.getByTestId('takeoff-split-rows').textContent).toContain('WC-1 · TOTO wall-hung bowl · Reece · from WC 1&2')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('3 rows will go on Rev 1 · 3 with a product · 1 split into 2 · 2 left out · 1 already on it')
    expect(screen.getByTestId('takeoff-confirm').textContent).toBe('Build Rev 1 with 3 rows')
    fireEvent.click(screen.getByTestId('split-rule-link'))
    const modal = screen.getByRole('dialog', { name: 'When a row can split' })
    expect(within(modal).getByTestId('split-rule-table').textContent).toContain('WC 1&2WC-1, WC-2can split')
    fireEvent.click(within(modal).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    const [rows, , splits] = onConfirm.mock.calls[0] as [TakeoffCandidate[], Map<string, boolean>, Map<string, boolean>]
    expect(rows.map((r) => [r.countRowId, r.split])).toEqual([['c-wc', true], ['c-hb', false]])
    expect([...splits.entries()]).toEqual([['c-wc', true]])
  })
})
