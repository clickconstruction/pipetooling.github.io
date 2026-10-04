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

  it('2026-10-02 · each part has the same three buttons: trim starts order only, a part can be left out, the product line follows, and Confirm hands back the parts as picked', () => {
    const piece = (key: string, label: string, trim = false) => ({ key, label, partId: key, partTypeName: null, trim, houseId: 'h-m', houseName: 'Moore Supply', quantity: 1, lineId: key, templateItemId: null, assembly: null, manufacturer: null })
    const lav = cand({ countRowId: 'c-lav2', fixture: 'LAV2', tagText: 'LAV-2', tags: ['LAV-2'], group: 'fixtures', count: 6, supplyHouseName: 'Moore Supply',
      pieces: [piece('l1', '2215-0 LADENA WHITE'), piece('l2', 'T25S51E#CP'), piece('l3', 'BRASSCRA PLB113XP 1/2 NOM COMPX3/8 OD COMP W/LOOSEKEY ANG', true)],
      productKeys: ['l1', 'l2'], product: '2215-0 LADENA WHITE + T25S51E#CP' })
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={[lav]} onConfirm={onConfirm} onClose={() => {}} />)
    // Folded to start: one line says how the parts stand.
    expect(screen.queryByTestId('takeoff-pieces')).toBeNull()
    expect(screen.getByTestId('takeoff-part-count').textContent).toBe('2 the GC sees · 1 order only')
    fireEvent.click(screen.getByTestId('takeoff-parts-toggle'))
    expect(screen.getAllByTestId('takeoff-piece').map((c) => c.getAttribute('data-pick'))).toEqual(['gc', 'gc', 'order'])
    expect(screen.queryByTestId('takeoff-piece-run')).toBeNull()
    expect(screen.getByTestId('takeoff-product').textContent).toBe('2215-0 LADENA WHITE + T25S51E#CP')
    fireEvent.click(pick('T25S51E#CP', 'Order only'))
    expect(screen.getByTestId('takeoff-product').textContent).toBe('2215-0 LADENA WHITE')
    fireEvent.click(pick('2215-0 LADENA WHITE', 'Left out'))
    expect(screen.getByTestId('takeoff-product').textContent).toBe('every part order only — the row comes in to type with Edit')
    expect(screen.getByTestId('takeoff-part-count').textContent).toBe('2 order only · 1 left out')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('1 row goes on Rev 1 (1 to type with Edit)')
    fireEvent.click(pick('T25S51E#CP', 'GC sees it'))
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    const [plan] = onConfirm.mock.calls[0] as [TakeoffPlan]
    expect(plan.add[0]!.candidate).toMatchObject({ product: 'T25S51E#CP', productKeys: ['l2'], supplyHouseName: 'Moore Supply' })
    // The part left out is not one of the pieces the row is built from; the bid remembers both lists.
    expect(plan.add[0]!.candidate.pieces.map((p) => p.key)).toEqual(['l2', 'l3'])
    expect([...plan.productKeys.entries()]).toEqual([['c-lav2', ['l2']]])
    expect([...plan.leftOut.entries()]).toEqual([['c-lav2', ['l1']]])
  })

  it('parts, not assemblies · an assembly’s parts sit under its name, the loose lines under On the takeoff, with how many on a fixture', () => {
    const piece = (key: string, label: string, assembly: string | null, quantity = 1) => ({ key, label, partId: key, partTypeName: null, trim: false, houseId: null, houseName: null, quantity, lineId: assembly ? 'l-dwh' : key, templateItemId: assembly ? key : null, assembly, manufacturer: null })
    const dwh = cand({ countRowId: 'c-dwh', fixture: 'DWH1 & ET', tagText: 'DWH-1', tags: ['DWH-1'], group: 'fixtures', count: 1,
      pieces: [piece('i-heater', 'RHEEM PROPH40-T2-RH400-SO', 'DWH1 & ET assembly SPACEX'), piece('i-tank', 'AMTROL ST-5', 'DWH1 & ET assembly SPACEX', 2), piece('l-pump', 'B&G 60B0B1001', null)],
      productKeys: ['i-heater', 'i-tank', 'l-pump'], product: 'RHEEM PROPH40-T2-RH400-SO + AMTROL ST-5 + B&G 60B0B1001' })
    render(<SubmittalTakeoffPicker mode="build" revLabel="Rev 1" candidates={[dwh]} onConfirm={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByTestId('takeoff-parts-toggle'))
    expect(screen.getAllByTestId('takeoff-piece-run').map((r) => r.textContent)).toEqual(['Inside DWH1 & ET assembly SPACEX', 'On the takeoff'])
    expect(screen.getAllByTestId('takeoff-piece').map((c) => c.textContent!.replace('GC sees itOrder onlyLeft out', ''))).toEqual(['RHEEM PROPH40-T2-RH400-SO', 'AMTROL ST-5 × 2', 'B&G 60B0B1001'])
  })

  it('2026-10-02 · a fixture on the draft shows its parts as the row holds them; a change is handed back for the row, an ordered part cannot be left out, and the fixture’s own button rules its parts', () => {
    const piece = (key: string, label: string, trim = false) => ({ key, label, partId: key, partTypeName: null, trim, houseId: null, houseName: null, quantity: 1, lineId: key, templateItemId: null, assembly: null, manufacturer: null })
    const ewc = cand({ countRowId: 'c-ewc', fixture: 'EWC1', tagText: 'EWC-1', tags: ['EWC-1'], group: 'fixtures', count: 2, alreadyOn: true, onAs: 'gc',
      pieces: [piece('cooler', 'ELKAY LZSTL8WSLK'), piece('trap', 'MAINLINE MLZ8700 P-TRAP', true), piece('carrier', 'JOSAM 17560-WCBL')], productKeys: ['cooler', 'carrier'], product: 'ELKAY LZSTL8WSLK + JOSAM 17560-WCBL',
      // The row holds the cooler for the GC and the carrier as order only; it has no trap.
      onParts: [{ key: 'cooler', onSubmittal: true }, { key: 'carrier', onSubmittal: false }] })
    const onConfirm = vi.fn()
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 1" candidates={[ewc]} boughtParts={new Map([['c-ewc', new Map([['carrier', 'Ordered 09/23, on site 09/29']])]])} onConfirm={onConfirm} onClose={() => {}} />)
    expect(screen.getByTestId('takeoff-part-count').textContent).toBe('1 the GC sees · 1 order only · 1 left out')
    fireEvent.click(screen.getByTestId('takeoff-parts-toggle'))
    expect(screen.getAllByTestId('takeoff-piece').map((c) => c.getAttribute('data-pick'))).toEqual(['gc', 'out', 'order'])
    expect((pick('JOSAM 17560-WCBL', 'Left out') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('takeoff-piece-bought').textContent).toBe('Ordered 09/23, on site 09/29. It cannot be left out.')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('Nothing changes yet.')
    // Bring the trap on as order only.
    fireEvent.click(pick('MAINLINE MLZ8700 P-TRAP', 'Order only'))
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('parts change on 1 fixture')
    // The fixture's own button rules the parts without erasing them.
    fireEvent.click(pick('EWC-1', 'Order only'))
    expect(screen.getByTestId('takeoff-pieces-ruled').textContent).toContain('The whole fixture is order only.')
    expect((pick('ELKAY LZSTL8WSLK', 'Left out') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(pick('EWC-1', 'GC sees it'))
    expect(screen.getAllByTestId('takeoff-piece').map((c) => c.getAttribute('data-pick'))).toEqual(['gc', 'order', 'order'])
    fireEvent.click(screen.getByTestId('takeoff-confirm'))
    const [plan] = onConfirm.mock.calls[0] as [TakeoffPlan]
    expect(plan.parts.map((x) => [x.countRowId, x.candidate.pieces.map((p) => p.key), x.candidate.productKeys])).toEqual([['c-ewc', ['cooler', 'trap', 'carrier'], ['cooler']]])
    expect([...plan.leftOut.entries()]).toEqual([['c-ewc', []]])
    expect([plan.add.length, plan.remove.length]).toEqual([0, 0])
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
  it('2026-10-03 · a fixture approved on an earlier revision opens locked: Update is held until something is picked, and only Ask again puts it back on the draft', () => {
    const onConfirm = vi.fn()
    const after = [
      cand({ countRowId: 'c-wc', fixture: 'WC 1&2', tagText: 'WC-1, WC-2', tags: ['WC-1', 'WC-2'], group: 'fixtures', product: 'TOTO wall-hung bowl', standsOn: { rev: 3, whole: true } }),
      cand({ countRowId: 'c-lav', fixture: 'LAV 1', tagText: 'LAV-1', tags: ['LAV-1'], group: 'fixtures', product: 'Kohler lav', alreadyOn: true, onAs: 'gc' }),
      cand({ countRowId: 'c-us', fixture: 'UTILITY SINK', group: 'no_part' }),
    ]
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 4" candidates={after} onConfirm={onConfirm} onClose={() => {}} />)
    const row = screen.getAllByTestId('takeoff-candidate')[0]!
    expect(row.getAttribute('data-pick')).toBe('stands')
    expect(within(row).getByTestId('takeoff-stands').textContent).toBe('✓ Approved on Rev 3Ask again…')
    expect(within(row).getByTestId('takeoff-stands-line').textContent).toBe('It stays on Rev 3 and on the procurement log. It is not on Rev 4.')
    expect(within(row).queryByRole('group')).toBeNull()
    // Left alone, nothing says it will move.
    expect(within(row).queryByTestId('takeoff-change')).toBeNull()
    expect(screen.getByTestId('takeoff-group-fixtures').textContent).toContain('1 the GC sees · 1 approved earlier')
    expect(screen.getByTestId('takeoff-counts').textContent).toBe('1 the GC sees0 order only1 left out1 approved earlier')
    // Nothing touched: nothing to write.
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('Nothing changes yet.')
    expect((screen.getByTestId('takeoff-confirm') as HTMLButtonElement).disabled).toBe(true)
    // The sweep leaves it alone too.
    fireEvent.click(screen.getByRole('button', { name: 'GC sees all with a product' }))
    expect((screen.getByTestId('takeoff-confirm') as HTMLButtonElement).disabled).toBe(true)
    // Ask again: now it is a row coming on, and the line says the GC answers it again.
    fireEvent.click(within(row).getByTestId('takeoff-ask-again'))
    expect(picked('WC-1, WC-2')).toBe('GC sees it')
    expect(within(row).getByTestId('takeoff-change').textContent).toContain('Approved on Rev 3. It goes on Rev 4 and the GC is asked again.')
    expect(screen.getByTestId('takeoff-bar').textContent).toBe('1 row goes on Rev 4')
    // Keep the approval: back to locked, nothing to write.
    fireEvent.click(within(row).getByTestId('takeoff-keep-approval'))
    expect(within(row).getByTestId('takeoff-stands')).toBeTruthy()
    expect((screen.getByTestId('takeoff-confirm') as HTMLButtonElement).disabled).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
  })
  it('2026-10-03 · picks made and not written: ×, Cancel, the backdrop and Esc ask first; with none made they close at once', () => {
    const onClose = vi.fn()
    const { unmount } = render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 1" candidates={cands} onConfirm={() => {}} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    render(<SubmittalTakeoffPicker mode="add" revLabel="Rev 1" candidates={cands} onConfirm={() => {}} onClose={onClose} />)
    fireEvent.click(pick('HB-3', 'Left out'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('leave-question').textContent).toContain('Your picks are not on Rev 1 yet.')
    fireEvent.click(screen.getByTestId('leave-keep'))
    expect(picked('HB-3')).toBe('Left out')
    fireEvent.click(screen.getByRole('presentation'))
    expect(screen.getByTestId('leave-question')).toBeTruthy()
    fireEvent.click(screen.getByTestId('leave-confirm'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
