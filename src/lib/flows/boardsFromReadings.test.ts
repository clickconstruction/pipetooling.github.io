/**
 * The boards and the job's papers over flows/state.ts's own readings of the demo people (`flowFixtures.ts`), where
 * board.test.ts and jobPapers.test.ts hand-build the places. `companyOf` is the mapping wave 2's loader makes: a
 * reading's places, its Once lane's done steps and its ended jobs, under the company's name and trade.
 */
import { describe, expect, it } from 'vitest'
import { boardBands, boardLines, boardSummary, byTrade, lineDayWords, type BoardCompany, type BoardContext } from './board'
import { FIRST_NAMES, USUAL } from './boardFixtures'
import type { FlowKind } from './facts'
import { FLOW_FIXTURE_JOBS, FLOW_FIXTURE_NOW, FLOW_FIXTURE_PEOPLE, type FlowFixturePerson } from './flowFixtures'
import { gridColumns, jobPaperGrid, jobStrip, type JobPaperCompany, type JobPapersInput } from './jobPapers'
import { SEED_FLOWS } from './seed'
import { flat, paperRead, perJobJobs, placesOf, readFlow, stepReading, type FlowReading } from './state'

const TODAY = '2026-10-02'
const JOBS = Object.fromEntries(Object.entries(FLOW_FIXTURE_JOBS).map(([id, name]) => [id, { name }]))

function companyOf(p: FlowFixturePerson, r: FlowReading): BoardCompany {
  const flow = SEED_FLOWS[p.kind]
  const once = flow.lanes.filter((l) => l.lane !== 'per_job').flatMap((l) => l.steps)
  return {
    contactId: p.contactId,
    name: p.company || p.name,
    personName: p.ghost ? null : p.name,
    firstName: p.ghost ? null : (p.name.split(' ').find((w) => !/^dr\.?$/i.test(w)) ?? null),
    trades: p.trade ? [p.trade] : [],
    jobIds: p.stamps.jobIds,
    defaultJobId: p.stamps.defaultJobId,
    off: r.off ? { since: r.off.since, why: r.off.why } : null,
    places: placesOf(r),
    onceDone: once.filter((s) => stepReading(r, s.id, null)?.state === 'done').map((s) => s.id),
    jobsDone: perJobJobs(r).filter((j) => j.started && !j.headStepId && !j.ended).map((j) => j.jobId),
  }
}

const read = (p: FlowFixturePerson) => readFlow(SEED_FLOWS[p.kind], p.stamps, FLOW_FIXTURE_NOW)
const companies = (kind: FlowKind) => FLOW_FIXTURE_PEOPLE.filter((p) => p.kind === kind).map((p) => companyOf(p, read(p)))
const ctx = (kind: FlowKind): BoardContext => ({ flow: SEED_FLOWS[kind], jobs: JOBS, usual: USUAL, firstNames: FIRST_NAMES, today: TODAY })
const step = (kind: FlowKind, id: string) => {
  const s = flat(SEED_FLOWS[kind]).find((x) => x.id === id)
  if (!s) throw new Error(`no step ${id}`)
  return s
}

describe('the boards over the read', () => {
  const trade = ctx('trade')
  const trades = companies('trade')

  it('reads Papers in as the prototype draws it, Hillside lapsed since its insurance ran out Sep 30', () => {
    expect(boardLines(trade, trades, step('trade', 'papers')).map((l) => [l.contactId, l.days, lineDayWords(l, trade)])).toEqual([
      ['g4', 6, '6 d · over usual'],
      ['tom', 4, '4 d · over usual'],
      ['greg', 2, 'insurance expired'],
      ['g3', 2, '2 d'],
    ])
  })

  it('groups the asks by job with the day they share, and reminds the one late', () => {
    const ask = boardBands(trade, trades).flatMap((b) => b.rows).find((r) => r.step.id === 'ask')
    expect(ask?.groups.map((g) => [g.label, g.sharedDue, g.chips.map((c) => `${c.line.contactId}:${c.words}`)])).toEqual([
      ['Boerne Retail Shell', '2026-10-08', ['greg:late 2 days', 'g3:', 'g5:', 'tom:']],
      ['Boerne Retail Pad B', '2026-10-22', ['g4:', 'greg:']],
    ])
    expect(ask?.press).toEqual({ kind: 'nudge', label: 'Remind the 1 late', contactIds: ['greg'], late: true })
  })

  it('counts the hand by company, and over usual and waiting as watches', () => {
    expect(boardSummary(trade, trades).hand).toEqual({ count: 1, late: 1, lapsed: 0, over: 3, waiting: 0 })
    expect(boardSummary(trade, trades).off.map((o) => o.contactId)).toEqual(['g6', 'g7'])
    expect(boardSummary(ctx('customer'), companies('customer')).hand).toEqual({ count: 0, late: 0, lapsed: 0, over: 2, waiting: 1 })
  })

  it('reads By trade from the companies’ records', () => {
    const sitework = byTrade(trade, trades).find((r) => r.trade === 'Sitework')
    expect(sitework?.chips).toMatchObject([{ name: 'Hillside Excavation', step: { id: 'ask' }, jobId: 'boerne', words: 'late 2 days', tone: 'late' }])
  })
})

describe('the job’s papers over the read', () => {
  const people = FLOW_FIXTURE_PEOPLE.filter((p) => p.stamps.jobIds.includes('boerne'))
  const onBoerne: JobPaperCompany[] = people.map((p) => {
    const r = read(p)
    return { ...companyOf(p, r), kind: p.kind, reads: Object.fromEntries(gridColumns(SEED_FLOWS[p.kind]).map((c) => [c.paper, paperRead(r, c.paper, 'boerne')])) }
  })
  const input: JobPapersInput = { jobId: 'boerne', flows: { trade: SEED_FLOWS.trade, customer: SEED_FLOWS.customer, arch: SEED_FLOWS.arch }, companies: onBoerne, today: TODAY, usual: USUAL, firstNames: FIRST_NAMES, jobs: JOBS }

  it('reads each quote for its own job: Hillside’s Boerne quote is late, and its Pad B quote is not', () => {
    const greg = people.find((p) => p.contactId === 'greg')
    if (!greg) throw new Error('no greg')
    const r = read(greg)
    const padB = jobPaperGrid({ ...input, jobId: 'padb', companies: [{ ...companyOf(greg, r), kind: 'trade', reads: { quote: paperRead(r, 'quote', 'padb') } }] })
    expect(padB.sections[0]?.rows[0]?.cells.find((c) => c.paper === 'quote')).toMatchObject({ mark: 'waiting', words: 'due Oct 22', lateDays: 0 })
    expect(jobPaperGrid(input).sections[0]?.rows[0]?.cells.find((c) => c.paper === 'quote')).toMatchObject({ mark: 'late', words: 'late 2 days', lateDays: 2 })
  })

  it('reads every on-time quote by its day', () => {
    const quotes = jobPaperGrid(input).sections[0]?.rows.map((row) => [row.contactId, row.cells.find((c) => c.paper === 'quote')?.words])
    expect(quotes).toEqual([
      ['greg', 'late 2 days'],
      ['tom', 'due Thu'],
      ['g5', 'due Thu'],
      ['g3', 'due Thu'],
      ['bill', 'Sep 29'],
    ])
  })

  it('reads Before bid day from the same people', () => {
    expect(jobStrip(input, { kind: 'bid', due: '2026-10-08' })?.lines.map((l) => l.text)).toEqual([
      "Hillside Excavation's insurance ran out Sep 30. No statement of work can go to them until a new one is in.",
      "Hillside Excavation's quote is late 2 days.",
      "Tejas Power's quote is in. The compare has sat 3 days, over the usual 2.",
      '3 quotes due Thu Oct 8: Bexar Steel Erectors, Lone Star Mechanical, Kerr Electric. On time so far.',
    ])
  })
})
