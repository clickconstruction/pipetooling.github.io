import { describe, expect, it } from 'vitest'
import { boardCompanyOf, jobPaperCompanyOf } from './boardRead'
import { FIRST_NAMES, USUAL } from './boardFixtures'
import { FLOW_FIXTURE_JOBS, FLOW_FIXTURE_NOW, FLOW_FIXTURE_PEOPLE } from './flowFixtures'
import { jobPaperList } from './jobPaperList'
import { SEED_FLOWS } from './seed'
import { readFlow } from './state'

/** Everyone on Boerne Retail Shell, read on their flows from the shared demo people. */
const onBoerne = FLOW_FIXTURE_PEOPLE.filter((p) => p.stamps.jobIds.includes('boerne')).map((p) => {
  const flow = SEED_FLOWS[p.kind]
  const r = readFlow(flow, p.stamps, FLOW_FIXTURE_NOW)
  const card = { name: p.name, goes_by: null, company: p.company || null, trades: p.trade ? [p.trade] : [], gc_company_id: null, customer_id: null }
  return jobPaperCompanyOf(flow, boardCompanyOf(flow, p.contactId, card, r), r, 'boerne')
})
const list = jobPaperList({
  jobId: 'boerne',
  flows: { trade: SEED_FLOWS.trade, customer: SEED_FLOWS.customer, arch: SEED_FLOWS.arch },
  companies: onBoerne,
  today: '2026-10-02',
  usual: USUAL,
  firstNames: FIRST_NAMES,
  jobs: Object.fromEntries(Object.entries(FLOW_FIXTURE_JOBS).map(([id, name]) => [id, { name }])),
})
const lines = (name: string) => list.find((c) => c.name === name)?.lines.map((l) => [l.label, l.state, l.step, l.where, l.press])

describe('jobPaperList', () => {
  it('lists each company in the grid’s order, under what it is to the job', () => {
    expect(list.map((c) => [c.name, c.kindWord])).toEqual([
      ['Hillside Excavation', 'trade partner'],
      ['Bexar Steel Erectors', 'trade partner'],
      ['Kerr Electric', 'trade partner'],
      ['Lone Star Mechanical', 'trade partner'],
      ['Tejas Power', 'trade partner'],
      ['Cibolo Creek Partners', 'customer'],
      ['Marsh & Vale Architects', 'architect'],
    ])
  })

  it('reads each paper reached with its state, the step it finishes, where the person is, and its press', () => {
    expect(lines('Hillside Excavation')).toEqual([
      ['Invitation', 'on file Sep 8', 'Invited', 'done', 'open'],
      ['W-9', 'on file Sep 12', 'Papers in', 'lapsed', 'open'],
      ['Insurance certificate', 'ran out Sep 30', 'Papers in', 'lapsed', 'ask'],
      ['Master agreement', 'on file Sep 14', 'MSA signed', 'done', 'open'],
      ['Quote', 'late 2 days', 'Asked to quote', 'Greg is on it', 'remind'],
    ])
  })

  it('says a paper of theirs is owed by its day, a paper we sent went, and calls a company with nobody named by its name', () => {
    expect(lines('Lone Star Mechanical')?.find((l) => l[0] === 'Quote')).toEqual(['Quote', 'due Thu', 'Asked to quote', 'Lone Star Mechanical is on it', 'remind'])
    expect(lines('Cibolo Creek Partners')?.find((l) => l[0] === 'Pay application')).toEqual(['Pay application', 'went, waiting on them', 'Pay application', 'Elena is on it', 'remind'])
    expect(lines('Tejas Power')?.find((l) => l[0] === 'Statement of work')).toEqual(['Statement of work', 'nothing on file', 'Statement of work', 'next', 'send'])
  })

  it('leaves off the papers later in the flow', () => {
    expect(lines('Hillside Excavation')?.map((l) => l[0])).not.toContain('Statement of work')
  })
})
