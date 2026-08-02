import { describe, expect, it } from 'vitest'
import {
  mergeItemIntoDrafts,
  mergeTemplateItemDrafts,
  mergedPartQuantity,
  type TemplateItemDraft,
} from './mergeTemplateItemDrafts'

const part = (part_id: string, quantity: number): TemplateItemDraft => ({ item_type: 'part', part_id, nested_template_id: null, quantity })
const tpl = (nested_template_id: string, quantity: number): TemplateItemDraft => ({ item_type: 'template', part_id: null, nested_template_id, quantity })

describe('mergeTemplateItemDrafts (batch form)', () => {
  it('merges duplicate parts by part_id, keeps first-occurrence order', () => {
    expect(mergeTemplateItemDrafts([part('p-a', 1), part('p-b', 2), part('p-a', 3)])).toEqual([
      part('p-a', 4),
      part('p-b', 2),
    ])
  })

  it('lets nested templates repeat as separate rows', () => {
    expect(mergeTemplateItemDrafts([tpl('t-1', 1), tpl('t-1', 2)])).toEqual([tpl('t-1', 1), tpl('t-1', 2)])
  })

  it('skips null/undefined holes and does not mutate inputs', () => {
    const a = part('p-a', 1)
    const out = mergeTemplateItemDrafts([a, null, undefined, part('p-a', 2)])
    expect(out).toEqual([part('p-a', 3)])
    expect(a.quantity).toBe(1)
  })
})

describe('mergeItemIntoDrafts (single-item form)', () => {
  it('adds quantity into an existing part row without mutating prev', () => {
    const prev = [part('p-a', 2), tpl('t-1', 1)]
    const out = mergeItemIntoDrafts(prev, part('p-a', 3))
    expect(out).toEqual([part('p-a', 5), tpl('t-1', 1)])
    expect(prev[0]?.quantity).toBe(2)
  })

  it('appends new parts and always appends templates (even repeats)', () => {
    expect(mergeItemIntoDrafts([part('p-a', 1)], part('p-b', 1))).toHaveLength(2)
    expect(mergeItemIntoDrafts([tpl('t-1', 1)], tpl('t-1', 2))).toHaveLength(2)
  })

  it('treats a missing existing quantity as 1 (the ?? 1 quirk)', () => {
    const weird = { ...part('p-a', 1), quantity: undefined as unknown as number }
    expect(mergeItemIntoDrafts([weird], part('p-a', 2))[0]?.quantity).toBe(3)
  })
})

describe('mergedPartQuantity (DB-update rule)', () => {
  it('adds with the ?? 1 default for null/undefined existing quantities', () => {
    expect(mergedPartQuantity(4, 2)).toBe(6)
    expect(mergedPartQuantity(null, 2)).toBe(3)
    expect(mergedPartQuantity(undefined, 5)).toBe(6)
  })
})
