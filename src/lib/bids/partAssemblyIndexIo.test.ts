import { describe, expect, it } from 'vitest'
import { makeFakeRowCapSupabase } from '../../test/fakeRowCapSupabase'
import { loadPartAssemblyIndex } from './partAssemblyIndexIo'

/** `count` part rows, one part each, spread over assemblies of ten. */
function itemRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `i${String(i).padStart(5, '0')}`,
    template_id: `t${Math.floor(i / 10)}`,
    item_type: 'part',
    part_id: `p${i}`,
    nested_template_id: null,
    quantity: 2,
  }))
}

describe('loadPartAssemblyIndex', () => {
  it('reads a second page when the first is full, so parts past row 1,000 are indexed', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: itemRows(1400) })
    const index = await loadPartAssemblyIndex(client)
    expect(calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999]])
    expect(index?.size).toBe(1400)
    expect(index?.get('p1399')).toEqual([{ templateId: 't139', quantity: 2 }])
  })

  it('reads one page when it comes back short', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: itemRows(40) })
    const index = await loadPartAssemblyIndex(client)
    expect(calls).toHaveLength(1)
    expect(index?.size).toBe(40)
  })

  it('reads a closing empty page when the table holds exactly one full page', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: itemRows(1000) })
    const index = await loadPartAssemblyIndex(client)
    expect(calls).toHaveLength(2)
    expect(index?.size).toBe(1000)
  })

  it('asks for the five index columns in a stable id order, on a fresh query per page', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: itemRows(1400) })
    await loadPartAssemblyIndex(client)
    expect(calls).toHaveLength(2)
    expect(calls[0]).not.toBe(calls[1])
    for (const call of calls) {
      expect(call.table).toBe('material_template_items')
      expect(call.select).toBe('template_id, item_type, part_id, nested_template_id, quantity')
      expect(call.order).toEqual(['id'])
      expect(call.in).toBeNull()
    }
  })

  it('follows a nested assembly whose rows sit on the second page', async () => {
    const rows = [
      { id: 'i00000', template_id: 'kit', item_type: 'template', part_id: null, nested_template_id: 'sub', quantity: 3 },
      ...itemRows(1000).map((r, i) => ({ ...r, id: `i${String(i + 1).padStart(5, '0')}` })),
      { id: 'i99999', template_id: 'sub', item_type: 'part', part_id: 'valve', nested_template_id: null, quantity: 2 },
    ]
    const { client } = makeFakeRowCapSupabase({ material_template_items: rows })
    const index = await loadPartAssemblyIndex(client)
    expect(index?.get('valve')).toEqual([
      { templateId: 'kit', quantity: 6 },
      { templateId: 'sub', quantity: 2 },
    ])
  })

  it('resolves null when the first page fails', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: itemRows(1400) }, { failOnCall: 1 })
    expect(await loadPartAssemblyIndex(client)).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('resolves null, not an index of the first page, when a later page fails', async () => {
    const { client, calls } = makeFakeRowCapSupabase({ material_template_items: itemRows(1400) }, { failOnCall: 2 })
    expect(await loadPartAssemblyIndex(client)).toBeNull()
    expect(calls).toHaveLength(2)
  })
})
