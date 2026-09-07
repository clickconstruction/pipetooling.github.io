import { describe, expect, it } from 'vitest'
import { teamBoardHref, unassignedWeekCards } from './unassignedFieldTimeCard'
import type { PeopleHoursUnallocatedRow } from './peopleHoursUnallocatedRows'

function row(personName: string, workDate: string, unallocatedHrs: number): PeopleHoursUnallocatedRow {
  return {
    personName,
    workDate,
    dayHoursRaw: 8,
    overheadOnDay: 0,
    fieldHours: 8,
    crewAttributedHrs: 8 - unallocatedHrs,
    subLaborHrs: 0,
    unallocatedHrs,
    isSalary: false,
    crewAssignmentCount: 0,
    officeAssignmentCount: 0,
  }
}

describe('unassignedWeekCards', () => {
  it('groups person-days by company week (Sunday start), newest week first, with people/hours/latest day', () => {
    const cards = unassignedWeekCards([
      row('Isiah', '2026-09-05', 0.72), // Sat → week of Aug 30
      row('Paige', '2026-09-01', 2), // Tue → week of Aug 30
      row('Isiah', '2026-09-01', 1.5),
      row('Malachi', '2026-08-28', 3), // Fri → week of Aug 23
    ])
    expect(cards.map((c) => c.weekStart)).toEqual(['2026-08-30', '2026-08-23'])
    expect(cards[0]).toEqual({
      weekStart: '2026-08-30',
      weekEnd: '2026-09-05',
      rowCount: 3,
      peopleCount: 2,
      totalUnallocatedHrs: 4.22,
      latestWorkDate: '2026-09-05',
    })
    expect(cards[1]!.rowCount).toBe(1)
    expect(cards[1]!.peopleCount).toBe(1)
  })

  it('returns no cards for no rows', () => {
    expect(unassignedWeekCards([])).toEqual([])
  })
})

describe('teamBoardHref', () => {
  it('links to the Team tab with the week and the exceptions filter', () => {
    expect(teamBoardHref({ week: '2026-09-05', onlyExceptions: true })).toBe('/jobs?tab=combined-labor&teamWeek=2026-09-05&teamExceptions=1')
  })
  it('links to a job row without a week', () => {
    expect(teamBoardHref({ jobId: 'abc' })).toBe('/jobs?tab=combined-labor&teamLaborJob=abc')
  })
  it('plain tab link with no options', () => {
    expect(teamBoardHref()).toBe('/jobs?tab=combined-labor')
  })
})
