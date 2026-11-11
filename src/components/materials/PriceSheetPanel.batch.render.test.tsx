// @vitest-environment jsdom
/**
 * The price sheet panel with the house's numbers on file (punch list #308, PR 5): the one press for
 * the ready rows, the batch confirm, a kit row's own press, and Take this sheet back. The numbers are
 * mocked on; every other read answers empty.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/materials/houseCodes', async (original) => ({
  ...(await original<typeof import('../../lib/materials/houseCodes')>()),
  loadHouseCodes: async () => ({
    live: true,
    error: null,
    rows: [
      { id: 'c1', supply_house_id: 'hill', code: '512207', code_key: '512207', part_id: 'kit', not_a_part: false, unit_factor: 1, taught_from: 'sheet' },
      { id: 'c2', supply_house_id: 'hill', code: '277310', code_key: '277310', part_id: 'rinse', not_a_part: false, unit_factor: 1, taught_from: 'sheet' },
    ],
  }),
}))

import { PriceSheetPanel } from './PriceSheetPanel'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { LoadedSheet } from '../../lib/materials/priceSheet/priceSheetIo'
import type { SheetLine } from '../../lib/materials/priceSheet/sheetPlan'

// Every house, bid, part, number and price here is made up.
const houses = [{ id: 'hill', name: 'Hillcrest Supply' }]
const parts = [
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT 1/2IPS X 3/8OD', manufacturer: 'Arlo' },
  { id: 'trap', name: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP', manufacturer: 'Arlo' },
  { id: 'rinse', name: 'B0133-ADF12 TANNER PRE-RINSE WALL MNT 8IN', manufacturer: 'Tanner' },
]
const line = (over: Partial<SheetLine>): SheetLine => ({
  id: `l${over.lineNo}`, lineNo: 1, groupNo: 1, kind: 'part', houseCode: '', description: '', qty: 1, unitPrice: null, pricingUnit: 'each', partId: null, filedAt: null, filedPrice: null, heldWhy: '', page: 4, ...over,
})
const sheet = (lines: SheetLine[]): LoadedSheet => ({
  paper: { id: 'p1', supplyHouseId: 'hill', number: 'Q-88213', datedOn: '2026-11-06', validUntil: null, bidId: 'b1', fileSha256: 'abc', pages: 6, createdAt: '2026-11-06T15:00:00Z', createdBy: 'u1', readBy: 'text' },
  groups: [{ id: 'g1', groupNo: 1, tag: 'SK-2', label: 'DUMP SINK', eachPrice: 52.72, placedAt: null, heldWhy: '' }],
  lines,
})
const draw = (s: LoadedSheet) =>
  renderWithProviders(<PriceSheetPanel paperId="p1" bid={{ id: 'b1', label: 'BP1042 Juniper Street Dental' }} serviceTypeId="st1" supplyHouses={houses} knownParts={parts} docked initialSheet={s} onFold={() => {}} onGone={() => {}} />)

describe('PriceSheetPanel: the presses for many rows', () => {
  it('the one press says how many rows it files and how many wait, and each bucket has its press', async () => {
    draw(
      sheet([
        line({ lineNo: 1, kind: 'component', houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT' }),
        line({ lineNo: 2, houseCode: '277310', description: 'B0133-ADF12 TANNER PRE RINSE', unitPrice: 312.5 }),
        line({ lineNo: 3, kind: 'component', houseCode: '318002', description: 'AX87029-BPC ARLO 1-1/2 17GA P-TRAP' }),
        line({ lineNo: 4, houseCode: '702291', description: 'NORDIC NW-2BL COOLER', unitPrice: 1284 }),
      ]),
    )
    await settle()
    // Two rows carry a number Hillcrest is known by; one matches by its model number; one is new.
    expect(await screen.findByRole('button', { name: 'File 2 rows · 2 wait ▸' })).toBeTruthy()
    expect(screen.getByTestId('price-sheet-batch').textContent).toContain('2 are held. They stay here with the reason. The 2 ready ones file now.')
    expect(screen.getByRole('button', { name: 'Confirm 1 as the same part' })).toBeTruthy()
    // A kit row matched by its model number has its own press, and it names no price.
    expect(screen.getByRole('button', { name: 'Same part' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New part in the book · file $1,284.00' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove this sheet…' })).toBeTruthy()
  })

  it('a sheet with a filed row offers to take it back, not to remove it', async () => {
    draw(
      sheet([
        line({ lineNo: 1, houseCode: '277310', description: 'B0133-ADF12 TANNER PRE RINSE', unitPrice: 312.5, partId: 'rinse', filedAt: '2026-11-06T16:00:00Z', filedPrice: 312.5 }),
        line({ lineNo: 2, kind: 'component', houseCode: '512207', description: 'AX8802XL-LR-PC ARLO SUPPLY KIT' }),
      ]),
    )
    await settle()
    expect(await screen.findByRole('button', { name: 'File 1 row' })).toBeTruthy()
    expect(screen.getByText('1 filed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Take this sheet back…' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove this sheet…' })).toBeNull()
  })

  it('with every row filed, no press for many rows is drawn', async () => {
    draw(sheet([line({ lineNo: 1, houseCode: '277310', description: 'TANNER PRE RINSE', unitPrice: 312.5, partId: 'rinse', filedAt: '2026-11-06T16:00:00Z', filedPrice: 312.5 })]))
    await settle()
    expect(screen.getByText('1 filed')).toBeTruthy()
    expect(screen.queryByTestId('price-sheet-batch')).toBeNull()
  })
})
