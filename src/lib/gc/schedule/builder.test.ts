/**
 * The schedule builder's kernel (punch list #204, PR 1): a template of phases and rows put on a job from a
 * start day. The quick-lube shell of `testTemplate.ts` on Fair Oaks D (`testState.ts`), a Monday start on
 * working days and on every day, a template saved before read as rows, a built job's shape as rows and
 * back, and the words before the draw.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcProject, GcState } from '../types'
import { weekdayOf } from './network'
import { FINAL_INSPECTION, OFFICE_WHO, ROUGH_IN_INSPECTION, findRow, rowLandings, rowRef, rowsDraft, rowsFit, rowsFitLines, rowsFitWords, templateRows } from './builder'
import { scheduleDraft } from './draft'
import { drawWeeks } from './rough'
import { templateShape } from './templates'
import { initialGcState } from './testState'
import { QUICK_LUBE_PHASES, QUICK_LUBE_ROWS, quickLubeTemplate } from './testTemplate'
import type { ProjectSchedule, ScheduleActivity, TemplateRow } from './types'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
const MONDAY = '2026-11-02'

/** An activity by what it is called: a line by its id, an inspection or the job's own work by its name. */
function byName(schedule: ProjectSchedule, name: string): ScheduleActivity {
  const a = schedule.activities.find((x) => x.lineId === name || x.inspection?.label === name || x.added?.label === name)
  if (!a) throw new Error(`no activity ${name}`)
  return a
}
const isWeekend = (day: string) => weekdayOf(day) === 0 || weekdayOf(day) === 6

/** Four Office rows: a 5-day one, a 15-day one, one after the first with a gap of one, one right after it. */
const FOUR: TemplateRow[] = [
  { phase: 'one', label: 'Five days', who: { kind: 'office' }, days: 5, after: [], offset: 0, milestone: false },
  { phase: 'one', label: 'Fifteen days', who: { kind: 'office' }, days: 15, after: [], offset: 0, milestone: false },
  { phase: 'one', label: 'A gap of one', who: { kind: 'office' }, days: 1, after: [{ row: 'Five days', gap: 1 }], offset: 0, milestone: false },
  { phase: 'one', label: 'Right after', who: { kind: 'office' }, days: 1, after: [{ row: 'Five days' }], offset: 0, milestone: false },
]
const fourRows = (workingDays: boolean) => ({ phases: [{ key: 'one', name: 'The one phase' }], rows: FOUR, workingDays })

describe('the calendar (call 4)', () => {
  it('counts working days from a Monday: a 5-day row ends Friday, a 15-day row the third Friday, a gap of one crosses the weekend', () => {
    const s = rowsDraft(job(initialGcState(), 'fairoaksd'), MONDAY, fourRows(true))
    expect(byName(s, 'Five days')).toMatchObject({ start: '2026-11-02', finish: '2026-11-06' })
    expect(byName(s, 'Fifteen days')).toMatchObject({ start: '2026-11-02', finish: '2026-11-20' })
    // Friday, then Monday as the gap day, then Tuesday.
    expect(byName(s, 'A gap of one')).toMatchObject({ start: '2026-11-10', finish: '2026-11-10', after: [byName(s, 'Five days').lineId], lag: { [byName(s, 'Five days').lineId]: 1 } })
    expect(byName(s, 'Right after')).toMatchObject({ start: '2026-11-09', finish: '2026-11-09' })
  })

  it('counts every day with the switch off, as every template saved before', () => {
    const s = rowsDraft(job(initialGcState(), 'fairoaksd'), MONDAY, fourRows(false))
    expect(byName(s, 'Five days')).toMatchObject({ start: '2026-11-02', finish: '2026-11-06' })
    expect(byName(s, 'Fifteen days')).toMatchObject({ start: '2026-11-02', finish: '2026-11-16' })
    expect(byName(s, 'A gap of one')).toMatchObject({ start: '2026-11-08', finish: '2026-11-08' })
    expect(byName(s, 'Right after')).toMatchObject({ start: '2026-11-07', finish: '2026-11-07' })
  })

  it('never starts a row on a weekend when it counts working days, and lets one sit there when it counts every day', () => {
    const saturday = '2026-11-07'
    expect(byName(rowsDraft(job(initialGcState(), 'fairoaksd'), saturday, fourRows(true)), 'Five days')).toMatchObject({ start: '2026-11-09', finish: '2026-11-13' })
    expect(byName(rowsDraft(job(initialGcState(), 'fairoaksd'), saturday, fourRows(false)), 'Five days')).toMatchObject({ start: '2026-11-07', finish: '2026-11-11' })
  })
})

describe('the quick-lube shell on Fair Oaks D from Mon Nov 2, working days (D4)', () => {
  const t = templateRows(quickLubeTemplate())
  const fo = job(initialGcState(), 'fairoaksd')
  const s = rowsDraft(fo, MONDAY, t)
  const own = (name: string) => byName(s, name)

  it('is 52 rows in 8 phases with 6 dates to meet, as the mock-up lists them', () => {
    expect(QUICK_LUBE_ROWS).toHaveLength(52)
    expect(QUICK_LUBE_PHASES).toHaveLength(8)
    expect(QUICK_LUBE_ROWS.filter((r) => r.milestone)).toHaveLength(6)
    expect(t.workingDays).toBe(true)
  })

  it('dates the first two phases as the mock-up does', () => {
    expect(own('Notice to proceed and precon meeting')).toMatchObject({ start: '2026-11-02', finish: '2026-11-06', added: { label: 'Notice to proceed and precon meeting', who: OFFICE_WHO, doneOn: null }, packageId: '', phase: 'Preconstruction and procurement' })
    expect(own('Submittals, permits and approvals')).toMatchObject({ start: '2026-11-09', finish: '2026-11-27' })
    // A gap of five working days after the notice, then the start date, a milestone on Mon Nov 16; the row after it starts that day.
    expect(s.milestones.find((m) => m.label === 'Start date')).toMatchObject({ planned: '2026-11-16', packageId: null, phase: 'Preconstruction and procurement' })
    expect(own('Mobilize, temp facilities, SWPPP and fencing')).toMatchObject({ start: '2026-11-16', finish: '2026-11-18', packageId: 'fsite', added: { who: 'Sitework' }, phase: 'Preconstruction and procurement' })
    expect(own('Layout and sawcut limits')).toMatchObject({ start: '2026-11-20', finish: '2026-11-24' })
    expect(own('Erosion control, silt fence and inlet protection')).toMatchObject({ start: '2026-11-25', finish: '2026-11-26' })
    expect(own('Light demolition')).toMatchObject({ start: '2026-11-30', finish: '2026-12-01' })
    expect(own('Rough grading and building pad')).toMatchObject({ start: '2026-12-02', finish: '2026-12-10' })
    expect(own('Underground sanitary sewer, lift station and boring')).toMatchObject({ start: '2026-11-30', finish: '2026-12-18', packageId: 'fplumb', added: { who: 'Our own crew' }, phase: 'Sitework and utilities' })
    // A Us row named like our own package's line lands on that line.
    expect(own('fplumb-1')).toMatchObject({ start: '2026-12-14', finish: '2026-12-16', packageId: 'fplumb', phase: 'Sitework and utilities' })
    expect(own('fplumb-1').added).toBeUndefined()
    expect(own('Underground storm drainage')).toMatchObject({ start: '2026-12-17', finish: '2026-12-18', after: ['fplumb-1'] })
    // Fri Dec 25 is a holiday: the chart marks it and works it.
    expect(own('Site underground electrical and service conduits')).toMatchObject({ start: '2026-12-21', finish: '2026-12-25', packageId: 'felec', added: { who: 'Electrical' } })
    expect(own('fconc-1')).toMatchObject({ start: '2026-12-28', finish: '2027-01-01', phase: 'Foundations and slab' })
  })

  it('lands a row whose trade the job has no package for with no company yet, and never touches the scope book (call 7)', () => {
    expect(own('Paving')).toMatchObject({ packageId: '', added: { label: 'Paving', who: 'Paving', doneOn: null }, phase: 'Exterior sitework' })
    expect(own('Dumpster enclosure foundation and walls')).toMatchObject({ packageId: '', added: { who: 'Masonry' } })
    expect(s.milestones.find((m) => m.label === 'Paving done')).toMatchObject({ packageId: null, phase: 'Exterior sitework' })
    expect(fo.packages.map((k) => k.trade)).not.toContain('Paving')
  })

  it('draws an Office row named an inspection as the city’s inspection, the two the first draft draws by their own ids', () => {
    expect(own(ROUGH_IN_INSPECTION)).toMatchObject({ lineId: 'fairoaksd-insp-roughin', packageId: '', inspection: { label: ROUGH_IN_INSPECTION }, phase: 'MEP rough-in' })
    expect(own(FINAL_INSPECTION)).toMatchObject({ lineId: 'fairoaksd-insp-final', inspection: { label: FINAL_INSPECTION }, phase: 'Commissioning and closeout' })
    expect(own('Slab inspection')).toMatchObject({ lineId: 'fairoaksd-insp-slab-inspection', packageId: '', inspection: { label: 'Slab inspection' } })
    expect(s.activities.filter((a) => a.inspection)).toHaveLength(3)
  })

  it('puts the rough-in inspection after the job’s own rough-ins the template has no row for, and moves what waits on it', () => {
    const insp = own(ROUGH_IN_INSPECTION)
    // The template's three waits, and the job's rough-in lines drawn by the stage rules, all before it.
    for (const id of ['fplumb-2', 'fhvac-1', own('Electrical rough-in').lineId, 'felec-1', 'felec-2', 'fhvac-2', 'fplumb-3']) {
      expect(insp.after).toContain(id)
      expect(byName(s, id).finish < insp.start).toBe(true)
    }
    expect(own('Hang and tape drywall').start > insp.finish).toBe(true)
    // The final inspection comes after every line of the job, rowed or not, and after its own seven waits; the punch list follows it.
    const final = own(FINAL_INSPECTION)
    for (const a of s.activities.filter((x) => !x.inspection && !x.added)) expect(a.finish < final.start, a.lineId).toBe(true)
    for (const name of ['Flooring', 'Set lube equipment and lifts', 'Doors, hardware and millwork', 'Electrical trim and lighting', 'fhvac-4', 'Striping and signs', 'Landscaping and irrigation']) {
      expect(final.after).toContain(byName(s, name).lineId)
      expect(byName(s, name).finish < final.start).toBe(true)
    }
    expect(own('Punch list and cleaning')).toMatchObject({ after: [final.lineId] })
    expect(own('Punch list and cleaning').start > final.finish).toBe(true)
  })

  it('draws the job’s lines in no row by the stage days, with no phase', () => {
    const noRow = s.activities.filter((a) => !a.inspection && !a.added && a.phase === undefined)
    expect(noRow.map((a) => a.lineId).sort()).toEqual(['felec-1', 'felec-2', 'felec-3', 'felec-4', 'fhvac-2', 'fhvac-3', 'fplumb-3', 'fplumb-4', 'froof-2', 'froof-3', 'froof-4', 'fsite-1', 'fsite-2', 'fsite-3', 'fsite-4', 'fsteel-1', 'fsteel-2', 'fconc-2'].sort())
    expect(noRow.every((a) => a.after.every((id) => s.activities.some((b) => b.lineId === id)))).toBe(true)
  })

  it('carries every row’s phase by name, lets no rowed bar start on a weekend, and keeps every id once', () => {
    const names = QUICK_LUBE_PHASES.map((p) => p.name)
    const rowed = s.activities.filter((a) => a.phase !== undefined)
    expect(rowed).toHaveLength(52 - 6)
    expect(rowed.every((a) => names.includes(a.phase ?? ''))).toBe(true)
    expect(rowed.some((a) => isWeekend(a.start))).toBe(false)
    expect(s.milestones.every((m) => names.includes(m.phase ?? '') && !isWeekend(m.planned))).toBe(true)
    expect(new Set(s.activities.map((a) => a.lineId)).size).toBe(s.activities.length)
    expect(s.activities.every((a) => a.after.every((id) => s.activities.some((b) => b.lineId === id)))).toBe(true)
    expect(s.milestones.map((m) => m.label)).toEqual(['Start date', 'Slab on grade pour and finish', 'Roof on', 'Paving done', 'Punch list done', 'Certificate of occupancy'])
  })

  it('reads a wait on a milestone row as waits on what that milestone waits on, and dates it from the milestone', () => {
    // Mobilize waits on Start date, which waits on the notice with a gap of five: the bar waits on the notice, with that gap.
    const notice = own('Notice to proceed and precon meeting').lineId
    expect(own('Mobilize, temp facilities, SWPPP and fencing')).toMatchObject({ after: [notice], lag: { [notice]: 5 } })
    // A milestone on a trade belongs to its package.
    expect(s.milestones.find((m) => m.label === 'Roof on')).toMatchObject({ packageId: 'froof', phase: 'Building shell' })
  })
})

describe('where each row lands (rowLandings)', () => {
  it('names the trade on the job’s own work on a package, and on the work with no package', () => {
    const fo = job(initialGcState(), 'fairoaksd')
    const lands = rowLandings(fo, QUICK_LUBE_ROWS)
    const of = (label: string) => lands[QUICK_LUBE_ROWS.findIndex((r) => r.label === label)]
    // The four Office rows before it are the job's own work too: its id is the fifth.
    expect(of('Mobilize, temp facilities, SWPPP and fencing')).toEqual({ kind: 'added', lineId: 'fairoaksd-own-5', packageId: 'fsite', who: 'Sitework' })
    expect(of('Underground')).toMatchObject({ kind: 'line', lineId: 'fplumb-1', packageId: 'fplumb', trade: 'Plumbing' })
    expect(of('Paving')).toMatchObject({ kind: 'added', packageId: '', who: 'Paving' })
    expect(of('Start date')).toEqual({ kind: 'milestone', id: 'fairoaksd-ms-1', packageId: null })
    expect(of('Slab on grade pour and finish')).toEqual({ kind: 'milestone', id: 'fairoaksd-ms-2', packageId: 'fconc' })
    expect(lands.filter((l) => l.kind === 'line')).toHaveLength(9)
  })

  it('names a row by its label, or by who and label when another row has the same label', () => {
    const rows: TemplateRow[] = [
      { phase: 'a', label: 'Rough-in', who: { kind: 'trade', trade: 'Plumbing' }, days: 5, after: [], offset: 0, milestone: false },
      { phase: 'a', label: 'Rough-in', who: { kind: 'trade', trade: 'Electrical' }, days: 5, after: [], offset: 0, milestone: false },
      { phase: 'a', label: 'Drywall', who: { kind: 'trade', trade: 'Framing and drywall' }, days: 5, after: [], offset: 0, milestone: false },
    ]
    expect(rowRef(rows, rows[0]!)).toBe('Plumbing · Rough-in')
    expect(rowRef(rows, rows[2]!)).toBe('Drywall')
    expect(findRow(rows, 'electrical · rough-in')).toBe(rows[1])
    expect(findRow(rows, 'Rough-in')).toBe(rows[0])
    expect(findRow(rows, 'drywall')).toBe(rows[2])
    expect(findRow(rows, 'Paint')).toBeNull()
  })
})

describe('a template saved before, read as rows', () => {
  const s0 = initialGcState()
  const fo = job(s0, 'fairoaksd')
  const old = { lines: templateShape(s0, fo)!.lines }

  it('reads its lines as trade rows in their stage as the phase, the two inspections as Office rows, and the waits by name', () => {
    const t = templateRows(old)
    expect(t.workingDays).toBe(false)
    expect(t.rows).toHaveLength(29)
    // Fair Oaks D has no close-in line, so no Close-in phase.
    expect(t.phases.map((p) => p.key)).toEqual(['sitePrep', 'foundations', 'underground', 'slab', 'structure', 'dryIn', 'roughIn', 'trim', 'siteFinish', 'closeout'])
    expect(t.phases[0]).toEqual({ key: 'sitePrep', name: 'Site prep' })
    expect(t.rows.find((r) => r.label === 'Structural steel')).toMatchObject({ phase: 'structure', who: { kind: 'trade', trade: 'Structural steel' }, days: 19, after: [{ row: 'Foundations' }], offset: 9, milestone: false })
    expect(t.rows.find((r) => r.label === ROUGH_IN_INSPECTION)).toMatchObject({ phase: 'roughIn', who: { kind: 'office' }, days: 2 })
    expect(t.rows.find((r) => r.label === FINAL_INSPECTION)).toMatchObject({ phase: 'closeout', who: { kind: 'office' } })
  })

  it('draws its own job back onto its own dates', () => {
    const drawn = rowsDraft(fo, '2026-07-06', templateRows(old))
    for (const a of fo.schedule!.activities) {
      if (a.inspection && !(a.inspection.label === ROUGH_IN_INSPECTION || a.inspection.label === FINAL_INSPECTION)) continue
      expect(byName(drawn, a.lineId), a.lineId).toMatchObject({ start: a.start, finish: a.finish })
    }
  })

  it('reads a template with rows as its own rows, and names its phases after the keys when it has none', () => {
    const t = templateRows(quickLubeTemplate())
    expect(t.rows).toBe(QUICK_LUBE_ROWS)
    expect(t.phases).toBe(QUICK_LUBE_PHASES)
    const bare = templateRows({ lines: [], rows: QUICK_LUBE_ROWS.slice(0, 2), workingDays: true })
    expect(bare.phases).toEqual([{ key: 'precon', name: 'precon' }])
  })
})

describe('a built job’s shape as rows, and back (templateShape v2)', () => {
  const s0 = initialGcState()
  /** Fair Oaks D with the job's own work on the chart: a cure after the slab, nothing waiting on it. */
  const fo: GcProject = (() => {
    const p = job(s0, 'fairoaksd')
    const cure: ScheduleActivity = { lineId: 'fairoaksd-own-1', packageId: '', start: '2026-08-29', finish: '2026-09-04', after: ['fconc-2'], added: { label: 'Slab cure', who: 'Cure time', doneOn: null } }
    return { ...p, schedule: { ...p.schedule!, activities: [...p.schedule!.activities, cure] } }
  })()
  const shape = templateShape(s0, fo)!

  it('keeps every trade line, our own lines as Us, the inspections and the job’s own work as Office, and the milestones', () => {
    expect(shape.workingDays).toBe(false)
    expect(shape.lines).toHaveLength(29)
    expect(shape.rows).toHaveLength(27 + 3 + 1 + 4)
    expect(shape.rows.filter((r) => r.who.kind === 'us').map((r) => r.label)).toEqual(['Underground', 'Rough in', 'Top out', 'Trim'])
    expect(shape.rows.filter((r) => r.who.kind === 'office' && !r.milestone).map((r) => r.label)).toEqual(['Slab cure', 'Electrical service inspection', ROUGH_IN_INSPECTION, FINAL_INSPECTION])
    expect(shape.rows.filter((r) => r.milestone).map((r) => r.label)).toEqual(['Slab poured', 'Dry-in', ROUGH_IN_INSPECTION, 'Substantial completion'])
    expect(shape.phases.map((p) => p.name)).toEqual(['Site prep', 'Foundations', 'Underground', 'Slab', 'Structure', 'Dry-in', 'Rough-in', 'Trim', 'Site finish', 'Closeout'])
  })

  it('gives the job’s own work the stage of what it waits on, and a milestone the bar that finished last before its day', () => {
    expect(shape.rows.find((r) => r.label === 'Slab cure')).toMatchObject({ phase: 'slab', who: { kind: 'office' }, days: 7, after: [{ row: 'Slab on grade' }], offset: 0 })
    expect(shape.rows.find((r) => r.label === 'Electrical service inspection')).toMatchObject({ phase: 'roughIn', after: [{ row: 'Service and gear' }], offset: 20, days: 1 })
    expect(shape.rows.find((r) => r.label === 'Slab poured')).toMatchObject({ phase: 'slab', who: { kind: 'trade', trade: 'Concrete' }, after: [{ row: 'Slab on grade' }], offset: -1, milestone: true })
    expect(shape.rows.find((r) => r.label === 'Substantial completion')).toMatchObject({ phase: 'closeout', who: { kind: 'office' }, after: [{ row: FINAL_INSPECTION }], offset: 2 })
    // The milestone named like the inspection waits on the inspection, by who and name.
    const twice = shape.rows.filter((r) => r.label === ROUGH_IN_INSPECTION)
    expect(twice.map((r) => r.milestone)).toEqual([false, true])
    expect(twice[1]?.after).toEqual([{ row: `Office · ${ROUGH_IN_INSPECTION}` }])
    expect(findRow(shape.rows, `Office · ${ROUGH_IN_INSPECTION}`)).toBe(twice[0])
  })

  it('draws the job back onto its own dates, bar for bar and date for date', () => {
    const drawn = rowsDraft(fo, '2026-07-06', shape)
    for (const a of fo.schedule!.activities) {
      const name = a.inspection?.label ?? a.added?.label ?? a.lineId
      const b = byName(drawn, name)
      expect(b, name).toMatchObject({ start: a.start, finish: a.finish })
      if (!a.inspection && !a.added) expect([...b.after].sort(), name).toEqual([...a.after].sort())
    }
    expect(byName(drawn, 'Slab cure')).toMatchObject({ packageId: '', added: { label: 'Slab cure', who: OFFICE_WHO, doneOn: null }, phase: 'Slab' })
    for (const m of fo.schedule!.milestones) expect(drawn.milestones.find((x) => x.label === m.label), m.label).toMatchObject({ planned: m.planned, packageId: m.packageId })
    expect(drawn.activities).toHaveLength(fo.schedule!.activities.length)
  })

  it('still draws today’s first draft when no template is given, and keeps the old shape’s lines as they were', () => {
    const p = job(s0, 'fairoaksd')
    expect(scheduleDraft(p, MONDAY, undefined, [])).toEqual(scheduleDraft(p, MONDAY))
    expect(templateShape(s0, p)!.lines).toEqual(shape.lines)
  })
})

describe('the words before the draw (D3)', () => {
  const s0 = initialGcState()
  const fo = job(s0, 'fairoaksd')
  const t = templateRows(quickLubeTemplate())
  const fit = rowsFit(fo, MONDAY, t)!

  it('counts the rows, the trades, ours, the office’s, the dates to meet and the lines in no row', () => {
    expect(fit).toMatchObject({ rows: 52, phases: 8, start: MONDAY, onTrades: 21, trades: 6, ours: 5, ourTrade: 'Plumbing', office: 13 })
    expect(fit.noPackage).toEqual([
      { trade: 'Masonry', rows: 2 },
      { trade: 'Framing and drywall', rows: 3 },
      { trade: 'Glass and storefront', rows: 1 },
      { trade: 'Painting', rows: 1 },
      { trade: 'Flooring', rows: 1 },
      { trade: 'Doors and hardware', rows: 1 },
      { trade: 'Paving', rows: 3 },
      { trade: 'Landscaping', rows: 1 },
    ])
    expect(fit.milestones).toEqual(['Start date', 'Slab on grade pour and finish', 'Roof on', 'Paving done', 'Punch list done', 'Certificate of occupancy'])
    expect(fit.notIn).toHaveLength(18)
    expect(fit.notIn[0]).toEqual({ trade: 'Sitework', label: 'Clearing and grading' })
    const w = drawWeeks(rowsDraft(fo, MONDAY, t))!
    expect(fit).toMatchObject({ weeks: w.weeks, finish: w.finish })
    expect(fit.weeks).toBeGreaterThan(15)
  })

  it('says it in six labelled lines', () => {
    const lines = rowsFitLines(fit)
    expect(lines.map((l) => l.label)).toEqual(['Rows', 'Trades', 'Our crew', 'Office', 'Milestones', 'Not in it'])
    const words = Object.fromEntries(lines.map((l) => [l.label, l.words]))
    expect(words['Rows']).toMatch(/^52 rows in 8 phases land on this job\. It makes \d+ weeks to build, Mon Nov 2 to \w{3} \w{3} \d+\.$/)
    expect(words['Trades']).toMatch(/^21 rows land on this job's 6 trades\. 13 rows name a trade this job has no package for yet: Masonry, Framing and drywall/)
    expect(words['Trades']).toMatch(/Paving and Landscaping\. They land with No company yet\.$/)
    expect(words['Our crew']).toBe('5 rows are ours. They land on our Plumbing package.')
    expect(words['Office']).toBe("13 rows are the office's own work.")
    expect(words['Milestones']).toBe('6 dates to meet: Start date, Slab on grade pour and finish, Roof on, Paving done and Punch list done. Then Certificate of occupancy.')
    // Sentences of twenty words at most: the long second name opens a new one.
    expect(words['Not in it']).toMatch(/^18 lines of this job's scope book are in no row: Sitework's Clearing and grading\. Then Sitework's Utilities to 5 ft of the building, /)
    expect(words['Not in it']).toMatch(/\. They take the stage days\.$/)
  })

  it('says every sentence in plain words, here and on a job with nothing missing and nothing ours', () => {
    const everyWord = [rowsFitWords(fit)]
    // Helotes, in buyout: no Paving either, our own plumbing again.
    const helotes = rowsFit(job(s0, 'helotes'), MONDAY, t)!
    everyWord.push(rowsFitWords(helotes))
    // A template of one Office row on a job: nothing on the trades, nothing ours, one line in no row at most.
    const one = rowsFit(fo, MONDAY, fourRows(true))!
    expect(rowsFitLines(one).map((l) => l.words)).toEqual([
      expect.stringMatching(/^4 rows in 1 phase land on this job\./),
      'No row names a trade.',
      'No row is ours.',
      "4 rows are the office's own work.",
      'No dates to meet.',
      expect.stringMatching(/^27 lines of this job's scope book are in no row: /),
    ])
    everyWord.push(rowsFitWords(one))
    // One row, singular everywhere.
    const single = rowsFit(fo, MONDAY, { phases: [{ key: 'a', name: 'A' }], rows: [{ ...QUICK_LUBE_ROWS[10]!, phase: 'a' }], workingDays: true })!
    expect(rowsFitLines(single)[0]?.words).toMatch(/^1 row in 1 phase lands on this job\./)
    expect(rowsFitLines(single)[2]?.words).toBe('1 row is ours. It lands on our Plumbing package.')
    everyWord.push(rowsFitWords(single))
    expect(everyWord.flatMap((w) => plainWordsFailures(w))).toEqual([])
    for (const line of rowsFitLines(fit)) expect(plainWordsFailures(line.words)).toEqual([])
    expect(everyWord.every((w) => w.length > 0)).toBe(true)
  })
})
