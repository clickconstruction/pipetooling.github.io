import { describe, expect, it } from 'vitest'
import {
  PO_ITEMS_WITH_DETAILS_SELECT,
  loadPOItemsWithDetails,
  mapPOItemRowsToDetails,
  type POItemJoinRow,
} from './poItemDetails'

function makeJoinRow(p: Partial<POItemJoinRow> = {}): POItemJoinRow {
  return {
    id: 'item-1',
    purchase_order_id: 'po-1',
    part_id: 'part-1',
    quantity: 2,
    sequence_order: 0,
    material_parts: { id: 'part-1', name: 'Copper Elbow' },
    supply_houses: { id: 'sh-1', name: 'Ferguson' },
    source_template: { id: 'tpl-1', name: 'Rough-in kit' },
    ...p,
  } as unknown as POItemJoinRow
}

describe('mapPOItemRowsToDetails', () => {
  it('hydrates part / supply_house / source_template from join keys', () => {
    const mapped = mapPOItemRowsToDetails([makeJoinRow()])[0]!
    expect(mapped.part).toEqual({ id: 'part-1', name: 'Copper Elbow' })
    expect(mapped.supply_house).toEqual({ id: 'sh-1', name: 'Ferguson' })
    expect(mapped.source_template).toEqual({ id: 'tpl-1', name: 'Rough-in kit' })
  })

  it('keeps the raw join keys on the result (spread semantics preserved)', () => {
    const mapped = mapPOItemRowsToDetails([makeJoinRow()])[0]!
    expect((mapped as unknown as POItemJoinRow).material_parts).toBeTruthy()
    expect((mapped as unknown as POItemJoinRow).supply_houses).toBeTruthy()
  })

  it('maps null supply_houses to undefined (the || undefined quirk)', () => {
    const mapped = mapPOItemRowsToDetails([makeJoinRow({ supply_houses: null })])[0]!
    expect(mapped.supply_house).toBeUndefined()
  })

  it('maps a missing source_template to null (the ?? null quirk)', () => {
    const row = makeJoinRow()
    delete (row as Partial<POItemJoinRow>).source_template
    const mapped = mapPOItemRowsToDetails([row])[0]!
    expect(mapped.source_template).toBeNull()
  })

  it('returns [] for null/undefined/empty input', () => {
    expect(mapPOItemRowsToDetails(null)).toEqual([])
    expect(mapPOItemRowsToDetails(undefined)).toEqual([])
    expect(mapPOItemRowsToDetails([])).toEqual([])
  })
})

/** Chainable query stub recording the calls loadPOItemsWithDetails makes. */
function makeClientStub(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown[]> = {}
  const builder = {
    select: (...a: unknown[]) => {
      calls.select = a
      return builder
    },
    eq: (...a: unknown[]) => {
      calls.eq = a
      return builder
    },
    order: (...a: unknown[]) => {
      calls.order = a
      return Promise.resolve(result)
    },
  }
  const client = {
    from: (...a: unknown[]) => {
      calls.from = a
      return builder
    },
  }
  return { client: client as unknown as Parameters<typeof loadPOItemsWithDetails>[0], calls }
}

describe('loadPOItemsWithDetails', () => {
  it('issues the canonical query and maps the rows', async () => {
    const { client, calls } = makeClientStub({ data: [makeJoinRow()], error: null })
    const items = await loadPOItemsWithDetails(client, 'po-9')
    expect(calls.from).toEqual(['purchase_order_items'])
    expect(calls.select).toEqual([PO_ITEMS_WITH_DETAILS_SELECT])
    expect(calls.eq).toEqual(['purchase_order_id', 'po-9'])
    expect(calls.order).toEqual(['sequence_order', { ascending: true }])
    expect(items).toHaveLength(1)
    expect(items?.[0]?.part.name).toBe('Copper Elbow')
  })

  it('returns null on query error (call sites keep their own fallbacks)', async () => {
    const { client } = makeClientStub({ data: null, error: { message: 'boom' } })
    expect(await loadPOItemsWithDetails(client, 'po-9')).toBeNull()
  })

  it('returns null when data is null without an error', async () => {
    const { client } = makeClientStub({ data: null, error: null })
    expect(await loadPOItemsWithDetails(client, 'po-9')).toBeNull()
  })

  it('returns [] (not null) for a PO with zero items', async () => {
    const { client } = makeClientStub({ data: [], error: null })
    expect(await loadPOItemsWithDetails(client, 'po-9')).toEqual([])
  })
})
