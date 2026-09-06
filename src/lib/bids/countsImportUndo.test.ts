import { describe, expect, it } from 'vitest'

import { importUndoIsEmpty, importUndoPlan } from './countsImportUndo'

describe('importUndoPlan', () => {
  it('deletes exactly the inserted ids, once each, skipping blanks', () => {
    const plan = importUndoPlan({ insertedIds: ['a', 'b', 'a', null, undefined, ''], sourceLinkBefore: null, sourceLinkWritten: null })
    expect(plan.deleteRowIds).toEqual(['a', 'b'])
    expect(plan.restoreSourceLink).toBeNull()
  })

  it('restores a link the import overwrote', () => {
    const plan = importUndoPlan({ insertedIds: ['a'], sourceLinkBefore: 'https://count.tooling/old', sourceLinkWritten: 'https://count.tooling/new' })
    expect(plan.restoreSourceLink).toEqual({ to: 'https://count.tooling/old' })
  })

  it('clears a link the import created on a bid that had none', () => {
    const plan = importUndoPlan({ insertedIds: ['a'], sourceLinkBefore: undefined, sourceLinkWritten: 'https://count.tooling/new' })
    expect(plan.restoreSourceLink).toEqual({ to: null })
  })

  it('leaves the link alone when the import wrote nothing or wrote the same value', () => {
    expect(importUndoPlan({ insertedIds: ['a'], sourceLinkBefore: 'x', sourceLinkWritten: null }).restoreSourceLink).toBeNull()
    expect(importUndoPlan({ insertedIds: ['a'], sourceLinkBefore: 'x', sourceLinkWritten: 'x' }).restoreSourceLink).toBeNull()
  })

  it('an empty plan is recognisable (nothing to undo)', () => {
    expect(importUndoIsEmpty(importUndoPlan({ insertedIds: [], sourceLinkBefore: 'x', sourceLinkWritten: null }))).toBe(true)
    expect(importUndoIsEmpty(importUndoPlan({ insertedIds: ['a'], sourceLinkBefore: null, sourceLinkWritten: null }))).toBe(false)
  })
})
