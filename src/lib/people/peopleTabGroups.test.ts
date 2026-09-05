import { describe, expect, it } from 'vitest'
import {
  PEOPLE_TABS,
  PEOPLE_TAB_GROUPS,
  PEOPLE_TAB_LABELS,
  groupOfTab,
  isPeopleTab,
  landingViewForGroup,
  parseGroupMemory,
  rememberTab,
  visibleTabGroups,
  type PeopleTab,
} from './peopleTabGroups'

const ALL_VISIBLE = Object.fromEntries(PEOPLE_TABS.map((t) => [t, true])) as Record<PeopleTab, boolean>

describe('peopleTabGroups', () => {
  it('every tab lives in exactly one group, and the groups cover every tab', () => {
    const seen = new Map<string, number>()
    for (const g of PEOPLE_TAB_GROUPS) for (const v of g.views) seen.set(v, (seen.get(v) ?? 0) + 1)
    expect([...seen.keys()].sort()).toEqual([...PEOPLE_TABS].sort())
    expect([...seen.values()].every((n) => n === 1)).toBe(true)
    expect(Object.keys(PEOPLE_TAB_LABELS).sort()).toEqual([...PEOPLE_TABS].sort())
    expect(PEOPLE_TABS.length).toBe(18)
  })

  it('places the owner-picked views: Person under People, Feedback alone at the top level', () => {
    expect(groupOfTab('person')).toBe('people')
    expect(groupOfTab('feedback')).toBe('feedback')
    expect(groupOfTab('scoreboard')).toBe('review')
    expect(groupOfTab('activity')).toBe('review')
    expect(groupOfTab('hr')).toBe('paperwork')
    expect(groupOfTab('overhead')).toBe('pay')
    expect(groupOfTab('housing')).toBe('fleet')
    expect(PEOPLE_TAB_GROUPS.map((g) => g.label)).toEqual(['People', 'Pay', 'Paperwork', 'Fleet & Housing', 'Review', 'Feedback'])
  })

  it('a dev sees six groups with all eighteen views', () => {
    const groups = visibleTabGroups(ALL_VISIBLE)
    expect(groups.map((g) => g.id)).toEqual(['people', 'pay', 'paperwork', 'fleet', 'review', 'feedback'])
    expect(groups.flatMap((g) => g.views).length).toBe(18)
  })

  it('the office sees four groups: a group with no visible view is dropped', () => {
    // Controller: everything but the dev-only views.
    const controller = { ...ALL_VISIBLE, hr: false, review: false, scoreboard: false, feedback: false, activity: false }
    const groups = visibleTabGroups(controller)
    expect(groups.map((g) => g.id)).toEqual(['people', 'pay', 'paperwork', 'fleet'])
    expect(groups.find((g) => g.id === 'paperwork')?.views).toEqual(['contracts', 'licenses', 'writeups'])
  })

  it('a master who is not pay-approved sees People and Paperwork only, with the views they had', () => {
    const master: Partial<Record<PeopleTab, boolean>> = { users: true, subs: true, person: true, contracts: true, writeups: true }
    const groups = visibleTabGroups(master)
    expect(groups.map((g) => g.id)).toEqual(['people', 'paperwork'])
    expect(groups[1]?.views).toEqual(['contracts', 'writeups'])
  })

  it('an assistant gets a one-view Pay group (Hours) and a one-view Fleet group (Vehicles)', () => {
    const assistant: Partial<Record<PeopleTab, boolean>> = {
      users: true, subs: true, person: true, hours: true, vehicles: true, licenses: true, contracts: true, writeups: true,
    }
    const groups = visibleTabGroups(assistant)
    expect(groups.find((g) => g.id === 'pay')?.views).toEqual(['hours'])
    expect(groups.find((g) => g.id === 'fleet')?.views).toEqual(['vehicles'])
  })

  it('landing on a group uses the remembered view when still visible, else the first visible view', () => {
    const groups = visibleTabGroups(ALL_VISIBLE)
    const people = groups.find((g) => g.id === 'people')!
    const pay = groups.find((g) => g.id === 'pay')!
    expect(landingViewForGroup(people, {})).toBe('users')
    expect(landingViewForGroup(pay, { pay: 'offsets' })).toBe('offsets')
    // Remembered Overhead, but this user lost the Overhead view → first visible.
    const payNoOverhead = visibleTabGroups({ ...ALL_VISIBLE, overhead: false }).find((g) => g.id === 'pay')
    expect(payNoOverhead).toBeDefined()
    expect(landingViewForGroup(payNoOverhead!, { pay: 'overhead' })).toBe('hours')
  })

  it('memory parsing drops junk, unknown views, and views filed under the wrong group', () => {
    expect(parseGroupMemory(null)).toEqual({})
    expect(parseGroupMemory('not json')).toEqual({})
    expect(parseGroupMemory('[1,2]')).toEqual({})
    expect(parseGroupMemory(JSON.stringify({ pay: 'pay_stubs', people: 'hours', paperwork: 'bogus', nope: 'users' }))).toEqual({
      pay: 'pay_stubs',
    })
  })

  it('rememberTab files the tab under its group and returns the same object when nothing changed', () => {
    const m0 = {}
    const m1 = rememberTab(m0, 'writeups')
    expect(m1).toEqual({ paperwork: 'writeups' })
    expect(rememberTab(m1, 'writeups')).toBe(m1)
    expect(rememberTab(m1, 'scoreboard')).toEqual({ paperwork: 'writeups', review: 'scoreboard' })
  })

  it('isPeopleTab accepts the eighteen keys and nothing else', () => {
    for (const t of PEOPLE_TABS) expect(isPeopleTab(t)).toBe(true)
    expect(isPeopleTab('teams')).toBe(false)
    expect(isPeopleTab('team_costs')).toBe(false)
    expect(isPeopleTab(null)).toBe(false)
    expect(isPeopleTab('toString')).toBe(false)
  })
})
