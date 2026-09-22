import { describe, expect, it } from 'vitest'
import { buildHoursGridRoster, payConfigRowsForRoster } from './hoursGridRoster'
import { buildPayRosterIndex, type RosterPerson } from './rosterPeople'

function person(pay_name: string, over: Partial<RosterPerson> = {}): RosterPerson {
  return {
    user_id: null,
    person_id: null,
    row_key: `p:${pay_name}`,
    pay_name,
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

const rows = (names: string[]) => names.map((n) => ({ person_name: n, person_id: null }))

describe('buildHoursGridRoster', () => {
  it('drops archived people (trimmed match), orders by display sequence, then alphabetically for the unordered', () => {
    const payRoster = buildPayRosterIndex([
      person('Zed Quinn'),
      person('Ana Ruiz'),
      person('Old Helper', { is_archived: true, is_pay_roster: false, is_active_roster: false }),
      person('Bo Lee'),
      person('Cy Park'),
    ])
    const out = buildHoursGridRoster({
      payConfigRows: rows(['Zed Quinn', 'Ana Ruiz', ' Old Helper ', 'Bo Lee', 'Cy Park']),
      payRoster,
      displayOrder: { 'Cy Park': 1, 'Zed Quinn': 2 },
    })
    expect(out).toEqual(['Cy Park', 'Zed Quinn', 'Ana Ruiz', 'Bo Lee'])
  })

  it('a sample account or a twin with a pay-config row is not on the grid (the 2026-09-21 Training Helper)', () => {
    const payRoster = buildPayRosterIndex([
      person('Ana Ruiz'),
      person('Training Helper', { account_kind: 'sample', is_sample: true, is_pay_roster: false, is_active_roster: false }),
      person('Twin Estimator 1', { account_kind: 'twin', is_digital_twin: true, is_pay_roster: false, is_active_roster: false }),
      person('Robert', { role: 'dev', is_dev: true, is_active_roster: false }),
    ])
    const out = buildHoursGridRoster({
      payConfigRows: rows(['Training Helper', 'Ana Ruiz', 'Twin Estimator 1', 'Robert']),
      payRoster,
      displayOrder: {},
    })
    // A dev with a pay row is paid like anyone; the sample and the twin are not people.
    expect(out).toEqual(['Ana Ruiz', 'Robert'])
  })

  it('is the same list whatever the viewer, given the same inputs — the J7-6 divergence was an unloaded archived set', () => {
    const payConfigRows = rows(['Ana Ruiz', 'Archived One', 'Archived Two'])
    const payRoster = buildPayRosterIndex([
      person('Ana Ruiz'),
      person('Archived One', { is_archived: true, is_pay_roster: false, is_active_roster: false }),
      person('Archived Two', { is_archived: true, is_pay_roster: false, is_active_roster: false }),
    ])
    const owner = buildHoursGridRoster({ payConfigRows, payRoster, displayOrder: {} })
    const assistant = buildHoursGridRoster({ payConfigRows, payRoster, displayOrder: {} })
    expect(assistant).toEqual(owner)
    expect(owner).toEqual(['Ana Ruiz'])
    // The bug: a roster that never loaded (null) has no verdict, so every row shows as a zero-hour line.
    expect(buildHoursGridRoster({ payConfigRows, payRoster: null, displayOrder: {} })).toHaveLength(3)
  })

  it('returns an empty roster when nobody has a pay-config row', () => {
    expect(buildHoursGridRoster({ payConfigRows: [], payRoster: buildPayRosterIndex([]), displayOrder: {} })).toEqual([])
  })

  it('payConfigRowsForRoster carries each row\'s person_id so the id can decide before the name', () => {
    expect(payConfigRowsForRoster({ Kyle: { person_name: 'Kyle', person_id: 'p-kyle' }, Zach: { person_name: 'Zach' } })).toEqual([
      { person_name: 'Kyle', person_id: 'p-kyle' },
      { person_name: 'Zach', person_id: null },
    ])
  })
})
