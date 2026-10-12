import { describe, expect, it } from 'vitest'
import { demoPeople } from './demoPeople.fixture'
import { funnel, type StepSpan } from './going'
import { goingInputs } from './goingInputs'

const people = demoPeople().filter((p) => p.reading.kind !== 'unknown')

/** One person's inputs, as How it is going reads everyone of their kind. */
const of = (id: string) => {
  const p = people.find((x) => x.id === id)
  if (!p) throw new Error(`no demo person ${id}`)
  return goingInputs(p.flow, [{ contactId: p.id, reading: p.reading }])
}

/** A span in words: 'msa 2026-09-12→2026-09-14 last msa_signed'. */
const words = (s: StepSpan) => `${s.stepId}${s.jobId ? `@${s.jobId}` : ''} ${s.from}→${s.to ?? '…'}${s.lastFact ? ` last ${s.lastFact}` : ''}`

describe('the times a person went through each step', () => {
  it('reads Greg’s from the day each step came on to the day it was done, still open where it is on now', () => {
    expect(of('greg').spans.map(words)).toEqual([
      'invited 2026-09-08→2026-09-08 last invite_sent',
      'portal 2026-09-08→2026-09-09 last portal_opened',
      // Lapsed: on it again since the certificate ran out.
      'papers 2026-09-30→…',
      // The step before finished on the W-9, Sep 12, though its certificate later lapsed: readFlow's rule.
      'msa 2026-09-12→2026-09-14 last msa_signed',
      'ask@boerne 2026-09-22→…',
      'ask@stoneoak 2026-09-08→2026-09-11 last quote_in',
      // A fork ends on either fact, so nothing sticks there.
      'compare@stoneoak 2026-09-11→2026-09-14',
      'sow@stoneoak 2026-09-14→2026-09-18 last sow_signed',
      // Each draw is a time through the step.
      'draws@stoneoak 2026-09-25→2026-09-30 last draw_paid',
      'draws@stoneoak 2026-10-01→…',
    ])
  })

  it('starts every step on now where readFlow says it went on now, so How it is going and the boards agree', () => {
    let checked = 0
    for (const p of people) {
      const { spans } = goingInputs(p.flow, [{ contactId: p.id, reading: p.reading }])
      for (const lane of p.reading.lanes) {
        for (const s of lane.steps) {
          if ((s.state !== 'now' && s.state !== 'lapsed') || !s.since || s.rounds.length) continue
          expect(spans.find((x) => x.stepId === s.stepId && x.jobId === s.jobId && x.to == null)?.from).toBe(s.since)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(3)
  })

  it('reads a change order off the chain from its own stamps, each round apart', () => {
    expect(of('elena').spans.filter((s) => s.stepId === 'co').map(words)).toEqual([
      'co@boerne 2026-09-10→2026-09-12 last co_answered',
      'co@boerne 2026-09-16→2026-09-18 last co_answered',
    ])
  })

  it('reads nobody twice: everyone of a kind at once is each person read alone', () => {
    const trade = people.filter((p) => p.reading.kind === 'trade')
    const flow = trade[0]?.flow
    if (!flow) throw new Error('no trade partner in the demo')
    const all = goingInputs(flow, trade.map((p) => ({ contactId: p.id, reading: p.reading })))
    expect(all.spans).toEqual(trade.flatMap((p) => of(p.id).spans))
    expect(all.runs).toEqual(trade.flatMap((p) => of(p.id).runs))
  })
})

describe('each run through the per-job lane', () => {
  it('runs from the ask, with every fact that turned true, once per round', () => {
    expect(of('greg').runs).toEqual([
      { contactId: 'greg', jobId: 'boerne', from: '2026-09-22', facts: [], ended: false },
      { contactId: 'greg', jobId: 'stoneoak', from: '2026-09-08', facts: ['quote_in', 'carried', 'sow_signed', 'draw_paid'], ended: false },
    ])
    expect(of('jonah').runs[0]?.facts).toEqual(['plans_in', 'question_answered', 'question_answered', 'addendum_filed'])
  })

  it('leaves out a job whose lane has not started, and ends a run its fork ended', () => {
    expect(of('greg').runs.map((r) => r.jobId)).not.toContain('padb')
    expect(of('marcus').runs).toEqual([{ contactId: 'marcus', jobId: 'bell', from: '2026-09-14', facts: ['asked_us', 'bid_sent', 'declined'], ended: true }])
  })

  it('makes the customers’ funnel for the quarter they began in', () => {
    const customers = people.filter((p) => p.reading.kind === 'customer')
    const flow = customers[0]?.flow
    if (!flow) throw new Error('no customer in the demo')
    const { runs } = goingInputs(flow, customers.map((p) => ({ contactId: p.id, reading: p.reading })))
    expect(funnel('customer', runs, '2026-09-30')).toEqual({
      stages: [
        { label: 'asked us', n: 3, pctOfPrev: null },
        { label: 'bid', n: 3, pctOfPrev: 100 },
        { label: 'said yes', n: 2, pctOfPrev: 67 },
        { label: 'contract', n: 2, pctOfPrev: 100 },
      ],
      out: { label: 'declined', n: 1 },
      rounds: false,
    })
  })
})
