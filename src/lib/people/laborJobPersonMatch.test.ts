import { describe, expect, it } from 'vitest'
import { laborJobMatchesPerson, splitAssignedToNames } from './laborJobPersonMatch'

describe('splitAssignedToNames', () => {
  it('splits the delimited multi-name column into trimmed names', () => {
    expect(splitAssignedToNames('Alice Ames | Bob Brown | Cal Cruz')).toEqual([
      'Alice Ames',
      'Bob Brown',
      'Cal Cruz',
    ])
  })

  it('handles a single name with stray whitespace', () => {
    expect(splitAssignedToNames('  Alice Ames  ')).toEqual(['Alice Ames'])
  })

  it('drops empty segments from doubled/trailing delimiters', () => {
    expect(splitAssignedToNames('Alice Ames | | Bob Brown |')).toEqual(['Alice Ames', 'Bob Brown'])
  })

  it('returns [] for null/undefined/empty', () => {
    expect(splitAssignedToNames(null)).toEqual([])
    expect(splitAssignedToNames(undefined)).toEqual([])
    expect(splitAssignedToNames('')).toEqual([])
  })
})

describe('laborJobMatchesPerson', () => {
  const none: ReadonlySet<string> = new Set()

  it('matches via the junction id even when the name text disagrees (rename-safe)', () => {
    const row = { id: 'job-1', assigned_to_name: 'Somebody Else' }
    expect(laborJobMatchesPerson(row, new Set(['job-1']), 'Alice Ames')).toBe(true)
  })

  it('falls back to name membership on a multi-assignee sheet (the old .eq missed these)', () => {
    const row = { id: 'job-2', assigned_to_name: 'Alice Ames | Bob Brown' }
    expect(laborJobMatchesPerson(row, none, 'Alice Ames')).toBe(true)
    expect(laborJobMatchesPerson(row, none, 'Bob Brown')).toBe(true)
    expect(laborJobMatchesPerson(row, none, 'Cal Cruz')).toBe(false)
  })

  it('still matches the plain single-name column', () => {
    const row = { id: 'job-3', assigned_to_name: 'Alice Ames' }
    expect(laborJobMatchesPerson(row, none, 'Alice Ames')).toBe(true)
  })

  it('trims both sides before comparing', () => {
    const row = { id: 'job-4', assigned_to_name: ' Alice Ames  |  Bob Brown ' }
    expect(laborJobMatchesPerson(row, none, '  Alice Ames ')).toBe(true)
  })

  it('does not partial-match a name that is a substring of an assignee', () => {
    const row = { id: 'job-5', assigned_to_name: 'Alice Ames Jr | Bob Brown' }
    expect(laborJobMatchesPerson(row, none, 'Alice Ames')).toBe(false)
  })

  it('never matches a blank person name or a null column', () => {
    expect(laborJobMatchesPerson({ id: 'job-6', assigned_to_name: 'Alice Ames' }, none, '   ')).toBe(false)
    expect(laborJobMatchesPerson({ id: 'job-7', assigned_to_name: null }, none, 'Alice Ames')).toBe(false)
  })
})
