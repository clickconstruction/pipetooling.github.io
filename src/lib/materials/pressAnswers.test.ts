/**
 * What taking presses back would do to the numbers: the ledger summed as it stands and without the
 * rows picked, a row whose removal moves nothing said so, and the words of the window's press.
 */
import { describe, expect, it } from 'vitest'
import type { Movement, MovementReason } from './onSite'
import { answerPressWords, isAnswerable, suggestedAnswer, takeBackPlan } from './pressAnswers'

let seq = 0
function row(p: { id?: string; reason: MovementReason; part?: string; qty: number; from?: string | null; to?: string | null; at: string }): Movement {
  seq += 1
  return { id: p.id ?? `m${seq}`, jobId: 'j1', partId: null, partName: p.part ?? '2" PVC 90', manufacturer: null, quantity: p.qty, reason: p.reason, fromContainerId: p.from ?? null, toContainerId: p.to ?? null, note: '', byUserId: null, byName: 'Sam R.', at: p.at, source: null, itemId: null }
}

describe('takeBackPlan', () => {
  const ledger = [
    row({ id: 'in', reason: 'delivered', qty: 40, to: 'g22', at: '2026-11-16T10:00:00Z' }),
    row({ id: 'take', reason: 'taken', qty: 10, from: 'g22', at: '2026-11-17T10:00:00Z' }),
    row({ id: 'count', reason: 'counted', qty: 5, from: 'g22', at: '2026-11-18T10:00:00Z' }),
    row({ id: 'use', reason: 'used', qty: 1, from: 'g22', at: '2026-11-18T11:00:00Z' }),
    row({ id: 'pex', reason: 'taken', part: '1/2" PEX', qty: 16, from: 'g40', at: '2026-11-18T12:00:00Z' }),
  ]

  it('takes a count back and the line reads what the presses before it add up to', () => {
    const plan = takeBackPlan(ledger, ['count'])
    expect(plan.changes).toEqual([{ containerId: 'g22', partKey: 'text:2" pvc 90', partName: '2" PVC 90', before: 4, after: 29 }])
    expect(plan.noEffect).toEqual([])
    expect(plan.notFound).toEqual([])
  })

  it('says a press under a later count moves no number', () => {
    const plan = takeBackPlan(ledger, ['take'])
    expect(plan.changes).toEqual([])
    expect(plan.noEffect).toEqual(['take'])
  })

  it('adds up several picked rows across boxes, and names a row it cannot find', () => {
    const plan = takeBackPlan(ledger, ['use', 'pex', 'gone'])
    expect(plan.changes.map((c) => [c.containerId, c.before, c.after])).toEqual([['g40', -16, 0], ['g22', 4, 5]])
    expect(plan.noEffect).toEqual([])
    expect(plan.notFound).toEqual(['gone'])
  })

  it('reads two rows that only move a number together', () => {
    // The take alone is under the count. With the count gone too, both show in the one line.
    const plan = takeBackPlan(ledger, ['take', 'count'])
    expect(plan.changes).toEqual([{ containerId: 'g22', partKey: 'text:2" pvc 90', partName: '2" PVC 90', before: 4, after: 39 }])
    expect(plan.noEffect).toEqual(['take'])
  })
})

describe('the window’s words', () => {
  it('offers a second count for a count, a mark for material that left, a take-back for a part added', () => {
    expect(suggestedAnswer('counted')).toBe('second_count')
    expect(suggestedAnswer('taken')).toBe('mark')
    expect(suggestedAnswer('used')).toBe('mark')
    expect(suggestedAnswer('delivered')).toBe('take_back')
    expect(suggestedAnswer('box_retired')).toBe('leave')
    expect(isAnswerable('taken')).toBe(true)
    expect(isAnswerable('box_moved')).toBe(false)
    expect(isAnswerable('answer_removed')).toBe(false)
  })

  it('names each act with its count on the press', () => {
    expect(answerPressWords({ takeBack: 1, mark: 2, secondCount: 1 })).toBe('Take back 1, mark 2, ask for 1 count')
    expect(answerPressWords({ takeBack: 0, mark: 3, secondCount: 0 })).toBe('Mark 3')
    expect(answerPressWords({ takeBack: 0, mark: 0, secondCount: 2 })).toBe('Ask for 2 counts')
    expect(answerPressWords({ takeBack: 0, mark: 0, secondCount: 0 })).toBeNull()
  })
})
