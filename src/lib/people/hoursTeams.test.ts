import { describe, expect, it, vi } from 'vitest'
import { buildPeopleHoursTeams, teamDayCost, teamsWithoutArchivedMembers } from './hoursTeams'

describe('buildPeopleHoursTeams', () => {
  it('keeps the teams in the order read and hangs each member on its team', () => {
    const teams = buildPeopleHoursTeams(
      [
        { id: 't2', name: 'Rough-in', sequence_order: 0 },
        { id: 't1', name: 'Service', sequence_order: 1 },
      ],
      [
        { team_id: 't1', person_name: 'Sam Lee' },
        { team_id: 't2', person_name: 'Alex Rivera' },
        { team_id: 't1', person_name: 'Jo Park' },
      ],
    )
    expect(teams).toEqual([
      { id: 't2', name: 'Rough-in', members: ['Alex Rivera'] },
      { id: 't1', name: 'Service', members: ['Sam Lee', 'Jo Park'] },
    ])
  })

  it('gives a team with no members an empty list, and drops a member of no team', () => {
    expect(buildPeopleHoursTeams([{ id: 't1', name: 'Service' }], [{ team_id: 'gone', person_name: 'Sam Lee' }])).toEqual([{ id: 't1', name: 'Service', members: [] }])
  })
})

describe('teamsWithoutArchivedMembers', () => {
  it('drops archived names, matching trimmed, and keeps the team', () => {
    const teams = [{ id: 't1', name: 'Service', members: ['Sam Lee', ' Jo Park ', 'Alex Rivera'] }]
    expect(teamsWithoutArchivedMembers(teams, new Set(['Jo Park', 'Alex Rivera']))).toEqual([{ id: 't1', name: 'Service', members: ['Sam Lee'] }])
  })

  it('leaves the list it was handed untouched', () => {
    const teams = [{ id: 't1', name: 'Service', members: ['Sam Lee'] }]
    teamsWithoutArchivedMembers(teams, new Set(['Sam Lee']))
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
