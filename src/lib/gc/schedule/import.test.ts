// @vitest-environment jsdom
/**
 * The tests of `gcScheduleImport.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { GC_COMPANY } from '../company'
import { customerSchedulePicture } from './customerSchedule'
import { scheduleCsv, scheduleExport, scheduleMspdi } from './export'
import { ganttBars } from './gantt'
import type { ScheduleFileReading, ScheduleFileResult } from './import'
import { guessPlaces, importLines, importedSchedule, readScheduleFile } from './import'
import { scheduleMeasures } from './schedule'
import { initialGcState } from './testState'
import type { ProjectSchedule, ScheduleImport, ScheduleImportPlace, ScheduleImportRow } from './types'
import { waitHolds, waitRows } from './waits'
import type { GcProject, GcState } from '../types'

const jobOf = (state: GcState, id: string) => state.projects.find((p) => p.id === id) as GcProject

function reading(result: ScheduleFileResult): ScheduleFileReading {
  if ('problem' in result) throw new Error(result.problem)
  return result
}

/** Every row the guess placed, kept as guessed, with these places changed by name; every date ticked. */
function plan(project: GcProject, read: ScheduleFileReading, workStarts: string, places: Record<string, ScheduleImportPlace | 'out'> = {}, from = 'Studio Ocotillo'): ScheduleImport {
  const guess = guessPlaces(project, read)
  const rows: ScheduleImportRow[] = read.rows
    .filter((r) => !r.date)
    .flatMap((r) => {
      const chosen = places[r.name]
      const place = chosen === 'out' ? null : (chosen ?? guess.get(r.key)?.place ?? null)
      if (!place || place.kind === 'out') return []
      return [{ key: r.key, name: r.name, start: r.start, finish: r.finish, place, after: r.after, ...(r.notBefore ? { notBefore: r.notBefore } : {}), ...(r.mustFinishBy ? { mustFinishBy: r.mustFinishBy } : {}), ...(r.underADay ? { underADay: true } : {}) }]
    })
  return { file: 'their-file', from, workStarts, rows, dates: read.rows.filter((r) => r.date).map((r) => ({ name: r.name, on: r.start })) }
}

/** Fair Oaks D's own team files (G-136), from a copy changed first, and the same job with no schedule and no Start to bring them into. */
function fairOaks(change: (p: GcProject) => GcProject = (p) => p) {
  const state = initialGcState()
  const project = change(jobOf(state, 'fairoaksd'))
  const m = scheduleMeasures(state, project)
  const bars = ganttBars(m.items, m.float, waitHolds(state, project), state.today, true)
  const job = { name: project.name, place: project.address, company: GC_COMPANY.name, by: 'Robert Douglas', finishWords: '', doneWords: null, customer: customerSchedulePicture(state, project) }
  const base = { bars, by: 'trade' as const, milestones: m.milestones, waits: waitRows(state, project), today: state.today, building: true, job }
  const team = scheduleExport({ ...base, for: 'team' })
  const bare: GcProject = { ...project, schedule: undefined, startedOn: null }
  return { state, project, bare, xml: scheduleMspdi(team), csv: scheduleCsv(team), owner: scheduleCsv(scheduleExport({ ...base, for: 'customer' })) }
}

/** An activity by what it is: an inspection by its name, a line by its id. */
const keyOf = (a: { lineId: string; inspection?: { label: string } }) => a.inspection?.label ?? a.lineId

/** Each activity's dates, waits and gaps, by name, so two schedules can be laid side by side whatever their new ids. */
function byName(s: ProjectSchedule) {
  const name = (id: string) => keyOf(s.activities.find((a) => a.lineId === id) ?? { lineId: id })
  return Object.fromEntries(
    s.activities.map((a) => [keyOf(a), { start: a.start, finish: a.finish, after: a.after.map(name).sort(), lag: Object.fromEntries(Object.entries(a.lag ?? {}).map(([id, g]) => [name(id), g])) }]),
  )
}

const datesOf = (s: ProjectSchedule) => Object.fromEntries(s.milestones.map((m) => [m.label, m.planned]))

describe('reading a file (G-137)', () => {
  it('says what it could not read, a sentence for each kind, and keeps the limits and gaps it can', () => {
    const task = (uid: number, name: string, extra = '') => `<Task><UID>${uid}</UID><Name>${name}</Name><OutlineLevel>${name === 'Group' ? 1 : 2}</OutlineLevel>${extra}</Task>`
    const dates = (s: string, f: string) => `<Start>${s}T08:00:00</Start><Finish>${f}T17:00:00</Finish>`
    const link = (uid: number, type = 1, lag = 0, format = 7, cross = 0) => `<PredecessorLink><PredecessorUID>${uid}</PredecessorUID><Type>${type}</Type><CrossProject>${cross}</CrossProject><LinkLag>${lag}</LinkLag><LagFormat>${format}</LagFormat></PredecessorLink>`
    const xml = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><MinutesPerDay>480</MinutesPerDay><Tasks>
      ${task(0, 'Whole job', '<Summary>1</Summary><OutlineLevel>0</OutlineLevel>')}
      ${task(1, 'Group', `<Summary>1</Summary>${dates('2026-11-02', '2026-12-31')}`)}
      ${task(2, 'Footings', dates('2026-11-02', '2026-11-06'))}
      ${task(3, 'Walls', `${dates('2026-11-10', '2026-11-20')}${link(2, 1, 14400, 8)}${link(1)}${link(99)}${link(2, 1, 0, 7, 1)}<ConstraintType>4</ConstraintType><ConstraintDate>2026-11-09T08:00:00</ConstraintDate>`)}
      ${task(4, 'Roof', `${dates('2026-11-23', '2026-11-30')}${link(3, 1, 500, 19)}${link(3, 3)}${link(6)}<ConstraintType>7</ConstraintType><ConstraintDate>2026-12-04T17:00:00</ConstraintDate><PercentComplete>20</PercentComplete>`)}
      ${task(5, 'Paint', `${dates('2026-12-01', '2026-12-04')}${link(4)}<ConstraintType>4</ConstraintType><ConstraintDate>2026-12-01T08:00:00</ConstraintDate>`)}
      ${task(6, 'Old task', `<Active>0</Active>${dates('2026-11-02', '2026-11-03')}`)}
      ${task(7, 'Dry-in', `<Milestone>1</Milestone>${dates('2026-11-30', '2026-11-30')}${link(4)}`)}
      ${task(8, 'No dates yet')}
    </Tasks></Project>`
    const read = reading(readScheduleFile(xml, 'theirs.xml'))
    expect(read.unread).toEqual([
      '1 wait does not start when the work before ends. The app has only that kind, so it is left out.',
      "1 wait runs to or from a date. The app's waits run between work, so it is left out.",
      '1 wait is on a group, not on work, so it is left out.',
      '2 waits are on work outside this file, so they are left out.',
      '1 wait has its gap as a percent, so it is left out.',
      '1 task has no start or finish, so it is left out.',
      '1 task is marked inactive, so it is left out.',
      'The file says what is done. That comes from the trades and the walk, so it is passed over.',
    ])
    // An elapsed gap counts every hour: 14,400 tenths of a minute is one elapsed day, not three working days.
    expect(read.rows.find((r) => r.name === 'Walls')).toMatchObject({ after: [{ key: 'task:2', gap: 1 }], notBefore: '2026-11-09' })
    expect(read.rows.find((r) => r.name === 'Roof')).toMatchObject({ mustFinishBy: '2026-12-04', notBefore: null })
    // Held on its own start is G-136's hold on every task, not a limit.
    expect(read.rows.find((r) => r.name === 'Paint')?.notBefore).toBeNull()
    expect(read.waits).toBe(2)
  })

  it('reads our own spreadsheets: the waits by their names, Excel’s dates after an edit, a cell we guarded', () => {
    const { csv, owner } = fairOaks()
    const read = reading(readScheduleFile(csv, 'fair-oaks.csv'))
    expect([read.format, read.rows.length, read.waits]).toEqual(['spreadsheet', 34, 43])
    // "Rough-in inspection" names the inspection and the date to meet: a wait means the inspection.
    const trim = read.rows.find((r) => r.name === 'Trim' && r.trade === 'Plumbing')
    const roughIn = read.rows.find((r) => r.name === 'Rough-in inspection' && !r.date)
    expect(trim?.after.map((a) => a.key)).toContain(roughIn?.key)
    // Saved again by Excel: no byte-order mark, and the US dates it writes.
    const excel = csv.replace(/^﻿/, '').replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y: string, m: string, d: string) => `${Number(m)}/${Number(d)}/${y}`)
    expect(reading(readScheduleFile(excel, 'fair-oaks.csv')).rows).toEqual(read.rows)
    const guarded = csv.replace('Plumbing,Top out,activity', "Plumbing,'=Top out,activity")
    expect(reading(readScheduleFile(guarded, 'x.csv')).rows.map((r) => r.name)).toContain('=Top out')
    // The owner's copy: its stages are activities, its dates to meet are dates.
    const stages = reading(readScheduleFile(owner, 'owner.csv'))
    expect([stages.rows.filter((r) => !r.date).length, stages.rows.filter((r) => r.date).length]).toEqual([10, 4])
  })

  it('refuses a file it cannot read, and says what to ask for', () => {
    expect(readScheduleFile('…', 'schedule.mpp')).toEqual({ problem: 'Only its own program opens this file. Ask them to save it from Project or Primavera with Save as XML.' })
    for (const xml of ['<Project><Tasks>', '<?xml version="1.0"?><Schedule xmlns="http://example.test"/>']) expect(readScheduleFile(xml, 'x.xml')).toEqual({ problem: 'This file is not Microsoft Project’s XML. Ask them to save it from Project or Primavera with Save as XML.' })
    expect(readScheduleFile('Task Name,Start,Finish\r\nFraming,10/1/2026,10/9/2026\r\n', 'x.csv')).toEqual({ problem: 'This spreadsheet’s columns are not the ones Export writes. Ask them for the project file instead.' })
  })
})

describe('the guess, left for the office to tick (G-137)', () => {
  it('reads our own spreadsheet’s Kind and Trade first, so every row of our export lands where it came from', () => {
    const { project, bare, csv } = fairOaks()
    const read = reading(readScheduleFile(csv, 'fair-oaks.csv'))
    const guess = guessPlaces(bare, read)
    const lineOf = (row: { name: string; trade: string | null }) => importLines(project).find((l) => l.label === row.name && l.trade === row.trade)?.lineId
    for (const r of read.rows.filter((x) => !x.date)) {
      const g = guess.get(r.key)
      if (r.kind === 'inspection') expect(g?.why).toBe('our spreadsheet says inspection')
      else expect([g?.place, g?.why]).toEqual([{ kind: 'line', lineId: lineOf(r) }, 'our spreadsheet’s Trade column'])
    }
  })
})

describe('the schedule it makes, through the first draft’s own path (G-137)', () => {
  /** Fair Oaks D with two days of cure before the slab, as its dates allow, so a gap rides the round trip. */
  const withGap = (p: GcProject): GcProject => ({ ...p, schedule: p.schedule && { ...p.schedule, activities: p.schedule.activities.map((a) => (a.lineId === 'fconc-2' ? { ...a, lag: { 'fconc-1': 2 } } : a)) } })

  it('brings Fair Oaks D’s own files back as its schedule: dates, waits, gaps, inspections and dates to meet', () => {
    const { project, bare, xml, csv } = fairOaks(withGap)
    const original = project.schedule as ProjectSchedule
    for (const [file, text] of [['fair-oaks.xml', xml], ['fair-oaks.csv', csv]] as const) {
      const made = importedSchedule(bare, plan(bare, reading(readScheduleFile(text, file)), '2026-07-06'))
      expect(byName(made.schedule)).toEqual(byName(original))
      expect(datesOf(made.schedule)).toEqual(datesOf(original))
      expect([made.kept, made.drawn, made.notes]).toEqual([30, 0, []])
      // The things the work waits on stay on the job's waits: no activity of theirs comes in.
      expect(made.schedule.activities.some((a) => a.added)).toBe(false)
    }
  })

  it('makes the same schedule from the project file as from the spreadsheet (the lead’s pin)', () => {
    const { bare, xml, csv } = fairOaks(withGap)
    const fromXml = importedSchedule(bare, plan(bare, reading(readScheduleFile(xml, 'f.xml')), '2026-07-06'))
    const fromCsv = importedSchedule(bare, plan(bare, reading(readScheduleFile(csv, 'f.csv')), '2026-07-06'))
    expect(fromCsv.schedule).toEqual(fromXml.schedule)
    expect(fromCsv.schedule.activities).toHaveLength(30)
  })

  it('brings Not before and Must finish by back from the spreadsheet only, as G-136 writes them there only', () => {
    const limits = (p: GcProject): GcProject => ({ ...p, schedule: p.schedule && { ...p.schedule, activities: p.schedule.activities.map((a) => (a.lineId === 'froof-3' ? { ...a, notBefore: '2026-10-10', mustFinishBy: '2026-10-23' } : a)) } })
    const { bare, xml, csv } = fairOaks(limits)
    const fromCsv = importedSchedule(bare, plan(bare, reading(readScheduleFile(csv, 'f.csv')), '2026-07-06'))
    const fromXml = importedSchedule(bare, plan(bare, reading(readScheduleFile(xml, 'f.xml')), '2026-07-06'))
    expect(fromCsv.schedule.activities.find((a) => a.lineId === 'froof-3')).toMatchObject({ notBefore: '2026-10-10', mustFinishBy: '2026-10-23' })
    expect(fromXml.schedule.activities.find((a) => a.lineId === 'froof-3')?.mustFinishBy).toBeUndefined()
  })
})
