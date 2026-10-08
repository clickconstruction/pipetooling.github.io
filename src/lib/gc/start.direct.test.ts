/**
 * Main's own tests for Get started (the Board's B2-ii): everything that has to be true before work
 * starts, by our contract, the permit and the start date, the schedule, and each trade's five papers,
 * with the one thing to do next, run through the kernel on the test data. The spike's own cases:
 * Helotes Dental Office is buying out, its customer signed Sep 4, and Fair Oaks Shops, Building D is
 * being built with Pecan Valley Electric's insurance run out.
 */
import { describe, expect, it } from 'vitest'
import { architectSummary } from './customers'
import { currentRev, planLabel } from './lookups'
import { initialGcState } from './schedule/testState'
import { startChecklist } from './start'

const job = (id: string) => initialGcState().projects.find((p) => p.id === id)!

describe('Get started', () => {
  it('lists what stands between Helotes and its start, our part first, then each trade’s next step', () => {
    const s = initialGcState()
    const list = startChecklist(s, job('helotes'))
    expect(list.owner.map((c) => [c.key, c.done, c.detail])).toEqual([
      ['ownerContract', true, 'signed Sep 4'],
      ['permit', false, 'not yet'],
      ['startDate', false, 'no date yet'],
    ])
    expect([list.schedule.done, list.schedule.detail]).toEqual([false, 'not drawn yet'])
    expect(list.trades.map((t) => [t.pkg.id, t.ready, t.next])).toEqual([
      ['dry', true, null],
      ['delec', false, 'Brightline Electric has the statement of work. Get it signed.'],
      ['dhvac', false, 'Kendall Air has the master agreement. Get it signed.'],
      ['dplumb', true, null],
      ['mill', false, 'Pick a company and award the trade.'],
    ])
    expect([list.done, list.total, list.ready]).toEqual([14, 25, false])
    expect(list.missing).toEqual([
      'The permit is in hand: not yet.',
      'A start date is set: no date yet.',
      'The schedule is drawn: not drawn yet.',
      'Electrical: Brightline Electric has the statement of work. Get it signed.',
      'HVAC: Kendall Air has the master agreement. Get it signed.',
      'Millwork: Pick a company and award the trade.',
    ])
  })

  it('a job being built still names a paper that ran out', () => {
    expect(startChecklist(initialGcState(), job('fairoaksd')).missing).toEqual(['Electrical: Get a current insurance certificate from Pecan Valley Electric.'])
  })
})

describe('an architect, and the plans', () => {
  it('counts an architect’s live jobs, sets and addenda, and the questions waiting on them', () => {
    const s = initialGcState()
    const summary = architectSummary(s, s.customers.find((c) => c.id === 'marshvale')!)
    expect([summary.live.map((p) => p.id), summary.sets, summary.addenda]).toEqual([['boerne', 'padb', 'fairoaksd'], 4, 1])
    expect(summary.waiting.map((w) => [w.project.id, w.question.id, w.days])).toEqual([
      ['boerne', 'q-roof-1', 5],
      ['boerne', 'q-elec-1', 2],
    ])
    expect(summary.answered.map((w) => w.question.id)).toEqual(['q-site-1'])
    expect(architectSummary(s, s.customers.find((c) => c.id === 'cibolo')!).live).toEqual([])
  })

  it('names the newest set of plans', () => {
    expect([currentRev(job('boerne')), planLabel(job('boerne'), currentRev(job('boerne')))]).toEqual([1, 'Addendum 1'])
    expect(planLabel(job('padb'), 0)).toBe('Pricing set')
  })
})
