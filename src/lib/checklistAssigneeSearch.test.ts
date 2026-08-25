import { describe, expect, it } from 'vitest'
import { matchesPersonQuery, singleEnterTarget, visibleAssigneeRows } from './checklistAssigneeSearch'

const people = [
  { id: 'r', name: 'Robert', email: 'robert@x.com' },
  { id: 'm1', name: 'Malachi', email: 'malachi@x.com' },
  { id: 'm2', name: 'Micah', email: 'micah@x.com' },
  { id: 'd', name: 'Darren', email: 'darren@x.com' },
  { id: 'g', name: '', email: 'grace@x.com' },
]

describe('matchesPersonQuery', () => {
  it('matches the displayed label case-insensitively, trimming the query', () => {
    expect(matchesPersonQuery(people[3]!, 'DAR')).toBe(true)
    expect(matchesPersonQuery(people[4]!, ' grace ')).toBe(true) // no name → email is the label
    expect(matchesPersonQuery(people[0]!, 'zzz')).toBe(false)
  })

  it('never matches a hidden email — "x.com" must not hit everyone on the domain', () => {
    expect(matchesPersonQuery(people[0]!, 'x.com')).toBe(false) // Robert displays his name
    expect(matchesPersonQuery(people[4]!, 'x.com')).toBe(true) // nameless row displays the email
  })

  it('empty query matches everyone', () => {
    expect(people.every((p) => matchesPersonQuery(p, ''))).toBe(true)
    expect(people.every((p) => matchesPersonQuery(p, '   '))).toBe(true)
  })
})

describe('visibleAssigneeRows', () => {
  it('keeps checked people visible even when they do not match, in original order', () => {
    const rows = visibleAssigneeRows(people, 'ma', { r: true })
    expect(rows.map((r) => r.id)).toEqual(['r', 'm1'])
  })

  it('unchecked entries with checked=false are treated as unchecked', () => {
    const rows = visibleAssigneeRows(people, 'ma', { r: false })
    expect(rows.map((r) => r.id)).toEqual(['m1'])
  })

  it('empty query returns everyone', () => {
    expect(visibleAssigneeRows(people, '', {})).toHaveLength(people.length)
  })
})

describe('singleEnterTarget', () => {
  it('returns the person only when exactly one UNCHECKED person matches', () => {
    expect(singleEnterTarget(people, 'dar', {})?.id).toBe('d')
    expect(singleEnterTarget(people, 'a', {})).toBeNull() // Malachi, Micah, Darren… — ambiguous
  })

  it('a checked match does not count — Enter never un-adds', () => {
    expect(singleEnterTarget(people, 'dar', { d: true })).toBeNull()
  })

  it('checked non-matches do not block the shortcut', () => {
    expect(singleEnterTarget(people, 'dar', { r: true })?.id).toBe('d')
  })

  it('empty query has no target', () => {
    expect(singleEnterTarget(people, '  ', {})).toBeNull()
  })
})
