/**
 * GC mode design spike: the made-up file G-137's tests and the browser check bring in (mock-up
 * `to-dos/gc-mode/mockups/G-137.md`). Studio Ocotillo's schedule for Helotes Dental Office, as
 * Microsoft Project saves it with Save as XML: Project's own elements the importer passes over, a
 * calendar with weekends off, its summary of the whole job as task 0, five groups, 13 activities, 4
 * milestones, 14 finish-to-start links (one with 3 days of gap), one start-to-start link and two
 * links to or from a milestone. Never read by the app itself.
 */

export const HELOTES_SAMPLE_FILE = 'helotes-schedule.xml'

type SampleTask = {
  uid: number
  name: string
  level: number
  summary?: boolean
  milestone?: boolean
  start: string
  finish: string
  /** What it waits on: the task's number, and finish to start unless a type is given (3: start to start). */
  after?: { uid: number; type?: number; lagDays?: number }[]
}

const TASKS: SampleTask[] = [
  { uid: 0, name: 'Helotes Dental Office', level: 0, summary: true, start: '2026-10-30', finish: '2027-02-05' },
  { uid: 1, name: 'Preconstruction', level: 1, summary: true, start: '2026-10-30', finish: '2026-11-02' },
  { uid: 2, name: 'Building permit issued', level: 2, milestone: true, start: '2026-10-30', finish: '2026-10-30' },
  { uid: 3, name: 'Notice to proceed', level: 2, milestone: true, start: '2026-11-02', finish: '2026-11-02' },
  { uid: 4, name: 'Underground and framing', level: 1, summary: true, start: '2026-11-02', finish: '2026-11-20' },
  { uid: 5, name: 'Underground plumbing', level: 2, start: '2026-11-02', finish: '2026-11-06', after: [{ uid: 3 }] },
  { uid: 6, name: 'Metal stud framing', level: 2, start: '2026-11-09', finish: '2026-11-20', after: [{ uid: 5 }] },
  { uid: 7, name: 'Rough-in', level: 1, summary: true, start: '2026-11-23', finish: '2026-12-08' },
  { uid: 8, name: 'MEP rough-in', level: 2, start: '2026-11-23', finish: '2026-12-04', after: [{ uid: 6 }] },
  { uid: 9, name: 'HVAC ductwork', level: 2, start: '2026-11-23', finish: '2026-12-04', after: [{ uid: 6 }] },
  { uid: 10, name: 'Above-ceiling inspection', level: 2, start: '2026-12-07', finish: '2026-12-08', after: [{ uid: 8 }, { uid: 9 }] },
  { uid: 11, name: 'Finishes', level: 1, summary: true, start: '2026-12-09', finish: '2027-01-20' },
  { uid: 12, name: 'Hang, tape and finish', level: 2, start: '2026-12-09', finish: '2026-12-18', after: [{ uid: 10 }] },
  { uid: 13, name: 'Acoustical ceilings', level: 2, start: '2026-12-21', finish: '2026-12-30', after: [{ uid: 12 }] },
  { uid: 14, name: 'Casework install', level: 2, start: '2027-01-04', finish: '2027-01-13', after: [{ uid: 12, lagDays: 3 }] },
  { uid: 15, name: 'Dental equipment, by owner', level: 2, start: '2027-01-11', finish: '2027-01-20', after: [{ uid: 13, type: 3 }] },
  { uid: 16, name: 'Trim and closeout', level: 1, summary: true, start: '2027-01-14', finish: '2027-02-05' },
  { uid: 17, name: 'Plumbing trim', level: 2, start: '2027-01-14', finish: '2027-01-20', after: [{ uid: 13 }] },
  { uid: 18, name: 'Electrical devices and fixtures', level: 2, start: '2027-01-14', finish: '2027-01-22', after: [{ uid: 13 }] },
  { uid: 19, name: 'Final inspection', level: 2, start: '2027-01-25', finish: '2027-01-26', after: [{ uid: 17 }, { uid: 18 }, { uid: 14 }] },
  { uid: 20, name: 'Punch list', level: 2, start: '2027-01-27', finish: '2027-01-28', after: [{ uid: 19 }] },
  { uid: 21, name: 'Substantial completion', level: 2, milestone: true, start: '2027-01-29', finish: '2027-01-29', after: [{ uid: 20 }] },
  { uid: 22, name: 'Owner move-in', level: 2, milestone: true, start: '2027-02-05', finish: '2027-02-05' },
]

function taskXml(t: SampleTask, id: number, outline: string): string {
  const hours = t.milestone || t.summary ? 0 : 8 * workdays(t.start, t.finish)
  const links = (t.after ?? []).map((a) => `<PredecessorLink><PredecessorUID>${a.uid}</PredecessorUID><Type>${a.type ?? 1}</Type><CrossProject>0</CrossProject><LinkLag>${(a.lagDays ?? 0) * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`).join('')
  return [
    '<Task>',
    `<UID>${t.uid}</UID><ID>${id}</ID><Name>${t.name.replace(/&/g, '&amp;')}</Name><Active>1</Active><Manual>0</Manual><Type>0</Type><IsNull>0</IsNull>`,
    `<CreateDate>2026-09-21T09:14:00</CreateDate><WBS>${outline}</WBS><OutlineNumber>${outline}</OutlineNumber><OutlineLevel>${t.level}</OutlineLevel><Priority>500</Priority>`,
    `<Start>${t.start}T${t.milestone ? '17:00:00' : '08:00:00'}</Start><Finish>${t.finish}T17:00:00</Finish><Duration>PT${hours}H0M0S</Duration><DurationFormat>7</DurationFormat>`,
    `<Milestone>${t.milestone ? 1 : 0}</Milestone><Summary>${t.summary ? 1 : 0}</Summary><Critical>0</Critical><PercentComplete>0</PercentComplete>`,
    `<ConstraintType>0</ConstraintType><CalendarUID>-1</CalendarUID>${links}`,
    '</Task>',
  ].join('')
}

/** Weekdays from start to finish, both counted: the file's own calendar takes weekends off. */
function workdays(start: string, finish: string): number {
  let n = 0
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${finish}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n += 1
  return n
}

function sampleXml(): string {
  let group = 0
  let child = 0
  const tasks = TASKS.map((t, i) => {
    if (t.level === 0) return taskXml(t, 0, '0')
    if (t.level === 1) {
      group += 1
      child = 0
      return taskXml(t, i, String(group))
    }
    child += 1
    return taskXml(t, i, `${group}.${child}`)
  })
  const weekDay = (type: number) =>
    type === 1 || type === 7
      ? `<WeekDay><DayType>${type}</DayType><DayWorking>0</DayWorking></WeekDay>`
      : `<WeekDay><DayType>${type}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    '<SaveVersion>14</SaveVersion><Name>helotes-schedule.xml</Name><Title>Helotes Dental Office</Title><Company>Studio Ocotillo</Company><Author>Studio Ocotillo</Author>',
    '<CreationDate>2026-09-21T09:00:00</CreationDate><ScheduleFromStart>1</ScheduleFromStart><StartDate>2026-10-30T08:00:00</StartDate><FinishDate>2027-02-05T17:00:00</FinishDate>',
    '<CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime><MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>2400</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth>',
    `<Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><BaseCalendarUID>-1</BaseCalendarUID><WeekDays>${[1, 2, 3, 4, 5, 6, 7].map(weekDay).join('')}</WeekDays></Calendar></Calendars>`,
    '<Tasks>',
    ...tasks,
    '</Tasks>',
    '</Project>',
    '',
  ].join('\n')
}

/** Studio Ocotillo's schedule for Helotes Dental Office, as Microsoft Project saves it. */
export const HELOTES_SAMPLE_XML = sampleXml()
