import { describe, it, expect } from 'vitest'
import { assigneePersonIdsForNames } from './assigneePersonIds'

const people = [
  { id: 'p-jesse', name: 'Jesse Ramirez', email: 'jesse@subs.test' },
  { id: 'p-mario', name: 'Mario Lozano', email: null },
  { id: 'p-rob', name: 'Robert D (roster)', email: 'rob@office.test' },
]
const users = [
  { name: 'Robert Douglas', email: 'rob@office.test' },
  { name: 'No Person Row', email: 'ghost@office.test' },
]

describe('assigneePersonIdsForNames', () => {
  it('matches people rows by trimmed name', () => {
    expect(assigneePersonIdsForNames(['Mario Lozano', ' Jesse Ramirez '], people, users)).toEqual([
      'p-mario',
      'p-jesse',
    ])
  })

  it('matches account users via their email-linked people row', () => {
    expect(assigneePersonIdsForNames(['Robert Douglas'], people, users)).toEqual(['p-rob'])
  })

  it('skips names with no roster or user match, and users with no people row', () => {
    expect(assigneePersonIdsForNames(['Unknown Guy', 'No Person Row'], people, users)).toEqual([])
  })

  it('dedupes when two picker names resolve to the same person', () => {
    expect(
      assigneePersonIdsForNames(['Robert D (roster)', 'Robert Douglas'], people, users),
    ).toEqual(['p-rob'])
  })

  it('prefers the people-row name match over a same-named user', () => {
    const shadowUsers = [{ name: 'Mario Lozano', email: 'rob@office.test' }]
    expect(assigneePersonIdsForNames(['Mario Lozano'], people, shadowUsers)).toEqual(['p-mario'])
  })
})
