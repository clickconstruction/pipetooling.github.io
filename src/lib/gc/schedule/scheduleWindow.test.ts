/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window's words. A first draft's
 * refusal, start day and log line, and the opened bar's card on Fair Oaks D, in plain words. Since
 * 9a, the job's own work put on the chart and a failed inspection, each with what it pushes.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcProject, GcState } from '../types'
import { chartHolds } from './chartHolds'
import { ganttBars, type GanttBar } from './gantt'
import { draftSchedule, scheduleMeasures } from './schedule'
import { addDays } from '../building'
import { planMove } from './moves'
import { barCardRows, changeTimeWords, draftRefusal, draftStart, draftWords, failInspectionPress, moveWords, ownWorkOffWords, ownWorkPress, partMovePress, redoWords, undoWords } from './scheduleWindow'
import { splitParts } from './splitBars'
import { initialGcState } from './testState'

const s = initialGcState()
const job = (st: GcState, id: string) => st.projects.find((p) => p.id === id)!

/** Fair Oaks D's bars as the chart draws them, with the chart's holds. */
function fairOaksBars(st: GcState = s): GanttBar[] {
  const p = job(st, 'fairoaksd')
  const m = scheduleMeasures(st, p)
  return ganttBars(m.items, m.float, chartHolds(st, p), st.today, true)
}
const rowsOf = (bars: GanttBar[], id: string, st: GcState = s) => barCardRows(bars.find((b) => b.id === id)!, bars, st.today, true)
const words = (rows: { label: string; words: string }[], label: string) => rows.filter((r) => r.label === label).map((r) => r.words)

/** Fair Oaks D with one of its bars changed. */
function withActivity(id: string, change: (a: NonNullable<GcProject['schedule']>['activities'][number]) => NonNullable<GcProject['schedule']>['activities'][number]): GcState {
  return {
    ...s,
    projects: s.projects.map((p) => (p.id === 'fairoaksd' && p.schedule ? { ...p, schedule: { ...p.schedule, activities: p.schedule.activities.map((a) => (a.lineId === id ? change(a) : a)) } } : p)),
  }
}

describe('a first draft', () => {
  it('is refused on a lost job and while we bid, a lost job first, as gc_schedule_draft refuses it', () => {
    expect(draftRefusal(job(s, 'boerne'))).toBe('While we bid, the rough schedule is the one to draw.')
    expect(draftRefusal({ ...job(s, 'helotes'), lostOn: '2026-10-01' })).toBe('This job was lost.')
    expect(draftRefusal({ ...job(s, 'boerne'), lostOn: '2026-10-01' })).toBe('This job was lost.')
    expect(draftRefusal(job(s, 'helotes'))).toBeNull()
    expect(draftRefusal(job(s, 'stoneoak'))).toBeNull()
  })

  it('starts on the job’s start day, else the rough’s, else the Monday after next', () => {
    expect(draftStart(job(s, 'fairoaksd'), s.today)).toBe('2026-07-06')
    // Friday Oct 2: the Monday after next is Oct 5, a week after the Monday of this week.
    expect(draftStart(job(s, 'helotes'), s.today)).toBe('2026-10-05')
    const rough = { start: '2026-11-02' } as NonNullable<GcProject['rough']>
    expect(draftStart({ ...job(s, 'helotes'), rough }, s.today)).toBe('2026-11-02')
    expect(draftStart({ ...job(s, 'helotes'), rough, startDate: '2026-10-19' }, s.today)).toBe('2026-10-19')
  })

  it('says its line in the log as the prototype’s reducer did', () => {
    const helotes = job(s, 'helotes')
    const draft = draftSchedule(helotes, '2026-10-05')
    expect(draftWords(helotes, draft, '2026-10-05')).toBe(`Drew a first draft of the schedule on Helotes Dental Office: ${draft.activities.length} activities from Mon Oct 5.`)
  })
})

describe('the opened bar’s card', () => {
  it('says a held bar’s days, spare days, what holds it and what it waits on, in plain words', () => {
    const rows = rowsOf(fairOaksBars(), 'felec-5')
    expect(words(rows, 'Planned')).toEqual(['Mon Oct 19 to Fri Oct 30'])
    expect(words(rows, 'Takes')).toEqual(['12 days, starts in 17'])
    expect(words(rows, 'Spare')).toEqual(['37 days before it moves the finish'])
    expect(rows.find((r) => r.label === 'Held')).toEqual({ label: 'Held', words: 'waits on current insurance, theirs ran out Sep 15', tone: 'amber' })
    expect(words(rows, 'Waits on')).toEqual(['Sidewalks and curbs in Concrete'])
    expect(words(rows, 'Holds up')).toEqual(['Final inspection'])
    expect(words(rows, 'Place')).toEqual(['Site, a guess from its name. Nobody has set it yet.'])
  })

  it('names another trade’s line with its trade, never in parentheses, one bar a row', () => {
    const rows = rowsOf(fairOaksBars(), 'fhvac-3')
    expect(words(rows, 'Waits on')).toEqual(['Rooftop units in HVAC', 'Rough-in inspection'])
    expect(words(rows, 'Holds up')).toEqual(['Test and balance in HVAC'])
    // The final inspection waits on ten bars: a row each, so no line runs past a sentence.
    expect(words(rowsOf(fairOaksBars(), fairOaksBars().find((b) => b.item.label === 'Final inspection')!.id), 'Waits on').length).toBeGreaterThan(5)
  })

  it('says every line of every bar on Fair Oaks D in plain words, the real days aside', () => {
    const bars = fairOaksBars()
    for (const b of bars) {
      for (const r of barCardRows(b, bars, s.today, true)) {
        // The real days are actualWords', the chart's own sentence, which keeps its semicolon.
        if (r.label === 'Really') continue
        expect(plainWordsFailures(r.words), `${b.item.label}: ${r.label}`).toEqual([])
      }
    }
  })

  it('says a bar on the critical path has no spare days, in red', () => {
    const bars = fairOaksBars()
    const critical = bars.find((b) => b.critical)!
    expect(barCardRows(critical, bars, s.today, true).find((r) => r.label === 'Spare')).toEqual({ label: 'Spare', words: 'None. A day lost here is a day lost on the finish.', tone: 'red' })
  })

  it('says a kept place as it is, and nothing about a place on an inspection', () => {
    const kept = withActivity('froof-1', (a) => ({ ...a, place: 'Roof' }))
    expect(words(rowsOf(fairOaksBars(kept), 'froof-1', kept), 'Place')).toEqual(['Roof'])
    const bars = fairOaksBars()
    const inspection = bars.find((b) => b.item.activity.inspection)!
    const rows = barCardRows(inspection, bars, s.today, true)
    expect(words(rows, 'Place')).toEqual([])
    expect(words(rows, 'Done')).toEqual([])
  })

  it('says each part of a split line as the walk does', () => {
    const a = job(s, 'fairoaksd').schedule!.activities.find((x) => x.lineId === 'froof-1')!
    const made = splitParts(a, [{ name: 'East half', start: a.start, finish: '2026-09-30' }, { name: 'West half', start: '2026-10-01', finish: a.finish }], 50)
    if (!('parts' in made)) throw new Error(made.problem)
    const split = withActivity('froof-1', (x) => ({ ...x, parts: made.parts }))
    const parts = words(rowsOf(fairOaksBars(split), 'froof-1', split), 'Part')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^East half: /)
    expect(parts[1]).toMatch(/^West half: /)
  })

  it('leaves the spare days and what holds it off a bar that is done', () => {
    const bars = fairOaksBars()
    const done = bars.find((b) => b.status === 'done')!
    const rows = barCardRows(done, bars, s.today, true)
    expect(words(rows, 'Spare')).toEqual([])
    expect(words(rows, 'Held')).toEqual([])
    expect(words(rows, 'Done')).toEqual(['100%'])
  })
})

describe('a move’s, an undo’s and a redo’s line in the log (PR 8a)', () => {
  const p = job(s, 'fairoaksd')
  const a = p.schedule!.activities.find((x) => x.lineId === 'froof-1')!

  it('says the bar’s new days, what it pushed and who said why, as the prototype’s reducer did', () => {
    const plan = planMove(p, a.lineId, addDays(a.start, 7), addDays(a.finish, 7))!
    expect(plan.problem).toBeNull()
    const words = moveWords(p, a.lineId, plan, { by: 'Robert', note: '  Rain kept the roof open a week.  ' })
    expect(words.startsWith(`Roofing · TPO membrane now runs Mon Sep 28 to Fri Oct 16.`)).toBe(true)
    expect(words.endsWith(' Robert: Rain kept the roof open a week.')).toBe(true)
    // What it pushed is said between, in the chart's words.
    if (plan.pushed.length > 0) expect(words).toMatch(/now runs Mon Sep 28 to Fri Oct 16\. .+ Robert: /)
  })

  it('says a move that pushes nothing with no line between', () => {
    const plan = { to: { start: '2026-11-02', finish: '2026-11-06' }, pushed: [] }
    expect(moveWords(p, a.lineId, plan, { by: 'Ann', note: 'The tile came early.' })).toBe('Roofing · TPO membrane now runs Mon Nov 2 to Fri Nov 6. Ann: The tile came early.')
  })

  it('says Undo and Redo as the prototype’s reducer did', () => {
    const move = { lineId: a.lineId, from: { start: '2026-09-21', finish: '2026-10-09' }, to: { start: '2026-09-28', finish: '2026-10-16' } }
    expect(undoWords(p, move, 'Robert')).toBe('Robert undid a move: Roofing · TPO membrane is back to Sep 21 to Oct 9.')
    expect(redoWords(p, move, 'Robert')).toBe('Robert put a move back: Roofing · TPO membrane is Sep 28 to Oct 16 again.')
  })

  it('says when a change was saved on the company’s clock, in the refusal’s words', () => {
    // 20:14 UTC on Nov 2 is 2:14 pm in Texas (CST); in October it is 3:14 pm (CDT).
    expect(changeTimeWords('2026-11-02T20:14:00+00:00')).toBe('2:14 pm')
    expect(changeTimeWords('2026-10-08T20:14:00Z')).toBe('3:14 pm')
    expect(changeTimeWords('2026-10-08T14:05:00Z')).toBe('9:05 am')
    expect(changeTimeWords('no time')).toBe('')
  })
})

describe('a part of a split line moved (PR 8b)', () => {
  /** Fair Oaks D with TPO membrane split into an east and a west half, as gc_schedule_split leaves it. */
  function split(): GcState {
    const a = job(s, 'fairoaksd').schedule!.activities.find((x) => x.lineId === 'froof-1')!
    const made = splitParts(a, [{ name: 'East half', start: a.start, finish: '2026-09-30' }, { name: 'West half', start: '2026-10-01', finish: a.finish }], 50)
    if (!('parts' in made)) throw new Error(made.problem)
    return withActivity('froof-1', (x) => ({ ...x, parts: made.parts }))
  }
  const why = { reason: 'weather' as const, note: 'Rain on the east side.', by: 'Robert' }

  it('moves only the part when its line keeps its days, and names the part in the log', () => {
    const st = split()
    const p = job(st, 'fairoaksd')
    // The west half a day later, still inside the line's days: the line keeps Sep 21 to Oct 9.
    const press = partMovePress(p, 'froof-1', 'froof-1-p2', '2026-10-02', '2026-10-09', why, st.today)!
    expect(press.words).toBe('Roofing · TPO membrane, West half now runs Fri Oct 2 to Fri Oct 9. Robert: Rain on the east side.')
    expect(press.move.parts).toMatchObject({ id: 'froof-1-p2', was: [{ id: 'froof-1-p1', from: 0 }, { id: 'froof-1-p2', from: 10 }], now: [{ id: 'froof-1-p1', from: 0 }, { id: 'froof-1-p2', from: 11 }] })
    expect(press.move).toMatchObject({ lineId: 'froof-1', reason: 'weather', by: 'Robert', from: { start: '2026-09-21', finish: '2026-10-09' }, to: { start: '2026-09-21', finish: '2026-10-09' } })
    const line = press.activities.find((x) => x.lineId === 'froof-1')!
    expect([line.start, line.finish]).toEqual(['2026-09-21', '2026-10-09'])
    expect(line.parts?.find((x) => x.id === 'froof-1-p2')?.from).toBe(11)
  })

  it('moves the line when its first part starts later, as its start is its first part\'s', () => {
    const st = split()
    const press = partMovePress(job(st, 'fairoaksd'), 'froof-1', 'froof-1-p1', '2026-09-22', '2026-09-30', why, st.today)!
    expect(press.words.startsWith('Roofing · TPO membrane now runs Tue Sep 22 to Fri Oct 9.')).toBe(true)
  })

  it('moves the line like any bar when the part goes past its end, pushes and all', () => {
    const st = split()
    const p = job(st, 'fairoaksd')
    const press = partMovePress(p, 'froof-1', 'froof-1-p2', '2026-10-01', '2026-10-16', why, st.today)!
    expect(press.words.startsWith('Roofing · TPO membrane now runs Mon Sep 21 to Fri Oct 16.')).toBe(true)
    expect(press.move.to).toEqual({ start: '2026-09-21', finish: '2026-10-16' })
    expect(press.move.parts?.id).toBe('froof-1-p2')
  })

  it('moves nothing for a part left where it was, or on a line with no parts', () => {
    const st = split()
    const p = job(st, 'fairoaksd')
    expect(partMovePress(p, 'froof-1', 'froof-1-p1', '2026-09-21', '2026-09-30', why, st.today)).toBeNull()
    expect(partMovePress(job(s, 'fairoaksd'), 'froof-1', 'froof-1-p1', '2026-09-22', '2026-09-30', why, s.today)).toBeNull()
  })
})

describe('the job’s own work and a failed inspection (PR 9a)', () => {
  const fairOaks = job(s, 'fairoaksd')
  const bar = (p: GcProject, id: string) => p.schedule!.activities.find((a) => a.lineId === id)!
  const withBars = (p: GcProject, activities: NonNullable<GcProject['schedule']>['activities']): GcProject => ({ ...p, schedule: { ...p.schedule!, activities } })

  it('puts the job’s own work on the chart with its waits, and pushes what waits on it from now on', () => {
    const made = ownWorkPress(fairOaks, { label: ' Slab cure ', who: 'Cure time', start: '2026-10-05', finish: '2026-10-14', after: ['froof-1'], holdsUp: ['froof-3'] }, 'Robert')!
    const own = made.activities.find((a) => a.added)!
    expect(own).toMatchObject({ lineId: 'fairoaksd-own-1', start: '2026-10-05', finish: '2026-10-14', after: ['froof-1'], added: { label: 'Slab cure', who: 'Cure time', doneOn: null } })
    // Sheet metal waits on it from now on, so it starts the day after the cure ends, its length kept.
    expect(bar(withBars(fairOaks, made.activities), 'froof-3')).toMatchObject({ start: '2026-10-15', finish: '2026-10-24', after: ['froof-1', 'fairoaksd-own-1'] })
    expect(made.words.startsWith(`Robert put Slab cure on ${fairOaks.name}'s schedule, Mon Oct 5 to Wed Oct 14, Cure time. 1 activity waits on it. `)).toBe(true)
    expect(made.words).toMatch(/Sheet metal and flashing moves to Thu Oct 15 to Sat Oct 24\.$/)
    expect(ownWorkOffWords(withBars(fairOaks, made.activities), own.lineId)).toBe(`Slab cure came off ${fairOaks.name}'s schedule.`)
  })

  it('puts nothing on the chart with no name, nobody’s, or a finish before its start', () => {
    const base = { label: 'Slab cure', who: 'Cure time', start: '2026-10-05', finish: '2026-10-14', after: [], holdsUp: [] }
    expect(ownWorkPress(fairOaks, { ...base, label: ' ' }, 'Robert')).toBeNull()
    expect(ownWorkPress(fairOaks, { ...base, who: '' }, 'Robert')).toBeNull()
    expect(ownWorkPress(fairOaks, { ...base, finish: '2026-10-01' }, 'Robert')).toBeNull()
  })

  it('moves a failed inspection to its re-inspection day, its days kept, and what waits on it out, with the reducer’s line', () => {
    const failed = failInspectionPress(fairOaks, 'fairoaksd-insp-roughin', { note: 'The bonding jumper is missing.', packageIds: ['felec', 'nope'], reinspectOn: '2026-11-02' }, s.today)!
    expect(failed.failure).toEqual({ on: s.today, note: 'The bonding jumper is missing.', packageIds: ['felec'], reinspectOn: '2026-11-02' })
    const after = withBars(fairOaks, failed.activities)
    expect(bar(after, 'fairoaksd-insp-roughin')).toMatchObject({ start: '2026-11-02', finish: '2026-11-03' })
    expect(bar(after, 'felec-4')).toMatchObject({ start: '2026-11-04', finish: '2026-11-22' })
    expect(bar(after, 'fhvac-3')).toMatchObject({ start: '2026-11-04', finish: '2026-11-15' })
    // Trim starts after the re-inspection already: it keeps its days.
    expect(bar(after, 'fplumb-4')).toEqual(bar(fairOaks, 'fplumb-4'))
    expect(failed.words).toBe(`The rough-in inspection failed on ${fairOaks.name}: The bonding jumper is missing. It was Electrical's work. Re-inspection Mon Nov 2. 2 activities after it move out.`)
  })

  it('keeps each gap down the line and leaves the rest of the plan alone: the known difference from the prototype’s whole-plan push', () => {
    // Fire alarm keeps 5 days after the inspection; Sheet metal starts beside TPO membrane, 3 days before it finishes (G-82).
    const gapped = withBars(
      fairOaks,
      fairOaks.schedule!.activities.map((a) =>
        a.lineId === 'felec-4' ? { ...a, lag: { 'fairoaksd-insp-roughin': 5 } } : a.lineId === 'froof-3' ? { ...a, start: '2026-10-07', finish: '2026-10-16', lag: { 'froof-1': -3 } } : a,
      ),
    )
    const failed = failInspectionPress(gapped, 'fairoaksd-insp-roughin', { note: 'Failed.', packageIds: [], reinspectOn: '2026-11-02' }, s.today)!
    const after = withBars(gapped, failed.activities)
    expect(bar(after, 'felec-4')).toMatchObject({ start: '2026-11-09', finish: '2026-11-27' })
    expect(bar(after, 'froof-3')).toEqual(bar(gapped, 'froof-3'))
    expect(failed.words).not.toMatch(/It was/)
  })

  it('records no failure for a passed inspection, a bar that is no inspection, no note, or a re-inspection not after today', () => {
    const input = { note: 'Failed.', packageIds: [], reinspectOn: '2026-11-02' }
    const passed = withBars(fairOaks, fairOaks.schedule!.activities.map((a) => (a.lineId === 'fairoaksd-insp-roughin' ? { ...a, inspection: { ...a.inspection!, passedOn: s.today } } : a)))
    expect(failInspectionPress(passed, 'fairoaksd-insp-roughin', input, s.today)).toBeNull()
    expect(failInspectionPress(fairOaks, 'froof-3', input, s.today)).toBeNull()
    expect(failInspectionPress(fairOaks, 'fairoaksd-insp-roughin', { ...input, note: '  ' }, s.today)).toBeNull()
    expect(failInspectionPress(fairOaks, 'fairoaksd-insp-roughin', { ...input, reinspectOn: s.today }, s.today)).toBeNull()
    expect(failInspectionPress({ ...fairOaks, stage: 'buyout' }, 'fairoaksd-insp-roughin', input, s.today)).toBeNull()
  })
})
