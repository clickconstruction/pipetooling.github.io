import { describe, expect, it } from 'vitest'
import { moveRowById } from './jobFormReorder'

const rows = [
  { id: 'a', name: 'Rough In' },
  { id: 'b', name: 'Top Out' },
  { id: 'c', name: 'Trim Set' },
]

describe('moveRowById', () => {
  it('moves a middle row up', () => {
    expect(moveRowById(rows, 'b', 'up').map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  it('moves a middle row down', () => {
    expect(moveRowById(rows, 'b', 'down').map((r) => r.id)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op (same reference) moving the first row up', () => {
    expect(moveRowById(rows, 'a', 'up')).toBe(rows)
  })

  it('is a no-op (same reference) moving the last row down', () => {
    expect(moveRowById(rows, 'c', 'down')).toBe(rows)
  })

  it('is a no-op (same reference) for an unknown id', () => {
    expect(moveRowById(rows, 'nope', 'up')).toBe(rows)
  })

  it('is a no-op on a single-row list', () => {
    const one = [{ id: 'a' }]
    expect(moveRowById(one, 'a', 'up')).toBe(one)
    expect(moveRowById(one, 'a', 'down')).toBe(one)
  })

  it('does not mutate the input array', () => {
    const before = rows.map((r) => r.id)
    moveRowById(rows, 'b', 'down')
    expect(rows.map((r) => r.id)).toEqual(before)
  })
})
