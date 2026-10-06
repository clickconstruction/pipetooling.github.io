import { describe, expect, it } from 'vitest'

import { describeImportUndo, importUndoIsEmpty, importUndoPlan } from './countsImportUndo'

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

describe('importUndoPlan — a reviewed import (v2.4699)', () => {
  it('carries the updated rows’ old values and the removed rows whole, dropping empty patches', () => {
    const plan = importUndoPlan({
      insertedIds: ['n1'],
      sourceLinkBefore: null,
      sourceLinkWritten: null,
      restoreRows: [{ id: 'a', before: { count: 12 } }, { id: 'b', before: {} }],
      reinsertRows: [{ id: 'm', bid_id: 'bid', bid_version_id: null, fixture: 'Trap primer', count: 2, group_tag: 'Restroom B', page: '4', unit: null, sequence_order: 7 }],
    })
    expect(plan.restoreRows).toEqual([{ id: 'a', before: { count: 12 } }])
    expect(plan.reinsertRows.map((r) => r.id)).toEqual(['m'])
    expect(importUndoIsEmpty(plan)).toBe(false)
    expect(describeImportUndo(plan)).toBe('Import undone — 1 row removed, 1 put back, 1 restored.')
  })

  it('an update-only import is still undoable', () => {
    const plan = importUndoPlan({ insertedIds: [], sourceLinkBefore: 'x', sourceLinkWritten: 'x', restoreRows: [{ id: 'a', before: { page: '2' } }] })
    expect(importUndoIsEmpty(plan)).toBe(false)
    expect(describeImportUndo(plan)).toBe('Import undone — 1 put back.')
  })
})
