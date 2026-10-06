/**
 * GC mode design spike: one line as several bars (G-39, `to-dos/gc-mode/mockups/G-39.md`). Played
 * on Fair Oaks D, today Fri Oct 2: Pecan Valley's Lighting (Sep 14 to Oct 23, 40%) split into the
 * sales floor and the back of house. The line's percent is its parts' weighted sum, stored as
 * today, so the bill reads the line; the parts' days are counted from the line's start, so every
 * move of the line carries them.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays, payAppDraftPcts, payApplication } from './gcBuilding'
import { ownerPayApp } from './gcOwnerBilling'
import { billingForecast } from './gcBillingForecast'
import type { GcAction, GcState, ScheduleMoveReason } from './gcTypes'
import { draftShares, lineLabel, linePctOf, movedParts, partFacts, partMoveOf, partPcts, partSpans, partStanding, partsSummary, splitActivityOf, splitDrafts, splitParts } from './gcSplitBars'
import { moveRows, undoableMove } from './gcScheduleMoves'
import { companiesToTell, datesMessage } from './gcTellTrades'
import { planPull } from './gcPullEarlier'
import { recoveryOffers } from './gcRecovery'
import { plainWordsFailures } from '../plainWords'

const ID = 'fairoaksd'
const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const act = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!
const sov = (s: GcState, id: string) => job(s).packages.flatMap((k) => k.sow?.sov ?? []).find((l) => l.id === id)!
const span = (a: { start: string; finish: string }) => `${a.start}..${a.finish}`
const why = (reason: ScheduleMoveReason, note: string) => ({ reason, note, by: 'Robert' })
const split = (lineId: string, parts: { name: string; start: string; finish: string }[]): GcAction => ({ type: 'splitActivity', projectId: ID, lineId, parts, by: 'Robert' })
const undo = (s: GcState, moveId: string) => play(s, { type: 'undoScheduleMove', projectId: ID, moveId, by: 'Robert' })
/** A whole-line move, its start and finish by `days`, with a reason. */
function moveLine(s: GcState, lineId: string, days: number, finishOnly = false): GcState {
  const a = act(s, lineId)
  return play(s, { type: 'setScheduleActivity', projectId: ID, lineId, start: finishOnly ? a.start : addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: why('crew', 'Pecan Valley moved its crew to another job.') })
}

const s0 = initialGcState()
const LIGHTING = 'felec-3'
const SALES_BACK = [
  { name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' },
  { name: 'Back of house', start: '2026-10-10', finish: '2026-10-23' },
]
const s1 = play(s0, split(LIGHTING, SALES_BACK))
const report = (s: GcState, partId: string, pct: number) => play(s, { type: 'tradeReportPart', projectId: ID, packageId: 'felec', sovId: LIGHTING, partId, pct })

describe('splitting a line', () => {
  it('keeps the line: its dates and its 40%, shares from the days, each part starting at the line', () => {
    const a = act(s1, LIGHTING)
    expect(span(a)).toBe('2026-09-14..2026-10-23')
    expect(a.parts).toEqual([
      { id: 'felec-3-p1', name: 'Sales floor', from: 0, days: 26, share: 65, pct: 40 },
      { id: 'felec-3-p2', name: 'Back of house', from: 26, days: 14, share: 35, pct: 40 },
    ])
    expect(linePctOf(a.parts!)).toBe(40)
    expect(sov(s1, LIGHTING).pctReported).toBe(40)
    expect(partSpans(a).map((p) => [p.part.name, p.start, p.finish])).toEqual([
      ['Sales floor', '2026-09-14', '2026-10-09'],
      ['Back of house', '2026-10-10', '2026-10-23'],
    ])
    expect(s1.log[0]?.text).toBe('Robert split Electrical · Lighting on Fair Oaks Shops, Building D into 2 parts: Sales floor, Back of house.')
  })

  it('is refused unless the parts start and end with the line, each named once, with days, two or more', () => {
    const a = act(s0, LIGHTING)
    expect(splitParts(a, [SALES_BACK[0]!], 40)).toEqual({ problem: 'Split it into two parts or more.' })
    expect(splitParts(a, [{ ...SALES_BACK[0]!, name: ' ' }, SALES_BACK[1]!], 40)).toEqual({ problem: 'Give each part a name.' })
    expect(splitParts(a, [SALES_BACK[0]!, { ...SALES_BACK[1]!, name: 'sales floor' }], 40)).toEqual({ problem: 'Give each part its own name.' })
    expect(splitParts(a, [SALES_BACK[0]!, { ...SALES_BACK[1]!, finish: '2026-10-09' }], 40)).toEqual({ problem: 'Each part has to finish on or after it starts.' })
    expect(splitParts(a, [SALES_BACK[0]!, { ...SALES_BACK[1]!, finish: '2026-10-20' }], 40)).toEqual({
      problem: 'The first part starts Mon Sep 14 and the last ends Fri Oct 23, as the line does. Move a part after the split to change that.',
    })
    // Not twice, and never an inspection.
    expect(play(s1, split(LIGHTING, SALES_BACK))).toBe(s1)
    expect(play(s0, split('fairoaksd-insp-roughin', [{ name: 'A', start: '2026-10-12', finish: '2026-10-12' }, { name: 'B', start: '2026-10-13', finish: '2026-10-13' }]))).toBe(s0)
  })

  it("the window's shares follow the days as they are typed, adding up to 100", () => {
    expect(draftShares(SALES_BACK)).toEqual([65, 35])
    expect(draftShares([...SALES_BACK, { start: '2026-10-20', finish: '' }])).toEqual([65, 35, null])
    expect(draftShares([{ start: '2026-09-14', finish: '2026-09-16' }, { start: '2026-09-17', finish: '2026-09-19' }, { start: '2026-09-20', finish: '2026-09-22' }])).toEqual([34, 33, 33])
    expect(draftShares([{ start: '', finish: '' }])).toEqual([null])
  })

  it('offers two halves to start from, and Make it one bar keeps the percent and the dates', () => {
    expect(splitDrafts(act(s0, LIGHTING))).toEqual([
      { name: 'Part 1', start: '2026-09-14', finish: '2026-10-03' },
      { name: 'Part 2', start: '2026-10-04', finish: '2026-10-23' },
    ])
    const reported = report(s1, 'felec-3-p1', 60)
    const one = play(reported, { type: 'joinActivity', projectId: ID, lineId: LIGHTING, by: 'Robert' })
    expect(act(one, LIGHTING).parts).toBeUndefined()
    expect(span(act(one, LIGHTING))).toBe('2026-09-14..2026-10-23')
    expect(sov(one, LIGHTING).pctReported).toBe(sov(reported, LIGHTING).pctReported)
  })
})

describe('reports: the line is its parts weighted by their share', () => {
  it('after each part reports, the line equals the weighted sum, stored where the bill reads it', () => {
    const one = report(s1, 'felec-3-p1', 60)
    expect(sov(one, LIGHTING).pctReported).toBe(Math.round((60 * 65 + 40 * 35) / 100))
    expect(sov(one, LIGHTING).pctReported).toBe(linePctOf(act(one, LIGHTING).parts!))
    const two = report(one, 'felec-3-p2', 0)
    expect(sov(two, LIGHTING).pctReported).toBe(39)
    expect(sov(two, LIGHTING).pctReported).toBe(linePctOf(act(two, LIGHTING).parts!))
    const three = report(two, 'felec-3-p2', 100)
    expect(sov(three, LIGHTING).pctReported).toBe(Math.round((60 * 65 + 100 * 35) / 100))
    expect(two.log[0]?.text).toBe('Pecan Valley Electric reported Lighting, Back of house at 0%. Lighting is 39%.')
  })

  it("sets each part's real days, and the line's real finish waits for every part", () => {
    const started = report(s1, 'felec-3-p2', 50)
    expect(act(started, LIGHTING).parts?.[1]).toMatchObject({ actualStart: '2026-10-02' })
    const firstDone = report(started, 'felec-3-p1', 100)
    expect(act(firstDone, LIGHTING).parts?.[0]).toMatchObject({ actualStart: '2026-10-02', actualFinish: '2026-10-02' })
    expect(act(firstDone, LIGHTING).actualFinish).toBeUndefined()
    const allDone = report(firstDone, 'felec-3-p2', 100)
    expect(act(allDone, LIGHTING)).toMatchObject({ actualFinish: '2026-10-02' })
  })

  it('never below what is billed, and the line itself is reported a part at a time', () => {
    // Panels and feeders: 80% reported, 50% billed.
    const panels = play(s0, split('felec-2', [{ name: 'Panels', start: '2026-09-14', finish: '2026-09-23' }, { name: 'Feeders', start: '2026-09-24', finish: '2026-10-02' }]))
    expect(act(panels, 'felec-2').parts?.map((p) => p.share)).toEqual([53, 47])
    const under = play(panels, { type: 'tradeReportPart', projectId: ID, packageId: 'felec', sovId: 'felec-2', partId: 'felec-2-p1', pct: 0 })
    expect(under).toBe(panels)
    const over = play(panels, { type: 'tradeReportPart', projectId: ID, packageId: 'felec', sovId: 'felec-2', partId: 'felec-2-p1', pct: 30 })
    expect(sov(over, 'felec-2').pctReported).toBe(54)
    expect(play(s1, { type: 'tradeReport', projectId: ID, packageId: 'felec', sovId: LIGHTING, pct: 90 })).toBe(s1)
    // The portal offers only the picks the reducer takes: Panels at 30% or more keeps the line at 50% or more.
    expect(partPcts(act(panels, 'felec-2'), 'felec-2-p1', 50)).toEqual([30, 40, 50, 60, 70, 80, 90, 100])
    expect(partPcts(act(s1, LIGHTING), 'felec-3-p2', 0)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  })

  it('our own crew reports a split stage a part at a time, and the whole trade follows', () => {
    const crew = play(s0, split('fplumb-3', [{ name: 'Restrooms', start: '2026-09-28', finish: '2026-10-03' }, { name: 'Tenant bays', start: '2026-10-04', finish: '2026-10-09' }]))
    expect(play(crew, { type: 'selfReportStage', projectId: ID, packageId: 'fplumb', lineId: 'fplumb-3', pct: 90 })).toBe(crew)
    const done = play(crew, { type: 'selfReportPart', projectId: ID, packageId: 'fplumb', lineId: 'fplumb-3', partId: 'fplumb-3-p1', pct: 100 })
    const self = job(done).packages.find((k) => k.id === 'fplumb')!.selfPerform!
    expect(self.pctByLine?.['fplumb-3']).toBe(linePctOf(act(done, 'fplumb-3').parts!))
    expect(self.pctByLine?.['fplumb-3']).toBe(70)
  })
})

describe('the bill reads the line', () => {
  it("Pecan Valley's pay application, the customer's bill and the forecast are the same before and after a split", () => {
    const pkg = (s: GcState) => job(s).packages.find((k) => k.id === 'felec')!
    const next = (s: GcState) => payApplication(pkg(s).sow!, 3, payAppDraftPcts(pkg(s).sow!))
    expect(next(s1)).toEqual(next(s0))
    expect(ownerPayApp(s1, job(s1))).toEqual(ownerPayApp(s0, job(s0)))
    expect(billingForecast(s1, job(s1)).months).toEqual(billingForecast(s0, job(s0)).months)
  })
})

describe('moves: the line carries its parts, counted from its start', () => {
  const daysOf = (s: GcState, lineId: string) => act(s, lineId).parts!.map((p) => [p.id, p.from, p.days])

  it('a drag of the whole line moves its parts with it, and Undo brings them back', () => {
    const dragged = moveLine(s1, LIGHTING, 5)
    expect(span(act(dragged, LIGHTING))).toBe('2026-09-19..2026-10-28')
    expect(daysOf(dragged, LIGHTING)).toEqual(daysOf(s1, LIGHTING))
    expect(partSpans(act(dragged, LIGHTING)).map((p) => span(p))).toEqual(['2026-09-19..2026-10-14', '2026-10-15..2026-10-28'])
    const back = undo(dragged, job(dragged).schedule!.moves![0]!.id)
    expect(act(back, LIGHTING)).toEqual(act(s1, LIGHTING))
  })

  it('a push from the work before carries the parts, and Undo brings them back', () => {
    // Fire alarm waits on Lighting with 9 days of room; Lighting 12 days longer pushes it 3 days.
    const fire = play(s0, split('felec-4', [{ name: 'Devices', start: '2026-11-02', finish: '2026-11-12' }, { name: 'Panel and testing', start: '2026-11-13', finish: '2026-11-20' }]))
    const pushed = moveLine(fire, LIGHTING, 12, true)
    expect(span(act(pushed, 'felec-4'))).toBe('2026-11-05..2026-11-23')
    expect(daysOf(pushed, 'felec-4')).toEqual(daysOf(fire, 'felec-4'))
    const back = undo(pushed, job(pushed).schedule!.moves![0]!.id)
    expect(act(back, 'felec-4')).toEqual(act(fire, 'felec-4'))
  })

  it('a pull (G-37) carries the parts, and Undo brings them back', () => {
    // TPO membrane finished today, a week early; Sheet metal's submittal approved; Sheet metal split.
    const ready = play(
      s0,
      { type: 'sendSubmittalToArchitect', projectId: ID, submittalId: 'fairoaksd-sub-6' },
      { type: 'answerSubmittal', projectId: ID, submittalId: 'fairoaksd-sub-6', answer: 'approved', note: '' },
      { type: 'tradeReport', projectId: ID, packageId: 'froof', sovId: 'froof-1', pct: 100 },
      split('froof-3', [{ name: 'North side', start: '2026-10-12', finish: '2026-10-16' }, { name: 'South side', start: '2026-10-17', finish: '2026-10-21' }]),
    )
    const offer = planPull(ready, job(ready))!
    expect(offer.pulls.map((p) => p.lineId)).toContain('froof-3')
    const pulled = play(ready, { type: 'pullScheduleEarlier', projectId: ID, leaveOut: [], why: why('early', offer.note) })
    expect(span(act(pulled, 'froof-3'))).toBe('2026-10-05..2026-10-14')
    expect(daysOf(pulled, 'froof-3')).toEqual(daysOf(ready, 'froof-3'))
    const back = undo(pulled, job(pulled).schedule!.moves![0]!.id)
    expect(act(back, 'froof-3')).toEqual(act(ready, 'froof-3'))
  })

  it('days got back (G-82) carry the parts, the last part taking the shorter finish, and Undo brings them back', () => {
    // G-98's late job: Trim a week later, Test and balance nine days; Test and balance split.
    const late = play(moveLineBy(moveLineBy(s0, 'fplumb-4', 7, 'customer'), 'fhvac-4', 9, 'weather'), split('fhvac-4', [{ name: 'Air side', start: '2026-12-09', finish: '2026-12-11' }, { name: 'Water side', start: '2026-12-12', finish: '2026-12-13' }]))
    expect(recoveryOffers(late, job(late)).map((o) => o.key)).toContain('crew:fhvac-4')
    const got = play(late, { type: 'recoverScheduleDays', projectId: ID, key: 'crew:fhvac-4', why: why('recovery', 'Cool Breeze brings a second crew for the last days.') })
    expect(act(got, 'fhvac-4').finish).toBe('2026-12-12')
    expect(daysOf(got, 'fhvac-4')).toEqual(daysOf(late, 'fhvac-4'))
    expect(partSpans(act(got, 'fhvac-4')).map((p) => span(p))).toEqual(['2026-12-09..2026-12-11', '2026-12-12..2026-12-12'])
    const back = undo(got, job(got).schedule!.moves![0]!.id)
    expect(act(back, 'fhvac-4')).toEqual(act(late, 'fhvac-4'))
  })

  it('a part moved later moves the line, is a move with its reason, names the part, and Undo and Redo put the parts back', () => {
    const moved = play(s1, { type: 'moveActivityPart', projectId: ID, lineId: LIGHTING, partId: 'felec-3-p2', start: '2026-10-17', finish: '2026-10-30', why: why('crew', 'Pecan Valley is short a crew on the back of house.') })
    expect(span(act(moved, LIGHTING))).toBe('2026-09-14..2026-10-30')
    expect(partSpans(act(moved, LIGHTING)).map((p) => span(p))).toEqual(['2026-09-14..2026-10-09', '2026-10-17..2026-10-30'])
    const move = job(moved).schedule!.moves![0]!
    expect(move.parts).toEqual({ id: 'felec-3-p2', was: [{ id: 'felec-3-p1', from: 0, days: 26 }, { id: 'felec-3-p2', from: 26, days: 14 }], now: [{ id: 'felec-3-p1', from: 0, days: 26 }, { id: 'felec-3-p2', from: 33, days: 14 }] })
    expect(moveRows(job(moved))[0]?.what).toBe('Electrical · Lighting, Back of house moved from Oct 10 to Oct 23, to Oct 17 to Oct 30.')
    const told = companiesToTell(moved, job(moved), [move])
    expect(told.map((c) => c.lines.map((l) => [l.work, span(l.from), span(l.to)]))).toEqual([[['Lighting, Back of house', '2026-10-10..2026-10-23', '2026-10-17..2026-10-30']]])
    expect(datesMessage(job(moved), told[0]!.partner, told[0]!, 'en').lines).toContain('Lighting, Back of house: Oct 17 to Oct 30, not Oct 10 to Oct 23.')
    expect(undoableMove(job(moved))?.id).toBe(move.id)
    const back = undo(moved, move.id)
    expect(act(back, LIGHTING)).toEqual(act(s1, LIGHTING))
    const again = play(back, { type: 'redoScheduleMove', projectId: ID, moveId: move.id, by: 'Robert' })
    expect(act(again, LIGHTING)).toEqual(act(moved, LIGHTING))
  })

  it("a part moved inside the line's span is still a move with its reason, and Undo keeps a later report", () => {
    const moved = play(s1, { type: 'moveActivityPart', projectId: ID, lineId: LIGHTING, partId: 'felec-3-p1', start: '2026-09-14', finish: '2026-10-12', why: why('us', 'The sales floor runs into the back of house a few days.') })
    expect(span(act(moved, LIGHTING))).toBe('2026-09-14..2026-10-23')
    const move = job(moved).schedule!.moves![0]!
    expect(move).toMatchObject({ lineId: LIGHTING, reason: 'us', parts: { id: 'felec-3-p1' } })
    const reported = report(moved, 'felec-3-p1', 70)
    const back = undo(reported, move.id)
    expect(act(back, LIGHTING).parts?.[0]).toMatchObject({ from: 0, days: 26, pct: 70 })
  })

  it("a part's new dates reach the move window as its line's new span, with the part's dates before and after", () => {
    expect(partMoveOf(act(s1, LIGHTING), 'felec-3-p2', '2026-10-17', '2026-10-30')).toEqual({
      lineId: LIGHTING,
      start: '2026-09-14',
      finish: '2026-10-30',
      after: act(s1, LIGHTING).after,
      part: { id: 'felec-3-p2', name: 'Back of house', from: { start: '2026-10-10', finish: '2026-10-23' }, start: '2026-10-17', finish: '2026-10-30' },
    })
    expect(partMoveOf(act(s1, LIGHTING), 'felec-3-p2', '2026-10-10', '2026-10-23')).toBeNull()
    expect(splitActivityOf(job(s1), LIGHTING)?.lineId).toBe(LIGHTING)
    expect(splitActivityOf(job(s0), LIGHTING)).toBeUndefined()
    expect(lineLabel(job(s1), LIGHTING)).toBe('Lighting')
  })

  it('a part moved with no reason keeps no record, as a bar moved with none, and a move that changes nothing is refused', () => {
    // The window always asks for one; with none, the dates move and nothing is recorded, as setScheduleActivity does.
    const quiet = play(s1, { type: 'moveActivityPart', projectId: ID, lineId: LIGHTING, partId: 'felec-3-p2', start: '2026-10-17', finish: '2026-10-30' })
    expect(span(act(quiet, LIGHTING))).toBe('2026-09-14..2026-10-30')
    expect(act(quiet, LIGHTING).parts?.map((p) => [p.from, p.days])).toEqual([
      [0, 26],
      [33, 14],
    ])
    expect(job(quiet).schedule!.moves ?? []).toEqual(job(s1).schedule!.moves ?? [])
    expect(movedParts(act(s1, LIGHTING), 'nope', '2026-10-17', '2026-10-30')).toBeNull()
    const same = play(s1, { type: 'moveActivityPart', projectId: ID, lineId: LIGHTING, partId: 'felec-3-p2', start: '2026-10-10', finish: '2026-10-23', why: why('crew', 'Nothing moves here at all.') })
    expect(same).toBe(s1)
  })

  it('in a what-if copy (G-81), a part moved stays in the copy, and Keep carries the parts', () => {
    const copy = play(s1, { type: 'startWhatIf', projectId: ID, by: 'Robert' })
    const tried = play(copy, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'moveActivityPart', projectId: ID, lineId: LIGHTING, partId: 'felec-3-p2', start: '2026-10-17', finish: '2026-10-30' } })
    expect(job(tried).schedule).toBe(job(copy).schedule)
    const inCopy = job(tried).whatIf!.schedule.activities.find((a) => a.lineId === LIGHTING)!
    expect(span(inCopy)).toBe('2026-09-14..2026-10-30')
    const moveId = job(tried).whatIf!.schedule.moves![0]!.id
    const kept = play(tried, { type: 'keepWhatIf', projectId: ID, by: 'Robert', whys: { [moveId]: { reason: 'crew', note: 'Pecan Valley is short a crew on the back of house.' } } })
    expect(span(act(kept, LIGHTING))).toBe('2026-09-14..2026-10-30')
    expect(act(kept, LIGHTING).parts?.map((p) => [p.from, p.days])).toEqual([
      [0, 26],
      [33, 14],
    ])
  })
})

describe('words', () => {
  it("the walk's lines, the card's sentence and the pills, in plain words", () => {
    const one = report(s1, 'felec-3-p1', 60)
    const a = act(one, LIGHTING)
    // A split gives each part the line's 40%: Back of house carries it until it reports.
    expect(partFacts(a, one.today)).toEqual(['Sales floor: 60%, plan 73%. Started Fri Oct 2.', 'Back of house: 40%, starts Sat Oct 10.'])
    const two = report(one, 'felec-3-p2', 0)
    expect(partFacts(act(two, LIGHTING), two.today)[1]).toBe('Back of house: not started, Sat Oct 10.')
    expect(partFacts(act(report(two, 'felec-3-p2', 100), LIGHTING), two.today)[1]).toBe('Back of house: done Fri Oct 2.')
    expect(partsSummary('Lighting', a)).toBe('Lighting is 53% done, the parts by their share.')
    expect(partsSummary('Lighting', act(s0, LIGHTING))).toBe('Lighting is one bar. Split it when the work goes in parts, a floor or an area at a time.')
    const [sales, back] = partSpans(a)
    expect(partStanding(sales!, sales!.part.pct, one.today)).toEqual({ words: 'behind', tone: 'amber' })
    expect(partStanding(back!, back!.part.pct, one.today)).toEqual({ words: 'starts Oct 10', tone: 'grey' })
    const words = [...partFacts(a, one.today), ...partFacts(act(two, LIGHTING), two.today), partsSummary('Lighting', a), partsSummary('Lighting', act(s0, LIGHTING))]
    const problems = [
      splitParts(act(s0, LIGHTING), [SALES_BACK[0]!], 40),
      splitParts(act(s0, LIGHTING), [SALES_BACK[0]!, { ...SALES_BACK[1]!, finish: '2026-10-20' }], 40),
    ].flatMap((x) => ('problem' in x ? [x.problem] : []))
    expect([...words, ...problems].flatMap((w) => plainWordsFailures(w))).toEqual([])
  })
})

/** A whole bar moved later by `days`, with a reason: G-98's late job. */
function moveLineBy(s: GcState, lineId: string, days: number, reason: ScheduleMoveReason): GcState {
  const a = act(s, lineId)
  return play(s, { type: 'setScheduleActivity', projectId: ID, lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: why(reason, 'The late job, as G-98 plays it.') })
}
