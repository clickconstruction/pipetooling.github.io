// @vitest-environment jsdom
/**
 * Render smoke for What we buy (punch list #298 PR 4a, v2.7114): the figures, a matched part and a code with no part
 * as rows, the sort, the house filter, a span with nothing in it offering Clear the filters, the bills not counted,
 * and a read that fails showing its reason. The sums are whatWeBuy.ts (kernel-tested); this holds the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { PurchaseData, PurchaseLinesIo } from '../../lib/materials/lines/purchaseLinesIo'
import type { HeldBillsIo } from '../../lib/materials/lines/heldBillsIo'
import type { PurchaseLine } from '../../lib/materials/lines/whatWeBuy'
import { WhatWeBuyTab } from './WhatWeBuyTab'

vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return m.useAuthModuleMock({ role: 'assistant' })
})
// The page opens on the six months that end with today's; the made-up bills sit in October 2026.
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-12' }))

const line = (over: Partial<PurchaseLine> & { id: string }): PurchaseLine => ({ invoiceId: 'b1', houseId: 'h1', datedOn: '2026-10-22', lineKind: 'part', houseCode: '', description: '', unit: 'EA', pricingUnit: 'each', unitPrice: null, partId: null, quantity: null, extendedCents: null, ...over })

// Made up: copper tube matched through the crosswalk at one house, a pipe code no one has matched at another, a fuel charge.
const data: PurchaseData = {
  lines: [
    line({ id: '1', invoiceId: 'b1', houseCode: 'RS-11204', description: '3/4 X 10 TYPE L COP TUBE', unit: 'FT', quantity: 80, unitPrice: 3.84, extendedCents: 30720 }),
    line({ id: '2', invoiceId: 'b2', houseCode: 'RS-11204', description: '3/4 X 10 TYPE L COP TUBE', unit: 'FT', quantity: 200, unitPrice: 3.78, extendedCents: 75600, datedOn: '2026-09-18' }),
    line({ id: '3', invoiceId: 'b3', houseId: 'h2', houseCode: '0417-2210', description: 'PVC SCH40 PIPE 2X20 PE', quantity: 30, unitPrice: 50.36, extendedCents: 151080 }),
    line({ id: '4', invoiceId: 'b1', lineKind: 'charge', description: 'FUEL SURCHARGE', extendedCents: 650 }),
  ],
  teaches: [{ houseId: 'h1', codeKey: 'RS11204', partId: 'p-tube', notAPart: false }],
  partNames: new Map([['p-tube', 'Copper tube, type L, 3/4 in.']]),
  houseNames: new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']]),
  shares: [{ invoiceId: 'b1', jobId: 'j1', pct: 100 }],
  jobNames: new Map([['j1', 'JP1042 Oak Hollow C']]),
}

function mount(io: PurchaseLinesIo = { load: vi.fn(async () => data), bookPrices: vi.fn(async () => []) }, heldIo?: HeldBillsIo) {
  return renderWithProviders(<WhatWeBuyTab io={io} heldIo={heldIo} />)
}

afterEach(() => cleanup())

describe('WhatWeBuyTab', () => {
  it('draws the figures and a row for a part and for a code with no part, the most spent first', async () => {
    mount()
    const page = await screen.findByTestId('what-we-buy')
    expect(within(page).getByTestId('what-we-buy-parts').textContent).toMatch(/\$2,574.*on 3 bills that add up/)
    expect(within(page).getByTestId('what-we-buy-charges').textContent).toMatch(/\$7.*freight, fuel, fees/)
    expect(within(page).getByTestId('what-we-buy-distinct').textContent).toMatch(/2.*1 by code only, no part yet/)
    const rows = within(page).getAllByTestId('what-we-buy-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.textContent).toMatch(/PVC SCH40 PIPE 2X20 PE/)
    expect(rows[0]!.textContent).toMatch(/no part yet · Pecan Supply Co 0417-2210/)
    expect(rows[0]!.textContent).toMatch(/1 time.*30 EA.*\$1,511.*Pecan Supply Co.*\$50\.36/)
    expect(rows[1]!.textContent).toMatch(/Copper tube, type L, 3\/4 in\./)
    expect(rows[1]!.textContent).toMatch(/2 times.*280 FT.*\$1,063.*Ridgeway Supply.*\$3\.84/)
    // The month strip reads its figures out.
    expect(within(rows[1]!).getByRole('img').getAttribute('aria-label')).toMatch(/Sep 2026 \$756, Oct 2026 \$307/)
  })

  it('sorts by how often, and holds the page to a house', async () => {
    mount()
    const page = await screen.findByTestId('what-we-buy')
    fireEvent.click(within(page).getByRole('button', { name: 'How often' }))
    await settle()
    expect(within(page).getAllByTestId('what-we-buy-row')[0]!.textContent).toMatch(/Copper tube/)
    fireEvent.change(within(page).getByLabelText('House'), { target: { value: 'h2' } })
    await settle()
    const rows = within(page).getAllByTestId('what-we-buy-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toMatch(/PVC SCH40 PIPE/)
    expect(within(page).getByTestId('what-we-buy-charges').textContent).toMatch(/\$0/)
  })

  it('holds the page to a job by the bill’s share', async () => {
    mount()
    const page = await screen.findByTestId('what-we-buy')
    fireEvent.change(within(page).getByLabelText('Job'), { target: { value: 'j1' } })
    await settle()
    const rows = within(page).getAllByTestId('what-we-buy-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toMatch(/1 time.*80 FT.*\$307/)
  })

  it('a span with nothing in it says so and offers Clear the filters', async () => {
    mount()
    const page = await screen.findByTestId('what-we-buy')
    fireEvent.change(within(page).getByLabelText('To month'), { target: { value: '2026-08' } })
    await settle()
    expect(within(page).queryAllByTestId('what-we-buy-row')).toHaveLength(0)
    expect(page.textContent).toMatch(/No purchases match the filters\./)
    fireEvent.click(within(page).getAllByRole('button', { name: 'Clear the filters' })[0]!)
    await settle()
    expect(within(page).getAllByTestId('what-we-buy-row')).toHaveLength(2)
  })

  it('says how many bills are not counted, with the door to their reasons', async () => {
    const heldIo: HeldBillsIo = {
      load: vi.fn(async () => ({
        invoices: [
          { id: 'x', supplyHouseId: 'h1', number: 'S-1', dateYmd: '2026-10-01', amountCents: 100, link: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view' },
          { id: 'y', supplyHouseId: 'h1', number: 'S-2', dateYmd: '2026-10-02', amountCents: 100, link: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view' },
        ],
        papers: [{ id: 'px', invoiceId: 'x', checkState: 'off' as const, checkNote: 'The lines are $12.40 short of the subtotal' }],
        holds: [{ invoiceId: 'y', why: 'cannot_open' as const, note: '' }],
        houseNames: new Map([['h1', 'Ridgeway Supply']]),
      })),
    }
    mount(undefined, heldIo)
    const tile = await screen.findByTestId('what-we-buy-not-counted')
    expect(tile.textContent).toMatch(/2/)
    expect(within(tile).getByRole('link', { name: 'Supply houses' }).getAttribute('href')).toBe('/materials?tab=supply-houses')
  })

  it('a row’s name opens Price over time on that row, and the strip comes back', async () => {
    const io: PurchaseLinesIo = { load: vi.fn(async () => data), bookPrices: vi.fn(async () => [{ houseId: 'h1', price: 3.62, checkedOn: '2026-07-14' }]) }
    mount(io)
    const page = await screen.findByTestId('what-we-buy')
    fireEvent.click(within(page).getByRole('button', { name: 'Copper tube, type L, 3/4 in.' }))
    const price = await screen.findByTestId('price-over-time')
    expect(within(price).getByRole('heading', { name: 'Copper tube, type L, 3/4 in.' })).toBeTruthy()
    expect(price.textContent).toMatch(/2 purchases since Sep 18 · every purchase is a point/)
    expect(within(price).getAllByTestId('price-point')).toHaveLength(2)
    expect(io.bookPrices).toHaveBeenCalledWith('p-tube')
    // The last price at the house, its change since the purchase before, and the book beside it.
    const last = within(price).getByTestId('price-last-paid')
    expect(last.textContent).toMatch(/Last paid · Ridgeway Supply.*\$3\.84.*Oct 22 · up 2% since Sep 18/)
    expect((await within(price).findByTestId('price-book')).textContent).toMatch(/\$3\.62.*checked Jul 14.*stale/)
    expect(within(price).getByTestId('price-book-line')).toBeTruthy()
    // The purchases are a table too, newest first, with the bill's job.
    const rows = within(price).getAllByTestId('price-row')
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringMatching(/Oct 22.*Ridgeway Supply.*80 FT.*\$3\.84.*JP1042 Oak Hollow C/), expect.stringMatching(/Sep 18.*200 FT.*\$3\.78/)])
    // A point says itself on focus.
    fireEvent.focus(within(price).getAllByTestId('price-point')[0]!)
    expect((await within(price).findByTestId('price-tip')).textContent).toMatch(/\$3\.78 · Sep 18 · Ridgeway Supply · 200 FT/)
    fireEvent.click(within(page).getByRole('tab', { name: 'What we buy' }))
    await settle()
    expect(within(page).getAllByTestId('what-we-buy-row')).toHaveLength(2)
  })

  it('Price over time with no row picked offers the most spent, and a search narrows them', async () => {
    mount()
    const page = await screen.findByTestId('what-we-buy')
    fireEvent.click(within(page).getByRole('tab', { name: 'Price over time' }))
    const price = await screen.findByTestId('price-over-time')
    const picker = within(price).getByTestId('price-picker')
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['PVC SCH40 PIPE 2X20 PE · Pecan Supply Co 0417-2210', 'Copper tube, type L, 3/4 in.'])
    fireEvent.change(within(picker).getByLabelText('Find a part or a code'), { target: { value: '0417' } })
    await settle()
    expect(within(picker).getAllByRole('button')).toHaveLength(1)
    fireEvent.change(within(picker).getByLabelText('Find a part or a code'), { target: { value: 'zzz' } })
    await settle()
    expect(picker.textContent).toMatch(/No part or code matches ‘zzz’\./)
  })

  it('no line on file points at Supply houses, and a failed read says its reason', async () => {
    const none = mount({ load: vi.fn(async () => ({ ...data, lines: [] })), bookPrices: vi.fn(async () => []) })
    expect((await screen.findByTestId('what-we-buy')).textContent).toMatch(/No bill lines yet\./)
    none.unmount()
    mount({ load: vi.fn(async () => Promise.reject(new Error('permission denied for view supply_purchase_lines'))), bookPrices: vi.fn(async () => []) })
    expect(await screen.findByText(/permission denied for view supply_purchase_lines/)).toBeTruthy()
  })
})
