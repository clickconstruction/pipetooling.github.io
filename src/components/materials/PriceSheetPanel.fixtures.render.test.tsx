// @vitest-environment jsdom
/**
 * The price sheet panel with Takeoffs behind it (punch list #308, PR 6): a fixture whose rows are
 * all filed is offered for the bid's row with the same tag, and a fixture the bid costed by hand,
 * one with no row, and one already placed each say so and offer their own press.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PriceSheetPanel, type PriceSheetRowOffer, type PriceSheetTakeoff } from './PriceSheetPanel'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { LoadedSheet } from '../../lib/materials/priceSheet/priceSheetIo'
import type { SheetGroup, SheetLine } from '../../lib/materials/priceSheet/sheetPlan'

// Every house, bid, part, number and price here is made up.
const houses = [{ id: 'hill', name: 'Hillcrest Supply' }]
const parts = [
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT', manufacturer: 'Arlo' },
  { id: 'trap', name: 'AX87029-BPC ARLO P-TRAP', manufacturer: 'Arlo' },
]
const filed = (lineNo: number, groupNo: number, partId: string): SheetLine => ({
  id: `l${lineNo}`, lineNo, groupNo, kind: 'component', houseCode: `5${lineNo}`, description: partId, qty: 1, unitPrice: null, pricingUnit: 'each', partId, filedAt: '2026-11-06T16:00:00Z', filedPrice: null, heldWhy: '', page: 4,
})
const group = (groupNo: number, tag: string, over: Partial<SheetGroup> = {}): SheetGroup => ({ id: `g${groupNo}`, groupNo, tag, label: 'SINK', eachPrice: 52.72, placedAt: null, heldWhy: '', ...over })
const sheet: LoadedSheet = {
  paper: { id: 'p1', supplyHouseId: 'hill', number: 'Q-88213', datedOn: '2026-11-06', validUntil: null, bidId: 'b1', fileSha256: 'abc', pages: 6, createdAt: '2026-11-06T15:00:00Z', createdBy: 'u1', readBy: 'text' },
  groups: [group(1, 'SK-1'), group(2, 'SK-2'), group(3, 'SK-4A'), group(4, 'SK-3', { placedAt: '2026-11-06T17:00:00Z', placedLineIds: ['x1'], templateId: 't1', bundlePrice: 52.72 })],
  lines: [filed(1, 1, 'kit'), filed(2, 1, 'trap'), filed(3, 2, 'kit'), filed(4, 3, 'kit'), filed(5, 4, 'trap')],
}
const takeoff: PriceSheetTakeoff = {
  countRows: [
    { id: 'r1', fixture: 'SK-1 OFCI', count: 1 },
    { id: 'r2', fixture: 'SK-2 OFCI', count: 3 },
    { id: 'r3', fixture: 'SK-3 OFCI', count: 1 },
  ],
  lineCount: (id) => (id === 'r2' ? 2 : 0),
  placeBundle: async () => ({ error: 'not in this test' }),
  removeLines: async () => ({ error: null }),
  reloadAssemblies: () => {},
}

describe('PriceSheetPanel: fixtures onto the takeoff', () => {
  it('says where each fixture stands and offers the press that fits', async () => {
    const offers: PriceSheetRowOffer[][] = []
    renderWithProviders(
      <PriceSheetPanel paperId="p1" bid={{ id: 'b1', label: 'BP1042 Juniper Street Dental' }} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} docked initialSheet={sheet} takeoff={takeoff} onRowOffers={(o) => offers.push(o)} onFold={() => {}} onGone={() => {}} />,
    )
    await settle()
    const lines = screen.getAllByTestId('price-sheet-fixture').map((el) => el.textContent ?? '')
    // SK-1: every row filed and the bid's row waits.
    expect(lines[0]).toContain('Goes on SK-1 OFCI. Makes a new assembly.')
    expect(screen.getByRole('button', { name: 'Place · $52.72 each' })).toBeTruthy()
    // SK-2: the bid's row has lines a person put there, so the sheet waits for a word.
    expect(lines[1]).toContain('SK-2 OFCI is costed by hand already.')
    expect(screen.getByRole('button', { name: "Use the sheet's $52.72" })).toBeTruthy()
    // SK-4A: no row of the bid answers to the tag, so she says which row it is.
    expect(lines[2]).toContain('No fixture on this bid is tagged SK-4A.')
    expect(screen.getByLabelText('The fixture on this bid for SK-4A')).toBeTruthy()
    // SK-3: placed already, with its way off.
    expect(lines[3]).toContain('On the takeoff, on SK-3 OFCI.')
    expect(screen.getByRole('button', { name: 'Take off' })).toBeTruthy()
    // One press for the fixtures that are ready, and only those.
    expect(screen.getByTestId('price-sheet-place').textContent).toBe('Place 1 fixture')
    // Takeoffs is told which of its rows has an offer: SK-1's, and no other.
    expect(offers[offers.length - 1]).toEqual([{ countRowId: 'r1', groupId: 'g1', houseName: 'Hillcrest Supply', each: 52.72, parts: 2 }])
  })

  it('with no takeoff behind it, the panel offers no placement at all', async () => {
    renderWithProviders(<PriceSheetPanel paperId="p1" bid={null} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} docked initialSheet={sheet} onFold={() => {}} onGone={() => {}} />)
    await settle()
    expect(screen.queryByTestId('price-sheet-fixture')).toBeNull()
    expect(screen.queryByTestId('price-sheet-place')).toBeNull()
  })
})
