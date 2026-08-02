import { describe, expect, it } from 'vitest'
import {
  PO_ITEMS_SUMMARY_SELECT,
  loadPOItemsSummary,
  mapPOItemSummaryRows,
  type POItemSummaryRow,
} from './poItemsSummary'

function row(p: Partial<POItemSummaryRow> = {}): POItemSummaryRow {
  return {
    quantity: 2,
    price_at_time: 4.5,
    material_parts: { name: 'Copper Elbow' },
    source_template: { id: 'tpl-1', name: 'Rough-in kit' },
    ...p,
  }
}

describe('mapPOItemSummaryRows', () => {
  it('maps part/template names with the em-dash and null fallbacks', () => {
    expect(mapPOItemSummaryRows([row(), row({ material_parts: null, source_template: null })])).toEqual([
      { part_name: 'Copper Elbow', quantity: 2, price_at_time: 4.5, template_name: 'Rough-in kit' },
      { part_name: '—', quantity: 2, price_at_time: 4.5, template_name: null },
    ])
  })

  it('returns [] for null/undefined/empty input', () => {
    expect(mapPOItemSummaryRows(null)).toEqual([])
    expect(mapPOItemSummaryRows(undefined)).toEqual([])
    expect(mapPOItemSummaryRows([])).toEqual([])
  })
})

function makeClient(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const b: Record<string, unknown> = {
    select: (...a: unknown[]) => ((calls.select = a), b),
    eq: (...a: unknown[]) => ((calls.eq = a), b),
    order: (...a: unknown[]) => ((calls.order = a), Promise.resolve(result)),
  }
  const client = { from: (...a: unknown[]) => ((calls.from = a), b) }
  return { client: client as unknown as Parameters<typeof loadPOItemsSummary>[0], calls }
}

describe('loadPOItemsSummary', () => {
  it('issues the canonical summary query and maps rows', async () => {
    const { client, calls } = makeClient({ data: [row()], error: null })
    const items = await loadPOItemsSummary(client, 'po-9')
    expect(calls.from).toEqual(['purchase_order_items'])
    expect(calls.select).toEqual([PO_ITEMS_SUMMARY_SELECT])
    expect(calls.eq).toEqual(['purchase_order_id', 'po-9'])
    expect(calls.order).toEqual(['sequence_order', { ascending: true }])
    expect(items).toEqual([
      { part_name: 'Copper Elbow', quantity: 2, price_at_time: 4.5, template_name: 'Rough-in kit' },
    ])
  })

  it('returns null on error and [] for a PO with no items', async () => {
    expect(await loadPOItemsSummary(makeClient({ data: null, error: { message: 'boom' } }).client, 'po-9')).toBeNull()
    expect(await loadPOItemsSummary(makeClient({ data: [], error: null }).client, 'po-9')).toEqual([])
  })
})
