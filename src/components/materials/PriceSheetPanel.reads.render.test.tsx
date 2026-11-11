// @vitest-environment jsdom
/**
 * The price sheet panel reads its sheet once (v2.6928). Takeoffs draws again on every list of offers the panel
 * hands it, and hands back a new takeoff, new parts and new callbacks each time. The panel read the sheet again on
 * each of those draws, about two hundred reads a second against the live database, until the list stopped being
 * sent when it had not changed and the read stopped following the door's callbacks.
 */
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import type { LoadedSheet } from '../../lib/materials/priceSheet/priceSheetIo'
import type { SheetGroup, SheetLine } from '../../lib/materials/priceSheet/sheetPlan'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

// Every house, bid, part, number and price here is made up.
const fx = vi.hoisted(() => {
  const filed = (lineNo: number, groupNo: number, partId: string): SheetLine => ({
    id: `l${lineNo}`, lineNo, groupNo, kind: 'component', houseCode: `5${lineNo}`, description: partId, qty: 1, unitPrice: null, pricingUnit: 'each', partId, filedAt: '2026-11-06T16:00:00Z', filedPrice: null, heldWhy: '', page: 4,
  })
  const group = (groupNo: number, tag: string): SheetGroup => ({ id: `g${groupNo}`, groupNo, tag, label: 'SINK', eachPrice: 52.72, placedAt: null, heldWhy: '' })
  const sheet: LoadedSheet = {
    paper: { id: 'p1', supplyHouseId: 'hill', number: 'Q-88213', datedOn: '2026-11-06', validUntil: null, bidId: 'b1', fileSha256: 'abc', pages: 6, createdAt: '2026-11-06T15:00:00Z', createdBy: 'u1', readBy: 'text' },
    groups: [group(1, 'SK-1')],
    lines: [filed(1, 1, 'kit'), filed(2, 1, 'trap')],
  }
  return { sheet, reads: { count: 0 } }
})

vi.mock('../../lib/materials/priceSheet/priceSheetIo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/materials/priceSheet/priceSheetIo')>()
  return {
    ...real,
    loadSheet: async () => {
      fx.reads.count += 1
      return { ok: true as const, sheet: fx.sheet }
    },
  }
})

import { PriceSheetPanel, type PriceSheetRowOffer, type PriceSheetTakeoff } from './PriceSheetPanel'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const houses = [{ id: 'hill', name: 'Hillcrest Supply' }]
const parts = [
  { id: 'kit', name: 'AX8802XL-LR-PC ARLO SUPPLY KIT', manufacturer: 'Arlo' },
  { id: 'trap', name: 'AX87029-BPC ARLO P-TRAP', manufacturer: 'Arlo' },
]
const takeoff: PriceSheetTakeoff = {
  countRows: [{ id: 'r1', fixture: 'SK-1 OFCI', count: 1 }],
  lineCount: () => 0,
  placeBundle: async () => ({ error: 'not in this test' }),
  removeLines: async () => ({ error: null }),
  reloadAssemblies: () => {},
}

/** As Takeoffs does: it keeps the offers it is handed, and every draw makes a new takeoff, new lists and new callbacks. */
function TakeoffsLike() {
  const [offers, setOffers] = useState<PriceSheetRowOffer[]>([])
  const takeoffNow: PriceSheetTakeoff = { ...takeoff }
  return (
    <>
      <span data-testid="offers">{offers.map((o) => o.countRowId).join(',')}</span>
      <PriceSheetPanel
        paperId="p1"
        bid={{ id: 'b1', label: 'BP1042 Juniper Street Dental' }}
        serviceTypeId="st1"
        supplyHouses={[...houses]}
        knownParts={[...parts]}
        docked
        takeoff={takeoffNow}
        onRowOffers={setOffers}
        onFold={() => {}}
        onChanged={() => {}}
        onGone={() => {}}
      />
    </>
  )
}

describe('PriceSheetPanel: one read of the sheet', () => {
  it('reads the sheet once, however often Takeoffs draws behind it', async () => {
    renderWithProviders(<TakeoffsLike />)
    for (let i = 0; i < 20; i += 1) await settle()
    // Takeoffs got its one offer: SK-1's row.
    expect(screen.getByTestId('offers').textContent).toBe('r1')
    // One read, or two where React runs each effect twice in development.
    expect(fx.reads.count).toBeGreaterThanOrEqual(1)
    expect(fx.reads.count).toBeLessThanOrEqual(2)
  })
})
