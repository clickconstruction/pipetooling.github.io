import { describe, expect, it } from 'vitest'
import { buildPayRosterIndex, isPayRosterRow, payRosterNames, type RosterPerson } from './rosterPeople'

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
