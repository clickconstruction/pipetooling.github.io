import { describe, expect, it } from 'vitest'
import { buildCostEstimatePOHtml, type CostEstimatePOModalItem } from './costEstimatePO'

function item(p: Partial<CostEstimatePOModalItem> = {}): CostEstimatePOModalItem {
  return {
    part_name: p.part_name ?? 'PVC Pipe',
    quantity: p.quantity ?? 2,
    price_at_time: p.price_at_time ?? 10,
    template_name: p.template_name !== undefined ? p.template_name : 'Rough Assembly',
  }
}

function thList(html: string): string[] {
  return Array.from(html.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)).map((m) => m[1] ?? '')
}

describe('buildCostEstimatePOHtml — review variant', () => {
  it('includes the Assembly column and labels unit cost "Cost"', () => {
    const html = buildCostEstimatePOHtml({ variant: 'review', poName: 'PO #1', items: [item()], taxPercent: 8.25 })
    expect(thList(html)).toEqual(['Part', 'Qty', 'Assembly', 'Cost', 'Total'])
    expect(html).toContain('<td>Rough Assembly</td>')
    expect(html).toContain('colspan="4"')
  })

  it('renders an em dash when template_name is null', () => {
    const html = buildCostEstimatePOHtml({ variant: 'review', poName: 'PO', items: [item({ template_name: null })], taxPercent: 0 })
    expect(html).toContain('<td>—</td>')
  })
})

describe('buildCostEstimatePOHtml — supplyHouse variant', () => {
  it('drops the Assembly column and labels unit cost "Price"', () => {
    const html = buildCostEstimatePOHtml({ variant: 'supplyHouse', poName: 'PO #1', items: [item()], taxPercent: 8.25 })
    expect(thList(html)).toEqual(['Part', 'Qty', 'Price', 'Total'])
    expect(html).not.toContain('Rough Assembly')
    expect(html).toContain('colspan="3"')
  })
})

describe('buildCostEstimatePOHtml — totals', () => {
  it('computes grand total and with-tax amount', () => {
    const html = buildCostEstimatePOHtml({
      variant: 'supplyHouse',
      poName: 'PO',
      items: [item({ quantity: 2, price_at_time: 10 }), item({ quantity: 1, price_at_time: 5 })],
      taxPercent: 10,
    })
    // grand total = 2*10 + 1*5 = 25 ; with tax 10% = 27.50
    expect(html).toContain('Grand Total:</td><td style="font-weight:600;">$25.00')
    expect(html).toContain('With Tax 10%:</td><td style="font-weight:600;">$27.50')
  })

  it('escapes the PO name and part names', () => {
    const html = buildCostEstimatePOHtml({
      variant: 'review',
      poName: 'A & B <PO>',
      items: [item({ part_name: '1/2" <pipe>' })],
      taxPercent: 0,
    })
    expect(html).toContain('<title>A &amp; B &lt;PO&gt;</title>')
    expect(html).toContain('<td>1/2&quot; &lt;pipe&gt;</td>')
  })

  it('matches the established output (parity snapshot)', () => {
    const html = buildCostEstimatePOHtml({
      variant: 'review',
      poName: 'PO #1',
      items: [item({ part_name: 'PVC Pipe', quantity: 2, price_at_time: 10, template_name: 'Rough Assembly' })],
      taxPercent: 8.25,
    })
    expect(html).toMatchInlineSnapshot(`
      "<!DOCTYPE html><html><head><meta charset="utf-8"><title>PO #1</title><style>
            body { font-family: sans-serif; margin: 1in; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
            th { background: #f5f5f5; }
            @media print { body { margin: 0.5in; } }
          </style></head><body>
            <h1>PO #1</h1>
            <table>
              <thead><tr><th>Part</th><th>Qty</th><th>Assembly</th><th>Cost</th><th>Total</th></tr></thead>
              <tbody><tr><td>PVC Pipe</td><td>2</td><td>Rough Assembly</td><td>$10.00</td><td>$20.00</td></tr></tbody>
              <tfoot><tr><td colspan="4" style="text-align:right; font-weight:600;">Grand Total:</td><td style="font-weight:600;">$20.00</td></tr><tr><td colspan="4" style="text-align:right; font-weight:600;">With Tax 8.25%:</td><td style="font-weight:600;">$21.65</td></tr></tfoot>
            </table>
          </body></html>"
    `)
  })
})
