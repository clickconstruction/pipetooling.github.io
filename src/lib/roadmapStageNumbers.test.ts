import { describe, expect, it } from 'vitest'
import { stageNumbersByGroupId } from './roadmapStageNumbers'

describe('stageNumbersByGroupId', () => {
  it('numbers stages 1..N in list order', () => {
    const m = stageNumbersByGroupId([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(m.get('a')).toBe(1)
    expect(m.get('b')).toBe(2)
    expect(m.get('c')).toBe(3)
    expect(m.size).toBe(3)
  })
  it('empty list -> empty map', () => {
    expect(stageNumbersByGroupId([]).size).toBe(0)
  })
})
