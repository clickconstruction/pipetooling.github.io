import { describe, expect, it } from 'vitest'
import { activeRosterOnly, isActiveRosterExternal, isActiveRosterPerson } from './activeRoster'

const human = { id: 'u-1', name: 'Jessica White', role: 'assistant', archived_at: null, is_digital_twin: false }
const twin = { id: 'u-2', name: 'Twin Estimator 1', role: 'estimator', archived_at: null, is_digital_twin: true }
const archived = { id: 'u-3', name: 'delete', role: 'helpers', archived_at: '2026-05-01T00:00:00Z', is_digital_twin: false }
const mergeKeep = { id: 'u-4', name: 'Merge Test keep', role: 'helpers', archived_at: '2026-06-01T00:00:00Z', is_digital_twin: false }
const devTest = { id: 'u-5', name: 'test', role: 'dev', archived_at: null, is_digital_twin: false }
const owner = { id: 'u-6', name: 'Robert', role: 'dev', archived_at: null, is_digital_twin: false }

describe('isActiveRosterPerson', () => {
  it('keeps a live human account', () => {
    expect(isActiveRosterPerson(human)).toBe(true)
  })

  it('drops digital twins on every human surface, even when the surface keeps dev or archived rows', () => {
    expect(isActiveRosterPerson(twin)).toBe(false)
    expect(isActiveRosterPerson(twin, { includeDev: true, includeArchived: true })).toBe(false)
    expect(isActiveRosterPerson({ ...twin, archived_at: '2026-01-01T00:00:00Z' }, { includeArchived: true })).toBe(false)
  })

  it('drops archived accounts unless the surface folds them itself', () => {
    expect(isActiveRosterPerson(archived)).toBe(false)
    expect(isActiveRosterPerson(mergeKeep)).toBe(false)
    expect(isActiveRosterPerson(archived, { includeArchived: true })).toBe(true)
  })

  it('dev accounts are dev-viewer-only by default (the `test` fixture convention)', () => {
    expect(isActiveRosterPerson(devTest)).toBe(false)
    expect(isActiveRosterPerson(owner)).toBe(false)
    expect(isActiveRosterPerson(devTest, { includeDev: true })).toBe(true)
    expect(isActiveRosterPerson(owner, { includeDev: true })).toBe(true)
  })

  it('treats a row without the twin column as human (fail-soft for partial selects)', () => {
    expect(isActiveRosterPerson({ archived_at: null, role: 'assistant' })).toBe(true)
    expect(isActiveRosterPerson({ archived_at: null, role: 'assistant', is_digital_twin: null })).toBe(true)
  })
})

describe('activeRosterOnly', () => {
  const all = [human, twin, archived, mergeKeep, devTest, owner]

  it('is the crew-picker roster for a non-dev viewer: humans only', () => {
    expect(activeRosterOnly(all).map((r) => r.name)).toEqual(['Jessica White'])
  })

  it('is the crew-picker roster for a dev viewer: humans plus dev rows, never twins or archived', () => {
    expect(activeRosterOnly(all, { includeDev: true }).map((r) => r.name)).toEqual(['Jessica White', 'test', 'Robert'])
  })

  it('is the Person-rail roster when the rail folds archived rows itself: order preserved, twins still out', () => {
    expect(activeRosterOnly(all, { includeDev: true, includeArchived: true }).map((r) => r.name)).toEqual([
      'Jessica White',
      'delete',
      'Merge Test keep',
      'test',
      'Robert',
    ])
  })
})

describe('isActiveRosterExternal', () => {
  it('external roster rows have no twin flag; archived is the only exclusion', () => {
    expect(isActiveRosterExternal({ archived_at: null })).toBe(true)
    expect(isActiveRosterExternal({})).toBe(true)
    expect(isActiveRosterExternal({ archived_at: '2026-05-01T00:00:00Z' })).toBe(false)
  })
})
