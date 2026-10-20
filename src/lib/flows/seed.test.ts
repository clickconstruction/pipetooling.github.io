import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { factById, isFactId, isPaperId, type FactId } from './facts'
import { planNudgeRun, type AppSends } from './nudgeDispatch'
import type { PersonFlow } from './nudges'
import { SEED_FLOWS } from './seed'
import { flat, readFlow, type FactStamp, type FlowStamps, type RoundStamp } from './state'

const RESIDENTIAL = SEED_FLOWS.residential

const ok = (fact: FactId, at: string): FactStamp => ({ fact, mark: 'ok', at, by: null, until: null })

/** A bill as one round of Billed and of Paid, keyed by its invoice the way the loader keys it. */
const bill = (key: string, stamps: FactStamp[], due: string | null = null): RoundStamp => ({ key, name: 'Bill 1', opened: '2026-10-08', due, stamps })

/**
 * Dana on job 1312, the customer prototype's screen 4: booked, visited and sent the estimate on Mon Oct 5, quiet since.
 * `more` adds the job's later stamps and its bills.
 */
function dana(more: { stamps?: FactStamp[]; billed?: RoundStamp[]; paid?: RoundStamp[] } = {}): PersonFlow {
  const stamps: FlowStamps = {
    kind: 'residential',
    jobIds: ['1312'],
    defaultJobId: '1312',
    person: { stamps: [], rounds: {}, dues: {} },
    jobs: {
      '1312': {
        jobId: '1312',
        stamps: [
          ok('booked', '2026-10-01'),
          ok('on_way', '2026-10-05'),
          ok('arrived', '2026-10-05'),
          ok('found', '2026-10-05'),
          ok('estimate_sent', '2026-10-05'),
          ...(more.stamps ?? []),
        ],
        rounds: { billed: more.billed ?? [], paid: more.paid ?? [] },
        dues: {},
      },
    },
    skips: [],
    waits: [],
    off: null,
  }
  return {
    id: 'dana',
    first: 'Dana',
    flow: RESIDENTIAL,
    reading: readFlow(RESIDENTIAL, stamps, MORNING),
    quietDays: null,
    lastOutAt: '2026-10-05T16:00:00Z',
    court: 'theirs',
    owe: false,
    marks: [],
    notes: [],
    sends: {},
    portal: null,
  }
}

/** The run's morning: Wed Oct 14, 9 AM Central. */
const MORNING = new Date('2026-10-14T14:00:00Z')

const run = (person: PersonFlow, appSends: AppSends) =>
  planNudgeRun({ people: [person], now: MORNING, appSends, sent: [], numbers: { dana: { number: '(210) 555-0190', optedOut: false } } })

describe('flows/seed: the residential flow', () => {
  it('is one Per job lane of eleven steps, in the screen 4 order', () => {
    expect(RESIDENTIAL.kind).toBe('residential')
    expect(RESIDENTIAL.lanes.map((l) => l.lane)).toEqual(['per_job'])
    expect(flat(RESIDENTIAL).map((s) => s.name)).toEqual([
      'Booked',
      'On the way',
      'Arrived',
      'What we found',
      'Estimate sent',
      'Approved',
      'Working',
      'Done',
      'Billed',
      'Paid',
      'Review asked',
    ])
    expect(flat(RESIDENTIAL).map((s) => s.id)).toEqual(['booked', 'onway', 'arrived', 'found', 'estimate', 'approved', 'working', 'done', 'billed', 'paid', 'review'])
  })

  it('is the customer’s move on Approved and Paid, and ours on every other step', () => {
    const theirs = flat(RESIDENTIAL).filter((s) => s.who === 'them').map((s) => s.id)
    expect(theirs).toEqual(['approved', 'paid'])
    expect(flat(RESIDENTIAL).filter((s) => s.who === 'both')).toEqual([])
  })

  it('finishes each step with one of the residential facts, in order', () => {
    expect(flat(RESIDENTIAL).flatMap((s) => s.facts)).toEqual([
      'booked',
      'on_way',
      'arrived',
      'found',
      'estimate_sent',
      'estimate_approved',
      'working',
      'done',
      'billed',
      'paid',
      'review_asked',
    ])
    for (const s of flat(RESIDENTIAL)) {
      for (const f of s.facts) expect(factById(f)?.scope).toBe(s.loop ? 'round' : 'job')
      for (const p of s.papers) expect(isPaperId(p)).toBe(true)
    }
  })

  it('runs Billed and Paid once per bill', () => {
    const loops = flat(RESIDENTIAL).filter((s) => s.loop)
    expect(loops.map((s) => [s.id, s.loop, s.loopEnds])).toEqual([
      ['billed', 'each bill', 'rounds'],
      ['paid', 'each bill', 'rounds'],
    ])
  })

  it('says what we owe on each our-move step, and nothing on theirs', () => {
    for (const s of flat(RESIDENTIAL)) {
      if (s.who === 'us') expect(s.owedWords).toBeTruthy()
      else expect(s.owedWords).toBeNull()
    }
  })

  it('puts the two reminders on the customer’s steps, the app’s to send', () => {
    const nudged = flat(RESIDENTIAL).filter((s) => s.nudge)
    expect(nudged.map((s) => [s.id, s.nudge])).toEqual([
      ['approved', { days: 1, how: 'text', send: 'app', dayFact: null }],
      ['paid', { days: 0, how: 'text', send: 'app', dayFact: 'pay_by' }],
    ])
  })

  it('sends nothing until the owner turns a step on', () => {
    const r = run(dana(), {})
    expect(r.texts).toEqual([])
    expect(r.notSent.map((k) => [k.stepId, k.why])).toEqual([['approved', 'off']])
  })

  it('texts the estimate reminder a day after the estimate went, once Approved is on', () => {
    const r = run(dana(), { residential: { approved: true } })
    expect(r.texts.map((t) => [t.stepId, t.jobId, t.record.by])).toEqual([['approved', '1312', 'app']])
  })

  it('keeps the bill reminder quiet with no pay by day, and sends it once the day is past', () => {
    const doneAndBilled = {
      stamps: [ok('estimate_approved', '2026-10-06'), ok('working', '2026-10-07'), ok('done', '2026-10-08')],
      billed: [bill('inv-1', [ok('billed', '2026-10-08')])],
    }
    const on: AppSends = { residential: { paid: true } }
    expect(run(dana({ ...doneAndBilled, paid: [bill('inv-1', [])] }), on).texts).toEqual([])
    const late = run(dana({ ...doneAndBilled, paid: [bill('inv-1', [], '2026-10-12')] }), on)
    expect(late.texts.map((t) => [t.stepId, t.jobId])).toEqual([['paid', '1312']])
  })
})

describe('flows/seed: every flow', () => {
  it('picks only known facts and papers', () => {
    for (const flow of Object.values(SEED_FLOWS))
      for (const s of flat(flow)) {
        for (const f of s.facts) expect(isFactId(f)).toBe(true)
        for (const p of s.papers) expect(isPaperId(p)).toBe(true)
      }
  })

  it('keeps every step name and every owed phrase in plain words', () => {
    for (const flow of Object.values(SEED_FLOWS))
      for (const s of flat(flow)) {
        expect(plainWordsFailures(s.name), s.name).toEqual([])
        if (s.owedWords) expect(plainWordsFailures(s.owedWords), s.owedWords).toEqual([])
      }
  })
})
