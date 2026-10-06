// @vitest-environment jsdom
/**
 * Bring in a schedule a customer or the architect hands us (the Gantt's G-137,
 * `to-dos/gc-mode/mockups/G-137.md`): reading the two files G-136 writes, the guess, the schedule it
 * makes through the first draft's own kernel, the doors and the words. Studio Ocotillo's made-up
 * file for Helotes Dental Office, and Fair Oaks D's own export brought back. jsdom for its XML
 * parser only.
 */
import { describe, expect, it } from 'vitest'
import { GC_COMPANY, initialGcState } from './gcFixture'
import { daysBetween, scheduleMeasures } from './gcBuildingSchedule'
import { addDays } from './gcBuilding'
import { ganttBars } from './gcGantt'
import { waitHolds, waitRows } from './gcScheduleWaits'
import { customerSchedulePicture } from './gcCustomerSchedule'
import { scheduleDraft } from './gcNewProject'
import { scheduleCsv, scheduleExport, scheduleMspdi } from './gcScheduleExport'
import { IMPORT_INTRO, IMPORT_REPLACES, togetherWords, guessPlaces, importHoldsWords, importLines, importRefusal, importedSchedule, notInWords, notPlacedWords, readScheduleFile, type ScheduleFileReading, type ScheduleFileResult } from './gcScheduleImport'
import { HELOTES_SAMPLE_FILE, HELOTES_SAMPLE_XML } from './gcScheduleImportSample'
import { gcReducer } from './gcReducer'
import { linePctOf, partSpans } from './gcSplitBars'
import { plainWordsFailures } from '../plainWords'
import type { GcAction, GcProject, GcState, ProjectSchedule, ScheduleImport, ScheduleImportPlace, ScheduleImportRow } from './gcTypes'

const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const jobOf = (state: GcState, id: string) => state.projects.find((p) => p.id === id) as GcProject
const lastLog = (s: GcState) => s.log[0]?.text ?? ''

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

/** Helotes Dental Office, with the office's picks from the mockup: MEP rough-in on Plumbing's Rough in, Casework install on the Reception desk, the punch list left out. */
function helotes(state = initialGcState()) {
  const project = jobOf(state, 'helotes')
  const read = reading(readScheduleFile(HELOTES_SAMPLE_XML, HELOTES_SAMPLE_FILE))
  const line = (label: string): ScheduleImportPlace => ({ kind: 'line', lineId: importLines(project).find((l) => l.label === label)?.lineId ?? '' })
  const imp = { ...plan(project, read, '2026-11-02', { 'MEP rough-in': line('Rough in'), 'Casework install': line('Reception desk') }), file: HELOTES_SAMPLE_FILE }
  return { state, project, read, line, imp }
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

/** Every wait holds: an activity starts after what it waits on ends, with its gap. */
function brokenWaits(s: ProjectSchedule): string[] {
  const by = new Map(s.activities.map((a) => [a.lineId, a]))
  return s.activities.flatMap((a) => a.after.filter((p) => a.start <= addDays(by.get(p)?.finish ?? '0000-01-01', a.lag?.[p] ?? 0)).map((p) => `${keyOf(a)} on ${p}`))
}

describe('reading a file (G-137)', () => {
  it('reads Studio Ocotillo’s Project file: its activities, dates and waits, and what it could not read', () => {
    const read = reading(readScheduleFile(HELOTES_SAMPLE_XML, HELOTES_SAMPLE_FILE))
    expect([read.format, read.title]).toEqual(['project', 'Helotes Dental Office'])
    expect(importHoldsWords(read)).toBe('What it holds: 13 activities, 14 waits between them and 4 dates.')
    expect(read.rows.filter((r) => r.date).map((r) => [r.name, r.start])).toEqual([
      ['Building permit issued', '2026-10-30'],
      ['Notice to proceed', '2026-11-02'],
      ['Substantial completion', '2027-01-29'],
      ['Owner move-in', '2027-02-05'],
    ])
    expect(read.rows.find((r) => r.name === 'Metal stud framing')).toMatchObject({ groups: ['Underground and framing'], start: '2026-11-09', finish: '2026-11-20', after: [{ key: 'task:5', gap: 0 }] })
    // Three days of gap in working days, as the file's minutes a day count them.
    expect(read.rows.find((r) => r.name === 'Casework install')?.after).toEqual([{ key: 'task:12', gap: 3 }])
    // The start-to-start wait and the two waits to or from a date are left out, and said.
    expect(read.rows.find((r) => r.name === 'Dental equipment, by owner')?.after).toEqual([])
    expect(read.rows.find((r) => r.name === 'Underground plumbing')?.after).toEqual([])
    expect(read.unread).toEqual(['1 wait does not start when the work before ends. The app has only that kind, so it is left out.', "2 waits run to or from a date. The app's waits run between work, so they are left out."])
    // The program's summary of the whole job and the groups are never rows.
    expect(read.rows.map((r) => r.name)).not.toContain('Helotes Dental Office')
    expect(read.rows.map((r) => r.name)).not.toContain('Rough-in')
  })

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
  it('places each of Studio Ocotillo’s rows on Helotes with its reason, as the mockup has it', () => {
    const { project, read } = helotes()
    const guess = guessPlaces(project, read)
    const lines = importLines(project)
    const where = (p: ScheduleImportPlace | { kind: 'out' } | null | undefined) => {
      if (!p) return 'not placed'
      if (p.kind !== 'line') return p.kind
      const l = lines.find((x) => x.lineId === p.lineId)
      return `${l?.trade}: ${l?.label}`
    }
    expect(read.rows.filter((r) => !r.date).map((r) => [r.name, where(guess.get(r.key)?.place), guess.get(r.key)?.why])).toEqual([
      ['Underground plumbing', 'Plumbing: Underground', 'the word plumbing'],
      ['Metal stud framing', 'Framing and drywall: Framing', 'the word framing'],
      ['MEP rough-in', 'not placed', "rough is in Electrical's lines and in Plumbing's"],
      ['HVAC ductwork', 'HVAC: Ductwork', 'the word HVAC'],
      ['Above-ceiling inspection', 'inspection', 'the word inspection'],
      ['Hang, tape and finish', 'Framing and drywall: Hang and tape', 'the word hang'],
      ['Acoustical ceilings', 'Framing and drywall: Ceilings', 'the word ceilings'],
      ['Casework install', 'not placed', 'Millwork, 3 lines in its stage'],
      ['Dental equipment, by owner', 'out', 'by owner'],
      ['Plumbing trim', 'Plumbing: Trim', 'the word plumbing'],
      ['Electrical devices and fixtures', 'Electrical: Devices', 'the word electrical'],
      ['Final inspection', 'finalInspection', 'the word final'],
      ['Punch list', 'not placed', 'no trade in its name'],
    ])
    // A date is ticked, never guessed.
    for (const r of read.rows.filter((x) => x.date)) expect(guess.has(r.key)).toBe(false)
  })

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

  it('draws our lines not in the file the first draft’s way, from the day after what they wait on, and breaks no wait', () => {
    const { project, imp } = helotes()
    const made = importedSchedule(project, imp)
    const draft = scheduleDraft(project, imp.workStarts)
    const acts = new Map(made.schedule.activities.map((a) => [a.lineId, a]))
    expect(made.notIn.map((l) => l.label)).toEqual(['Panels and feeders', 'Lighting', 'Low voltage rough', 'Split systems', 'Controls', 'Top out', 'Operatory cabinets', 'Break room'])
    for (const line of made.notIn) {
      const drawn = draft.activities.find((a) => a.lineId === line.lineId)
      const a = acts.get(line.lineId)
      if (!drawn || !a) throw new Error(`no ${line.label}`)
      // The first draft's days and waits, held against scheduleDraft itself.
      expect(daysBetween(a.start, a.finish)).toBe(daysBetween(drawn.start, drawn.finish))
      expect(a.after).toEqual(drawn.after)
      const from = a.after.reduce((m, p) => {
        const d = addDays(acts.get(p)?.finish ?? m, 1)
        return d > m ? d : m
      }, imp.workStarts)
      expect(a.start).toBe(from)
    }
    expect(brokenWaits(made.schedule)).toEqual([])
    // Plumbing's Top out runs after their Rough in, a crew's lines one after another.
    const roughIn = acts.get(importLines(project).find((l) => l.label === 'Rough in')?.lineId ?? '')
    expect(acts.get(importLines(project).find((l) => l.label === 'Top out')?.lineId ?? '')?.start).toBe(addDays(roughIn?.finish ?? '', 1))
    expect(made.inspectionsNotIn).toEqual(['Rough-in inspection'])
    expect(made.pastFinal).toEqual(['Lighting', 'Controls'])
    // Their substantial completion takes the place of ours, keeping its id; their other dates are new.
    expect(made.schedule.milestones.map((m) => [m.id, m.label, m.planned])).toEqual([
      ['helotes-roughin', 'Rough-in inspection', acts.get('helotes-insp-roughin')?.finish],
      ['helotes-substantial', 'Substantial completion', '2027-01-29'],
      ['helotes-date-1', 'Building permit issued', '2026-10-30'],
      ['helotes-date-2', 'Notice to proceed', '2026-11-02'],
      ['helotes-date-3', 'Owner move-in', '2027-02-05'],
    ])
    expect(made.words).toBe("Drew the schedule on Helotes Dental Office from Studio Ocotillo's file helotes-schedule.xml. 11 of their activities are on our schedule, with 4 dates to meet. 8 of our lines were drawn as the first draft draws them.")
  })

  it('makes two of theirs on one line its parts as their file names them, and one bar when a part would be shorter than a day (after G-39)', () => {
    const { project, read, line } = helotes()
    const both = { 'Acoustical ceilings': line('Hang and tape'), 'MEP rough-in': line('Rough in') }
    const hangId = importLines(project).find((l) => l.label === 'Hang and tape')?.lineId ?? ''
    const made = importedSchedule(project, plan(project, read, '2026-11-02', both))
    const hang = made.schedule.activities.find((a) => a.lineId === hangId) as ProjectSchedule['activities'][number]
    // The line spans both. Each of theirs is a part of it, named as their file names it, counted from the line's start, its
    // share from its days, at the line's own percent: Hill Country Interiors reported Hang and tape at 60.
    expect([hang.start, hang.finish]).toEqual(['2026-12-09', '2026-12-30'])
    expect(hang.parts).toEqual([
      { id: `${hangId}-p1`, name: 'Hang, tape and finish', from: 0, days: 10, share: 50, pct: 60 },
      { id: `${hangId}-p2`, name: 'Acoustical ceilings', from: 12, days: 10, share: 50, pct: 60 },
    ])
    expect(partSpans(hang).map((p) => [p.part.name, p.start, p.finish])).toEqual([
      ['Hang, tape and finish', '2026-12-09', '2026-12-18'],
      ['Acoustical ceilings', '2026-12-21', '2026-12-30'],
    ])
    expect(linePctOf(hang.parts ?? [])).toBe(60)
    expect(togetherWords(made)).toEqual(['Hang and tape: 2 of theirs, each a part of it.'])
    // Their waits as before: the ceilings' wait on the drywall is a wait on itself, so it goes; the trims wait on the line.
    expect(hang.after).toEqual(['helotes-insp-1'])
    const trim = made.schedule.activities.find((a) => importLines(project).find((l) => l.lineId === a.lineId)?.label === 'Trim')
    expect(trim?.after).toEqual([hangId])
    expect(brokenWaits(made.schedule)).toEqual([])
    // Their ceilings half a day in their file: one bar from the first start to the last finish, and the window says why.
    const halfDay = HELOTES_SAMPLE_XML.replace(/(<Name>Acoustical ceilings<\/Name>[\s\S]*?<Finish>)2026-12-30T17:00:00(<\/Finish><Duration>)PT\d+H0M0S/, '$12026-12-21T12:00:00$2PT4H0M0S')
    const short = reading(readScheduleFile(halfDay, HELOTES_SAMPLE_FILE))
    expect(short.rows.filter((r) => r.underADay).map((r) => r.name)).toEqual(['Acoustical ceilings'])
    const oneBar = importedSchedule(project, plan(project, short, '2026-11-02', both))
    const span = oneBar.schedule.activities.find((a) => a.lineId === hangId)
    expect([span?.start, span?.finish, span?.parts]).toEqual(['2026-12-09', '2026-12-21', undefined])
    expect(togetherWords(oneBar)).toEqual(['Hang and tape: 2 of theirs as one bar. One of them is shorter than a day.'])
    // Two of theirs with one name cannot be told apart as parts: one bar too.
    const twins = reading(readScheduleFile(HELOTES_SAMPLE_XML.replace('<Name>Acoustical ceilings</Name>', '<Name>Hang, tape and finish</Name>'), HELOTES_SAMPLE_FILE))
    const same = importedSchedule(project, plan(project, twins, '2026-11-02', { ...both, 'Hang, tape and finish': line('Hang and tape') }))
    expect(same.schedule.activities.find((a) => a.lineId === hangId)?.parts).toBeUndefined()
    expect(togetherWords(same)).toEqual(['Hang and tape: 2 of theirs as one bar. Two of them have the same name.'])
  })

  it('leaves out a wait their own dates break, and says so', () => {
    const { project, read } = helotes()
    const imp = plan(project, read, '2026-11-02')
    // Their framing moved a week earlier by hand, before the underground it waits on is done.
    const moved = { ...imp, rows: imp.rows.map((r) => (r.name === 'Metal stud framing' ? { ...r, start: '2026-11-04' } : r)) }
    const made = importedSchedule(project, moved)
    expect(made.notes).toEqual(['Framing starts before Underground ends in their file, so its wait on Underground is left out.'])
    expect(brokenWaits(made.schedule)).toEqual([])
  })

  it('keeps the rough untouched on a job whose rough was drawn (the lead’s pin), and draws the lines not in the file with its stage days', () => {
    let state = play(initialGcState(), { type: 'setRough', projectId: 'boerne', start: '2026-11-02', days: { structure: 25 }, by: 'Robert Douglas' }, { type: 'markWon', projectId: 'boerne' })
    const before = jobOf(state, 'boerne')
    expect([before.stage, Boolean(before.rough)]).toEqual(['buyout', true])
    const { xml } = fairOaks()
    const imp = plan(before, reading(readScheduleFile(xml, 'fair-oaks.xml')), '2026-11-02', {}, 'Cibolo Creek Partners')
    state = play(state, { type: 'importSchedule', projectId: 'boerne', imported: imp, by: 'Robert Douglas' })
    const after = jobOf(state, 'boerne')
    expect(after.rough).toBe(before.rough)
    expect(after.rough).toEqual(before.rough)
    expect(after.schedule?.activities.length).toBeGreaterThan(30)
    // Boerne's lines Fair Oaks' file does not name keep the days the first draft gives them with the rough's stage days.
    const made = importedSchedule(before, imp)
    const draft = scheduleDraft(before, imp.workStarts, before.rough?.days)
    expect(made.notIn.length).toBeGreaterThan(0)
    for (const line of made.notIn) {
      const a = after.schedule?.activities.find((x) => x.lineId === line.lineId)
      const d = draft.activities.find((x) => x.lineId === line.lineId)
      expect(a && d && daysBetween(a.start, a.finish)).toBe(d && daysBetween(d.start, d.finish))
    }
  })
})

describe('the doors (G-137)', () => {
  it('makes the first schedule on a job with none, in one press, with its log line', () => {
    const { state, imp } = helotes()
    const next = play(state, { type: 'importSchedule', projectId: 'helotes', imported: imp, by: 'Robert Douglas' })
    expect(jobOf(next, 'helotes').schedule).toEqual(importedSchedule(jobOf(state, 'helotes'), imp).schedule)
    expect(lastLog(next)).toBe("Drew the schedule on Helotes Dental Office from Studio Ocotillo's file helotes-schedule.xml. 11 of their activities are on our schedule, with 4 dates to meet. 8 of our lines were drawn as the first draft draws them.")
  })

  it('takes the place of a first draft drawn before Start that nobody walked or moved', () => {
    const drawn = play(initialGcState(), { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
    expect(importRefusal(jobOf(drawn, 'helotes'))).toBeNull()
    const { imp } = helotes(drawn)
    const next = play(drawn, { type: 'importSchedule', projectId: 'helotes', imported: imp, by: 'Robert Douglas' })
    expect(jobOf(next, 'helotes').schedule).toEqual(importedSchedule(jobOf(drawn, 'helotes'), imp).schedule)
  })

  it('is refused while bidding, on a lost job, past Start, after a walk or a move, and while a what-if copy is open', () => {
    const state = initialGcState()
    const drawn = play(state, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-05' })
    const helo = jobOf(drawn, 'helotes')
    const schedule = helo.schedule as ProjectSchedule
    const refusals: [string, GcProject][] = [
      ['While we bid, the rough schedule is the one to draw.', jobOf(state, 'boerne')],
      ['This job was lost.', { ...jobOf(state, 'helotes'), lostOn: '2026-09-30' }],
      ['This job started Wed Jul 1. A new set of plans is the way to change its schedule now.', jobOf(state, 'fairoaksd')],
      ['The schedule was walked. Its record stays as it is.', { ...helo, schedule: { ...schedule, walks: [{ id: 'w1', on: '2026-10-01', by: 'Robert Douglas', kept: [], moveIds: [], skipped: 0 }] } }],
    ]
    // A move saved with its reason, before Start.
    const framing = schedule.activities.find((a) => importLines(helo).find((l) => l.lineId === a.lineId)?.label === 'Framing') as ProjectSchedule['activities'][number]
    const moved = play(drawn, { type: 'setScheduleActivity', projectId: 'helotes', lineId: framing.lineId, start: addDays(framing.start, 2), finish: addDays(framing.finish, 2), after: framing.after, why: { reason: 'crew', note: 'The framers start Wednesday.', by: 'Robert Douglas' } })
    expect(jobOf(moved, 'helotes').schedule?.moves).toHaveLength(1)
    refusals.push(['The schedule has moves with their reasons. They stay as they are.', jobOf(moved, 'helotes')])
    for (const [words, project] of refusals) expect(importRefusal(project)).toBe(words)
    // The made-up data records no walk on Fair Oaks D: Start is what keeps it shut.
    expect(jobOf(state, 'fairoaksd').schedule?.walks ?? []).toEqual([])
    // The reducer holds the same doors: past Start, and with a what-if copy open.
    const { imp } = helotes()
    const fair = play(state, { type: 'importSchedule', projectId: 'fairoaksd', imported: imp, by: 'Robert Douglas' })
    expect(fair).toBe(state)
    const copy = play(drawn, { type: 'startWhatIf', projectId: 'helotes', by: 'Robert Douglas' })
    expect(importRefusal(jobOf(copy, 'helotes'))).toBe('A what-if copy is open. Keep it or throw it away first.')
    expect(play(copy, { type: 'importSchedule', projectId: 'helotes', imported: imp, by: 'Robert Douglas' })).toBe(copy)
  })
})

describe('the words (G-137)', () => {
  it('speaks to a first-timer: one idea a sentence, none over 20 words, no dashes, semicolons or parentheses', () => {
    const { project, read, imp } = helotes()
    const made = importedSchedule(project, imp)
    const refused = [jobOf(initialGcState(), 'boerne'), jobOf(initialGcState(), 'fairoaksd'), { ...project, lostOn: '2026-09-30' }].map((p) => importRefusal(p) ?? '')
    const lines = [...IMPORT_INTRO, IMPORT_REPLACES, importHoldsWords(read), ...read.unread, notPlacedWords(1) ?? '', notPlacedWords(3) ?? '', ...notInWords(made), ...refused, made.words, ...made.notes]
    expect(notInWords(made)).toEqual([
      'Electrical: Panels and feeders, Lighting and Low voltage rough.',
      'HVAC: Split systems and Controls.',
      'Plumbing: Top out.',
      'Millwork: Operatory cabinets and Break room.',
      "The first draft's rough-in inspection is not in it either. It is drawn after the work it waits on.",
      'Lighting and Controls run into their final inspection. Look at them before Start.',
    ])
    expect(notPlacedWords(0)).toBeNull()
    for (const l of lines) expect(plainWordsFailures(l)).toEqual([])
  })
})
