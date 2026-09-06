import { describe, expect, it } from 'vitest'
import { nextStageToOffer } from './offerNextStage'

const W = [
  { id: 'w-rough', fixture_id: 'f1', offered_to_gc: true, sequence: 1, name: 'Rough-in' },
  { id: 'w-top', fixture_id: 'f2', offered_to_gc: false, sequence: 2, name: 'Top-out' },
  { id: 'w-trim', fixture_id: 'f3', offered_to_gc: false, sequence: 3, name: 'Trim & final' },
]

describe('nextStageToOffer', () => {
  it('picks the next not-yet-offered window after the current one, by line-item order', () => {
    expect(nextStageToOffer(W, 'w-rough')?.id).toBe('w-top')
    expect(nextStageToOffer(W, 'w-top')?.id).toBe('w-trim')
    expect(nextStageToOffer(W, 'w-trim')).toBeNull()
  })
  it('skips windows already offered and copes with no current window', () => {
    expect(nextStageToOffer([{ ...W[1]!, offered_to_gc: true }, W[2]!], 'w-rough')?.id).toBe('w-trim')
    expect(nextStageToOffer(W, null)?.id).toBe('w-top')
    expect(nextStageToOffer([], 'w-rough')).toBeNull()
  })
})
