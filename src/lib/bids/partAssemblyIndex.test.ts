import { describe, expect, it } from 'vitest'
import { buildPartAssemblyIndex, type PartAssemblyIndexItem } from './partAssemblyIndex'

function partItem(templateId: string, partId: string, quantity = 1): PartAssemblyIndexItem {
  return { template_id: templateId, item_type: 'part', part_id: partId, nested_template_id: null, quantity }
}

function nestedItem(templateId: string, nestedTemplateId: string, quantity = 1): PartAssemblyIndexItem {
  return { template_id: templateId, item_type: 'template', part_id: null, nested_template_id: nestedTemplateId, quantity }
}

function entriesFor(index: Map<string, { templateId: string; quantity: number }[]>, partId: string) {
  return (index.get(partId) ?? []).slice().sort((a, b) => a.templateId.localeCompare(b.templateId))
}

describe('buildPartAssemblyIndex', () => {
  it('returns an empty index for no items', () => {
    expect(buildPartAssemblyIndex([]).size).toBe(0)
  })

  it('indexes direct parts with their quantities', () => {
    const index = buildPartAssemblyIndex([partItem('t1', 'p1', 2), partItem('t1', 'p2'), partItem('t2', 'p1', 3)])
    expect(entriesFor(index, 'p1')).toEqual([
      { templateId: 't1', quantity: 2 },
      { templateId: 't2', quantity: 3 },
    ])
    expect(entriesFor(index, 'p2')).toEqual([{ templateId: 't1', quantity: 1 }])
  })

  it('merges a part appearing twice in the same template', () => {
    const index = buildPartAssemblyIndex([partItem('t1', 'p1', 2), partItem('t1', 'p1', 5)])
    expect(entriesFor(index, 'p1')).toEqual([{ templateId: 't1', quantity: 7 }])
  })

  it('credits parts of a nested assembly to the parent, multiplying quantities', () => {
    const index = buildPartAssemblyIndex([
      partItem('child', 'p1', 2),
      nestedItem('parent', 'child', 3),
    ])
    expect(entriesFor(index, 'p1')).toEqual([
      { templateId: 'child', quantity: 2 },
      { templateId: 'parent', quantity: 6 },
    ])
  })

  it('follows multi-level nesting', () => {
    const index = buildPartAssemblyIndex([
      partItem('leaf', 'p1'),
      nestedItem('mid', 'leaf', 2),
      nestedItem('top', 'mid', 4),
    ])
    expect(entriesFor(index, 'p1')).toEqual([
      { templateId: 'leaf', quantity: 1 },
      { templateId: 'mid', quantity: 2 },
      { templateId: 'top', quantity: 8 },
    ])
  })

  it('sums direct and nested occurrences of the same part', () => {
    const index = buildPartAssemblyIndex([
      partItem('child', 'p1', 2),
      partItem('parent', 'p1', 1),
      nestedItem('parent', 'child', 1),
    ])
    expect(entriesFor(index, 'p1')).toEqual([
      { templateId: 'child', quantity: 2 },
      { templateId: 'parent', quantity: 3 },
    ])
  })

  it('terminates on template cycles', () => {
    const index = buildPartAssemblyIndex([
      partItem('a', 'p1'),
      nestedItem('a', 'b'),
      partItem('b', 'p2'),
      nestedItem('b', 'a'),
    ])
    expect(entriesFor(index, 'p1').map((e) => e.templateId)).toContain('a')
    expect(entriesFor(index, 'p2').map((e) => e.templateId)).toContain('b')
  })

  it('ignores rows with missing ids and non-part/template item types', () => {
    const index = buildPartAssemblyIndex([
      { template_id: 't1', item_type: 'part', part_id: null, nested_template_id: null, quantity: 1 },
      { template_id: 't1', item_type: 'template', part_id: null, nested_template_id: null, quantity: 1 },
      { template_id: 't1', item_type: 'labor', part_id: 'p9', nested_template_id: null, quantity: 1 },
      partItem('t1', 'p1'),
    ])
    expect(index.size).toBe(1)
    expect(entriesFor(index, 'p1')).toEqual([{ templateId: 't1', quantity: 1 }])
  })
})
