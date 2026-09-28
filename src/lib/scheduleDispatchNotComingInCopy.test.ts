import { describe, expect, it } from 'vitest'

import {
  blocksNotRemovedToast,
  markOffConfirmCopy,
  ncnsResultToasts,
  notComingInResultToasts,
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

describe('blocksNotRemovedToast', () => {
  it('says nothing when every block went', () => {
    expect(blocksNotRemovedToast(0)).toBeNull()
    expect(blocksNotRemovedToast(-1)).toBeNull()
  })

  it('counts the blocks left behind, one or many', () => {
    expect(blocksNotRemovedToast(1)).toEqual({
      message: '1 schedule block could not be removed; please remove manually.',
      tone: 'warning',
    })
    expect(blocksNotRemovedToast(3)?.message).toBe('3 schedule blocks could not be removed; please remove manually.')
  })
})

describe('notComingInResultToasts', () => {
  const base = { personName: 'Paige', workDateYmd: '2026-09-28', alreadyMarked: false, removed: 0, failed: 0 }

  it('says the day was marked, and nothing about blocks when there were none', () => {
    expect(notComingInResultToasts(base)).toEqual([
      { message: 'Marked Paige as not coming in (2026-09-28).', tone: 'success' },
    ])
  })

  it('counts the blocks it removed, one or many', () => {
    expect(notComingInResultToasts({ ...base, removed: 1 })[0]?.message).toBe(
      'Marked Paige as not coming in (2026-09-28). Removed 1 schedule block for the day.',
    )
    expect(notComingInResultToasts({ ...base, removed: 2 })[0]?.message).toBe(
      'Marked Paige as not coming in (2026-09-28). Removed 2 schedule blocks for the day.',
    )
  })

  it('warns instead of confirming when the day already had time off, and still counts the blocks', () => {
    expect(notComingInResultToasts({ ...base, alreadyMarked: true, removed: 2 })).toEqual([
      {
        message: 'Paige already had unpaid time off on 2026-09-28. Removed 2 schedule blocks for the day.',
        tone: 'warning',
      },
    ])
    expect(notComingInResultToasts({ ...base, alreadyMarked: true })[0]?.message).toBe(
      'Paige already had unpaid time off on 2026-09-28.',
    )
  })

  it('raises the salary sync warning after the mark', () => {
    expect(notComingInResultToasts({ ...base, syncWarning: 'no pay config' })).toEqual([
      { message: 'Marked Paige as not coming in (2026-09-28).', tone: 'success' },
      { message: 'Salary sync: no pay config', tone: 'warning' },
    ])
  })

  it('says nothing about the salary sync when nothing was written', () => {
    const toasts = notComingInResultToasts({ ...base, alreadyMarked: true, syncWarning: 'no pay config' })
    expect(toasts).toHaveLength(1)
    expect(toasts[0]?.tone).toBe('warning')
  })

  it('ends with the blocks that would not go', () => {
    expect(notComingInResultToasts({ ...base, syncWarning: 'no pay config', removed: 1, failed: 2 })).toEqual([
      { message: 'Marked Paige as not coming in (2026-09-28). Removed 1 schedule block for the day.', tone: 'success' },
      { message: 'Salary sync: no pay config', tone: 'warning' },
      { message: '2 schedule blocks could not be removed; please remove manually.', tone: 'warning' },
    ])
  })
})

describe('ncnsResultToasts', () => {
  const base = {
    personName: 'Paige',
    workDateYmd: '2026-09-28',
    rejectedCount: 0,
    hadApprovedSessions: false,
    removed: 0,
    failed: 0,
    timeOff: { ok: true as const, alreadyMarked: false },
  }

  it('says the incident is recorded, and nothing else when nothing else happened', () => {
    expect(ncnsResultToasts(base)).toEqual([{ message: 'NCNS recorded for Paige (2026-09-28).', tone: 'success' }])
  })

  it('adds the rejected sessions, the unwound hours and the removed blocks, in that order', () => {
    expect(
      ncnsResultToasts({ ...base, rejectedCount: 2, hadApprovedSessions: true, removed: 3 })[0]?.message,
    ).toBe(
      'NCNS recorded for Paige (2026-09-28). 2 clock sessions rejected. Approved hours were unwound. Removed 3 schedule blocks.',
    )
  })

  it('counts one of each in the singular, and leaves "for the day" to the other flow', () => {
    expect(ncnsResultToasts({ ...base, rejectedCount: 1, removed: 1 })[0]?.message).toBe(
      'NCNS recorded for Paige (2026-09-28). 1 clock session rejected. Removed 1 schedule block.',
    )
  })

  it('still confirms the incident when the day-off marking failed, and says which one is on record', () => {
    expect(ncnsResultToasts({ ...base, timeOff: { ok: false, message: 'Not allowed' } })).toEqual([
      { message: 'NCNS recorded for Paige (2026-09-28).', tone: 'success' },
      { message: 'Day-off marking failed: Not allowed (the incident is recorded).', tone: 'warning' },
    ])
  })

  it('warns that the day already had time off', () => {
    expect(ncnsResultToasts({ ...base, timeOff: { ok: true, alreadyMarked: true } })[1]).toEqual({
      message: 'Paige already had time off recorded for the day.',
      tone: 'warning',
    })
  })

  it('raises the salary sync warning only when the day-off marking was written', () => {
    expect(
      ncnsResultToasts({ ...base, timeOff: { ok: true, alreadyMarked: false, syncWarning: 'no pay config' } })[1],
    ).toEqual({ message: 'Salary sync: no pay config', tone: 'warning' })
    expect(
      ncnsResultToasts({ ...base, timeOff: { ok: true, alreadyMarked: true, syncWarning: 'no pay config' } }),
    ).toHaveLength(2)
  })

  it('ends with the blocks that would not go', () => {
    const toasts = ncnsResultToasts({ ...base, failed: 1, timeOff: { ok: false, message: 'Not allowed' } })
    expect(toasts.map((t) => t.tone)).toEqual(['success', 'warning', 'warning'])
    expect(toasts[2]?.message).toBe('1 schedule block could not be removed; please remove manually.')
  })
})
