import { describe, expect, it } from 'vitest'
import {
  archivedRosterNames,
  buildArchivedRoster,
  buildPayRosterIndex,
  isArchivedRosterRef,
  isPayRosterRow,
  NO_ARCHIVED_ROSTER,
  personIdByName,
  payRosterNames,
  splitNamesByArchived,
  type RosterPerson,
} from './rosterPeople'

function row(over: Partial<RosterPerson> & { pay_name: string }): RosterPerson {
  return {
    user_id: null,
    person_id: null,
    row_key: `p:${over.pay_name}`,
    account_name: null,
    roster_name: null,
    role: null,
    kind: null,
    account_kind: 'person',
    is_digital_twin: false,
    is_sample: false,
    is_dev: false,
    read_only: false,
    needs_supervision: false,
    user_archived_at: null,
    person_archived_at: null,
    is_archived: false,
    is_pay_roster: true,
    is_active_roster: true,
    has_login: true,
    has_roster_row: true,
    start_date: null,
    end_date: null,
    master_user_id: null,
    ...over,
  }
}

describe('pay roster membership from the roster view', () => {
  const index = buildPayRosterIndex([
    row({ pay_name: 'Ana Ruiz', person_id: 'p-ana' }),
    // The 2026-09-21 incident: a sample-like account with a Salary-ticked pay row.
    row({ pay_name: 'Training Helper', person_id: 'p-train', account_kind: 'sample', is_sample: true, is_pay_roster: false, is_active_roster: false }),
    row({ pay_name: 'Twin Estimator 1', account_kind: 'twin', is_digital_twin: true, is_pay_roster: false, is_active_roster: false }),
    row({ pay_name: 'Old Helper', user_archived_at: '2026-08-01T00:00:00Z', is_archived: true, is_pay_roster: false, is_active_roster: false }),
    row({ pay_name: 'Robert', role: 'dev', is_dev: true, is_pay_roster: true, is_active_roster: false }),
  ])

  it('a sample account with a pay-config row is not on the pay roster, matched by person_id or by name', () => {
    expect(isPayRosterRow(index, { person_name: 'Training Helper', person_id: 'p-train' })).toBe(false)
    expect(isPayRosterRow(index, { person_name: ' Training Helper ' })).toBe(false)
  })

  it('twins and archived accounts drop; a dev with a pay row stays (paid people include devs)', () => {
    expect(isPayRosterRow(index, { person_name: 'Twin Estimator 1' })).toBe(false)
    expect(isPayRosterRow(index, { person_name: 'Old Helper' })).toBe(false)
    expect(isPayRosterRow(index, { person_name: 'Robert' })).toBe(true)
  })

  it('a pay row matching no roster row is kept (an orphan is a data question, not hidden money)', () => {
    expect(isPayRosterRow(index, { person_name: 'Mario Lozano' })).toBe(true)
  })

  it('no index yet means no verdict: every row stays', () => {
    expect(isPayRosterRow(null, { person_name: 'Training Helper' })).toBe(true)
  })

  it('person_id wins over a name collision', () => {
    // A live roster row named like an archived one: the id decides.
    const idx = buildPayRosterIndex([
      row({ pay_name: 'Kyle', person_id: 'p-kyle-live' }),
      row({ pay_name: 'Kyle', person_id: 'p-kyle-old', person_archived_at: '2026-08-01', is_archived: true, is_pay_roster: false, is_active_roster: false }),
    ])
    expect(isPayRosterRow(idx, { person_name: 'Kyle', person_id: 'p-kyle-old' })).toBe(false)
    expect(isPayRosterRow(idx, { person_name: 'Kyle', person_id: 'p-kyle-live' })).toBe(true)
    // By name alone the live row wins.
    expect(isPayRosterRow(idx, { person_name: 'Kyle' })).toBe(true)
  })

  it('payRosterNames keeps order and drops the non-people', () => {
    expect(
      payRosterNames(index, [
        { person_name: 'Training Helper', person_id: 'p-train' },
        { person_name: 'Ana Ruiz', person_id: 'p-ana' },
        { person_name: 'Mario Lozano' },
      ]),
    ).toEqual(['Ana Ruiz', 'Mario Lozano'])
  })
})

describe('archived names from the roster view (punch list #29)', () => {
  const archived = { is_archived: true, is_pay_roster: false, is_active_roster: false }

  it('an archived account answers to its pay, account and roster names, trimmed', () => {
    const rows = [
      row({ pay_name: 'Dana Whitfield ', account_name: 'Dana Whitfield', roster_name: 'Dana W.', user_archived_at: '2026-09-01', ...archived }),
      row({ pay_name: 'Sam Ortiz', account_name: 'Sam Ortiz' }),
    ]
    expect([...archivedRosterNames(rows)].sort()).toEqual(['Dana W.', 'Dana Whitfield'])
  })

  it('an archived roster-only person is in the set too (the RPC knew accounts only)', () => {
    const rows = [row({ pay_name: 'Old Sub Crew', roster_name: 'Old Sub Crew', has_login: false, account_kind: 'external', person_archived_at: '2026-08-01', ...archived })]
    expect([...archivedRosterNames(rows)]).toEqual(['Old Sub Crew'])
  })

  it('a living person never hides behind an archived namesake, whatever the case', () => {
    const rows = [
      row({ pay_name: 'Jordan Lee', account_name: 'Jordan Lee', user_archived_at: '2025-12-01', ...archived }),
      row({ pay_name: 'jordan lee', roster_name: 'jordan lee', has_login: false, account_kind: 'external' }),
      row({ pay_name: 'Pat Moore', account_name: 'Pat Moore', user_archived_at: '2026-01-01', ...archived }),
    ]
    expect([...archivedRosterNames(rows)]).toEqual(['Pat Moore'])
  })

  it('a twin or a sample that is not archived is not in the set (the pay roster drops those)', () => {
    const rows = [
      row({ pay_name: 'Twin Estimator 1', account_kind: 'twin', is_digital_twin: true, is_pay_roster: false, is_active_roster: false }),
      row({ pay_name: 'Sample helper', account_kind: 'sample', is_sample: true, is_pay_roster: false, is_active_roster: false }),
    ]
    expect(archivedRosterNames(rows).size).toBe(0)
  })

  it('blank names are not names; no rows, no set', () => {
    expect(archivedRosterNames([row({ pay_name: '  ', account_name: '', roster_name: null, ...archived })]).size).toBe(0)
    expect(archivedRosterNames([]).size).toBe(0)
  })
})

describe('who is archived, id first (punch list #29, item 3)', () => {
  const archived = { is_archived: true, is_pay_roster: false, is_active_roster: false }
  const roster = buildArchivedRoster([
    // A linked pair: its account archived, so both ids answer archived.
    row({ pay_name: 'Dana Whitfield', user_id: 'u-dana', person_id: 'p-dana', user_archived_at: '2026-09-01', ...archived }),
    row({ pay_name: 'Sam Ortiz', user_id: 'u-sam', person_id: 'p-sam' }),
    // An archived account with no roster row, and a living roster-only namesake.
    row({ pay_name: 'Jordan Lee', user_id: 'u-jordan-old', user_archived_at: '2025-12-01', ...archived }),
    row({ pay_name: 'Jordan Lee', person_id: 'p-jordan', has_login: false, account_kind: 'external' }),
    row({ pay_name: 'Pat Moore', user_id: 'u-pat', user_archived_at: '2026-01-01', ...archived }),
  ])

  it('a renamed row still folds: the id matches, no name does', () => {
    expect(isArchivedRosterRef(roster, { name: 'Dana W.', person_id: 'p-dana' })).toBe(true)
    expect(isArchivedRosterRef(roster, { name: 'Dana W.', user_id: 'u-dana' })).toBe(true)
    expect(isArchivedRosterRef(roster, { name: 'Dana W.' })).toBe(false)
  })

  it('the id wins when the name says otherwise', () => {
    // A living person whose row carries an archived person's name.
    expect(isArchivedRosterRef(roster, { name: 'Pat Moore', person_id: 'p-sam' })).toBe(false)
    expect(isArchivedRosterRef(roster, { name: 'Pat Moore', user_id: 'u-sam' })).toBe(false)
    // An archived person whose row carries a living person's name.
    expect(isArchivedRosterRef(roster, { name: 'Sam Ortiz', person_id: 'p-dana' })).toBe(true)
  })

  it('namesakes are told apart by id; by name a living namesake keeps the name', () => {
    expect(isArchivedRosterRef(roster, { name: 'Jordan Lee', user_id: 'u-jordan-old' })).toBe(true)
    expect(isArchivedRosterRef(roster, { name: 'Jordan Lee', person_id: 'p-jordan' })).toBe(false)
    expect(isArchivedRosterRef(roster, { name: 'Jordan Lee' })).toBe(false)
  })

  it('a row with no id, or an id the roster does not know, falls back to the name, trimmed and without case', () => {
    expect(isArchivedRosterRef(roster, { name: ' Pat Moore ' })).toBe(true)
    expect(isArchivedRosterRef(roster, { name: 'pat moore' })).toBe(true)
    expect(isArchivedRosterRef(roster, { name: 'Pat Moore', person_id: 'p-unknown', user_id: null })).toBe(true)
    expect(isArchivedRosterRef(roster, { name: 'Sam Ortiz', person_id: null })).toBe(false)
  })

  it('the person id is asked before the user id', () => {
    expect(isArchivedRosterRef(roster, { name: 'x', person_id: 'p-sam', user_id: 'u-dana' })).toBe(false)
    expect(isArchivedRosterRef(roster, { name: 'x', person_id: 'p-dana', user_id: 'u-sam' })).toBe(true)
  })

  it('carries the archived names as they were, and knows no one before the read lands', () => {
    expect([...roster.names].sort()).toEqual(['Dana Whitfield', 'Pat Moore'])
    expect(isArchivedRosterRef(NO_ARCHIVED_ROSTER, { name: 'Pat Moore', person_id: 'p-dana', user_id: 'u-pat' })).toBe(false)
  })
})

describe('personIdByName (the Offsets board groups by name)', () => {
  it('keys by the trimmed name without case, and keeps the one id its rows carry', () => {
    const ids = personIdByName([
      { name: 'Trace ', person_id: 'p-trace' },
      { name: 'trace', person_id: null },
      { name: 'Abraham', person_id: null },
    ])
    expect(ids.get('trace')).toBe('p-trace')
    expect(ids.get('abraham')).toBeNull()
  })

  it('two ids under one name are two people: no id, so the name decides', () => {
    const ids = personIdByName([
      { name: 'Jordan Lee', person_id: 'p-jordan-1' },
      { name: 'Jordan Lee', person_id: 'p-jordan-2' },
    ])
    expect(ids.get('jordan lee')).toBeNull()
  })

  it('a blank name is not a key', () => {
    expect(personIdByName([{ name: '  ', person_id: 'p-x' }]).size).toBe(0)
  })
})

describe('splitNamesByArchived (People → Contracts, #29 item 3)', () => {
  const archived = { is_archived: true, is_pay_roster: false, is_active_roster: false }
  const roster = buildArchivedRoster([
    // v2.1409's pattern: the account archived, its linked roster person left active. One roster row.
    row({ pay_name: 'Bill Hayes', user_id: 'u-bill', person_id: 'p-bill', user_archived_at: '2026-05-01', ...archived }),
    row({ pay_name: 'Dana Whitfield', person_id: 'p-dana', person_archived_at: '2026-09-01', ...archived }),
    row({ pay_name: 'Jordan Lee', user_id: 'u-jordan-old', user_archived_at: '2025-12-01', ...archived }),
    row({ pay_name: 'Jordan Lee', person_id: 'p-jordan', has_login: false, account_kind: 'external' }),
    row({ pay_name: 'Pat Moore', user_id: 'u-pat-old', user_archived_at: '2026-01-01', ...archived }),
    row({ pay_name: 'Sam Ortiz', user_id: 'u-sam', person_id: 'p-sam' }),
    row({ pay_name: 'Old Sub Crew', person_id: 'p-old-crew', person_archived_at: '2026-02-01', has_login: false, ...archived }),
  ])
  const split = splitNamesByArchived(
    [
      { name: 'Bill Hayes', person_id: 'p-bill' },
      { name: 'Dana W.', person_id: 'p-dana' },
      { name: 'Jordan Lee', person_id: 'p-jordan' },
      { name: 'Pat Moore', user_id: 'u-sam' },
      { name: 'Sam Ortiz', person_id: 'p-sam' },
      { name: 'Sam Ortiz', user_id: 'u-sam' },
      { name: '  ', person_id: 'p-sam' },
    ],
    roster,
  )

  it('a roster person whose linked account is archived is archived, by id', () => {
    expect(split.active).not.toContain('Bill Hayes')
    expect(split.archived).toContain('Bill Hayes')
  })

  it('a renamed row folds by id, under the name it carries', () => {
    expect(split.archived).toContain('Dana W.')
    expect(split.active).not.toContain('Dana W.')
  })

  it('the id wins: a living row under an archived name is living, and the name leaves the archived list', () => {
    expect(split.active).toContain('Pat Moore')
    expect(split.archived).not.toContain('Pat Moore')
  })

  it('namesakes: the living one keeps the name', () => {
    expect(split.active).toContain('Jordan Lee')
    expect(split.archived).not.toContain('Jordan Lee')
  })

  it('every other archived roster name is listed, both lists sorted, each name once', () => {
    expect(split.active).toEqual(['Jordan Lee', 'Pat Moore', 'Sam Ortiz'])
    expect(split.archived).toEqual(['Bill Hayes', 'Dana W.', 'Dana Whitfield', 'Old Sub Crew'])
  })

  it('before the roster read lands, everyone is living and nothing is archived', () => {
    expect(splitNamesByArchived([{ name: 'Bill Hayes', person_id: 'p-bill' }], NO_ARCHIVED_ROSTER)).toEqual({ active: ['Bill Hayes'], archived: [] })
  })
})
