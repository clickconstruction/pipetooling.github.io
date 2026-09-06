import { describe, expect, it } from 'vitest'

import {
  markOffConfirmCopy,
  undoNotComingInCopy,
  undoNotComingInRestoresBlocks,
} from './scheduleDispatchNotComingInCopy'

describe('scheduleDispatchNotComingInCopy', () => {
  const target = { personLabel: 'Paige', workDateLabel: 'Wednesday, Sep 2' }

  it('the undo RPC never restores blocks, so the undo body always says removed blocks don\'t come back', () => {
    expect(undoNotComingInRestoresBlocks()).toBe(false)
    const plain = undoNotComingInCopy({ ...target, isNcns: false })
    expect(plain.title).toBe('Remove the Not coming in mark?')
    expect(plain.lead).toBe('Paige on Wednesday, Sep 2 — they’ll be schedulable again.')
    expect(plain.blocksNote).toMatch(/don’t come back/)
    expect(plain.blocksNote).toMatch(/add them again from the cell/)
    expect(plain.ncnsNote).toBeNull()
    expect(plain.confirmLabel).toBe('Mark as coming in')
  })

  it('NCNS keeps the sterner title and adds the incident note on top of the blocks note', () => {
    const ncns = undoNotComingInCopy({ ...target, isNcns: true })
    expect(ncns.title).toBe('Clear the NCNS mark from the schedule?')
    expect(ncns.blocksNote).toMatch(/don’t come back/)
    expect(ncns.ncnsNote).toMatch(/attendance incident stays on record/)
  })

  it('the empty-cell off confirm names the person and day, promises no blocks are removed, and names the undo', () => {
    const copy = markOffConfirmCopy(target)
    expect(copy.title).toBe('Mark Paige as not coming in?')
    expect(copy.body).toMatch(/^Wednesday, Sep 2 — records unpaid time off/)
    expect(copy.body).toMatch(/no blocks are removed/)
    expect(copy.body).toMatch(/Undo any time from the cell’s chip/)
    expect(copy.confirmLabel).toBe('Mark not coming in')
  })
})
