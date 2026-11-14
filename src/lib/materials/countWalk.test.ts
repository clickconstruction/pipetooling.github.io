import { describe, expect, it } from 'vitest'
import { countWalkAt, countWalkCantFindWords, countWalkKeys } from './countWalk'

const line = (partKey: string, onHand: number, cannotFindSinceCount = 0) => ({ partKey, onHand, cannotFindSinceCount })

describe('countWalkKeys', () => {
  it('lists the lines with parts on hand, in the box’s order', () => {
    expect(countWalkKeys([line('a', 4), line('b', 0), line('c', 1)])).toEqual(['a', 'c'])
  })
  it('is empty for an empty box', () => {
    expect(countWalkKeys([])).toEqual([])
  })
  it('takes a line at none that carries a Can’t find, which only the office could clear (v2.7252)', () => {
    // B was pressed Can't find down to none. It is drawn in the box with its mark, so the walk visits it.
    expect(countWalkKeys([line('a', 4), line('b', 0, 3), line('c', 0)])).toEqual(['a', 'b'])
    // A box whose only line is such a one can be counted.
    expect(countWalkKeys([line('b', 0, 3)])).toEqual(['b'])
    expect(countWalkCantFindWords(3)).toBe("3 marked can't find. Your count clears the mark.")
    expect(countWalkCantFindWords(0)).toBe('')
  })
})

describe('countWalkAt', () => {
  const keys = ['a', 'b', 'c', 'd']

  it('a line counted to none does not move the walk past the next one', () => {
    // The person said A is gone: A now reads 0, and the walk goes to its second line, which is B.
    const after = [line('a', 0), line('b', 5), line('c', 2), line('d', 9)]
    expect(countWalkAt(keys, 1, after)).toEqual({ line: line('b', 5), index: 1 })
  })

  it('visits every line once when each is counted to none', () => {
    let lines = [line('a', 1), line('b', 1), line('c', 1), line('d', 1)]
    const seen: string[] = []
    for (let i = 0; i < keys.length; i += 1) {
      const at = countWalkAt(keys, i, lines)
      if (!at) break
      seen.push(at.line.partKey)
      // The count to none, as the screen's own filter would then read it: the emptied line may leave the list.
      lines = lines.filter((l) => l.partKey !== at.line.partKey)
    }
    expect(seen).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reads the line’s number fresh, so a press from another phone shows', () => {
    expect(countWalkAt(keys, 2, [line('a', 4), line('b', 5), line('c', 7), line('d', 9)])?.line.onHand).toBe(7)
  })

  it('passes over a line that left the box since the walk began', () => {
    expect(countWalkAt(keys, 1, [line('a', 4), line('c', 2), line('d', 9)])).toEqual({ line: line('c', 2), index: 2 })
  })

  it('ends when no line is left', () => {
    expect(countWalkAt(keys, 4, [line('a', 4)])).toBeNull()
    expect(countWalkAt(keys, 3, [line('a', 4)])).toBeNull()
    expect(countWalkAt([], 0, [line('a', 4)])).toBeNull()
  })
})
