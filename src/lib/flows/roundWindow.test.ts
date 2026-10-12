import { describe, expect, it } from 'vitest'
import { FLOW_FIXTURE_NOW, flowFixture } from './flowFixtures'
import { roundWindow, type ChangeOrderDetail, type PayAppDetail } from './roundWindow'
import { SEED_FLOWS } from './seed'
import { flat, readFlow, stepReading } from './state'

const roundsOf = (id: string, stepId: string, jobId: string) => {
  const p = flowFixture(id)
  const r = readFlow(SEED_FLOWS[p.kind], p.stamps, FLOW_FIXTURE_NOW)
  const step = flat(SEED_FLOWS[p.kind]).find((s) => s.id === stepId)!
  return { step, rounds: stepReading(r, stepId, jobId)?.rounds ?? [] }
}
const PRIYA = { name: 'Dr. Priya Raman', firstName: 'Dr. Raman' }
const SINK: ChangeOrderDetail = { what: 'a sink in exam 3', adds: 2600, days: null, sumBefore: 412000, sentOn: '2026-09-30', openedOn: null }

describe('a change order’s window', () => {
  const { step, rounds } = roundsOf('priya', 'co', 'helotes')
  const [co1, co2] = rounds

  it('reads an open one with its facts, whether they opened it, and Ask again', () => {
    expect(roundWindow(step, co2!, PRIYA, { changeOrder: SINK, theirPage: true })).toEqual({
      title: 'CO 2 · a sink in exam 3',
      sub: 'Change orders · Dr. Priya Raman',
      state: { words: 'open since Sep 30', tone: 'wait' },
      line: 'Dr. Raman has not opened it.',
      facts: [
        { label: 'What', value: 'a sink in exam 3' },
        { label: 'Adds', value: '+$2,600' },
        { label: 'Days', value: 'none' },
        { label: 'Sum after', value: '$414,600 once signed' },
        { label: 'Sent', value: 'Wed Sep 30' },
      ],
      actions: [
        { kind: 'ask-again', label: 'Ask again' },
        { kind: 'their-page', label: 'See their page' },
      ],
    })
    expect(roundWindow(step, co2!, PRIYA, { changeOrder: { ...SINK, openedOn: '2026-10-01' } }).line).toBe('Dr. Raman opened it Thu Oct 1 and has not signed.')
  })

  it('leaves the money out for a reader who may not see it, and reads a signed one as done with nothing to press', () => {
    const noMoney = roundWindow(step, co2!, PRIYA, { changeOrder: { ...SINK, adds: null, sumBefore: null } })
    expect(noMoney.facts.map((f) => f.label)).toEqual(['What', 'Days', 'Sent'])
    const signed = roundWindow(step, co1!, PRIYA, {})
    expect(signed).toMatchObject({ title: 'CO 1 · exam 2 cabinets', state: { words: 'done Sep 28', tone: 'ok' }, line: null, facts: [], actions: [] })
  })
})

describe('a pay application’s window', () => {
  const { step, rounds } = roundsOf('elena', 'payapp', 'boerne')
  const ELENA = { name: 'Elena Marchetti', firstName: 'Elena' }

  it('reads what it covers, the amount, the certificate with the architect, and not paid yet', () => {
    const four: PayAppDetail = { covers: 'work through Sep 30', amount: 118600, certifiedBy: null, certifiedOn: null, withArchitect: { name: 'Jonah Vale', since: '2026-09-28' }, paidOn: null, waivers: null, tradesPaidOn: null }
    expect(roundWindow(step, rounds[1]!, ELENA, { payApp: four })).toMatchObject({
      title: 'Pay app 4',
      state: { words: 'due Oct 30', tone: 'wait' },
      facts: [
        { label: 'Covers', value: 'work through Sep 30' },
        { label: 'Amount', value: '$118,600' },
        { label: 'Certified', value: 'with Jonah Vale since Sep 28' },
        { label: 'Paid', value: 'not yet' },
      ],
      actions: [
        { kind: 'open', label: 'Open the application' },
        { kind: 'the-trades', label: 'The trades on it' },
      ],
    })
  })

  it('reads a paid one with its certificate, its waivers and the day the trades were paid', () => {
    const three: PayAppDetail = { covers: null, amount: null, certifiedBy: 'Jonah Vale', certifiedOn: '2026-09-22', withArchitect: null, paidOn: '2026-09-25', waivers: 6, tradesPaidOn: '2026-09-28' }
    expect(roundWindow(step, rounds[0]!, ELENA, { payApp: three }).facts).toEqual([
      { label: 'Certified', value: 'Jonah Vale, Sep 22' },
      { label: 'Paid', value: 'Sep 25, 6 waivers, trades paid Sep 28' },
    ])
  })
})

describe('any other round’s window', () => {
  it('reads its day, and Ask again on their move', () => {
    const { step, rounds } = roundsOf('jonah', 'questions', 'boerne')
    expect(roundWindow(step, rounds[2]!, { name: 'Jonah Vale', firstName: 'Jonah' })).toEqual({
      title: 'Pond',
      sub: 'Questions · Jonah Vale',
      state: { words: 'due Mon', tone: 'wait' },
      line: 'Pond, due Mon Oct 5.',
      facts: [],
      actions: [
        { kind: 'open', label: 'Open' },
        { kind: 'ask-again', label: 'Ask again' },
      ],
    })
  })

  it('reads a late one as was due, and a round done with nothing to ask', () => {
    const { step, rounds } = roundsOf('greg', 'ask', 'boerne')
    expect(roundWindow(step, rounds[0]!, { name: 'Greg Paulk', firstName: 'Greg' })).toMatchObject({ state: { words: 'late 2 days' }, line: 'Boerne Retail Shell, was due Wed Sep 30.' })
    const q = roundsOf('jonah', 'questions', 'boerne')
    expect(roundWindow(q.step, q.rounds[0]!, { name: 'Jonah Vale', firstName: 'Jonah' })).toMatchObject({ state: { words: 'done Sep 18', tone: 'ok' }, actions: [{ kind: 'open', label: 'Open' }] })
  })
})
