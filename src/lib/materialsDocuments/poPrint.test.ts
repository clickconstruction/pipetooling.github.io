import { describe, expect, it } from 'vitest'
import type { PurchaseOrderWithItems } from '../materials/poItemDetails'
import { buildPOForSupplyHousePrintHtml, buildPOPrintHtml } from './poPrint'

function makePO(p: Partial<PurchaseOrderWithItems> = {}): PurchaseOrderWithItems {
  return {
    id: 'po-1',
    name: 'Rough-in <PO> "A"',
    status: 'draft',
    finalized_at: null,
    created_at: '2026-07-01T12:00:00Z',
    items: [
      {
        id: 'item-1',
        quantity: 2,
        price_at_time: 10,
        part: { name: 'Copper Elbow' },
        supply_house: { name: 'Ferguson' },
      },
      {
        id: 'item-2',
        quantity: 1,
        price_at_time: 5.5,
        part: { name: 'PVC Tee' },
        supply_house: undefined,
      },
    ],
    ...p,
  } as unknown as PurchaseOrderWithItems
}

describe('buildPOPrintHtml — finalized', () => {
  const html = buildPOPrintHtml(makePO({ status: 'finalized', finalized_at: '2026-07-02T08:00:00Z' }), null)

  it('escapes the PO name in title and heading', () => {
    expect(html).toContain('<title>Rough-in &lt;PO&gt; &quot;A&quot;</title>')
    expect(html).not.toContain('<PO>')
  })

  it('renders the finalized header + status label', () => {
    expect(html).toContain('<th>Supply House</th>')
    expect(html).not.toContain('<th>All prices</th>')
    expect(html).toContain('Finalized')
  })

  it('renders chosen supply house, em-dash fallback, and the grand total', () => {
    expect(html).toContain('<td>Ferguson</td>')
    expect(html).toContain('<td>—</td>') // item-2 has no supply house
    expect(html).toContain('$25.50') // 2*10 + 1*5.50
  })
})

describe('buildPOPrintHtml — draft', () => {
  const prices = [
    [{ supply_house_name: 'Ferguson', price: 9.75 }, { supply_house_name: 'Winsupply', price: 11 }],
    [],
  ]
  const html = buildPOPrintHtml(makePO(), prices)

  it('renders the draft comparison header + Draft label', () => {
    expect(html).toContain('<th>All prices</th>')
    expect(html).toContain('<th>Chosen</th>')
    expect(html).toContain('Draft')
  })

  it('joins all price options and falls back to an em dash for none', () => {
    expect(html).toContain('Ferguson: $9.75; Winsupply: $11.00')
    expect(html).toContain('<td>—</td>')
  })

  it('renders the chosen column from the item itself', () => {
    expect(html).toContain('Ferguson: $10.00')
  })

  it('tolerates a null allPricesPerItem (every row falls back to —)', () => {
    const bare = buildPOPrintHtml(makePO(), null)
    expect(bare).toContain('<th>All prices</th>')
  })
})

describe('buildPOForSupplyHousePrintHtml', () => {
  const html = buildPOForSupplyHousePrintHtml(makePO(), 8.25)

  it('renders chosen prices only (no supply-house/all-prices columns)', () => {
    expect(html).toContain('<tr><th>Part</th><th>Qty</th><th>Price</th><th>Total</th></tr>')
  })

  it('renders grand total and with-tax footer', () => {
    expect(html).toContain('$25.50')
    expect(html).toContain('With Tax 8.25%:')
    expect(html).toContain('$27.60') // 25.50 * 1.0825 = 27.60375 -> 27.60
  })
})
