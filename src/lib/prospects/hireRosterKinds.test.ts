import { describe, expect, it } from 'vitest'
import { DEFAULT_HIRE_ROSTER_KIND, HIRE_ROSTER_KINDS, isHireRosterKind, suggestRosterKind } from './hireRosterKinds'

/** `people_kind_check` (baseline migration) — the only values the roster insert can write. */
const DB_PEOPLE_KINDS = ['assistant', 'master_technician', 'sub', 'dev', 'estimator', 'primary', 'superintendent', 'helper']

describe('HIRE_ROSTER_KINDS (J25-F5)', () => {
  it('still offers the two historical field kinds first', () => {
    expect(HIRE_ROSTER_KINDS.slice(0, 2).map((k) => k.kind)).toEqual(['sub', 'helper'])
    expect(DEFAULT_HIRE_ROSTER_KIND).toBe('sub')
  })

  it('adds the office kinds the roster supports', () => {
    const kinds = HIRE_ROSTER_KINDS.map((k) => k.kind)
    for (const office of ['assistant', 'estimator', 'superintendent', 'primary', 'master_technician']) {
      expect(kinds).toContain(office)
    }
  })

  it('offers only values the DB CHECK constraint accepts, and never dev or controller', () => {
    for (const { kind, label } of HIRE_ROSTER_KINDS) {
      expect(DB_PEOPLE_KINDS).toContain(kind)
      expect(label.trim().length).toBeGreaterThan(0)
    }
    const kinds = HIRE_ROSTER_KINDS.map((k) => k.kind)
    expect(kinds).not.toContain('dev')
    // PersonKind knows controller; people_kind_check does not — offering it would fail the insert.
    expect(kinds).not.toContain('controller')
    expect(new Set(kinds).size).toBe(kinds.length)
  })

  it('isHireRosterKind guards select values', () => {
    expect(isHireRosterKind('assistant')).toBe(true)
    expect(isHireRosterKind('controller')).toBe(false)
    expect(isHireRosterKind('')).toBe(false)
  })
})

describe('suggestRosterKind', () => {
  it('reads office roles as assistant', () => {
    expect(suggestRosterKind('Office Manager')).toBe('assistant')
    expect(suggestRosterKind('Dispatcher')).toBe('assistant')
    expect(suggestRosterKind('Admin Assistant')).toBe('assistant')
  })

  it('maps the other named roles', () => {
    expect(suggestRosterKind('Estimator')).toBe('estimator')
    expect(suggestRosterKind('Superintendent')).toBe('superintendent')
    expect(suggestRosterKind('Project Manager')).toBe('superintendent')
    expect(suggestRosterKind('Apprentice')).toBe('helper')
    expect(suggestRosterKind('Helper')).toBe('helper')
    expect(suggestRosterKind('Master Plumber')).toBe('master_technician')
    expect(suggestRosterKind('Primary')).toBe('primary')
  })

  it('falls back to Subcontractor for trade roles, blanks and unknowns', () => {
    expect(suggestRosterKind('Plumber')).toBe('sub')
    expect(suggestRosterKind('Journeyman Electrician')).toBe('sub')
    expect(suggestRosterKind('')).toBe('sub')
    expect(suggestRosterKind(null)).toBe('sub')
    expect(suggestRosterKind(undefined)).toBe('sub')
  })
})
