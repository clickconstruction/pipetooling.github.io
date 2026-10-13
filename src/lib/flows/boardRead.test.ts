import { describe, expect, it } from 'vitest'
import { boardCompanyOf, jobPaperCompanyOf, parseFlowRowsKind, portalCellWords, readBoard, type ContactCard, type FlowRowsKindAnswer } from './boardRead'
import { FLOW_FIXTURE_NOW as NOW, flowFixture } from './flowFixtures'
import { SEED_FLOWS } from './seed'
import { readFlow } from './state'

const read = (id: string) => {
  const p = flowFixture(id)
  return readFlow(SEED_FLOWS[p.kind], p.stamps, NOW)
}
const card = (c: Partial<ContactCard> & Pick<ContactCard, 'name'>): ContactCard => ({ goes_by: null, company: null, trades: [], gc_company_id: null, customer_id: null, ...c })

describe('parseFlowRowsKind', () => {
  it('keeps each entry with a contact, and reads a card with a field missing as empty', () => {
    const answer = parseFlowRowsKind({
      c1: { contact: { id: 'c1', kind: 'trade' }, card: { name: ' Greg Paulk ', company: 'Hillside Excavation', trades: ['Sitework', '', 7] } },
      c2: { contact: { id: 'c2', kind: 'trade' } },
      broken: { card: { name: 'No contact' } },
      worse: 'not an entry',
    })
    expect(Object.keys(answer)).toEqual(['c1', 'c2'])
    expect(answer.c1?.card).toEqual({ name: 'Greg Paulk', goes_by: null, company: 'Hillside Excavation', trades: ['Sitework'], gc_company_id: null, customer_id: null })
    expect(answer.c2?.card).toEqual({ name: '', goes_by: null, company: null, trades: [], gc_company_id: null, customer_id: null })
  })

  it('reads the records a contact’s own windows open by, a trade’s company from its rows when the card has none', () => {
    const answer = parseFlowRowsKind({
      t1: { contact: { id: 't1', kind: 'trade' }, company: { id: 'co-9', portal_opened_on: null }, card: { name: 'Greg Paulk' } },
      k1: { contact: { id: 'k1', kind: 'customer' }, card: { name: 'Elena Marchetti', customer_id: 'cu-4' } },
    })
    expect([answer.t1?.card.gc_company_id, answer.k1?.card.customer_id]).toEqual(['co-9', 'cu-4'])
  })

  it('reads anything but an object as no one', () => {
    expect(parseFlowRowsKind(null)).toEqual({})
    expect(parseFlowRowsKind([{ contact: { id: 'x' } }])).toEqual({})
  })
})

describe('boardCompanyOf', () => {
  it('reads a trade partner: the company’s name, the person, the trades, the jobs and where they stand', () => {
    const greg = boardCompanyOf(SEED_FLOWS.trade, 'greg', card({ name: 'Greg Paulk', company: 'Hillside Excavation', trades: ['Sitework'] }), read('greg'))
    expect(greg).toMatchObject({
      contactId: 'greg',
      name: 'Hillside Excavation',
      personName: 'Greg Paulk',
      firstName: 'Greg',
      trades: ['Sitework'],
      jobIds: ['boerne', 'padb', 'stoneoak'],
      defaultJobId: 'boerne',
      off: null,
      onceDone: ['invited', 'portal', 'msa'],
      jobsDone: [],
    })
    expect(greg.places.map((p) => `${p.stepId}@${p.jobId ?? '-'}:${p.state}`)).toEqual(['papers@-:lapsed', 'ask@boerne:now', 'ask@padb:now', 'draws@stoneoak:now'])
    expect(greg).not.toHaveProperty('jobsEnded')
  })

  it('reads a customer who declined: off the flow, the job ended declined', () => {
    const marcus = boardCompanyOf(SEED_FLOWS.customer, 'marcus', card({ name: 'Marcus Bell', company: 'Bell Family Dental' }), read('marcus'))
    expect(marcus).toMatchObject({ off: { since: '2026-09-29', why: 'Declined our bid, went with another plumber.' }, jobsEnded: { bell: 'declined' }, places: [] })
  })

  it('names a person who is their own record, keeps a title in what we call them, goes by what they go by, and calls a company with nobody named by its name', () => {
    expect(boardCompanyOf(SEED_FLOWS.customer, 'priya', card({ name: 'Dr. Priya Raman' }), read('priya'))).toMatchObject({ name: 'Dr. Priya Raman', personName: null, firstName: 'Dr. Raman' })
    expect(boardCompanyOf(SEED_FLOWS.trade, 'bill', card({ name: 'William Sorrell', goes_by: 'Bill', company: 'Tejas Power' }), read('bill')).firstName).toBe('Bill')
    expect(boardCompanyOf(SEED_FLOWS.trade, 'x', card({ name: '' }), read('bill'))).toMatchObject({ name: 'No name yet', firstName: null })
    expect(boardCompanyOf(SEED_FLOWS.trade, 'g5', card({ name: 'Kerr Electric', company: 'Kerr Electric' }), read('g5'))).toMatchObject({ name: 'Kerr Electric', personName: null, firstName: null })
  })
})

describe('jobPaperCompanyOf', () => {
  it('reads each of the flow’s papers for that one job', () => {
    const r = read('greg')
    const company = boardCompanyOf(SEED_FLOWS.trade, 'greg', card({ name: 'Greg Paulk', company: 'Hillside Excavation' }), r)
    const onBoerne = jobPaperCompanyOf(SEED_FLOWS.trade, company, r, 'boerne')
    expect(onBoerne.kind).toBe('trade')
    expect(Object.keys(onBoerne.reads)).toEqual(['invitation', 'w9', 'coi', 'msa', 'quote', 'sow', 'waiver', 'final_waiver'])
    expect(onBoerne.reads.coi).toMatchObject({ stepId: 'papers', mark: 'bad' })
    expect(jobPaperCompanyOf(SEED_FLOWS.trade, company, r, 'padb').reads.quote).toMatchObject({ stepId: 'ask', stepState: 'now' })
  })
})

describe('readBoard', () => {
  const answer: FlowRowsKindAnswer = {
    c2: {
      contact: { id: 'c2', kind: 'trade', off_since: null, off_why: null, off_by: null },
      card: card({ name: 'Ana Ruiz', company: 'Alamo Steel', trades: ['Structural steel'] }),
      company: { id: 'co2', portal_opened_on: '2026-09-02' },
      tradeMessages: [{ company_id: 'co2', kind: 'invite', sent_on: '2026-09-01', sent_by: null }],
      contactJobs: [{ project_id: 'p1', is_default: true }],
      projects: [{ project_id: 'p1', name: 'Stone Oak Pharmacy', stage: 'building', created_at: '2026-08-01T15:00:00Z', bid_due: null, our_bid_sent_on: null, won_on: null, lost_on: null, owner_contract_sent_on: null, owner_contract_signed_on: null, started_on: null, closed_on: null, owner_pay_days: null }],
    },
    c1: {
      contact: { id: 'c1', kind: 'trade', off_since: null, off_why: null, off_by: null },
      card: card({ name: 'Dan Ruiz', company: 'Rio Paving', trades: ['Paving'] }),
    },
    c3: { contact: { id: 'c3', kind: 'customer', off_since: null, off_why: null, off_by: null }, card: card({ name: 'Elena Marchetti' }) },
  }

  it('reads every contact of the flow’s kind, A to Z, with the jobs’ names and what we call each one', () => {
    const b = readBoard(SEED_FLOWS.trade, answer, NOW)
    expect(b.companies.map((c) => c.name)).toEqual(['Alamo Steel', 'Rio Paving'])
    expect(b.jobs).toEqual({ p1: { name: 'Stone Oak Pharmacy' } })
    expect(b.firstNames).toEqual({ c1: 'Dan', c2: 'Ana' })
    expect(b.refs.c2).toEqual({ companyId: null, customerId: null })
    expect(Object.keys(b.readings).sort()).toEqual(['c1', 'c2'])
  })

  it('reads the Once lane from their rows, and the job they are tied to waiting on its ask', () => {
    const alamo = readBoard(SEED_FLOWS.trade, answer, NOW).companies[0]
    expect(alamo).toMatchObject({ onceDone: ['invited', 'portal'], jobIds: ['p1'], defaultJobId: 'p1' })
    expect(alamo?.places.map((p) => `${p.stepId}@${p.jobId ?? '-'}`)).toEqual(['papers@-', 'ask@p1'])
  })
})

describe('portalCellWords', () => {
  it('reads a trade partner’s Portal opened step', () => {
    expect(portalCellWords(SEED_FLOWS.trade, read('greg'), null, NOW)).toBe('opened')
    expect(portalCellWords(SEED_FLOWS.trade, undefined, null, NOW)).toBe('never')
  })

  it('reads a customer’s last outside open of their page in the app’s days', () => {
    expect(portalCellWords(SEED_FLOWS.customer, read('elena'), null, NOW)).toBe('never')
    expect(portalCellWords(SEED_FLOWS.customer, read('elena'), '2026-10-02T14:00:00Z', NOW)).toBe('today')
    // 02:00 UTC on Oct 2 is the evening of Oct 1 in Texas: one day, not today.
    expect(portalCellWords(SEED_FLOWS.customer, read('elena'), '2026-10-02T02:00:00Z', NOW)).toBe('1 d ago')
    expect(portalCellWords(SEED_FLOWS.customer, read('elena'), '2026-09-25T16:00:00Z', NOW)).toBe('7 d ago')
  })
})
