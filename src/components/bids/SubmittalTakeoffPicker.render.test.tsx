// @vitest-environment jsdom
/**
 * Render smoke for Choose from the takeoff (v2.4107; three picks 2026-10-02): the three groups
 * with where each fixture starts, the three buttons on every fixture (the ones already on the
 * draft included), the bar, and Confirm handing back what the picks change and every pick.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SubmittalTakeoffPicker } from './SubmittalTakeoffPicker'
import type { TakeoffCandidate } from '../../lib/submittals/takeoffCandidates'
import type { TakeoffPlan } from '../../lib/submittals/takeoffPicks'

const cand = (p: Partial<TakeoffCandidate> & { countRowId: string; fixture: string; group: TakeoffCandidate['group'] }): TakeoffCandidate => ({
  count: 1, tagText: '', tags: [], product: null, partId: null, supplyHouseId: null, supplyHouseName: null, defaultTicked: p.group === 'fixtures', storedTick: null, ticked: p.group === 'fixtures', alreadyOn: false, canSplit: (p.tags?.length ?? 0) > 1, storedSplit: null, split: false, pieces: [], storedProductKeys: null, productKeys: [], ...p,
})
const cands = [
  cand({ countRowId: 'c-wc', fixture: 'WC 1&2', tagText: 'WC-1, WC-2', tags: ['WC-1', 'WC-2'], group: 'fixtures', product: 'TOTO wall-hung bowl', supplyHouseName: 'Reece', count: 10 }),
  cand({ countRowId: 'c-hb', fixture: 'HB-3', tagText: 'HB-3', tags: ['HB-3'], group: 'fixtures', product: 'Woodford hose bibb', supplyHouseName: 'Reece', count: 2 }),
  cand({ countRowId: 'c-lav', fixture: 'LAV 1', tagText: 'LAV-1', tags: ['LAV-1'], group: 'fixtures', product: 'Kohler lav', supplyHouseName: 'Moore', alreadyOn: true, onAs: 'gc' }),
  cand({ countRowId: 'c-us', fixture: 'UTILITY SINK', group: 'no_part' }),
  cand({ countRowId: 'c-pipe', fixture: 'ft of 3/4IN WATER', group: 'pipe_allowance', product: '3/4IN TYPE L COPPER', count: 140 }),
]

/** The three buttons of one fixture, by its name. */
const pick = (name: string, label: 'GC sees it' | 'Order only' | 'Left out') => within(screen.getByRole('group', { name })).getByRole('button', { name: label })
const picked = (name: string) => within(screen.getByRole('group', { name })).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true')!.textContent

describe('SubmittalTakeoffPicker', () => {
  it('fixtures start as the GC’s, pipe and unpriced rows left out; Confirm hands back the rows coming on and every pick', () => {
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={cands} onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getByTestId('takeoff-group-fixtures').textContent).toContain('Fixtures & equipment · 3 the GC sees')
    expect(screen.getByTestId('takeoff-group-no_part').textContent).toContain('No part on the takeoff yet · 0 the GC sees · 1 left out')
    expect(screen.getByTestId('takeoff-group-pipe_allowance').textContent).toContain('Pipe, sawcutting and allowances · 0 the GC sees · 1 left out')
    expect(screen.getByTestId('takeoff-counts').textContent).toBe('3 the GC sees0 order only2 left out')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('2 rows go on Rev 1')
    expect([picked('WC-1, WC-2'), picked('HB-3'), picked('LAV-1'), picked('UTILITY SINK'), picked('ft of 3/4IN WATER')]).toEqual(['GC sees it', 'GC sees it', 'GC sees it', 'Left out', 'Left out'])
    // Leave the hose bibb out, bring the utility sink on to type later, buy the pipe without the GC.
    fireEvent.click(pick('HB-3', 'Left out'))
    fireEvent.click(pick('UTILITY SINK', 'GC sees it'))
    fireEvent.click(pick('ft of 3/4IN WATER', 'Order only'))
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('3 rows go on Rev 1 (1 order only, 1 to type with Edit)')
    expect(screen.getByTestId('takeoff-counts').textContent).toBe('3 the GC sees1 order only1 left out')
    expect(screen.getByTestId('takeoff-confirm').textContent).toBe('Build Rev 1 with 3 rows')
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [plan] = onConfirm.mock.calls[0] as [TakeoffPlan]
    expect(plan.add.map((a) => [a.candidate.countRowId, a.orderOnly])).toEqual([['c-wc', false], ['c-us', false], ['c-pipe', true]])
    expect([...plan.ticks.entries()]).toEqual([['c-wc', true], ['c-hb', false], ['c-lav', true], ['c-us', true], ['c-pipe', true]])
    expect([...plan.orderOnly.entries()].filter(([, v]) => v).map(([k]) => k)).toEqual(['c-pipe'])
    expect(plan.remove).toEqual([])
  })

  it('2026-10-02 · a fixture already on the draft is not locked: it moves to order only, comes off, or stays; the button waits for a change', () => {
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 2" candidates={cands.map((c) => (c.countRowId === 'c-hb' ? { ...c, alreadyOn: true, onAs: 'order' as const } : c))} onConfirm={onConfirm} onClose={() => {}} />)
    // HB-3 is an order-only row on the draft, LAV-1 a row the GC sees; WC is not on it and will come on.
    expect([picked('HB-3'), picked('LAV-1')]).toEqual(['Order only', 'GC sees it'])
    expect(screen.getByTestId('takeoff-confirm').textContent).toBe('Update Rev 2')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('1 row goes on Rev 2')
    fireEvent.click(pick('WC-1, WC-2', 'Left out'))
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('Nothing changes yet.')
    expect((screen.getByTestId('takeoff-confirm') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(pick('LAV-1', 'Order only'))
    expect(screen.getByTestId('takeoff-change').textContent).toBe('On Rev 2 now. It moves to order only: off the GC’s list, still on the log.')
    fireEvent.click(pick('HB-3', 'Left out'))
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('1 fixture moves to order only · 1 comes off Rev 2')
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    const [plan] = onConfirm.mock.calls[0] as [TakeoffPlan]
    expect([plan.add.length, plan.toOrderOnly, plan.toGc, plan.remove]).toEqual([0, ['c-lav'], [], ['c-hb']])
  })

  it('2026-10-02 · a fixture the log holds an order for cannot be left out: the button is held and the row says why', () => {
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 1" candidates={cands} bought={new Map([['c-lav', 'Ordered 09/23, on site 09/29']])} onConfirm={() => {}} onClose={() => {}} />)
    expect((pick('LAV-1', 'Left out') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('takeoff-bought').textContent).toBe('Ordered 09/23, on site 09/29. It cannot be left out.')
    expect((pick('LAV-1', 'Order only') as HTMLButtonElement).disabled).toBe(false)
    // A fixture not on the draft has nothing on the log to lose.
    expect((pick('HB-3', 'Left out') as HTMLButtonElement).disabled).toBe(false)
  })

  it('GC sees all with a product brings the pipe row on too', () => {
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 2" candidates={cands} onConfirm={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'GC sees all with a product' }))
    expect(picked('ft of 3/4IN WATER')).toBe('GC sees it')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('3 rows go on Rev 2')
  })

  it('v2.4118 · the Split switch shows only on a row whose name spells out two tags; on, the bar counts a row per tag and Confirm hands the split back', () => {
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={cands} onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getAllByTestId('takeoff-split')).toHaveLength(1)
    expect(screen.queryByTestId('takeoff-split-rows')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Split WC-1, WC-2' }))
    expect(screen.getByTestId('takeoff-split-rows').textContent).toContain('WC-1 · TOTO wall-hung bowl · Reece · from WC 1&2')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('3 rows go on Rev 1')
    expect(screen.getByTestId('takeoff-confirm').textContent).toBe('Build Rev 1 with 3 rows')
    fireEvent.click(screen.getByTestId('split-rule-link'))
    const modal = screen.getByRole('dialog', { name: 'When a row can split' })
    expect(within(modal).getByTestId('split-rule-table').textContent).toContain('WC 1&2WC-1, WC-2can split')
    fireEvent.click(within(modal).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    const [plan, splits] = onConfirm.mock.calls[0] as [TakeoffPlan, Map<string, boolean>]
    expect(plan.add.map((a) => [a.candidate.countRowId, a.candidate.split])).toEqual([['c-wc', true], ['c-hb', false]])
    expect([...splits.entries()]).toEqual([['c-wc', true]])
  })

  it('v2.4292 · each part is a chip; trim starts order only, a tap switches a part, the product line follows, and Confirm hands back the parts the GC sees', () => {
    const piece = (key: string, label: string, trim = false) => ({ key, label, partId: key, partTypeName: null, trim, houseId: 'h-m', houseName: 'Moore Supply', quantity: 1, lineId: key, templateItemId: null, assembly: null, manufacturer: null })
    const lav = cand({ countRowId: 'c-lav2', fixture: 'LAV2', tagText: 'LAV-2', tags: ['LAV-2'], group: 'fixtures', count: 6, supplyHouseName: 'Moore Supply',
      pieces: [piece('l1', '2215-0 LADENA WHITE'), piece('l2', 'T25S51E#CP'), piece('l3', 'BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG', true)],
      productKeys: ['l1', 'l2'], product: '2215-0 LADENA WHITE + T25S51E#CP' })
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={[lav]} onConfirm={onConfirm} onClose={() => {}} />)
    const chips = screen.getAllByTestId('takeoff-piece')
    expect(chips.map((c) => [c.textContent, c.getAttribute('aria-pressed')])).toEqual([['2215-0 LADENA WHITE', 'true'], ['T25S51E#CP', 'true'], ['BRASSCRA PLB113XP 1/2 NOM COMPX3/… · order only', 'false']])
    expect(screen.getByTestId('takeoff-part-count').textContent).toBe('3 parts · the GC sees 2 · 1 order only')
    expect(screen.queryByTestId('takeoff-piece-run')).toBeNull()
    expect(screen.getByTestId('takeoff-product').textContent).toBe('2215-0 LADENA WHITE + T25S51E#CP')
    fireEvent.click(screen.getByRole('button', { name: 'T25S51E#CP' }))
    expect(screen.getByTestId('takeoff-product').textContent).toBe('2215-0 LADENA WHITE')
    fireEvent.click(screen.getByRole('button', { name: '2215-0 LADENA WHITE' }))
    expect(screen.getByTestId('takeoff-product').textContent).toBe('every part order only — the row comes in to type with Edit')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('1 row goes on Rev 1 (1 to type with Edit)')
    fireEvent.click(screen.getByRole('button', { name: 'T25S51E#CP, order only' }))
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    const [plan, , keys] = onConfirm.mock.calls[0] as [TakeoffPlan, unknown, Map<string, string[]>]
    expect(plan.add[0]!.candidate).toMatchObject({ product: 'T25S51E#CP', productKeys: ['l2'], supplyHouseName: 'Moore Supply' })
    expect([...keys.entries()]).toEqual([['c-lav2', ['l2']]])
  })

  it('parts, not assemblies · an assembly’s parts sit under its name, the loose lines under On the takeoff, with how many on a fixture', () => {
    const piece = (key: string, label: string, assembly: string | null, quantity = 1) => ({ key, label, partId: key, partTypeName: null, trim: false, houseId: null, houseName: null, quantity, lineId: assembly ? 'l-dwh' : key, templateItemId: assembly ? key : null, assembly, manufacturer: null })
    const dwh = cand({ countRowId: 'c-dwh', fixture: 'DWH1 & ET', tagText: 'DWH-1', tags: ['DWH-1'], group: 'fixtures', count: 1,
      pieces: [piece('i-heater', 'RHEEM PROPH40-T2-RH400-SO', 'DWH1 & ET assembly SPACEX'), piece('i-tank', 'AMTROL ST-5', 'DWH1 & ET assembly SPACEX', 2), piece('l-pump', 'B&G 60B0B1001', null)],
      productKeys: ['i-heater', 'i-tank', 'l-pump'], product: 'RHEEM PROPH40-T2-RH400-SO + AMTROL ST-5 + B&G 60B0B1001' })
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={[dwh]} onConfirm={() => {}} onClose={() => {}} />)
    expect(screen.getAllByTestId('takeoff-piece-run').map((r) => r.textContent)).toEqual(['Inside DWH1 & ET assembly SPACEX', 'On the takeoff'])
    expect(screen.getAllByTestId('takeoff-piece').map((c) => c.textContent)).toEqual(['RHEEM PROPH40-T2-RH400-SO', 'AMTROL ST-5 × 2', 'B&G 60B0B1001'])
  })

  it('v2.4338 · a click outside When a row can split closes that window only, not the picker behind it', () => {
    const onClose = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={cands} onConfirm={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('split-rule-link'))
    const rule = screen.getByRole('dialog', { name: 'When a row can split' })
    fireEvent.click(rule.parentElement!)
    expect(screen.queryByRole('dialog', { name: 'When a row can split' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Choose from the takeoff' })).toBeTruthy()
  })
})
