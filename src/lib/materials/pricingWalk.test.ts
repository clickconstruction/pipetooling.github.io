import { describe, expect, it } from 'vitest'
import { answerWalk, currentKey, skipWalk, startWalk, undoWalk, walkEndWords, walkWords } from './pricingWalk'

const open = (...keys: string[]) => (key: string) => keys.includes(key)

describe('the pricing walk', () => {
  it('asks in the order fixed at the start', () => {
    const w = startWalk(['a', 'b', 'c'])
    expect(currentKey(w, open('a', 'b', 'c'))).toBe('a')
  })
  it('an answer and a skip both move on', () => {
    let w = startWalk(['a', 'b', 'c'])
    w = answerWalk(w, 'a')
    expect(currentKey(w, open('b', 'c'))).toBe('b')
    w = skipWalk(w, 'b')
    expect(currentKey(w, open('b', 'c'))).toBe('c')
    expect(w.answered).toEqual(['a'])
    expect(w.skipped).toEqual(['b'])
  })
  it('steps over a row that left the list by itself', () => {
    const w = startWalk(['a', 'b', 'c'])
    expect(currentKey(w, open('c'))).toBe('c')
  })
  it('ends when nothing ahead is open, even with skipped rows behind', () => {
    let w = startWalk(['a', 'b'])
    w = skipWalk(w, 'a')
    w = answerWalk(w, 'b')
    expect(currentKey(w, open('a'))).toBeNull()
    expect(walkEndWords(w, 1)).toBe('1 row priced. 1 row still has no price.')
    expect(walkEndWords(w, 0)).toBe('1 row priced.')
  })
  it('Undo returns to the row that was answered', () => {
    let w = startWalk(['a', 'b', 'c'])
    w = answerWalk(w, 'a')
    w = answerWalk(w, 'b')
    w = undoWalk(w, 'b')
    expect(currentKey(w, open('b', 'c'))).toBe('b')
    expect(w.answered).toEqual(['a'])
  })
  it('says where the walk is and what is left', () => {
    let w = startWalk(Array.from({ length: 88 }, (_, i) => `k${i}`))
    w = answerWalk(w, 'k0')
    w = answerWalk(w, 'k1')
    expect(walkWords(w, 'k2', 86, 1430)).toEqual({ where: 'Row 3 of 88', rest: '86 left · 1,430 pieces to go' })
  })
})
