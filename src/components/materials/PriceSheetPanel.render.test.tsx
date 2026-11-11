// @vitest-environment jsdom
/**
 * Render smokes for the price sheet panel and its Takeoffs door (punch list #308, PR 4). The stub
 * answers every read with no rows, so no number and no price is on file: the sheet handed in rests
 * on the model number, the words and its own printed prices.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { PriceSheetPanel } from './PriceSheetPanel'
import { PriceSheetDoor } from './PriceSheetDoor'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { LoadedSheet } from '../../lib/materials/priceSheet/priceSheetIo'
import type { SheetLine } from '../../lib/materials/priceSheet/sheetPlan'

// Every house, bid, part, number and price here is made up.
const houses = [{ id: 'hill', name: 'Hillcrest Supply' }, { id: 'bord', name: 'Borden Pipe & Supply' }]
const parts = [
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD', manufacturer: 'Arlo' },
  { id: 'trap', name: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP', manufacturer: 'Arlo' },
  { id: 'trapBare', name: 'AX8702-9BPC', manufacturer: null },
  { id: 'rinse', name: 'B0133-ADF12 TANNER PRE-RINSE WALL MNT 8IN', manufacturer: 'Tanner' },
]
const line = (over: Partial<SheetLine>): SheetLine => ({
  id: `l${over.lineNo}`, lineNo: 1, groupNo: 1, kind: 'part', houseCode: '', description: '', qty: 1, unitPrice: null, pricingUnit: 'each', partId: null, filedAt: null, filedPrice: null, heldWhy: '', page: 4, ...over,
})
const sheet = (supplyHouseId: string | null): LoadedSheet => ({
  paper: { id: 'p1', supplyHouseId, number: 'Q-88213', datedOn: '2026-11-06', validUntil: '2026-12-06', bidId: 'b1', fileSha256: 'abc', pages: 6, createdAt: '2026-11-06T15:00:00Z', createdBy: 'u1', readBy: 'text' },
  groups: [
    { id: 'g1', groupNo: 1, tag: 'SK-2', label: 'DUMP SINK (BAR) (OFCI)', eachPrice: 52.72, placedAt: null, heldWhy: '' },
    { id: 'g2', groupNo: 2, tag: 'MS-1', label: 'MOP SINK', eachPrice: 1650, placedAt: null, heldWhy: '' },
  ],
  lines: [
    line({ lineNo: 1, groupNo: 1, kind: 'charge', houseCode: '440118', description: 'MISC CHARGE' }),
    line({ lineNo: 2, groupNo: 1, kind: 'component', houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD' }),
    line({ lineNo: 3, groupNo: 1, kind: 'component', houseCode: '318002', description: 'AX87029BPC ARLO 1-1/2 17GA P-TRAP' }),
    line({ lineNo: 4, groupNo: 2, houseCode: '277310', description: 'B0133-ADF12 TANNER PRE RINSE WALL MNT 8"', unitPrice: 312.5 }),
    line({ lineNo: 5, groupNo: 2, houseCode: '702291', description: 'NORDIC NW-2BL BI-LEVEL COOLER', unitPrice: 1284 }),
  ],
})
const bid = { id: 'b1', label: 'BP1042 Juniper Street Dental' }
const panel = (s: LoadedSheet, firstRead: Parameters<typeof PriceSheetPanel>[0]['firstRead'] = null) => (
  <PriceSheetPanel paperId="p1" bid={bid} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} firstRead={firstRead} docked initialSheet={s} onFold={() => {}} onGone={() => {}} />
)

describe('PriceSheetPanel', () => {
  it('names the house with its reasons, says the sheet in one line, and opens on what needs her', async () => {
    renderWithProviders(panel(sheet('hill'), { letterhead: { houseId: 'hill', printed: 'HILLCREST SUPPLY CO.' }, fileName: 'Q-88213.pdf' }))
    await settle()
    expect(screen.getByTestId('price-sheet-house').textContent).toContain('This sheet is from Hillcrest Supply.')
    expect(screen.getByText('Letterhead reads HILLCREST SUPPLY CO.')).toBeTruthy()
    expect(screen.getByTestId('price-sheet-verdict').textContent).toContain('6 pages · 2 fixtures · 5 rows.')
    expect(screen.getByText('2 need you')).toBeTruthy()
    expect(screen.getByText('2 to confirm together')).toBeTruthy()
    expect(screen.getByText('1 charge stays in its bundle')).toBeTruthy()
    // Two parts carry the trap's model number, and nothing on file is the cooler.
    expect(screen.getByText('Two parts on file')).toBeTruthy()
    expect(screen.getByText('Nothing on file')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New part in the book · file $1,284.00' })).toBeTruthy()
    // A model number match is one look and one press; where the row sits is said.
    expect(screen.getByRole('button', { name: 'Same part · file $312.50' })).toBeTruthy()
    expect(screen.getByText('MS-1 · row 4 · page 4')).toBeTruthy()
  })

  it('folds each fixture to a line and opens it to its rows', async () => {
    renderWithProviders(panel(sheet('hill')))
    await settle()
    const fold = screen.getByRole('button', { name: /SK-2 DUMP SINK/ })
    expect(fold.textContent).toContain('$52.72 each')
    expect(screen.queryByText('MISC CHARGE')).toBeNull()
    fireEvent.click(fold)
    expect(screen.getByText('MISC CHARGE')).toBeTruthy()
    expect(screen.getByText('Not a part')).toBeTruthy()
    expect(screen.getAllByText('in the bundle').length).toBeGreaterThan(0)
  })

  it('asks which house when the sheet has none, and files nothing until it is said', async () => {
    renderWithProviders(panel(sheet(null), { letterhead: null }))
    await settle()
    const strip = screen.getByTestId('price-sheet-house')
    expect(strip.textContent).toContain('Which house is this sheet from? Nothing on it names one.')
    expect(strip.textContent).toContain('A price is filed only after you say.')
    expect(screen.queryByRole('button', { name: /file \$/ })).toBeNull()
  })

  it('a sheet opened again asks for its house without saying its letterhead named none', async () => {
    renderWithProviders(panel(sheet(null)))
    await settle()
    const strip = screen.getByTestId('price-sheet-house')
    expect(strip.textContent).toContain('Which house is this sheet from?')
    expect(strip.textContent).not.toContain('Nothing on it names one')
  })

  it('says a fixture whose rows do not add up to its subtotal', async () => {
    renderWithProviders(panel(sheet('hill')))
    await settle()
    expect(screen.getByTestId('price-sheet-verdict').textContent).toContain('MS-1 does not add up to its subtotal.')
  })
})

describe('PriceSheetDoor', () => {
  it('is one press in the title row that offers a file or one price', async () => {
    const takeoff = { countRows: [], lineCount: () => 0, placeBundle: async () => ({ error: 'not in this test' }), removeLines: async () => ({ error: null }), reloadAssemblies: () => {} }
    renderWithProviders(<PriceSheetDoor bid={bid} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} onBookChanged={() => {}} takeoff={takeoff} onRowOffers={() => {}} placeRef={{ current: null }} />)
    await settle()
    const door = screen.getByRole('button', { name: 'Price sheet ▾' })
    fireEvent.click(door)
    expect(screen.getByRole('menuitem', { name: /Read a file…/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: /Paste a price/ }))
    expect(await screen.findByRole('heading', { name: 'One price' })).toBeTruthy()
  })

  it('with no bid, on the Parts Book, it lists every sheet and says so when there is none', async () => {
    renderWithProviders(<PriceSheetDoor serviceTypeId="st1" onBookChanged={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Price sheet ▾' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'All price sheets…' }))
    expect(await screen.findByRole('heading', { name: 'Price sheets' })).toBeTruthy()
    expect(screen.getByText('Nothing waiting on a price sheet.')).toBeTruthy()
  })
})
