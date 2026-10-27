import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { fillLine } from '../quickReplies/blanks'
import type { FactId } from './facts'
import { nudgeLine, planNudgeRun, type AppSends } from './nudgeDispatch'
import { afterPrior, nudgeDue, nudgeRows, priorDone, reminderWords, type PersonFlow } from './nudges'
import { SEED_FLOWS } from './seed'
import { readFlow, stepById, type FactStamp, type FlowStamps, type RoundStamp } from './state'

/**
 * Customer reviews (v2.5943, punch list #185): the Review asked step is the one reminder on our own move. It counts from
 * the day Paid turned true, never from quiet days, holds while the customer waits on an answer from us, and its text
 * carries {rate} for the press or the edge to mint.
 */

const RESIDENTIAL = SEED_FLOWS.residential
const REVIEW = stepById(RESIDENTIAL, 'review')!
/** Wed Oct 14, 9 AM Central. */
const MORNING = new Date('2026-10-14T14:00:00Z')

const ok = (fact: FactId, at: string): FactStamp => ({ fact, mark: 'ok', at, by: null, until: null })
const bill = (key: string, stamps: FactStamp[]): RoundStamp => ({ key, name: 'Bill 1', opened: '2026-10-08', due: null, stamps })

/** Dana on job 1312, every step done through Billed, and the bill paid on `paidOn`. */
function dana(paidOn: string, more: Partial<PersonFlow> = {}): PersonFlow {
  const stamps: FlowStamps = {
    kind: 'residential',
    jobIds: ['1312'],
    defaultJobId: '1312',
    person: { stamps: [], rounds: {}, dues: {} },
    jobs: {
      '1312': {
        jobId: '1312',
        stamps: [ok('booked', '2026-10-01'), ok('on_way', '2026-10-05'), ok('arrived', '2026-10-05'), ok('found', '2026-10-05'), ok('estimate_sent', '2026-10-05'), ok('estimate_approved', '2026-10-06'), ok('working', '2026-10-07'), ok('done', '2026-10-07')],
        rounds: { billed: [bill('inv-1', [ok('billed', '2026-10-08')])], paid: [bill('inv-1', [ok('paid', paidOn)])] },
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
    quietDays: 20,
    lastOutAt: '2026-10-08T16:00:00Z',
    court: 'theirs',
    owe: false,
    marks: [],
    notes: [],
    sends: {},
    portal: null,
    jobs: { '1312': 'the water heater' },
    ...more,
  }
}

const reviewStep = (p: PersonFlow) => p.reading.lanes.find((l) => l.jobId === '1312')!.steps.find((s) => s.stepId === 'review')!

describe('the review ask: the one reminder on our own move (v2.5943)', () => {
  it('names the residential review step and no other', () => {
    expect(afterPrior('residential', 'review')).toBe(true)
    expect(afterPrior('residential', 'paid')).toBe(false)
    expect(afterPrior('trade', 'review')).toBe(false)
    expect(REVIEW.nudge).toEqual({ days: 1, how: 'text', send: 'app', dayFact: null })
  })

  it('reads the day Paid turned true, and is due the morning after it', () => {
    const yesterday = dana('2026-10-13')
    const step = reviewStep(yesterday)
    expect(step.state).toBe('now')
    expect(priorDone(yesterday, step, MORNING)).toEqual({ name: 'Paid', days: 1 })
    expect(nudgeDue(yesterday, step, MORNING)).toMatchObject({ due: true, reason: 'after prior' })
    const today = dana('2026-10-14')
    expect(nudgeDue(today, reviewStep(today), MORNING)).toMatchObject({ due: false, reason: 'not yet' })
  })

  it('holds while the customer waits on an answer from us, and keeps Hold until Mon', () => {
    const waiting = dana('2026-10-13', { court: 'ours' })
    expect(nudgeDue(waiting, reviewStep(waiting), MORNING)).toMatchObject({ due: false, reason: 'they wait' })
    const held = dana('2026-10-13', { marks: [{ stepId: 'review', jobId: '1312', holdUntil: '2026-10-19' }] })
    expect(nudgeDue(held, reviewStep(held), MORNING)).toMatchObject({ due: false, reason: 'held' })
  })

  it('says it in words on the card and carries it on Follow up', () => {
    const yesterday = dana('2026-10-13')
    const words = reminderWords(yesterday, reviewStep(yesterday), MORNING)
    expect(words).toBe('Text the morning after Paid, sent by the app. Paid was 1 day ago, so it is on Follow up now.')
    const waiting = dana('2026-10-13', { court: 'ours' })
    expect(reminderWords(waiting, reviewStep(waiting), MORNING)).toBe('Text the morning after Paid, sent by the app. Dana is waiting on an answer from us, so not yet.')
    const rows = nudgeRows([yesterday], MORNING)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ contactId: 'dana', stepId: 'review', jobId: '1312', how: 'text' })
    expect(rows[0]!.why).toContain('Paid was 1 day ago')
    expect(plainWordsFailures(words), words).toEqual([])
  })

  it('the run offers the ask with the name and the job filled and the link left for the edge', () => {
    const appSends: AppSends = { residential: { review: 'offer' } }
    const yesterday = dana('2026-10-13')
    const r = planNudgeRun({ people: [yesterday], now: MORNING, appSends, sent: [], numbers: { dana: { number: '(210) 555-0190', optedOut: false } } })
    expect(r.texts).toEqual([])
    expect(r.offers).toHaveLength(1)
    expect(r.offers[0]).toMatchObject({ contactId: 'dana', stepId: 'review', jobId: '1312', held: null })
    expect(r.offers[0]!.body).toBe('Dana, thank you for paying for the water heater. Would you tell us how we did? It takes one tap: {rate}')
    const sent = planNudgeRun({ people: [yesterday], now: MORNING, appSends: { residential: { review: true } }, sent: [], numbers: { dana: { number: '(210) 555-0190', optedOut: false } } })
    expect(sent.texts).toHaveLength(1)
    expect(fillLine(sent.texts[0]!.body, { rate: 'https://clicktooling.com/rate?t=c91d' }).text.endsWith('one tap: https://clicktooling.com/rate?t=c91d')).toBe(true)
    const off = planNudgeRun({ people: [yesterday], now: MORNING, appSends: {}, sent: [], numbers: {} })
    expect(off.notSent.map((k) => [k.stepId, k.why])).toEqual([['review', 'off']])
  })

  it('the line reads in plain words once filled', () => {
    const line = nudgeLine({ first: 'Dana', reading: { kind: 'residential' } }, REVIEW)
    expect(line).toBe('Dana, thank you for paying for {job}. Would you tell us how we did? It takes one tap: {rate}')
    const filled = fillLine(line, { job: 'the water heater', rate: 'clicktooling.com/rate?t=c91d' }).text
    expect(plainWordsFailures(filled), filled).toEqual([])
  })
})
