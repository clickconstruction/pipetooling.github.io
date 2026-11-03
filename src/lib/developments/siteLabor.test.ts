import { describe, expect, it } from 'vitest'
import { allocateSiteLabor, crewDayHours, siteLaborFromManHours, type SiteCrewRow } from './siteLabor'

const config = {
  Luis: { hourly_wage: 35, is_salary: false },
  'id:p-mateo': { hourly_wage: 30, is_salary: true },
  Mateo: { hourly_wage: 30, is_salary: true },
}
// 2026-10-26 is a Monday, 2026-10-31 a Saturday.
const crew: SiteCrewRow[] = [
  { work_date: '2026-10-26', person_name: 'Luis', person_id: 'p-luis', job_assignments: [{ job_id: 'j1', pct: 50 }, { job_id: 'j2', pct: 50 }], crew_lead_person_name: 'Luis' },
  { work_date: '2026-10-27', person_name: 'Luis', person_id: 'p-luis', job_assignments: [{ job_id: 'j1', pct: 100 }], crew_lead_person_name: 'Luis' },
  { work_date: '2026-10-26', person_name: 'Mateo', person_id: 'p-mateo', job_assignments: [{ job_id: 'j1', pct: 100 }], crew_lead_person_name: 'Luis' },
  { work_date: '2026-10-31', person_name: 'Mateo', person_id: 'p-mateo', job_assignments: [{ job_id: 'j1', pct: 100 }], crew_lead_person_name: null },
  // a job that is not on the site
  { work_date: '2026-10-28', person_name: 'Luis', person_id: 'p-luis', job_assignments: [{ job_id: 'elsewhere', pct: 100 }], crew_lead_person_name: 'Luis' },
]
const hours = [
  { person_name: 'Luis', person_id: 'p-luis', work_date: '2026-10-26', hours: 10 },
  { person_name: 'Luis', person_id: 'p-luis', work_date: '2026-10-27', hours: 8 },
  { person_name: 'Luis', person_id: 'p-luis', work_date: '2026-10-28', hours: 9 },
]

describe('allocateSiteLabor', () => {
  const out = allocateSiteLabor({ jobIds: ['j1', 'j2', 'j3'], crewRows: crew, hoursRows: hours, config })

  it('splits a crew day over its jobs by percent, salaried people at 8 h on a weekday and 0 on a Saturday', () => {
    const j1 = out.byJobId.get('j1')!
    const luis = j1.people.find((p) => p.personName === 'Luis')!
    const mateo = j1.people.find((p) => p.personName === 'Mateo')!
    expect(luis.hours).toBe(5 + 8)
    expect(luis.costUsd).toBe(13 * 35)
    expect(mateo.hours).toBe(8)
    expect(mateo.costUsd).toBe(8 * 30)
    expect(j1.hours).toBe(21)
    expect(j1.costUsd).toBe(13 * 35 + 8 * 30)
    expect(out.byJobId.get('j2')).toMatchObject({ hours: 5, costUsd: 175 })
  })

  it('counts days once each at every level, and the lead days', () => {
    const j1 = out.byJobId.get('j1')!
    expect(j1.days).toBe(2)
    expect(j1.people.find((p) => p.personName === 'Luis')).toMatchObject({ days: 2, leadDays: 2, personId: 'p-luis' })
    expect(j1.people.find((p) => p.personName === 'Mateo')).toMatchObject({ days: 1, leadDays: 0 })
    expect(out.siteDays).toBe(2)
    expect(out.people).toBe(2)
  })

  it('leaves out jobs off the site, jobs with no hours, and a crew row seen twice', () => {
    expect(out.byJobId.has('elsewhere')).toBe(false)
    expect(out.byJobId.has('j3')).toBe(false)
    const twice = allocateSiteLabor({ jobIds: ['j1'], crewRows: [crew[1]!, crew[1]!], hoursRows: hours, config })
    expect(twice.byJobId.get('j1')!.hours).toBe(8)
  })

  it('crewDayHours follows the clock for an hourly person and the calendar for a salaried one', () => {
    const map = { 'Luis:2026-10-26': 10 }
    expect(crewDayHours({ is_salary: false }, crew[0]!, map)).toBe(10)
    expect(crewDayHours(undefined, crew[0]!, map)).toBe(10)
    expect(crewDayHours({ is_salary: true }, crew[2]!, map)).toBe(8)
    expect(crewDayHours({ is_salary: true }, crew[3]!, map)).toBe(0)
  })
})

describe('the login of each person (v2.6457)', () => {
  it('a person carries the login the roster links them to, else null', () => {
    const out = allocateSiteLabor({ jobIds: ['j1'], crewRows: crew, hoursRows: hours, config, userIdByPersonId: new Map([['p-luis', 'u-luis']]) })
    const people = out.byJobId.get('j1')!.people
    expect(people.find((p) => p.personName === 'Luis')!.userId).toBe('u-luis')
    expect(people.find((p) => p.personName === 'Mateo')!.userId).toBeNull()
  })
})

describe('the hours alone, for a reader the clock is closed to (v2.6457)', () => {
  it('each person’s hours on each site job, no wage, no days, and the site says its days are not known', () => {
    const out = siteLaborFromManHours(['j1', 'j2'], [
      { job_id: 'j1', person_name: 'Luis', man_hours: '612.5' },
      { job_id: 'j1', person_name: 'Mateo', man_hours: 540 },
      { job_id: 'j2', person_name: 'Luis', man_hours: 0 },
      { job_id: 'elsewhere', person_name: 'Tom', man_hours: 99 },
    ])
    expect(out.daysKnown).toBe(false)
    expect(out.people).toBe(2)
    expect(out.byJobId.get('j1')).toMatchObject({ hours: 1152.5, costUsd: 0, days: 0 })
    expect(out.byJobId.get('j1')!.people.map((p) => [p.personName, p.hours, p.costUsd, p.days, p.userId])).toEqual([
      ['Luis', 612.5, 0, 0, null],
      ['Mateo', 540, 0, 0, null],
    ])
    expect(out.byJobId.has('j2')).toBe(false)
    expect(out.byJobId.has('elsewhere')).toBe(false)
  })
  it('the clock’s own read knows its days', () => {
    expect(allocateSiteLabor({ jobIds: ['j1'], crewRows: crew, hoursRows: hours, config }).daysKnown).toBe(true)
  })
})
