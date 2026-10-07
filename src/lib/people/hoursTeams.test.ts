import { describe, expect, it, vi } from 'vitest'
import { buildPeopleHoursTeams, teamDayCost, teamsWithoutArchivedMembers } from './hoursTeams'
import { buildArchivedRoster, NO_ARCHIVED_ROSTER, type RosterPerson } from './rosterPeople'

/** An archived roster that knows names only (no ids): the fallback rule on its own. */
const byName = (names: string[]) => ({ ...NO_ARCHIVED_ROSTER, names: new Set(names) })

describe('buildPeopleHoursTeams', () => {
  it('keeps the teams in the order read and hangs each member on its team', () => {
    const teams = buildPeopleHoursTeams(
      [
        { id: 't2', name: 'Rough-in', sequence_order: 0 },
        { id: 't1', name: 'Service', sequence_order: 1 },
      ],
      [
        { team_id: 't1', person_name: 'Sam Lee', person_id: 'p-sam' },
        { team_id: 't2', person_name: 'Alex Rivera', person_id: 'p-alex' },
        { team_id: 't1', person_name: 'Jo Park' },
      ],
    )
    expect(teams).toEqual([
      { id: 't2', name: 'Rough-in', members: ['Alex Rivera'], memberPersonIds: { 'Alex Rivera': 'p-alex' } },
      { id: 't1', name: 'Service', members: ['Sam Lee', 'Jo Park'], memberPersonIds: { 'Sam Lee': 'p-sam', 'Jo Park': null } },
    ])
  })

  it('gives a team with no members an empty list, and drops a member of no team', () => {
    expect(buildPeopleHoursTeams([{ id: 't1', name: 'Service' }], [{ team_id: 'gone', person_name: 'Sam Lee' }])).toEqual([{ id: 't1', name: 'Service', members: [], memberPersonIds: {} }])
  })
})

describe('teamsWithoutArchivedMembers', () => {
  it('drops archived names, matching trimmed, and keeps the team', () => {
    const teams = [{ id: 't1', name: 'Service', members: ['Sam Lee', ' Jo Park ', 'Alex Rivera'] }]
    expect(teamsWithoutArchivedMembers(teams, byName(['Jo Park', 'Alex Rivera']))).toEqual([{ id: 't1', name: 'Service', members: ['Sam Lee'] }])
  })

  it('the id decides before the name (#29 item 3): a renamed member still drops, a living member under an archived name stays', () => {
    const roster = (over: Partial<RosterPerson> & { pay_name: string }): RosterPerson => ({
      user_id: null, person_id: null, row_key: `p:${over.pay_name}`, account_name: null, roster_name: null, role: null, kind: null,
      account_kind: 'person', is_digital_twin: false, is_sample: false, is_dev: false, read_only: false, needs_supervision: false,
      user_archived_at: null, person_archived_at: null, is_archived: false, is_pay_roster: true, is_active_roster: true,
      has_login: true, has_roster_row: true, start_date: null, end_date: null, master_user_id: null, ...over,
    })
    const archived = buildArchivedRoster([
      roster({ pay_name: 'Dana Whitfield', person_id: 'p-dana', person_archived_at: '2026-09-01', is_archived: true, is_pay_roster: false }),
      roster({ pay_name: 'Sam Ortiz', person_id: 'p-sam' }),
      roster({ pay_name: 'Old Sam', user_id: 'u-old-sam', user_archived_at: '2025-12-01', is_archived: true, is_pay_roster: false }),
    ])
    const teams = [
      { id: 't1', name: 'Service', members: ['Dana W.', 'Old Sam', 'Jo Park'], memberPersonIds: { 'Dana W.': 'p-dana', 'Old Sam': 'p-sam', 'Jo Park': null } },
      // Added since the load: no id yet, so the name decides.
      { id: 't2', name: 'Rough-in', members: ['Old Sam'] },
    ]
    expect(teamsWithoutArchivedMembers(teams, archived).map((t) => t.members)).toEqual([['Old Sam', 'Jo Park'], []])
  })

  it('leaves the list it was handed untouched', () => {
    const teams = [{ id: 't1', name: 'Service', members: ['Sam Lee'] }]
    teamsWithoutArchivedMembers(teams, byName(['Sam Lee']))
    expect(teams[0]?.members).toEqual(['Sam Lee'])
  })
})

describe('teamDayCost', () => {
  // 2026-09-21 is a Monday, 2026-09-25 a Friday, 2026-09-26 a Saturday, 2026-09-27 a Sunday.
  it('is the actual cost with max hours off', () => {
    expect(teamDayCost({ showMaxHours: false, hourlyWage: 30, workDate: '2026-09-21', actualCost: () => 123.45 })).toBe(123.45)
  })

  it('is a flat eight hours at the wage on a weekday, without asking for the actual cost', () => {
    const actualCost = vi.fn(() => 999)
    expect(teamDayCost({ showMaxHours: true, hourlyWage: 30, workDate: '2026-09-21', actualCost })).toBe(240)
    expect(teamDayCost({ showMaxHours: true, hourlyWage: 30, workDate: '2026-09-25', actualCost })).toBe(240)
    expect(actualCost).not.toHaveBeenCalled()
  })

  it('is the actual cost on a weekend day', () => {
    expect(teamDayCost({ showMaxHours: true, hourlyWage: 30, workDate: '2026-09-26', actualCost: () => 60 })).toBe(60)
    expect(teamDayCost({ showMaxHours: true, hourlyWage: 30, workDate: '2026-09-27', actualCost: () => 0 })).toBe(0)
  })

  it('is zero on a weekday for a person with no wage on file', () => {
    expect(teamDayCost({ showMaxHours: true, hourlyWage: null, workDate: '2026-09-21', actualCost: () => 50 })).toBe(0)
    expect(teamDayCost({ showMaxHours: true, hourlyWage: undefined, workDate: '2026-09-21', actualCost: () => 50 })).toBe(0)
  })
})
