import { describe, expect, it } from 'vitest'
import { OFFICE_LIKE_MERCURY_CATEGORIES } from '../mercuryOfficeLikeCategories'
import {
  TALLY_DAY_CHIP_CAP,
  TALLY_OFFICE_CATEGORIES,
  TALLY_RULE_CONFIDENCE,
  groupTallyChargesByDay,
  splitTallyAmountByHours,
  suggestTallyDay,
  tallyRowsForChoice,
  tallyStoreKey,
  type TallyCharge,
  type TallyClockSession,
  type TallyDayInput,
  type TallyDaySuggestion,
  type TallySortedCharge,
} from './tallySortSuggestion'

// The day cards of the #72 pass-2 page, with made-up holders, stores, jobs and amounts.
// Times are Chicago daylight time (UTC−5) in late September 2026.
const OFFICE = 'job-office'
const JOB_A = 'job-a'
const JOB_B = 'job-b'
const JOB_C = 'job-c'
const JOB_D = 'job-d'
const JOB_E = 'job-e'
const JOB_F = 'job-f'
const NOW = Date.parse('2026-09-30T17:00:00-05:00') // Wed Sep 30, 5 PM

const at = (ymd: string, hm: string) => `${ymd}T${hm}:00-05:00`
const charge = (
  id: string,
  ymd: string,
  hm: string,
  amount: number,
  counterparty: string,
  category: string | null,
): TallyCharge => ({ id, holderId: 'h', madeAt: at(ymd, hm), amount, counterparty, category })
const session = (ymd: string, jobId: string | null, from: string, to: string | null): TallyClockSession => ({
  workDate: ymd,
  jobId,
  clockedInAt: at(ymd, from),
  clockedOutAt: to ? at(ymd, to) : null,
})
const sorted = (id: string, ymd: string, hm: string, counterparty: string, jobId: string, amount = -10): TallySortedCharge => ({
  id,
  postedAt: at(ymd, hm),
  counterparty,
  splits: [{ jobId, amount }],
})
const job = (jobId: string) => ({ kind: 'job', jobId })

function day(over: Partial<TallyDayInput> & Pick<TallyDayInput, 'ymd' | 'charges'>): TallyDaySuggestion {
  return suggestTallyDay({
    holderId: 'h',
    sessions: [],
    scheduled: [],
    history: [],
    officeJobId: OFFICE,
    nowMs: NOW,
    ...over,
  })
}

const chipsOf = (d: TallyDaySuggestion) => d.chips.map((c) => [c.choice, c.rule, c.confidence])
const hoursOf = (d: TallyDaySuggestion) => d.clockedJobs.map(({ jobId, hours }) => ({ jobId, hours }))

describe('suggestTallyDay — the pass-2 day cards', () => {
  it('a one-job day: the job clocked that day is likely, and the fuel line takes it', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: [charge('t1', '2026-09-30', '06:03', -31.47, 'Corner Fuel', 'FuelAndGas')],
      sessions: [session('2026-09-30', JOB_A, '07:10', '16:40')],
    })
    expect(d.best).toEqual({ choice: job(JOB_A), rule: 'clock-one-job', confidence: 'likely', facts: { hours: [9.5] } })
    expect(chipsOf(d)).toEqual([
      [job(JOB_A), 'clock-one-job', 'likely'],
      [job(OFFICE), 'office', 'none'],
    ])
    expect(d.lines[0]).toMatchObject({ best: d.best, own: [], even: null, byHours: null })
    expect(d.allSure).toBe(false)
    expect(hoursOf(d)).toEqual([{ jobId: JOB_A, hours: 9.5 }])
  })

  it("no clock: the store's run is offered on the line, never chosen", () => {
    const d = day({
      ymd: '2026-09-30',
      charges: [charge('t2', '2026-09-30', '08:41', -152.1, 'The Pipe Depot', 'Retail')],
      history: [
        sorted('h1', '2026-09-25', '09:00', 'The Pipe Depot', JOB_B),
        sorted('h2', '2026-09-21', '09:00', 'Pipe Depot #6542', JOB_B),
        sorted('h3', '2026-09-15', '09:00', 'PIPE DEPOT', JOB_B),
        sorted('h4', '2026-09-10', '09:00', 'The Pipe Depot', JOB_C),
      ],
    })
    expect(d.lines[0]!.own).toEqual([
      { choice: job(JOB_B), rule: 'store-streak', confidence: 'none', facts: { store: 'The Pipe Depot', count: 3 } },
    ])
    expect(d.lines[0]!.best).toBeNull()
    expect(d.best).toBeNull()
    expect(chipsOf(d)).toEqual([[job(OFFICE), 'office', 'none']])
  })

  it('a two-job day: both jobs and the even split; by hours rides on the line, not as a chip; nothing likely', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: [charge('t3', '2026-09-30', '12:10', -88.2, 'Valley Plumbing Supply', 'Retail')],
      sessions: [session('2026-09-30', JOB_C, '07:02', '11:30'), session('2026-09-30', JOB_D, '12:40', '16:15')],
      history: [sorted('h5', '2026-09-24', '10:00', 'Valley Plumbing Supply', JOB_C)],
    })
    expect(d.best).toBeNull()
    expect(d.chips.map((c) => c.rule)).toEqual(['clock-job', 'clock-job', 'split-even', 'office'])
    expect(d.chips[2]!.choice).toEqual({ kind: 'split', how: 'even', jobIds: [JOB_C, JOB_D] })
    const line = d.lines[0]!
    expect(line.best).toBeNull()
    expect(line.own).toEqual([
      { choice: job(JOB_C), rule: 'store-last', confidence: 'none', facts: { store: 'Valley Plumbing Supply', count: 1 } },
    ])
    // By exact minutes (268 and 215), not the rounded hours a chip shows; the cents add up.
    expect(line.byHours).toEqual([
      { jobId: JOB_C, amount: -48.94 },
      { jobId: JOB_D, amount: -39.26 },
    ])
    expect(line.even).toEqual([
      { jobId: JOB_C, amount: -44.1 },
      { jobId: JOB_D, amount: -44.1 },
    ])
  })

  it('a one-job day with a store that always went to Office: the store is offered, the day stays likely', () => {
    const d = day({
      ymd: '2026-09-29',
      charges: [
        charge('t5', '2026-09-29', '12:18', -205.3, 'Ridge Supply', 'Retail'),
        charge('t4', '2026-09-29', '10:05', -61, 'Truck Wash Co', 'VehicleExpenses'),
      ],
      sessions: [session('2026-09-29', JOB_A, '07:14', '17:02')],
      history: [
        sorted('h6', '2026-09-29', '12:39', 'Ridge Supply', OFFICE, -40.15),
        sorted('h7', '2026-09-22', '12:00', 'Ridge Supply', OFFICE),
        sorted('h8', '2026-09-15', '12:00', 'Ridge Supply', OFFICE),
        sorted('h9', '2026-09-08', '12:00', 'Ridge Supply', OFFICE),
      ],
    })
    expect(d.lines.map((l) => l.chargeId)).toEqual(['t4', 't5'])
    for (const l of d.lines) expect(l.best).toBe(d.best)
    expect(d.best?.choice).toEqual(job(JOB_A))
    expect(d.lines[1]!.own).toEqual([
      { choice: job(OFFICE), rule: 'store-streak', confidence: 'none', facts: { store: 'Ridge Supply', count: 4 } },
    ])
    // The day's sorted 12:39 charge went to Office, so Office is offered for that reason, once.
    expect(d.chips.map((c) => [c.choice, c.rule])).toEqual([
      [job(JOB_A), 'clock-one-job'],
      [job(OFFICE), 'same-day-sorted'],
    ])
    expect(d.chips[1]!.facts).toEqual({ postedAt: [at('2026-09-29', '12:39')] })
  })

  it('a Saturday with no clock and nothing scheduled: no likely; Friday, Monday and the sorted one are offered', () => {
    const d = day({
      ymd: '2026-09-26',
      charges: [
        charge('t7', '2026-09-26', '10:08', -70.15, 'Corner Fuel', 'FuelAndGas'),
        charge('t8', '2026-09-26', '10:13', -16.4, 'Corner Fuel', 'FuelAndGas'),
      ],
      sessions: [session('2026-09-25', JOB_D, '07:00', '14:48'), session('2026-09-28', JOB_A, '07:05', '15:30')],
      history: [sorted('h10', '2026-09-26', '09:26', 'Corner Fuel', JOB_E, -5.1)],
    })
    expect(d.best).toBeNull()
    // Monday is two days out: the day ±1 would stop at an empty Sunday.
    expect(d.chips.map((c) => [c.choice, c.rule, c.facts])).toEqual([
      [job(JOB_D), 'neighbour-day', { days: ['2026-09-25'] }],
      [job(JOB_A), 'neighbour-day', { days: ['2026-09-28'] }],
      [job(JOB_E), 'same-day-sorted', { postedAt: [at('2026-09-26', '09:26')] }],
      [job(OFFICE), 'office', {}],
    ])
    // Fuel takes no store rule, even with a Corner Fuel charge sorted that morning.
    for (const l of d.lines) expect(l).toMatchObject({ best: null, own: [] })
  })
})

describe('suggestTallyDay — the line rules', () => {
  const oneJobTue = {
    ymd: '2026-09-29',
    sessions: [session('2026-09-29', JOB_D, '07:40', '16:20')],
  }

  it('Advertising, Insurance and Internet and telephone are the line’s own likely Office; Software is not', () => {
    const d = day({
      ...oneJobTue,
      charges: [
        charge('a1', '2026-09-29', '07:55', -48.6, 'Corner Fuel', 'FuelAndGas'),
        charge('a2', '2026-09-29', '09:00', -120, 'Bright Signs', 'Advertising'),
        charge('a3', '2026-09-29', '09:30', -75.25, 'Prairie Wireless', 'InternetAndTelephone'),
        charge('a4', '2026-09-29', '10:00', -12.99, 'CloudBooks', 'Software'),
      ],
    })
    expect(d.lines.map((l) => [l.best?.choice, l.best?.rule])).toEqual([
      [job(JOB_D), 'clock-one-job'],
      [job(OFFICE), 'office-category'],
      [job(OFFICE), 'office-category'],
      [job(JOB_D), 'clock-one-job'],
    ])
    expect(d.lines[1]!.own[0]).toEqual({
      choice: job(OFFICE),
      rule: 'office-category',
      confidence: 'likely',
      facts: { category: 'Advertising' },
    })
  })

  it('with no Office job set, the category rule and the Office chip are off', () => {
    const d = day({ ...oneJobTue, officeJobId: null, charges: [charge('a2', '2026-09-29', '09:00', -120, 'Bright Signs', 'Advertising')] })
    expect(d.lines[0]!.own).toEqual([])
    expect(d.lines[0]!.best?.choice).toEqual(job(JOB_D))
    expect(d.chips.map((c) => c.rule)).toEqual(['clock-one-job'])
  })

  it('a store run counts the latest charges there until another job, and a split ends it', () => {
    const base = { ymd: '2026-09-30', charges: [charge('c1', '2026-09-30', '09:00', -50, 'Ridge Supply', 'Retail')] }
    const run = day({
      ...base,
      history: [
        sorted('x1', '2026-09-28', '09:00', 'Ridge Supply', JOB_B),
        sorted('x2', '2026-09-27', '09:00', 'Ridge Supply', JOB_B),
        sorted('x3', '2026-09-20', '09:00', 'Ridge Supply', JOB_D),
        sorted('x4', '2026-09-10', '09:00', 'Ridge Supply', JOB_B),
      ],
    })
    expect(run.lines[0]!.own).toEqual([
      { choice: job(JOB_B), rule: 'store-last', confidence: 'none', facts: { store: 'Ridge Supply', count: 2 } },
    ])
    const split: TallySortedCharge = {
      id: 'x0',
      postedAt: at('2026-09-29', '09:00'),
      counterparty: 'Ridge Supply',
      splits: [
        { jobId: JOB_B, amount: -5 },
        { jobId: JOB_D, amount: -5 },
      ],
    }
    expect(day({ ...base, history: [split, sorted('x1', '2026-09-28', '09:00', 'Ridge Supply', JOB_B)] }).lines[0]!.own).toEqual([])
  })

  it('a charge older than 30 days, one after the day and the charge itself are not history', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: [charge('c1', '2026-09-30', '09:00', -50, 'Ridge Supply', 'Retail')],
      history: [
        sorted('late', '2026-10-01', '09:00', 'Ridge Supply', JOB_B),
        sorted('old', '2026-08-29', '09:00', 'Ridge Supply', JOB_B),
        sorted('c1', '2026-09-30', '09:00', 'Ridge Supply', JOB_B),
      ],
    })
    expect(d.lines[0]!.own).toEqual([])
    expect(d.chips.some((c) => c.rule === 'same-day-sorted')).toBe(false)
  })
})

describe('suggestTallyDay — the day rules', () => {
  const one = [charge('c1', '2026-09-30', '09:00', -50, 'Ridge Supply', 'Retail')]

  it('no clock, no schedule, no neighbours and no history: only Office is offered', () => {
    const d = day({ ymd: '2026-09-30', charges: one })
    expect(chipsOf(d)).toEqual([[job(OFFICE), 'office', 'none']])
    expect(d.best).toBeNull()
    expect(d.lines[0]).toMatchObject({ best: null, own: [] })
    expect(day({ ymd: '2026-09-30', charges: one, officeJobId: null }).chips).toEqual([])
  })

  it('a day clocked only on Office has no likely: office staff buy for jobs', () => {
    const d = day({ ymd: '2026-09-30', charges: one, sessions: [session('2026-09-30', OFFICE, '08:00', '17:00')] })
    expect(chipsOf(d)).toEqual([[job(OFFICE), 'clock-office', 'none']])
    expect(d.best).toBeNull()
  })

  it('one job plus time on a bid is still likely, under its own rule', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: one,
      sessions: [session('2026-09-30', JOB_A, '07:00', '13:00'), session('2026-09-30', null, '13:30', '15:00')],
    })
    expect(d.best).toMatchObject({ choice: job(JOB_A), rule: 'clock-one-job-mixed', confidence: 'likely' })
  })

  it('two sessions on the one job are still the only job, and their hours add', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: one,
      sessions: [session('2026-09-30', JOB_A, '07:00', '11:00'), session('2026-09-30', JOB_A, '11:30', '15:00')],
    })
    expect(d.best?.rule).toBe('clock-one-job')
    expect(hoursOf(d)).toEqual([{ jobId: JOB_A, hours: 7.5 }])
  })

  it('no clock and one job scheduled: likely; two scheduled: both offered', () => {
    const sched = day({ ymd: '2026-09-30', charges: one, scheduled: [{ workDate: '2026-09-30', jobId: JOB_B }] })
    expect(sched.best).toMatchObject({ choice: job(JOB_B), rule: 'schedule-one-job', confidence: 'likely' })
    const two = day({
      ymd: '2026-09-30',
      charges: one,
      scheduled: [
        { workDate: '2026-09-30', jobId: JOB_B },
        { workDate: '2026-09-30', jobId: JOB_D },
      ],
    })
    expect(chipsOf(two)).toEqual([
      [job(JOB_B), 'schedule-job', 'none'],
      [job(JOB_D), 'schedule-job', 'none'],
      [job(OFFICE), 'office', 'none'],
    ])
    expect(two.best).toBeNull()
  })

  it('a clocked day also offers the job scheduled but not clocked and the jobs clocked the day before and after', () => {
    const input = {
      ymd: '2026-09-30',
      charges: one,
      sessions: [
        session('2026-09-30', JOB_A, '07:00', '15:00'),
        session('2026-09-29', JOB_C, '07:00', '15:00'),
        session('2026-10-01', JOB_D, '07:00', '15:00'),
      ],
      scheduled: [{ workDate: '2026-09-30', jobId: JOB_B }],
    }
    expect(day(input).chips.map((c) => [c.choice, c.rule])).toEqual([
      [job(JOB_A), 'clock-one-job'],
      [job(JOB_B), 'schedule-job'],
      [job(JOB_C), 'neighbour-day'],
      [job(JOB_D), 'neighbour-day'],
      [job(OFFICE), 'office'],
    ])
    // A smaller cap cuts the tail: Office goes behind "Another job…".
    expect(day({ ...input, chipCap: 4 }).chips.map((c) => c.rule)).toEqual([
      'clock-one-job',
      'schedule-job',
      'neighbour-day',
      'neighbour-day',
    ])
  })

  it('a busy day keeps the fixed order and is cut at the cap', () => {
    const busy = {
      ymd: '2026-09-30',
      charges: one,
      sessions: [
        session('2026-09-30', JOB_A, '07:00', '09:00'),
        session('2026-09-30', JOB_B, '09:30', '12:00'),
        session('2026-09-30', JOB_C, '12:30', '16:00'),
        session('2026-09-29', JOB_E, '07:00', '15:00'),
      ],
      scheduled: [{ workDate: '2026-09-30', jobId: JOB_D }],
      history: [sorted('s1', '2026-09-30', '08:00', 'Corner Fuel', JOB_F)],
    }
    const all = day({ ...busy, chipCap: 20 })
    expect(all.chips.map((c) => c.rule)).toEqual([
      'clock-job',
      'clock-job',
      'clock-job',
      'split-even',
      'schedule-job',
      'neighbour-day',
      'same-day-sorted',
      'office',
    ])
    const capped = day(busy)
    expect(capped.chips).toEqual(all.chips.slice(0, TALLY_DAY_CHIP_CAP))
  })

  it('today, a session still open counts its hours up to now', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: one,
      sessions: [session('2026-09-30', JOB_C, '07:00', '12:00'), session('2026-09-30', JOB_D, '12:30', null)],
    })
    expect(hoursOf(d)).toEqual([
      { jobId: JOB_C, hours: 5 },
      { jobId: JOB_D, hours: 4.5 },
    ])
    expect(d.lines[0]!.byHours).not.toBeNull()
  })

  it('a past day still clocked in has no hours: the even split only', () => {
    const d = day({
      ymd: '2026-09-28',
      charges: [charge('c1', '2026-09-28', '12:10', -30, 'Ridge Supply', 'Retail')],
      sessions: [session('2026-09-28', JOB_C, '07:00', '12:00'), session('2026-09-28', JOB_D, '12:30', null)],
    })
    expect(hoursOf(d)[1]).toEqual({ jobId: JOB_D, hours: null })
    expect(d.chips.map((c) => c.rule)).toEqual(['clock-job', 'clock-job', 'split-even', 'office'])
    expect(d.lines[0]!.byHours).toBeNull()
    expect(d.lines[0]!.even).toEqual([
      { jobId: JOB_C, amount: -15 },
      { jobId: JOB_D, amount: -15 },
    ])
  })

  it('a neighbour job on both sides of an empty day is one chip with both days', () => {
    const d = day({
      ymd: '2026-09-26',
      charges: [charge('c1', '2026-09-26', '10:00', -20, 'Corner Fuel', 'FuelAndGas')],
      sessions: [session('2026-09-25', JOB_A, '07:00', '15:00'), session('2026-09-28', JOB_A, '07:00', '15:00')],
    })
    expect(d.chips[0]).toMatchObject({ choice: job(JOB_A), rule: 'neighbour-day', facts: { days: ['2026-09-25', '2026-09-28'] } })
  })

  it('an empty day looks no further than 3 days each side', () => {
    const d = day({
      ymd: '2026-09-26',
      charges: [charge('c1', '2026-09-26', '10:00', -20, 'Corner Fuel', 'FuelAndGas')],
      sessions: [session('2026-09-22', JOB_A, '07:00', '15:00')],
    })
    expect(d.chips.map((c) => c.rule)).toEqual(['office'])
  })

  it('a refund is not history: it starts no store run and names no same-day job', () => {
    const refund = (id: string, ymd: string, hm: string, jobId: string): TallySortedCharge => ({
      id,
      postedAt: at(ymd, hm),
      counterparty: 'Ridge Supply',
      splits: [{ jobId, amount: 25 }],
    })
    const d = day({
      ymd: '2026-09-30',
      charges: [charge('c1', '2026-09-30', '12:00', -50, 'Ridge Supply', 'Retail')],
      history: [
        refund('r0', '2026-09-30', '09:00', JOB_F),
        refund('r1', '2026-09-28', '09:00', JOB_F),
        sorted('p1', '2026-09-27', '09:00', 'Ridge Supply', JOB_B),
      ],
    })
    expect(d.lines[0]!.own).toEqual([
      { choice: job(JOB_B), rule: 'store-last', confidence: 'none', facts: { store: 'Ridge Supply', count: 1 } },
    ])
    expect(d.chips.some((c) => c.choice.kind === 'job' && c.choice.jobId === JOB_F)).toBe(false)
  })

  it('carries the facts the evidence line reads: spans, other time, the schedule and the neighbours', () => {
    const worked = day({
      ymd: '2026-09-30',
      charges: one,
      sessions: [
        session('2026-09-30', JOB_A, '11:30', '15:00'),
        session('2026-09-30', JOB_A, '07:00', '11:00'),
        session('2026-09-30', null, '15:30', '16:00'),
        session('2026-09-29', JOB_C, '07:00', '15:00'),
      ],
      scheduled: [{ workDate: '2026-09-30', jobId: JOB_B }],
    })
    expect(worked.clockedJobs[0]!.spans).toEqual([
      { clockedInAt: at('2026-09-30', '07:00'), clockedOutAt: at('2026-09-30', '11:00') },
      { clockedInAt: at('2026-09-30', '11:30'), clockedOutAt: at('2026-09-30', '15:00') },
    ])
    expect(worked.otherTime).toBe(true)
    expect(worked.scheduledJobs).toEqual([JOB_B])
    expect(worked.neighbours).toEqual([{ jobId: JOB_C, days: ['2026-09-29'] }])
  })

  it('an evening charge keeps its company day, the day its clock session is dated', () => {
    // 8:30 PM Chicago is 01:30 the next morning in UTC.
    const evening = charge('e1', '2026-09-29', '20:30', -42.75, 'Corner Fuel', 'FuelAndGas')
    expect(new Date(evening.madeAt).toISOString().slice(0, 10)).toBe('2026-09-30')
    const [group] = groupTallyChargesByDay([evening])
    expect(group!.ymd).toBe('2026-09-29')
    const d = day({ ymd: group!.ymd, charges: group!.charges, sessions: [session('2026-09-29', JOB_A, '07:00', '16:00')] })
    expect(d.lines[0]!.best?.choice).toEqual(job(JOB_A))
  })
})

describe('rule set v2', () => {
  it('no rule is sure: the replay found none at 95% on 40 or more charges', () => {
    expect(Object.values(TALLY_RULE_CONFIDENCE)).not.toContain('sure')
  })

  it('pins the rule ids PR 5 measures, each with its one level', () => {
    expect(TALLY_RULE_CONFIDENCE).toEqual({
      'office-category': 'likely',
      'store-streak': 'none',
      'store-last': 'none',
      'clock-one-job': 'likely',
      'clock-one-job-mixed': 'likely',
      'clock-office': 'none',
      'clock-job': 'none',
      'split-even': 'none',
      'schedule-one-job': 'likely',
      'schedule-job': 'none',
      'same-day-sorted': 'none',
      'neighbour-day': 'none',
      office: 'none',
    })
  })

  it('every suggestion carries its rule’s level', () => {
    const days = [
      day({ ymd: '2026-09-30', charges: [charge('c1', '2026-09-30', '09:00', -50, 'Bright Signs', 'Advertising')], sessions: [session('2026-09-30', JOB_A, '07:00', '15:00')] }),
      day({
        ymd: '2026-09-30',
        charges: [charge('c2', '2026-09-30', '09:00', -50, 'Ridge Supply', 'Retail')],
        sessions: [session('2026-09-30', JOB_C, '07:00', '11:00'), session('2026-09-30', JOB_D, '12:00', '15:00')],
        history: [sorted('z', '2026-09-29', '09:00', 'Ridge Supply', JOB_B)],
      }),
    ]
    const all = days.flatMap((d) => [...d.chips, ...d.lines.flatMap((l) => [...l.own, ...(l.best ? [l.best] : [])])])
    expect(all.length).toBeGreaterThan(5)
    for (const s of all) expect(s.confidence).toBe(TALLY_RULE_CONFIDENCE[s.rule])
  })

  it('the office categories are a measured subset of People → Review’s office-type list', () => {
    for (const c of TALLY_OFFICE_CATEGORIES) expect(OFFICE_LIKE_MERCURY_CATEGORIES).toContain(c)
  })
})

describe('splitTallyAmountByHours', () => {
  it('gives the odd cent to the largest remainder, then to the earlier job', () => {
    expect(
      splitTallyAmountByHours(-100, [
        { jobId: 'a', hours: 1 },
        { jobId: 'b', hours: 1 },
        { jobId: 'c', hours: 1 },
      ]),
    ).toEqual([
      { jobId: 'a', amount: -33.34 },
      { jobId: 'b', amount: -33.33 },
      { jobId: 'c', amount: -33.33 },
    ])
  })

  it('keeps the sign of a refund', () => {
    expect(
      splitTallyAmountByHours(10, [
        { jobId: 'a', hours: 1 },
        { jobId: 'b', hours: 2 },
      ]),
    ).toEqual([
      { jobId: 'a', amount: 3.33 },
      { jobId: 'b', amount: 6.67 },
    ])
  })

  it('is null with no jobs, or a job with no hours', () => {
    expect(splitTallyAmountByHours(-10, [])).toBeNull()
    expect(
      splitTallyAmountByHours(-10, [
        { jobId: 'a', hours: 2 },
        { jobId: 'b', hours: 0 },
      ]),
    ).toBeNull()
  })

  it('always sums to the charge in whole cents', () => {
    let seed = 7
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 500; i++) {
      const cents = Math.floor(rand() * 500000) + 1
      const jobs = Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, k) => ({
        jobId: `j${k}`,
        hours: Math.round((0.25 + rand() * 10) * 60) / 60,
      }))
      const split = splitTallyAmountByHours(-cents / 100, jobs)!
      expect(split.reduce((s, l) => s + Math.round(l.amount * 100), 0)).toBe(-cents)
      for (const l of split) expect(Math.abs(l.amount * 100 - Math.round(l.amount * 100))).toBeLessThan(1e-6)
    }
  })
})

describe('tallyRowsForChoice', () => {
  it('writes the whole charge to a job, or the line’s split', () => {
    const d = day({
      ymd: '2026-09-30',
      charges: [charge('t3', '2026-09-30', '12:10', -88.2, 'Valley Plumbing Supply', 'Retail')],
      sessions: [session('2026-09-30', JOB_C, '07:02', '11:30'), session('2026-09-30', JOB_D, '12:40', '16:15')],
    })
    const line = d.lines[0]!
    expect(tallyRowsForChoice(line, { kind: 'job', jobId: JOB_D })).toEqual([{ jobId: JOB_D, amount: -88.2 }])
    expect(tallyRowsForChoice(line, { kind: 'split', how: 'even', jobIds: [JOB_C, JOB_D] })).toBe(line.even)
    expect(tallyRowsForChoice(line, { kind: 'split', how: 'hours', jobIds: [JOB_C, JOB_D] })).toBe(line.byHours)
  })
})

describe('groupTallyChargesByDay', () => {
  it('groups by holder and company day, newest day first, charges in posted order', () => {
    const rows = [
      { id: 'a', holderId: 'u2', madeAt: '2026-09-29T10:00:00-05:00' },
      { id: 'b', holderId: 'u1', madeAt: '2026-09-29T23:30:00-05:00' },
      { id: 'c', holderId: 'u1', madeAt: '2026-09-29T08:00:00-05:00' },
      { id: 'd', holderId: 'u1', madeAt: '2026-09-30T06:03:00-05:00' },
      { id: 'e', holderId: 'u1', madeAt: 'not a date' },
    ]
    expect(groupTallyChargesByDay(rows).map((g) => [g.holderId, g.ymd, g.charges.map((c) => c.id)])).toEqual([
      ['u1', '2026-09-30', ['d']],
      ['u1', '2026-09-29', ['c', 'b']],
      ['u2', '2026-09-29', ['a']],
    ])
  })
})

describe('tallyStoreKey', () => {
  it('matches a store to itself across case, "The", store numbers and punctuation', () => {
    expect(tallyStoreKey('The Pipe Depot #6542')).toBe('pipedepot')
    expect(tallyStoreKey('PIPE DEPOT')).toBe('pipedepot')
    expect(tallyStoreKey('Quick-Stop 12345')).toBe(tallyStoreKey('Quick-Stop'))
    expect(tallyStoreKey("Dan's Farm & Ranch")).toBe('dansfarmranch')
    expect(tallyStoreKey('66')).toBe('66')
    expect(tallyStoreKey('  ')).toBe('')
    expect(tallyStoreKey(null)).toBe('')
  })
})
