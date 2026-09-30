import { describe, expect, it } from 'vitest'
import { effectiveSolveScope, sameSolveScope, scopeWorkbenchRows, solveScopeKey, solveScopeLabel } from './workbenchSolveScope'

const tags = ['Break room']
const rows = [
  { id: 'a', rowCost: 600, group_tag: null },
  { id: 'b', rowCost: 200, group_tag: 'Kitchen' },
  { id: 'c', rowCost: 200, group_tag: 'break room' },
  { id: 'd', rowCost: 0, group_tag: 'Break Room' },
]

describe('workbenchSolveScope', () => {
  it('base keeps every row outside an alternate and its share of the overhead', () => {
    const s = scopeWorkbenchRows(rows, 'base', tags, 100)
    expect(s.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(s.fixtureCost).toBe(800)
    expect(s.overhead).toBe(80)
    expect(s.scope).toBe('base')
  })
  it('an alternate takes only its rows (spelling and case aside) and its share', () => {
    const s = scopeWorkbenchRows(rows, { alternate: 'BREAK ROOM' }, tags, 100)
    expect(s.rows.map((r) => r.id)).toEqual(['c', 'd'])
    expect(s.overhead).toBe(20)
    expect(s.scope).toEqual({ alternate: 'break room' })
  })
  it('whole takes everything; a bid without alternates is always whole', () => {
    expect(scopeWorkbenchRows(rows, 'whole', tags, 100)).toMatchObject({ overhead: 100, fixtureCost: 1000 })
    expect(scopeWorkbenchRows(rows, 'base', [], 100)).toMatchObject({ scope: 'whole', overhead: 100 })
    expect(effectiveSolveScope('base', ['Roof'], rows)).toBe('whole')
  })
  it('an alternate the bid no longer has falls back to the base', () => {
    expect(effectiveSolveScope({ alternate: 'roof' }, tags, rows)).toBe('base')
  })
  it('no fixture cost at all → the whole overhead stays on the scope', () => {
    expect(scopeWorkbenchRows([{ id: 'x', rowCost: 0, group_tag: null }, { id: 'y', rowCost: 0, group_tag: 'Break room' }], 'base', tags, 50).overhead).toBe(50)
  })
  it('keys, equality and labels', () => {
    expect(solveScopeKey({ alternate: 'break room' })).toBe('alt:break room')
    expect(sameSolveScope('base', 'base')).toBe(true)
    expect(sameSolveScope('base', { alternate: 'x' })).toBe(false)
    expect(solveScopeLabel('base')).toBe('Base')
    expect(solveScopeLabel('whole')).toBe('Whole bid')
    expect(solveScopeLabel({ alternate: 'break room' }, new Map([['break room', 'Break room']]))).toBe('+ Break room')
    expect(solveScopeLabel({ alternate: 'break room' })).toBe('+ break room')
  })
})
