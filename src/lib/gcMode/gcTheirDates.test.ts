// @vitest-environment jsdom
/**
 * GC mode design spike: their dates to meet only, onto a running job (G-145). Cibolo Creek Partners'
 * master schedule for Fair Oaks D, read by G-137's reader, today Fri Oct 2: Notice to proceed passed,
 * Slab poured ours met, Dry-in 7 days later, the rough-in inspection 3 days later, substantial
 * completion 7 days earlier, and a new Grand opening. jsdom for the reader's XML parser only.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import { milestoneRows, scheduleMeasures, substantialCompletionOn } from './gcBuildingSchedule'
import { lateFinish } from './gcLateFinish'
import { ownerFinishRisk } from './gcOwnerBillingFinish'
import { customerSchedulePicture } from './gcCustomerSchedule'
import { readScheduleFile, type ScheduleFileReading, type ScheduleFileResult } from './gcScheduleImport'
import { THEIR_DATES_SAMPLE_FILE, THEIR_DATES_SAMPLE_XML } from './gcTheirDatesSample'
import { changeOrderWords, contractWords, differenceWords, rowNotes, theirDates, theirDatesLogWords, theirDatesRefusal, type TheirDate } from './gcTheirDates'
import { plainWordsFailures } from '../plainWords'
import type { GcAction, GcState, ScheduleMoveReason } from './gcTypes'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const FROM = 'Cibolo Creek Partners'

function reading(result: ScheduleFileResult): ScheduleFileReading {
  if ('problem' in result) throw new Error(result.problem)
  return result
}
const sample = () => reading(readScheduleFile(THEIR_DATES_SAMPLE_XML, THEIR_DATES_SAMPLE_FILE))
type Take = Extract<GcAction, { type: 'takeTheirDates' }>
const take = (dates: TheirDate[]): Take => ({ type: 'takeTheirDates', projectId: ID, file: THEIR_DATES_SAMPLE_FILE, from: FROM, dates, by: 'Robert' })
/** What the window sends untouched: every row that starts ticked, to the one of ours it starts on. */
const startTicked = (s: GcState): TheirDate[] =>
  theirDates(s, job(s), sample())
    .rows.filter((r) => r.ticked)
    .map((r) => ({ name: r.name, on: r.on, ours: r.ours }))
const CONTRACT: TheirDate = { name: 'Substantial completion', on: '2026-12-04', ours: 'fo-substantial' }
const dueOf = (s: GcState, id: string) => milestoneRows(s, job(s)).find((r) => r.milestone.id === id)

/** G-98's late job, as G-141's tests have it: Trim waits a week on the customer's tile decision, rain holds Test and balance nine days. Tue Dec 15, 4 days past Fri Dec 11. */
function lateJob(): GcState {
  const moveBy = (s: GcState, label: string, n: number, reason: ScheduleMoveReason, note: string) => {
    const a = scheduleMeasures(s, job(s)).items.find((i) => i.label === label)!.activity
    return gcReducer(s, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, n), finish: addDays(a.finish, n), after: a.after, why: { reason, note, by: 'Robert' } })
  }
  const s = gcReducer(initialGcState(), { type: 'setOwnerLateFinish', projectId: ID, perDay: 500 })
  return moveBy(moveBy(s, 'Trim', 7, 'customer', 'Waiting on the restroom tile decision.'), 'Test and balance', 9, 'weather', 'Rain kept the roof open a week.')
}

/** Every read of the contract's day: the chart's date, the Projected finish measure's days, Bill the customer's risk and G-141's ask. */
function contractReads(s: GcState) {
  const late = lateFinish(s, job(s))
  const risk = ownerFinishRisk(s, job(s))
  return {
    chart: dueOf(s, 'fo-substantial')?.due,
    measure: late.risk.past,
    risk: [risk.contract?.on, risk.past],
    ask: late.ask ? [late.ask.days, late.ask.contract?.from, late.ask.contract?.to] : null,
  }
}

describe('reading their file', () => {
  it('takes only the dates G-137’s reader marks, and counts their activities passed over', () => {
    const t = theirDates(initialGcState(), job(initialGcState()), sample())
    expect(t.rows.map((r) => [r.name, r.on])).toEqual([
      ['Notice to proceed', '2026-07-01'],
      ['Slab poured', '2026-08-28'],
      ['Dry-in', '2026-10-02'],
      ['Rough-in inspection', '2026-10-16'],
      ['Substantial completion', '2026-12-04'],
      ['Grand opening', '2027-01-15'],
    ])
    expect(t.activities).toBe(9)
    expect(t.ours.map((r) => r.milestone.label)).toEqual(['Dry-in', 'Rough-in inspection', 'Substantial completion'])
  })

  it('sets each beside ours by name, with the difference, what starts ticked and what never can', () => {
    const s = initialGcState()
    const t = theirDates(s, job(s), sample())
    const ours = new Map(t.ours.map((r) => [r.milestone.id, r]))
    expect(t.rows.map((r) => [r.name, r.ours, r.metOurs?.milestone.id ?? null, differenceWords(r.on, r.ours ? (ours.get(r.ours) ?? null) : null), r.ticked, rowNotes(s, job(s), r, r.ours ? (ours.get(r.ours) ?? null) : null)])).toEqual([
      ['Notice to proceed', null, null, 'a new date', false, ['That day has passed.']],
      ['Slab poured', null, 'fo-slab', 'a new date', false, ['Ours was met Thu Aug 27, so it stays.']],
      ['Dry-in', 'fo-dryin', null, '7 days later', true, []],
      ['Rough-in inspection', 'fo-roughin', null, '3 days later', true, []],
      ['Substantial completion', 'fo-substantial', null, '7 days earlier', false, ["This is the contract's finish. With theirs, the projected finish, Fri Dec 11, is 7 days past the contract."]],
      ['Grand opening', null, null, 'a new date', true, []],
    ])
  })

  it('says what the contract’s day does in the Projected finish measure’s words', () => {
    const s = initialGcState()
    expect([contractWords(s, job(s), '2026-12-04'), contractWords(s, job(s), '2026-12-18'), contractWords(s, job(s), '2026-12-11')]).toEqual([
      "This is the contract's finish. With theirs, the projected finish, Fri Dec 11, is 7 days past the contract.",
      "This is the contract's finish. With theirs, the projected finish, Fri Dec 11, leaves 7 days to spare.",
      "This is the contract's finish. With theirs, the projected finish, Fri Dec 11, leaves no days to spare.",
    ])
    expect(changeOrderWords(job(s), '2026-12-18')).toBeNull()
  })
})

describe('taking them', () => {
  it('writes only the dates to meet, a new one as the job’s own, and names the file in the log', () => {
    const before = initialGcState()
    const after = gcReducer(before, take(startTicked(before)))
    const was = job(before).schedule!
    const now = job(after).schedule!
    // Nothing else on the schedule moves: the same objects after as before.
    for (const key of ['activities', 'moves', 'baseline', 'baselines', 'lookAhead', 'walks', 'lateNotices'] as const) expect(now[key]).toBe(was[key])
    // The things the work waits on are the job's, and stay as they were.
    expect(job(after).waits).toBe(job(before).waits)
    expect(now.milestones.map((m) => [m.id, m.label, m.planned, m.packageId, m.metOn])).toEqual([
      ['fo-slab', 'Slab poured', '2026-08-28', 'fconc', '2026-08-27'],
      ['fo-dryin', 'Dry-in', '2026-10-02', 'froof', null],
      ['fo-roughin', 'Rough-in inspection', '2026-10-16', null, null],
      ['fo-substantial', 'Substantial completion', '2026-12-11', null, null],
      ['fairoaksd-ms-5-grand-opening', 'Grand opening', '2027-01-15', null, null],
    ])
    expect(after.log[0]?.text).toBe("Took 3 of Cibolo Creek Partners' dates to meet from cibolo-master.xml on Fair Oaks Shops, Building D.")
    expect(theirDatesLogWords(job(before), FROM, THEIR_DATES_SAMPLE_FILE, [{ name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' }])).toBe("Took Cibolo Creek Partners' date for Dry-in from cibolo-master.xml on Fair Oaks Shops, Building D.")
  })

  it('refuses what it never does', () => {
    const s = initialGcState()
    const copy = gcReducer(s, { type: 'startWhatIf', projectId: ID, by: 'Robert' })
    expect(theirDatesRefusal(job(copy))).toBe('A what-if copy is open. Keep it or throw it away first.')
    expect(gcReducer(copy, take(startTicked(s)))).toBe(copy)
    const refused: GcAction[] = [
      { ...take(startTicked(s)), projectId: 'helotes' },
      take([{ name: 'Slab poured', on: '2026-08-28', ours: 'fo-slab' }]),
      take([{ name: 'Dry-in', on: '2026-10-02', ours: 'nope' }]),
      take([{ name: 'Dry-in', on: 'Oct 2', ours: 'fo-dryin' }]),
      take([{ name: ' ', on: '2027-01-15', ours: null }]),
      take([{ name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' }, { name: 'Dry-in again', on: '2026-10-09', ours: 'fo-dryin' }]),
      take([]),
      { ...take(startTicked(s)), file: ' ' },
    ]
    for (const action of refused) expect(gcReducer(s, action)).toBe(s)
  })

  it('reads change orders’ days as part of their day, so nothing counts them twice', () => {
    // A signed time extension moved the contract 4 days, to Tue Dec 15 (G-141).
    let s = lateJob()
    s = gcReducer(s, { type: 'draftTimeExtension', projectId: ID })
    s = gcReducer(s, { type: 'sendChangeOrder', projectId: ID, changeOrderId: 'co-1' })
    s = gcReducer(s, { type: 'ownerSignChangeOrder', projectId: ID, changeOrderId: 'co-1' })
    const moved = substantialCompletionOn(job(s))!
    expect(moved.days).toBeGreaterThan(0)
    expect(changeOrderWords(job(s), '2026-12-18')).toBe(`Ours counts ${moved.days} days by change order, so it is due Fri Dec 18 as theirs.`)
    const after = gcReducer(s, take([{ name: 'Substantial completion', on: '2026-12-18', ours: 'fo-substantial' }]))
    expect(substantialCompletionOn(job(after))).toEqual({ planned: addDays('2026-12-18', -moved.days), days: moved.days, on: '2026-12-18' })
  })
})

describe('the lead’s pins: what reads the contract’s day after', () => {
  it('one take with substantial completion ticked moves the chart, the measure, Bill the customer’s risk and G-141’s ask together', () => {
    const s = lateJob()
    expect(contractReads(s)).toEqual({ chart: '2026-12-11', measure: 4, risk: ['2026-12-11', 4], ask: [5, '2026-12-11', '2026-12-16'] })
    const after = gcReducer(s, take([...startTicked(s), CONTRACT]))
    expect(contractReads(after)).toEqual({ chart: '2026-12-04', measure: 11, risk: ['2026-12-04', 11], ask: [5, '2026-12-04', '2026-12-09'] })
  })

  it('with it unticked none of them change, while Dry-in and the rough-in inspection do', () => {
    const s = lateJob()
    const after = gcReducer(s, take(startTicked(s)))
    expect(contractReads(after)).toEqual(contractReads(s))
    expect(lateFinish(after, job(after))).toEqual(lateFinish(s, job(s)))
    expect([dueOf(after, 'fo-dryin')?.due, dueOf(after, 'fo-dryin')?.state, dueOf(after, 'fo-roughin')?.due]).toEqual(['2026-10-02', 'due', '2026-10-16'])
    expect([dueOf(s, 'fo-dryin')?.state]).toEqual(['late'])
  })

  it('the customer reads the new days where they read dates, and nothing is sent', () => {
    const s = initialGcState()
    const after = gcReducer(s, take(startTicked(s)))
    expect(customerSchedulePicture(after, job(after)).milestones.map((r) => [r.milestone.label, r.due])).toEqual([
      ['Slab poured', '2026-08-28'],
      ['Dry-in', '2026-10-02'],
      ['Rough-in inspection', '2026-10-16'],
      ['Substantial completion', '2026-12-11'],
      ['Grand opening', '2027-01-15'],
    ])
    expect(job(after).scheduleSends).toBe(job(s).scheduleSends)
    expect(after.log.slice(1)).toEqual(s.log)
  })
})

describe('the words', () => {
  it('says every sentence in plain words', () => {
    const s = initialGcState()
    const t = theirDates(s, job(s), sample())
    const ours = new Map(t.ours.map((r) => [r.milestone.id, r]))
    const texts = [
      ...t.rows.flatMap((r) => rowNotes(s, job(s), r, r.ours ? (ours.get(r.ours) ?? null) : null)),
      contractWords(s, job(s), '2026-12-18'),
      contractWords(s, job(s), '2026-12-11'),
      'Ours counts 4 days by change order, so it is due Fri Dec 18 as theirs.',
      theirDatesLogWords(job(s), FROM, THEIR_DATES_SAMPLE_FILE, startTicked(s)),
      theirDatesLogWords(job(s), FROM, THEIR_DATES_SAMPLE_FILE, [{ name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' }]),
      theirDatesRefusal(job(gcReducer(s, { type: 'startWhatIf', projectId: ID, by: 'Robert' }))) ?? '',
      'Only their dates to meet come in. Nothing else on the schedule moves, and nothing is sent.',
      'In the file: 6 dates. Its 9 activities are passed over.',
      'Tick a date to take it.',
      'This file has no dates to meet.',
      'Two of their dates take the place of Dry-in.',
    ]
    for (const t2 of texts) expect([t2, plainWordsFailures(t2)]).toEqual([t2, []])
  })
})
