import { describe, expect, it } from 'vitest'
import { summarizeMultiCellAddResult } from './multiCellAdd'

const none = { added: 0, skippedOverlap: 0, failed: 0 }

describe('summarizeMultiCellAddResult', () => {
  it('counts the blocks it added, one or many', () => {
    expect(summarizeMultiCellAddResult({ ...none, added: 1 })).toEqual({ message: 'Added 1 block.', tone: 'success' })
    expect(summarizeMultiCellAddResult({ ...none, added: 4 })).toEqual({ message: 'Added 4 blocks.', tone: 'success' })
  })

  it('names all three outcomes in order: added, skipped, failed', () => {
    expect(summarizeMultiCellAddResult({ added: 3, skippedOverlap: 1, failed: 2 })).toEqual({
      message: 'Added 3 blocks. Skipped 1 (overlap). 2 failed.',
      tone: 'success',
    })
  })

  it('reads as a success whenever anything was added, whatever else happened', () => {
    expect(summarizeMultiCellAddResult({ added: 1, skippedOverlap: 0, failed: 5 })).toEqual({
      message: 'Added 1 block. 5 failed.',
      tone: 'success',
    })
    expect(summarizeMultiCellAddResult({ added: 1, skippedOverlap: 5, failed: 0 })).toEqual({
      message: 'Added 1 block. Skipped 5 (overlap).',
      tone: 'success',
    })
  })

  it('reads as an error when nothing was added and something failed', () => {
    expect(summarizeMultiCellAddResult({ ...none, failed: 2 })).toEqual({ message: '2 failed.', tone: 'error' })
    expect(summarizeMultiCellAddResult({ added: 0, skippedOverlap: 3, failed: 1 })).toEqual({
      message: 'Skipped 3 (overlap). 1 failed.',
      tone: 'error',
    })
  })

  it('reads as plain information when every cell was skipped', () => {
    expect(summarizeMultiCellAddResult({ ...none, skippedOverlap: 2 })).toEqual({
      message: 'Skipped 2 (overlap).',
      tone: 'info',
    })
  })

  it('says "No blocks added." when nothing happened at all', () => {
    expect(summarizeMultiCellAddResult(none)).toEqual({ message: 'No blocks added.', tone: 'info' })
  })

  it('does not pluralize the skipped or failed counts', () => {
    expect(summarizeMultiCellAddResult({ added: 0, skippedOverlap: 1, failed: 1 }).message).toBe(
      'Skipped 1 (overlap). 1 failed.',
    )
  })
})
