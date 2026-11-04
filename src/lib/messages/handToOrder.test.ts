import { describe, expect, it } from 'vitest'
import { filterHandTo, handToGroupOf, handToMatches, nextLit, orderHandTo } from './handToOrder'

const TEAM = [
  { id: 'w', name: 'William', role: 'dev' },
  { id: 'ta', name: 'Taunya', role: 'assistant' },
  { id: 'm', name: 'Malachi', role: 'master_technician' },
  { id: 'we', name: 'Wendi', role: 'estimator' },
  { id: 'g', name: 'Grace', role: 'assistant' },
  { id: 't', name: 'test', role: 'dev' },
  { id: 'c', name: 'Cal', role: 'controller' },
  { id: 's', name: 'Sal Super', role: 'superintendent' },
]

describe('orderHandTo', () => {
  it('puts the office and the estimators first, then the owner and devs, then everyone else, each by name', () => {
    const groups = orderHandTo(TEAM)
    expect(groups.map((g) => g.heading)).toEqual(['Office and estimators', 'Owner and devs', 'Everyone else'])
    expect(groups.map((g) => g.people.map((p) => p.name))).toEqual([
      ['Cal', 'Grace', 'Taunya', 'Wendi'],
      ['Malachi', 'test', 'William'],
      ['Sal Super'],
    ])
  })

  it('leaves an empty group out', () => {
    const groups = orderHandTo(TEAM.filter((t) => t.role !== 'superintendent'))
    expect(groups.map((g) => g.key)).toEqual(['office', 'ownerDev'])
    expect(orderHandTo([])).toEqual([])
  })

  it('orders by role, never by who holds the most waiting', () => {
    // Taunya holds the most on the real team; she still sits by name inside her group.
    const names = orderHandTo(TEAM)[0]!.people.map((p) => p.name)
    expect(names.indexOf('Grace')).toBeLessThan(names.indexOf('Taunya'))
  })

  it('names each role its group', () => {
    expect(['assistant', 'controller', 'estimator'].map(handToGroupOf)).toEqual(['office', 'office', 'office'])
    expect(['master_technician', 'dev'].map(handToGroupOf)).toEqual(['ownerDev', 'ownerDev'])
    expect(['superintendent', 'technician', ''].map(handToGroupOf)).toEqual(['others', 'others', 'others'])
  })
})

describe('handToMatches and filterHandTo', () => {
  it('matches any part of the name, case-blind, and everything when nothing is typed', () => {
    expect(handToMatches('Taunya', 'tau')).toBe(true)
    expect(handToMatches('Taunya', 'UNY')).toBe(true)
    expect(handToMatches('Taunya', 'tony')).toBe(false)
    expect(handToMatches('Taunya', '')).toBe(true)
    expect(handToMatches('Taunya', '   ')).toBe(true)
  })

  it('keeps the groups in order with only the people the run lands on, and drops a group with nobody', () => {
    const groups = orderHandTo(TEAM)
    expect(filterHandTo(groups, 'w').map((g) => [g.heading, g.people.map((p) => p.name)])).toEqual([
      ['Office and estimators', ['Wendi']],
      ['Owner and devs', ['William']],
    ])
    expect(filterHandTo(groups, 'zz')).toEqual([])
    expect(filterHandTo(groups, '')).toEqual(groups)
  })
})

describe('nextLit', () => {
  it('walks down and up and wraps at both ends', () => {
    expect(nextLit(0, 3, 1)).toBe(1)
    expect(nextLit(2, 3, 1)).toBe(0)
    expect(nextLit(0, 3, -1)).toBe(2)
    expect(nextLit(1, 3, -1)).toBe(0)
  })

  it('lights the first on down and the last on up from nowhere, and nothing with no rows', () => {
    expect(nextLit(-1, 3, 1)).toBe(0)
    expect(nextLit(-1, 3, -1)).toBe(2)
    expect(nextLit(0, 0, 1)).toBe(-1)
  })
})
