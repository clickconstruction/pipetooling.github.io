import { describe, expect, it } from 'vitest'
import { nextStageToShare, type NextStageCandidate } from './offerNextStage'

const F: NextStageCandidate[] = [
  { id: 'f-rough', name: 'Rough-in', sequence: 1, kind: 'order', shared: true, windowId: 'w-rough' },
  { id: 'f-top', name: 'Top-out', sequence: 2, kind: 'order', shared: false, windowId: 'w-top' },
  { id: 'f-co', name: 'Relocate water heater', sequence: 3, kind: 'any', shared: false, windowId: null },
  { id: 'f-trim', name: 'Trim & final', sequence: 4, kind: 'order', shared: false, windowId: null },
  { id: 'f-permit', name: 'Permit', sequence: 5, kind: null, shared: false, windowId: null },
]

describe('nextStageToShare', () => {
  it('picks the next not-yet-shared Order row after the current one, by line-item order — never an Any or plain row', () => {
    expect(nextStageToShare(F, 'f-rough')?.id).toBe('f-top')
    expect(nextStageToShare(F, 'f-top')?.id).toBe('f-trim')
    expect(nextStageToShare(F, 'f-trim')).toBeNull()
  })
  it('skips rows already shared and copes with no current row', () => {
    expect(nextStageToShare(F.map((f) => (f.id === 'f-top' ? { ...f, shared: true } : f)), 'f-rough')?.id).toBe('f-trim')
    expect(nextStageToShare(F, null)?.id).toBe('f-top')
    expect(nextStageToShare([], 'f-rough')).toBeNull()
  })
})
