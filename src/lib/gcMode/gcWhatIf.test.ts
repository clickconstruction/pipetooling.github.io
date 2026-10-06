/**
 * GC mode design spike: a what-if copy of the schedule (G-81, `to-dos/gc-mode/mockups/G-81.md`).
 * The copy sits beside the real schedule and never inside it. Moves, pulls, undo and redo are
 * tried on it with Why it moved optional. Keep puts its moves on the real schedule as real moves
 * with their reasons. Throw away leaves the real one as it was. Played from the made-up data: on
 * Fair Oaks D, Summit's TPO membrane a week later for the rain, and our crew's Top out three days
 * longer with no reason given.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcAction, GcState, ScheduleMoveReason } from './gcTypes'
import { WHAT_IF_ACTIONS, WHAT_IF_NO_WHY, keepWhatIf, whatIfBaseChangedWords, whatIfBaseChanges, whatIfDiff, whatIfGhosts, whatIfKeptWords, whatIfProject, whatIfTried } from './gcWhatIf'
import { moveRows, undoableMove } from './gcScheduleMoves'
import { companiesToTell, untoldMoves } from './gcTellTrades'
import { customerChanges, customerSchedulePicture, customerStanding } from './gcCustomerSchedule'
import { daysLostByCause } from './gcDaysLost'
import { portalSchedule } from './gcPortalSchedule'
import { followUps } from './gcFollowUp'
import { gcNeedsYou } from './gcNeedsYou'
import { callList } from './gcCallList'
import { chartHolds } from './gcChartHolds'
import { stageProgress } from './gcProgress'
import { scheduleSummary } from './gcBuildingSchedule'
import { weeklyReport } from './gcBuildingWeekly'
import { architectWaits } from './gcArchitectSchedule'
import { billingForecast } from './gcBillingForecast'
import { plainWordsFailures } from '../plainWords'

const ID = 'fairoaksd'
const play = (state: GcState, ...actions: GcAction[]) => actions.reduce((s, a) => gcReducer(s, a), state)
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const act = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!
const copyAct = (s: GcState, lineId: string) => job(s).whatIf!.schedule.activities.find((a) => a.lineId === lineId)!
const span = (a: { start: string; finish: string }) => `${a.start}..${a.finish}`
const why = (reason: ScheduleMoveReason, note: string) => ({ reason, note, by: 'Robert' })

const START: GcAction = { type: 'startWhatIf', projectId: ID, by: 'Robert' }
/** A move tried in the copy: the bar's finish moved, what it waits on as it is. */
function tryFinish(s: GcState, lineId: string, finish: string, given?: { reason: ScheduleMoveReason; note: string; by: string }): GcState {
  const a = copyAct(s, lineId)
  return play(s, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'setScheduleActivity', projectId: ID, lineId, start: a.start, finish, after: a.after, ...(given ? { why: given } : {}) } })
}
const RAIN = why('weather', 'Rain is forecast all next week.')

const s0 = initialGcState()
const s1 = play(s0, START)
// Summit's TPO membrane a week later for the rain, with its reason.
const s2 = tryFinish(s1, 'froof-1', '2026-10-16', RAIN)
// Our crew's Top out three days longer, tried with no reason.
const s3 = tryFinish(s2, 'fplumb-3', '2026-10-12')

describe('Try a what-if', () => {
  it('copies the schedule: the same activities, a history of its own, the base kept, the real schedule untouched', () => {
    const copy = job(s1).whatIf!
    expect(copy.schedule.activities).toEqual(job(s0).schedule!.activities)
    expect(copy.schedule.moves).toEqual([])
    expect(copy.schedule.walks).toEqual([])
    expect(Object.keys(copy.base).sort()).toEqual(job(s0).schedule!.activities.map((a) => a.lineId).sort())
    expect([copy.on, copy.by]).toEqual(['2026-10-02', 'Robert'])
    expect(job(s1).schedule).toBe(job(s0).schedule)
    // One per job: a second asks nothing new.
    expect(play(s1, START)).toBe(s1)
  })

  it('a move tried pushes what waits on it, in the copy only, and logs nothing', () => {
    expect([span(copyAct(s2, 'froof-1')), span(copyAct(s2, 'froof-3')), span(copyAct(s2, 'fhvac-1'))]).toEqual(['2026-09-21..2026-10-16', '2026-10-17..2026-10-26', '2026-10-17..2026-10-28'])
    expect(job(s2).whatIf!.schedule.moves?.[0]).toMatchObject({ lineId: 'froof-1', reason: 'weather', note: 'Rain is forecast all next week.' })
    expect(job(s2).schedule).toBe(job(s0).schedule)
    expect(s2.log).toBe(s0.log)
  })

  it('a move tried with no reason keeps a stand-in, marked, and its row says so', () => {
    const tried = job(s3).whatIf!.schedule.moves![0]!
    expect(tried).toMatchObject({ lineId: 'fplumb-3', noWhy: true, reason: WHAT_IF_NO_WHY.reason, note: WHAT_IF_NO_WHY.note })
    expect(moveRows(whatIfProject(job(s3))!)[0]?.reason).toBe('No reason yet')
    // The rough-in inspection waits on Top out, so it moves out a day.
    expect(span(copyAct(s3, 'fairoaksd-insp-roughin'))).toBe('2026-10-13..2026-10-14')
    expect(whatIfTried(job(s3)).map((m) => m.lineId)).toEqual(['froof-1', 'fplumb-3'])
  })
})

describe('the copy is invisible everywhere else', () => {
  /** Everything outside the Schedule tab that reads a job, with any project the outputs carry read without its copy. */
  function seen(s: GcState) {
    const p = job(s)
    const out = {
      portalSummit: portalSchedule(s, 'summit', p),
      portalCoolBreeze: portalSchedule(s, 'coolbreeze', p),
      followUps: followUps(s),
      needsYou: gcNeedsYou(s),
      callList: callList(s, p, chartHolds(s, p)),
      boardRow: stageProgress(s, p),
      scheduleSummary: scheduleSummary(p, s.today),
      fridayReport: weeklyReport(s, p),
      customerPicture: customerSchedulePicture(s, p),
      customerStanding: customerStanding(s, p),
      customerChanges: customerChanges(p, s.today),
      architect: architectWaits(s, p),
      tellTheTrades: untoldMoves(p),
      daysLost: daysLostByCause(p),
      billing: billingForecast(s, p).months,
    }
    return JSON.parse(JSON.stringify(out, (k, v: unknown) => (k === 'whatIf' ? undefined : v))) as unknown
  }

  it('with a copy open and two moves tried, the portals, Follow up, Needs you, the call list, the board row, the Friday report and the customer read as with no copy', () => {
    expect(seen(s3)).toEqual(seen(s0))
    // And the state is the state with no copy, the copy aside.
    const aside = { ...s3, projects: s3.projects.map(({ whatIf: _copy, ...p }) => p) }
    expect(aside).toEqual(s0)
  })
})

describe('what the copy takes, and what it refuses', () => {
  it('a pull (G-37), Undo and Redo work on the copy only', () => {
    // Both rough-ins finished today on the real schedule, then a copy: the rough-in inspection can come in.
    const done = play(
      s0,
      { type: 'tradeReport', projectId: ID, packageId: 'fhvac', sovId: 'fhvac-2', pct: 100 },
      { type: 'selfReportStage', projectId: ID, packageId: 'fplumb', lineId: 'fplumb-3', pct: 100 },
      START,
    )
    const pulled = play(done, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'pullScheduleEarlier', projectId: ID, leaveOut: [], why: why('early', 'Both rough-ins finished today.') } })
    expect(span(copyAct(pulled, 'fairoaksd-insp-roughin'))).toBe('2026-10-05..2026-10-06')
    expect(span(act(pulled, 'fairoaksd-insp-roughin'))).toBe('2026-10-12..2026-10-13')
    const moveId = job(pulled).whatIf!.schedule.moves![0]!.id
    const undone = play(pulled, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'undoScheduleMove', projectId: ID, moveId, by: 'Robert' } })
    expect(span(copyAct(undone, 'fairoaksd-insp-roughin'))).toBe('2026-10-12..2026-10-13')
    const redone = play(undone, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'redoScheduleMove', projectId: ID, moveId, by: 'Robert' } })
    expect(span(copyAct(redone, 'fairoaksd-insp-roughin'))).toBe('2026-10-05..2026-10-06')
    expect(job(redone).schedule).toBe(job(done).schedule)
  })

  it('days got back (G-82) are tried in the copy only, and Keep makes them an ordinary move', () => {
    // G-98's late job: Trim a week later for the customer, Test and balance nine days for the rain. Then a copy.
    const moveBy = (s: GcState, lineId: string, days: number, reason: ScheduleMoveReason, note: string) => {
      const a = act(s, lineId)
      return play(s, { type: 'setScheduleActivity', projectId: ID, lineId, start: addDays(a.start, days), finish: addDays(a.finish, days), after: a.after, why: why(reason, note) })
    }
    const late = play(moveBy(moveBy(s0, 'fplumb-4', 7, 'customer', 'Waiting on the restroom tile decision.'), 'fhvac-4', 9, 'weather', 'Rain kept the roof open a week.'), START)
    const crew = why('recovery', 'Cool Breeze brings a second crew for the last days.')
    const tried = play(late, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'recoverScheduleDays', projectId: ID, key: 'crew:fhvac-4', why: crew } })
    expect(copyAct(tried, 'fhvac-4').finish).toBe('2026-12-12')
    expect(act(tried, 'fhvac-4').finish).toBe('2026-12-13')
    expect(job(tried).schedule).toBe(job(late).schedule)
    expect(job(tried).whatIf!.schedule.moves?.[0]).toMatchObject({ lineId: 'fhvac-4', reason: 'recovery', recovery: { how: 'crew' } })
    // A key the copy no longer offers does nothing.
    expect(play(tried, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'recoverScheduleDays', projectId: ID, key: 'crew:fhvac-4', why: crew } })).toBe(tried)
    // Kept: a real move with its reason and its recovery, told to Cool Breeze, and Undo takes it off.
    const kept = play(tried, { type: 'keepWhatIf', projectId: ID, by: 'Robert', whys: {} })
    const move = job(kept).schedule!.moves![0]!
    expect(move).toMatchObject({ id: 'move-3', lineId: 'fhvac-4', reason: 'recovery', note: crew.note, recovery: { how: 'crew' }, fromWhatIf: '2026-10-02' })
    expect(act(kept, 'fhvac-4').finish).toBe('2026-12-12')
    expect(companiesToTell(kept, job(kept), [move]).map((c) => c.partner.company)).toEqual(['Cool Breeze Mechanical'])
    expect(undoableMove(job(kept))?.id).toBe('move-3')
    const undone = play(kept, { type: 'undoScheduleMove', projectId: ID, moveId: 'move-3', by: 'Robert' })
    expect(job(undone).schedule!.activities).toEqual(job(late).schedule!.activities)
  })

  it('takes only a move, a pull, undo and redo, on its own job, with a copy open', () => {
    // G-39 adds a part's move: a split line's part tried in the copy.
    expect(WHAT_IF_ACTIONS).toEqual(['setScheduleActivity', 'pullScheduleEarlier', 'undoScheduleMove', 'redoScheduleMove', 'recoverScheduleDays', 'moveActivityPart'])
    const refused: GcAction[] = [
      { type: 'tellTradesMoves', projectId: ID, moveIds: [], by: 'Robert' },
      { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualStart: '2026-09-21', by: 'Robert' },
      { type: 'recordScheduleWalk', projectId: ID, by: 'Robert', kept: ['froof-1'], moveIds: [], skipped: 0 },
      { type: 'setScheduleActivity', projectId: 'helotes', lineId: 'froof-1', start: '2026-09-21', finish: '2026-10-16', after: [] },
    ]
    for (const action of refused) expect(play(s3, { type: 'inWhatIf', projectId: ID, by: 'Robert', action })).toBe(s3)
    const a = act(s0, 'froof-1')
    expect(play(s0, { type: 'inWhatIf', projectId: ID, by: 'Robert', action: { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-1', start: a.start, finish: '2026-10-16', after: a.after } })).toBe(s0)
  })
})

describe('Keep', () => {
  const TOP_OUT_ID = job(s3).whatIf!.schedule.moves![0]!.id
  const CREW = { [TOP_OUT_ID]: { reason: 'crew' as const, note: 'Our crew is two men short next week.' } }
  const keep = (s: GcState, whys: Record<string, { reason: ScheduleMoveReason; note: string }>) => play(s, { type: 'keepWhatIf', projectId: ID, by: 'Robert', whys })
  const s4 = keep(s3, CREW)

  it('waits until every move has a reason and a sentence', () => {
    expect(keep(s3, {})).toBe(s3)
    expect(keep(s3, { [TOP_OUT_ID]: { reason: 'crew', note: 'Short' } })).toBe(s3)
    expect(keepWhatIf(job(s3), {}, 'Robert', s3.today)).toEqual({ problem: 'Give each move a reason and a sentence.' })
  })

  it('is refused once the real schedule moved since the copy, and not for a report or an actual date', () => {
    const curbs = act(s0, 'froof-4')
    const moved = play(s3, { type: 'setScheduleActivity', projectId: ID, lineId: 'froof-4', start: curbs.start, finish: '2026-10-12', after: curbs.after, why: why('crew', 'Summit has one crew on curbs this week.') })
    expect(whatIfBaseChanges(job(moved))).toEqual([{ lineId: 'froof-4', name: 'Roof curbs' }])
    expect(whatIfBaseChangedWords(whatIfBaseChanges(job(moved)))).toBe('The real schedule changed since this copy was made. Roof curbs moved there. Throw this copy away and make a new one.')
    expect(keep(moved, CREW)).toBe(moved)
    const reported = play(s3, { type: 'tradeReport', projectId: ID, packageId: 'fsteel', sovId: 'fsteel-3', pct: 90 }, { type: 'setActualDates', projectId: ID, lineId: 'froof-1', actualStart: '2026-09-21', by: 'Robert' })
    expect(whatIfBaseChanges(job(reported))).toEqual([])
    // Kept on top of the real actual date: the copy's plan, the real schedule's real days.
    const kept = keep(reported, CREW)
    expect(act(kept, 'froof-1')).toMatchObject({ start: '2026-09-21', finish: '2026-10-16', actualStart: '2026-09-21' })
  })

  it('puts the moves on the real schedule, oldest first, as real moves with their reasons, and the copy goes', () => {
    expect(job(s4).whatIf).toBeUndefined()
    const moves = job(s4).schedule!.moves!
    expect(moves.map((m) => [m.id, m.lineId, m.reason, m.note, m.by, m.on, m.fromWhatIf, m.noWhy])).toEqual([
      ['move-2', 'fplumb-3', 'crew', 'Our crew is two men short next week.', 'Robert', '2026-10-02', '2026-10-02', undefined],
      ['move-1', 'froof-1', 'weather', 'Rain is forecast all next week.', 'Robert', '2026-10-02', '2026-10-02', undefined],
    ])
    // The real dates are the copy's.
    expect(job(s4).schedule!.activities.map((a) => span(a))).toEqual(job(s3).whatIf!.schedule.activities.map((a) => span(a)))
    expect(s4.log[0]?.text).toBe('Robert kept a what-if on Fair Oaks Shops, Building D: 2 moves on the schedule, each with its reason.')
  })

  it('so Tell the trades, the customer, Days lost and the history read them as moves', () => {
    const p = job(s4)
    expect(untoldMoves(p).map((m) => m.id)).toEqual(['move-2', 'move-1'])
    expect(companiesToTell(s4, p, untoldMoves(p)).map((c) => c.partner.company)).toEqual(['Summit Roofing', 'Cool Breeze Mechanical'])
    expect(whatIfKeptWords(s4, p)).toEqual({ words: '2 moves kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told.', companies: ['Summit Roofing', 'Cool Breeze Mechanical'] })
    expect(customerChanges(p, s4.today)).toHaveLength(2)
    expect(daysLostByCause(p).rows.map((r) => r.cause).sort()).toEqual(['trade', 'weather'])
    expect(moveRows(p)[0]?.effect).toMatch(/Tried in a what-if first\.$/)
    // Told: the line about them goes.
    const told = play(s4, { type: 'tellTradesMoves', projectId: ID, moveIds: ['move-1', 'move-2'], by: 'Robert' })
    expect(whatIfKeptWords(told, job(told))).toBeNull()
  })

  it('then Undo takes them off one at a time, back to the real schedule before Keep', () => {
    expect(undoableMove(job(s4))?.id).toBe('move-2')
    const once = play(s4, { type: 'undoScheduleMove', projectId: ID, moveId: 'move-2', by: 'Robert' })
    // Top out undone: the schedule as the copy had it after the first try, TPO's week only.
    expect(job(once).schedule!.activities).toEqual(job(s2).whatIf!.schedule.activities)
    expect(undoableMove(job(once))?.id).toBe('move-1')
    const twice = play(once, { type: 'undoScheduleMove', projectId: ID, moveId: 'move-1', by: 'Robert' })
    expect(job(twice).schedule!.activities).toEqual(job(s0).schedule!.activities)
  })
})

describe('Throw it away', () => {
  it('removes the copy and leaves the real schedule as it was', () => {
    const gone = play(s3, { type: 'throwAwayWhatIf', projectId: ID, by: 'Robert' })
    expect(job(gone).whatIf).toBeUndefined()
    expect(job(gone).schedule).toBe(job(s0).schedule)
    expect(gone.log[0]?.text).toBe('Robert threw away a what-if on Fair Oaks Shops, Building D: 2 moves tried.')
    expect(play(gone, { type: 'throwAwayWhatIf', projectId: ID, by: 'Robert' })).toBe(gone)
  })
})

describe('the line over the chart', () => {
  it('says what the copy does against the real schedule, in plain words', () => {
    const diff = whatIfDiff(s3, job(s3))!
    expect(diff.words).toEqual([
      'A copy of the schedule to try moves on.',
      'Nothing here reaches the trades or the customer.',
      '2 moves tried.',
      '5 bars differ from the real schedule.',
      'The job still finishes Tue Dec 8, as in the real one.',
      'The bills: $22,661 of the Oct 25 bill moves to Nov 25.',
      '1 move has no reason yet.',
    ])
    expect([diff.moves, diff.noWhy, diff.bars.length, diff.finishDays]).toEqual([2, 1, 5, 0])
    for (const w of diff.words) expect(plainWordsFailures(w)).toEqual([])
    expect(whatIfDiff(s1, job(s1))!.words).toEqual(['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.', 'Move a bar to try something.'])
  })

  it('draws the real dates under each bar the copy moved', () => {
    const ghosts = whatIfGhosts(job(s3))
    expect([...ghosts.keys()].sort()).toEqual(['fairoaksd-insp-roughin', 'fhvac-1', 'fplumb-3', 'froof-1', 'froof-3'])
    expect(ghosts.get('froof-1')).toEqual({ start: '2026-09-21', finish: '2026-10-09' })
  })
})
