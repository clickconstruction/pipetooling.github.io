import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Line Items For Office (Projects → Forecast → stage modal): a data layer that
 * talks to Supabase directly and hands every failure back as a string. The tests
 * pin the filters and payloads, the fabricated memos for a PO / invoice line, the
 * error strings, and the display formatters the section reuses from Workflow.
 */
type Step = { method: string; args: unknown[] }
type Result = { data: unknown; error: { message: string } | null }
const queries: Array<{ table: string; steps: Step[] }> = []
let route: (table: string, steps: Step[]) => Result = () => ({ data: [], error: null })
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => {
      const steps: Step[] = []
      queries.push({ table, steps })
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: Result) => void) => resolve(route(table, steps))
            return (...a: unknown[]) => {
              steps.push({ method: String(prop), args: a })
              return p
            }
          },
        },
      )
      return p
    },
  },
}))

import {
  addInvoiceToStep,
  addPOToStep,
  deleteLineItemRow,
  formatAmount,
  formatLineItemDate,
  formatShortIsoDate,
  loadFinalizedPOOptions,
  loadInvoiceDetail,
  loadLineItemsForStep,
  loadPODetail,
  loadSupplyHouseInvoiceOptions,
  normalizeUrl,
  saveLineItem,
  type LineItemRow,
} from './projectsForecastStageLineItems'

const ok = (data: unknown): Result => ({ data, error: null })
const fail = (message: string): Result => ({ data: null, error: { message } })
const byTable = (map: Record<string, Result>) => (table: string) => map[table] ?? ok([])
const q = (table: string) => queries.find((x) => x.table === table)!
const args = (table: string, m: string) => q(table).steps.filter((s) => s.method === m).map((s) => s.args)
const existing = [{ id: 'li1', sequence_order: 3 }, { id: 'li2', sequence_order: 7 }] as unknown as LineItemRow[]

beforeEach(() => {
  queries.length = 0
  route = () => ok([])
})

describe('loadLineItemsForStep', () => {
  it('reads the step’s items in sequence order; a blank step id asks nothing', async () => {
    expect(await loadLineItemsForStep('')).toEqual({ items: [], error: null })
    expect(queries).toHaveLength(0)
    route = byTable({ workflow_step_line_items: ok([{ id: 'a' }]) })
    expect(await loadLineItemsForStep('s1')).toEqual({ items: [{ id: 'a' }], error: null })
    expect(args('workflow_step_line_items', 'eq')).toEqual([['step_id', 's1']])
    expect(args('workflow_step_line_items', 'order')).toEqual([['sequence_order', { ascending: true }]])
  })
  it('passes an RLS or read error back verbatim with no items', async () => {
    route = () => fail('permission denied')
    expect(await loadLineItemsForStep('s1')).toEqual({ items: [], error: 'permission denied' })
    route = () => ok(null)
    expect(await loadLineItemsForStep('s1')).toEqual({ items: [], error: null })
  })
})

describe('picker options', () => {
  it('finalized POs: newest 100, each with its item total (zero when it has no items); no second query when there are none', async () => {
    route = byTable({
      purchase_orders: ok([{ id: 'po1', name: 'Ferguson 9/1' }, { id: 'po2', name: 'Empty' }]),
      purchase_order_items: ok([
        { purchase_order_id: 'po1', price_at_time: 10.5, quantity: 3 },
        { purchase_order_id: 'po1', price_at_time: 2, quantity: 1 },
      ]),
    })
    const r = await loadFinalizedPOOptions()
    expect(args('purchase_orders', 'eq')).toEqual([['status', 'finalized']])
    expect(args('purchase_orders', 'order')).toEqual([['created_at', { ascending: false }]])
    expect(args('purchase_orders', 'limit')).toEqual([[100]])
    expect(args('purchase_order_items', 'in')).toEqual([['purchase_order_id', ['po1', 'po2']]])
    expect(r).toEqual({ options: [{ id: 'po1', name: 'Ferguson 9/1', total: 33.5 }, { id: 'po2', name: 'Empty', total: 0 }], error: null })

    queries.length = 0
    route = byTable({ purchase_orders: ok([]) })
    expect(await loadFinalizedPOOptions()).toEqual({ options: [], error: null })
    expect(queries.map((x) => x.table)).toEqual(['purchase_orders'])

    route = () => fail('down')
    expect(await loadFinalizedPOOptions()).toEqual({ options: [], error: 'down' })
  })
  it('supply-house invoices: newest 100 by invoice date, with the house name or "Unknown"', async () => {
    route = byTable({
      supply_house_invoices: ok([
        { id: 'i1', invoice_number: '123', invoice_date: '2026-09-01', due_date: null, amount: 99.9, is_paid: false, purchase_order_number: 'PO-7', supply_house_id: 'sh1', supply_houses: { name: 'Ferguson' } },
        { id: 'i2', invoice_number: '124', invoice_date: '2026-08-30', due_date: '2026-09-30', amount: 5, is_paid: true, purchase_order_number: null, supply_house_id: null, supply_houses: null },
      ]),
    })
    const r = await loadSupplyHouseInvoiceOptions()
    expect(args('supply_house_invoices', 'order')).toEqual([['invoice_date', { ascending: false }]])
    expect(args('supply_house_invoices', 'limit')).toEqual([[100]])
    expect(String(args('supply_house_invoices', 'select')[0]![0])).toContain('supply_houses(name)')
    expect(r.options).toEqual([
      { id: 'i1', invoice_number: '123', invoice_date: '2026-09-01', due_date: null, amount: 99.9, is_paid: false, purchase_order_number: 'PO-7', supply_house_name: 'Ferguson' },
      { id: 'i2', invoice_number: '124', invoice_date: '2026-08-30', due_date: '2026-09-30', amount: 5, is_paid: true, purchase_order_number: null, supply_house_name: 'Unknown' },
    ])
    route = () => fail('down')
    expect(await loadSupplyHouseInvoiceOptions()).toEqual({ options: [], error: 'down' })
  })
})

describe('saveLineItem', () => {
  const base = { stepId: 's1', item: null, memo: '  Permit fee ', amount: '125.50', itemDate: '2026-09-07T15:00:00Z', link: ' example.com/receipt ', existing }
  it('requires a memo before touching the database', async () => {
    expect(await saveLineItem({ ...base, memo: '   ' })).toBe('Memo is required')
    expect(queries).toHaveLength(0)
  })
  it('inserts a new item after the last sequence, with the memo trimmed, the amount parsed, the date cut to a day and the link normalised', async () => {
    expect(await saveLineItem(base)).toBeNull()
    expect(args('workflow_step_line_items', 'insert')).toEqual([[{ step_id: 's1', memo: 'Permit fee', amount: 125.5, item_date: '2026-09-07', link: 'https://example.com/receipt', sequence_order: 8 }]])
  })
  it('an unparsable amount becomes 0, a blank date null, a blank link null, and the first item gets sequence 1', async () => {
    expect(await saveLineItem({ ...base, amount: 'abc', itemDate: '  ', link: '', existing: [] })).toBeNull()
    expect(args('workflow_step_line_items', 'insert')[0]![0]).toMatchObject({ amount: 0, item_date: null, link: null, sequence_order: 1 })
  })
  it('updates an existing item by id without touching its sequence', async () => {
    expect(await saveLineItem({ ...base, item: { id: 'li1' } as LineItemRow })).toBeNull()
    expect(args('workflow_step_line_items', 'update')).toEqual([[{ link: 'https://example.com/receipt', memo: 'Permit fee', amount: 125.5, item_date: '2026-09-07' }]])
    expect(args('workflow_step_line_items', 'eq')).toEqual([['id', 'li1']])
  })
  it('names the failed action in the error', async () => {
    route = () => fail('rls')
    expect(await saveLineItem(base)).toBe('Failed to add line item: rls')
    expect(await saveLineItem({ ...base, item: { id: 'li1' } as LineItemRow })).toBe('Failed to update line item: rls')
    expect(await deleteLineItemRow('li1')).toBe('Failed to delete line item: rls')
    route = () => ok(null)
    expect(await deleteLineItemRow('li1')).toBeNull()
    const del = queries.filter((x) => x.table === 'workflow_step_line_items').pop()!
    expect(del.steps.some((s) => s.method === 'delete')).toBe(true)
    expect(del.steps.find((s) => s.method === 'eq')?.args).toEqual(['id', 'li1'])
  })
})

describe('addPOToStep / addInvoiceToStep', () => {
  it('fabricates the PO line from its items and name, stamps the PO id, and appends it', async () => {
    route = byTable({
      purchase_order_items: ok([{ price_at_time: 100, quantity: 1 }, { price_at_time: 25.25, quantity: 2 }]),
      purchase_orders: ok({ name: 'Ferguson 9/1' }),
    })
    expect(await addPOToStep('s1', 'po1', existing)).toBeNull()
    expect(args('purchase_order_items', 'eq')).toEqual([['purchase_order_id', 'po1']])
    expect(args('purchase_orders', 'single')).toHaveLength(1)
    expect(args('workflow_step_line_items', 'insert')).toEqual([[{ step_id: 's1', memo: 'PO: Ferguson 9/1 - 2 items, $150.50 total', amount: 150.5, sequence_order: 8, purchase_order_id: 'po1' }]])
  })
  it('a PO with no name or items still gets a line, and an insert failure is named', async () => {
    route = byTable({ purchase_order_items: ok(null), purchase_orders: ok(null), workflow_step_line_items: fail('rls') })
    expect(await addPOToStep('s1', 'po1', [])).toBe('Failed to add PO to step: rls')
    expect(args('workflow_step_line_items', 'insert')[0]![0]).toMatchObject({ memo: 'PO: Purchase Order - 0 items, $0.00 total', amount: 0, sequence_order: 1 })
  })
  it('fabricates the invoice line from the invoice and its house, stamps the invoice id, and appends it', async () => {
    route = byTable({ supply_house_invoices: ok({ invoice_number: '123', amount: 99.9, supply_houses: { name: 'Ferguson' } }) })
    expect(await addInvoiceToStep('s1', 'i1', existing)).toBeNull()
    expect(String(args('supply_house_invoices', 'select')[0]![0])).toContain('supply_houses(name)')
    expect(args('supply_house_invoices', 'eq')).toEqual([['id', 'i1']])
    expect(args('workflow_step_line_items', 'insert')).toEqual([[{ step_id: 's1', memo: 'Invoice #123 - Ferguson - $99.90', amount: 99.9, sequence_order: 8, supply_house_invoice_id: 'i1' }]])
  })
  it('an unknown house reads "Unknown"; a missing or failed invoice load and a failed insert are each named', async () => {
    route = byTable({ supply_house_invoices: ok({ invoice_number: '9', amount: 1, supply_houses: null }), workflow_step_line_items: fail('rls') })
    expect(await addInvoiceToStep('s1', 'i9', [])).toBe('Failed to add invoice to step: rls')
    expect(args('workflow_step_line_items', 'insert')[0]![0]).toMatchObject({ memo: 'Invoice #9 - Unknown - $1.00' })
    route = byTable({ supply_house_invoices: ok(null) })
    expect(await addInvoiceToStep('s1', 'gone', [])).toBe('Failed to load invoice: Not found')
    route = byTable({ supply_house_invoices: fail('timeout') })
    expect(await addInvoiceToStep('s1', 'i1', [])).toBe('Failed to load invoice: timeout')
  })
})

describe('detail popovers', () => {
  it('loadPODetail joins parts and houses onto the PO’s items in sequence order', async () => {
    route = byTable({
      purchase_orders: ok({ id: 'po1', name: 'Ferguson 9/1' }),
      purchase_order_items: ok([
        { quantity: 2, price_at_time: 10, material_parts: { name: '3/4 PEX' }, supply_houses: { name: 'Ferguson' }, sequence_order: 1 },
        { quantity: 1, price_at_time: 5, material_parts: { name: 'Elbow' }, supply_houses: null, sequence_order: 2 },
      ]),
    })
    const r = await loadPODetail('po1')
    expect(args('purchase_orders', 'eq')).toEqual([['id', 'po1']])
    expect(args('purchase_order_items', 'order')).toEqual([['sequence_order', { ascending: true }]])
    expect(r).toEqual({
      detail: {
        id: 'po1',
        name: 'Ferguson 9/1',
        items: [
          { part: { name: '3/4 PEX' }, quantity: 2, supply_house: { name: 'Ferguson' }, price_at_time: 10 },
          { part: { name: 'Elbow' }, quantity: 1, supply_house: null, price_at_time: 5 },
        ],
      },
      error: null,
    })
  })
  it('loadPODetail names which read failed', async () => {
    route = byTable({ purchase_orders: fail('gone') })
    expect(await loadPODetail('po1')).toEqual({ detail: null, error: 'Failed to load PO: gone' })
    route = byTable({ purchase_orders: ok(null) })
    expect(await loadPODetail('po1')).toEqual({ detail: null, error: 'Failed to load PO: Not found' })
    route = byTable({ purchase_orders: ok({ id: 'po1', name: 'x' }), purchase_order_items: fail('rls') })
    expect(await loadPODetail('po1')).toEqual({ detail: null, error: 'Failed to load PO items: rls' })
  })
  it('loadInvoiceDetail maps the invoice with its house name, falling back to "Unknown" and a null link', async () => {
    route = byTable({ supply_house_invoices: ok({ id: 'i1', invoice_number: '123', amount: 99.9, link: 'https://x.test/inv', supply_houses: { name: 'Ferguson' }, extra: 'ignored' }) })
    expect(await loadInvoiceDetail('i1')).toEqual({ detail: { id: 'i1', invoice_number: '123', supply_house_name: 'Ferguson', amount: 99.9, link: 'https://x.test/inv' }, error: null })
    route = byTable({ supply_house_invoices: ok({ id: 'i2', invoice_number: '9', amount: 1, link: undefined, supply_houses: null }) })
    expect((await loadInvoiceDetail('i2')).detail).toMatchObject({ supply_house_name: 'Unknown', link: null })
    route = byTable({ supply_house_invoices: fail('rls') })
    expect(await loadInvoiceDetail('i1')).toEqual({ detail: null, error: 'Failed to load invoice: rls' })
    route = byTable({ supply_house_invoices: ok(null) })
    expect(await loadInvoiceDetail('i1')).toEqual({ detail: null, error: 'Failed to load invoice: Not found' })
  })
})

describe('display helpers (copied from Workflow so the section matches)', () => {
  it('normalizeUrl adds a scheme, repairs a missing colon, and leaves blanks blank', () => {
    expect(normalizeUrl(null)).toBe('')
    expect(normalizeUrl('   ')).toBe('')
    expect(normalizeUrl(' https://x.test/a ')).toBe('https://x.test/a')
    expect(normalizeUrl('HTTP://x.test')).toBe('HTTP://x.test')
    expect(normalizeUrl('http//x.test')).toBe('http://x.test')
    expect(normalizeUrl('//cdn.test/f')).toBe('https://cdn.test/f')
    expect(normalizeUrl('x.test/path')).toBe('https://x.test/path')
  })
  it('formatAmount shows cents with a leading sign for negatives, and $0.00 for nothing', () => {
    expect(formatAmount(1234.5)).toBe('$1,234.50')
    expect(formatAmount(-5)).toBe('-$5.00')
    expect(formatAmount(0)).toBe('$0.00')
    expect(formatAmount(null)).toBe('$0.00')
    expect(formatAmount(undefined)).toBe('$0.00')
  })
  it('formatLineItemDate reads the calendar day off the value and prints it long; blanks and junk are an em dash', () => {
    expect(formatLineItemDate('2026-09-07')).toBe('Sep 7, 2026')
    expect(formatLineItemDate('2026-09-07T23:59:00Z')).toBe('Sep 7, 2026') // the day is taken from the text, not shifted
    expect(formatLineItemDate('')).toBe('—')
    expect(formatLineItemDate(null)).toBe('—')
    expect(formatLineItemDate('junk')).toBe('—')
  })
  it('formatShortIsoDate prints a numeric m/d/yy, or an em dash for nothing', () => {
    expect(formatShortIsoDate('2026-09-07T12:00:00')).toMatch(/^9\/7\/26$/)
    expect(formatShortIsoDate('')).toBe('—')
    expect(formatShortIsoDate(undefined)).toBe('—')
  })
})
