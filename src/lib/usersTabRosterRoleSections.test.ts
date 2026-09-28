import { describe, expect, it } from 'vitest'
import {
  AUTH_USER_ROLE_SECTION_LABEL,
  AUTH_USER_ROLE_SECTION_ORDER,
  groupRosterUsersByAuthRoleSection,
} from './usersTabRosterRoleSections'

/** The role sections People → Users draws, reused by the Schedule hub's People tab and Quickfill Schedule. */
const roles = (pairs: Record<string, string>) => new Map(Object.entries(pairs))

describe('AUTH_USER_ROLE_SECTION_ORDER', () => {
  it('starts with the leaders and ends with the devs, a label for every section', () => {
    expect(AUTH_USER_ROLE_SECTION_ORDER[0]).toBe('master_technician')
    expect(AUTH_USER_ROLE_SECTION_ORDER[AUTH_USER_ROLE_SECTION_ORDER.length - 1]).toBe('dev')
    for (const role of AUTH_USER_ROLE_SECTION_ORDER) {
      expect(AUTH_USER_ROLE_SECTION_LABEL[role]).toBeTruthy()
    }
    expect(AUTH_USER_ROLE_SECTION_LABEL.master_technician).toBe('Leaders')
    expect(AUTH_USER_ROLE_SECTION_LABEL.helpers).toBe('Helper')
  })
})

describe('groupRosterUsersByAuthRoleSection', () => {
  it('lists the sections in the People order, whatever order the people arrive in', () => {
    const users = [
      { id: 'd', name: 'Dana' },
      { id: 'h', name: 'Hugo' },
      { id: 'm', name: 'Malachi' },
      { id: 's', name: 'Sam' },
      { id: 't', name: 'Taunya' },
    ]
    const groups = groupRosterUsersByAuthRoleSection(
      users,
      roles({ d: 'dev', h: 'helpers', m: 'master_technician', s: 'superintendent', t: 'assistant' }),
    )
    expect(groups.map((g) => g.sectionKey)).toEqual(['master_technician', 'assistant', 'superintendent', 'helpers', 'dev'])
    expect(groups.map((g) => g.label)).toEqual(['Leaders', 'Assistants', 'Superintendents', 'Helper', 'Devs'])
  })

  it('keeps the incoming name order inside a section', () => {
    const users = [
      { id: '1', name: 'Abraham' },
      { id: '2', name: 'Bo' },
      { id: '3', name: 'Cruz' },
    ]
    const groups = groupRosterUsersByAuthRoleSection(users, roles({ 1: 'helpers', 2: 'primary', 3: 'helpers' }))
    expect(groups).toEqual([
      { sectionKey: 'primary', label: 'Primaries', rows: [{ id: '2', name: 'Bo' }] },
      {
        sectionKey: 'helpers',
        label: 'Helper',
        rows: [
          { id: '1', name: 'Abraham' },
          { id: '3', name: 'Cruz' },
        ],
      },
    ])
  })

  it('leaves out a section nobody is in', () => {
    const groups = groupRosterUsersByAuthRoleSection([{ id: '1', name: 'Abraham' }], roles({ 1: 'estimator' }))
    expect(groups).toHaveLength(1)
    expect(groups[0]?.sectionKey).toBe('estimator')
  })

  it('puts a missing, blank or unknown role in a trailing Other section', () => {
    const users = [
      { id: '1', name: 'Abraham' },
      { id: '2', name: 'Bo' },
      { id: '3', name: 'Cruz' },
      { id: '4', name: 'Dana' },
    ]
    const groups = groupRosterUsersByAuthRoleSection(users, roles({ 1: 'dev', 2: '  ', 3: 'janitor' }))
    expect(groups.map((g) => g.sectionKey)).toEqual(['dev', '__other__'])
    expect(groups[1]).toEqual({
      sectionKey: '__other__',
      label: 'Other',
      rows: [
        { id: '2', name: 'Bo' },
        { id: '3', name: 'Cruz' },
        { id: '4', name: 'Dana' },
      ],
    })
  })

  it('reads a role through surrounding whitespace, but not through a change of case', () => {
    const users = [
      { id: '1', name: 'Abraham' },
      { id: '2', name: 'Bo' },
    ]
    const groups = groupRosterUsersByAuthRoleSection(users, roles({ 1: ' controller ', 2: 'Controller' }))
    expect(groups.map((g) => [g.sectionKey, g.rows.map((r) => r.id)])).toEqual([
      ['controller', ['1']],
      ['__other__', ['2']],
    ])
  })

  it('returns no sections for no people', () => {
    expect(groupRosterUsersByAuthRoleSection([], roles({ 1: 'dev' }))).toEqual([])
  })
})
