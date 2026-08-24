import { describe, expect, it } from 'vitest'
import { buildCrewViews, crewChipState, crewRosterDiff, normalizePersonName } from './checklistCrewTags'

const users = [
  { id: 'u-rob', name: 'Robert' },
  { id: 'u-abe', name: 'Abraham' },
  { id: 'u-beh', name: '  Behar ' },
  { id: 'u-non', name: null },
]

describe('normalizePersonName', () => {
  it('trims and lowercases; null/undefined become empty', () => {
    expect(normalizePersonName('  Robert ')).toBe('robert')
    expect(normalizePersonName(null)).toBe('')
    expect(normalizePersonName(undefined)).toBe('')
  })
})

describe('buildCrewViews', () => {
  const teams = [
    { id: 't2', name: 'Office', sequence_order: 2 },
    { id: 't1', name: 'Farm crew', sequence_order: 1 },
  ]
  const members = [
    { team_id: 't1', person_name: 'robert' },
    { team_id: 't1', person_name: 'Behar' },
    { team_id: 't1', person_name: 'No Login Guy' },
    { team_id: 't1', person_name: 'ROBERT' }, // duplicate after normalization
    { team_id: 't2', person_name: 'Abraham' },
  ]

  it('orders by sequence_order and maps members to user ids by normalized name', () => {
    const views = buildCrewViews(teams, members, users)
    expect(views.map((v) => v.name)).toEqual(['Farm crew', 'Office'])
    expect(views[0]!.memberUserIds).toEqual(['u-rob', 'u-beh'])
    expect(views[1]!.memberUserIds).toEqual(['u-abe'])
  })

  it('counts unmatched members and keeps verbatim names for writes', () => {
    const farm = buildCrewViews(teams, members, users)[0]!
    expect(farm.unmatchedCount).toBe(1)
    expect(farm.memberNames).toEqual(['robert', 'Behar', 'No Login Guy', 'ROBERT'])
  })

  it('a team with no members maps to an empty crew', () => {
    const views = buildCrewViews([{ id: 't9', name: 'Empty', sequence_order: 9 }], [], users)
    expect(views[0]!.memberUserIds).toEqual([])
    expect(views[0]!.unmatchedCount).toBe(0)
  })
})

describe('crewChipState', () => {
  it('is none for an empty crew regardless of checks', () => {
    expect(crewChipState([], { 'u-rob': true })).toBe('none')
  })
  it('walks none → some → all as members get checked', () => {
    const ids = ['u-rob', 'u-abe']
    expect(crewChipState(ids, {})).toBe('none')
    expect(crewChipState(ids, { 'u-rob': true })).toBe('some')
    expect(crewChipState(ids, { 'u-rob': true, 'u-abe': true })).toBe('all')
    expect(crewChipState(ids, { 'u-rob': true, 'u-abe': false })).toBe('some')
  })
})

describe('crewRosterDiff', () => {
  it('adds newly selected users and removes deselected known users', () => {
    const { namesToAdd, namesToRemove } = crewRosterDiff(['Robert'], ['u-rob', 'u-abe'], users)
    expect(namesToAdd).toEqual(['Abraham'])
    expect(namesToRemove).toEqual([])
    const removal = crewRosterDiff(['Robert', 'Abraham'], ['u-rob'], users)
    expect(removal.namesToAdd).toEqual([])
    expect(removal.namesToRemove).toEqual(['Abraham'])
  })

  it('never removes members whose name matches no user (no login)', () => {
    const { namesToAdd, namesToRemove } = crewRosterDiff(['No Login Guy', 'Robert'], [], users)
    expect(namesToRemove).toEqual(['Robert'])
    expect(namesToAdd).toEqual([])
  })

  it('matches names case/whitespace-insensitively in both directions', () => {
    // 'behar' on the roster ≈ user '  Behar ' — selecting u-beh is a no-op.
    const { namesToAdd, namesToRemove } = crewRosterDiff(['behar'], ['u-beh'], users)
    expect(namesToAdd).toEqual([])
    expect(namesToRemove).toEqual([])
  })

  it('skips selected users with empty names (nothing valid to write)', () => {
    const { namesToAdd } = crewRosterDiff([], ['u-non'], users)
    expect(namesToAdd).toEqual([])
  })
})
