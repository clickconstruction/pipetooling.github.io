import { describe, expect, it } from 'vitest'
import { addExpandedPartsToPO, expandTemplate, getTemplatePartsPreview } from './materialPOUtils'

type Result = { data: unknown; error?: unknown }

/**
 * Per-table FIFO stub: select-chains pop `queries[table]`, inserts are
 * recorded into `inserts[table]` and pop `insertResults[table]` (default ok).
 */
function makeClient(plan: {
  queries?: Record<string, Result[]>
  insertResults?: Record<string, Result[]>
}) {
  const inserts: Record<string, unknown[]> = {}
  function chain(result: Result) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      Promise.resolve({ error: null, ...result }).then(f, r)
    return b
  }
  const client = {
    from: (table: string) => ({
      select: () => chain(plan.queries?.[table]?.shift() ?? { data: [], error: null }),
      insert: (payload: unknown) => {
        ;(inserts[table] ??= []).push(payload)
        return chain(plan.insertResults?.[table]?.shift() ?? { data: null, error: null })
      },
    }),
  }
  return { client: client as unknown as Parameters<typeof expandTemplate>[0], inserts }
}

function tplItem(p: Record<string, unknown>) {
  return { item_type: 'part', part_id: null, nested_template_id: null, quantity: 1, ...p }
}

describe('expandTemplate', () => {
  it('flattens parts and multiplies quantities through nested templates', async () => {
    const { client } = makeClient({
      queries: {
        material_template_items: [
          { data: [tplItem({ part_id: 'p-a', quantity: 2 }), tplItem({ item_type: 'template', nested_template_id: 'tpl-2', quantity: 3 })] },
          { data: [tplItem({ part_id: 'p-b', quantity: 4 })] },
        ],
      },
    })
    expect(await expandTemplate(client, 'tpl-1')).toEqual([
      { part_id: 'p-a', quantity: 2 },
      { part_id: 'p-b', quantity: 12 }, // 3 * 4
    ])
  })

  it('returns [] when the template has no items', async () => {
    const { client } = makeClient({ queries: { material_template_items: [{ data: [] }] } })
    expect(await expandTemplate(client, 'tpl-1')).toEqual([])
  })
})

describe('getTemplatePartsPreview', () => {
  it('merges duplicate parts, resolves names, and sorts by name', async () => {
    const { client } = makeClient({
      queries: {
        material_template_items: [
          {
            data: [
              tplItem({ part_id: 'p-b', quantity: 1 }),
              tplItem({ part_id: 'p-a', quantity: 2 }),
              tplItem({ part_id: 'p-b', quantity: 3 }),
            ],
          },
        ],
        material_parts: [{ data: [{ id: 'p-a', name: 'Elbow' }, { id: 'p-b', name: 'Tee' }] }],
      },
    })
    expect(await getTemplatePartsPreview(client, 'tpl-1')).toEqual([
      { part_name: 'Elbow', quantity: 2 },
      { part_name: 'Tee', quantity: 4 },
    ])
  })
})

describe('addExpandedPartsToPO', () => {
  it('merges quantities, picks the lowest price, and continues sequence_order', async () => {
    const { client, inserts } = makeClient({
      queries: {
        material_part_prices: [
          { data: [{ supply_house_id: 'sh-1', price: 4.5 }] }, // p-a lowest
          { data: [] }, // p-b has no prices
        ],
        purchase_order_items: [{ data: [{ sequence_order: 7 }] }],
      },
    })
    const err = await addExpandedPartsToPO(
      client,
      'po-1',
      [
        { part_id: 'p-a', quantity: 1 },
        { part_id: 'p-b', quantity: 2 },
        { part_id: 'p-a', quantity: 3 }, // merges with the first
      ],
      'tpl-9'
    )
    expect(err).toBeNull()
    expect(inserts.purchase_order_items).toEqual([
      {
        purchase_order_id: 'po-1',
        part_id: 'p-a',
        quantity: 4,
        selected_supply_house_id: 'sh-1',
        price_at_time: 4.5,
        sequence_order: 8,
        source_template_id: 'tpl-9',
      },
      {
        purchase_order_id: 'po-1',
        part_id: 'p-b',
        quantity: 2,
        selected_supply_house_id: null,
        price_at_time: 0,
        sequence_order: 9,
        source_template_id: 'tpl-9',
      },
    ])
  })

  it('tags source_template_id null when no template is given and starts at 1 on an empty PO', async () => {
    const { client, inserts } = makeClient({
      queries: {
        material_part_prices: [{ data: [] }],
        purchase_order_items: [{ data: [] }],
      },
    })
    expect(await addExpandedPartsToPO(client, 'po-1', [{ part_id: 'p-a', quantity: 1 }])).toBeNull()
    expect(inserts.purchase_order_items).toEqual([
      expect.objectContaining({ sequence_order: 1, source_template_id: null }),
    ])
  })

  it('returns the error message when an insert fails', async () => {
    const { client } = makeClient({
      queries: {
        material_part_prices: [{ data: [] }],
        purchase_order_items: [{ data: [] }],
      },
      insertResults: { purchase_order_items: [{ data: null, error: { message: 'nope' } }] },
    })
    expect(await addExpandedPartsToPO(client, 'po-1', [{ part_id: 'p-a', quantity: 1 }])).toBe(
      'Failed to add item: nope'
    )
  })

  it('no-ops on an empty expansion', async () => {
    const { client, inserts } = makeClient({})
    expect(await addExpandedPartsToPO(client, 'po-1', [])).toBeNull()
    expect(inserts.purchase_order_items).toBeUndefined()
  })
})
