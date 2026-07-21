import { describe, expect, it } from 'vitest'
import {
  summarizeLinkedCopyApply,
  toggleLinkedCopyBlockSelection,
} from './scheduleDispatchLinkedCopy'

describe('toggleLinkedCopyBlockSelection', () => {
  it('adds and removes without mutating the input', () => {
    const base = new Set(['a'])
    const withB = toggleLinkedCopyBlockSelection(base, 'b')
    expect([...withB].sort()).toEqual(['a', 'b'])
    expect([...base]).toEqual(['a'])
    const withoutA = toggleLinkedCopyBlockSelection(withB, 'a')
    expect([...withoutA]).toEqual(['b'])
  })
})

describe('summarizeLinkedCopyApply', () => {
  it('all applied → success with singular/plural copy word', () => {
    expect(summarizeLinkedCopyApply([{ blockId: 'a', error: null }])).toMatchObject({
      applied: 1,
      skipped: 0,
      message: 'Applied 1 linked copy.',
      tone: 'success',
    })
    expect(
      summarizeLinkedCopyApply([
        { blockId: 'a', error: null },
        { blockId: 'b', error: null },
      ]).message,
    ).toBe('Applied 2 linked copies.')
  })

  it('mixed → info with both counts', () => {
    expect(
      summarizeLinkedCopyApply([
        { blockId: 'a', error: null },
        { blockId: 'b', error: 'overlap' },
        { blockId: 'c', error: 'already linked' },
      ]),
    ).toMatchObject({
      applied: 1,
      skipped: 2,
      message: 'Applied 1 linked copy · skipped 2 (overlap or already linked).',
      tone: 'info',
    })
  })

  it('none applied → error tone', () => {
    expect(summarizeLinkedCopyApply([{ blockId: 'a', error: 'overlap' }])).toMatchObject({
      applied: 0,
      skipped: 1,
      tone: 'error',
    })
  })
})
