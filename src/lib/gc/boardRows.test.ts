import { describe, expect, it } from 'vitest'
import { proposalTotals, packageCoverage } from './bids'
import { boardStateFromRows, stageOf } from './boardRows'
import { clinicBoardRows as rows } from './boardTestRows'
import { followUps, wordRecord } from './followUp'
import { travelFor } from './map'
import { priceStanding } from './priceStanding'
import { answerRecord } from './reliability'
import { awardGate } from './vetting'

describe('the board read from its rows', () => {
  it('reads a project: bidding is pursuing, the customer and architect by name, our own trade waiting on its own bid', () => {
    const s = boardStateFromRows(rows())
    const p = s.projects[0]!
    expect([p.stage, p.owner, p.architect, p.town, p.bidDue]).toEqual(['pursuing', 'Oak Street Partners', 'Studio Ocotillo', 'Boerne', '2026-10-20'])
    expect(p.packages.map((k) => [k.trade, k.carried, packageCoverage(k)])).toEqual([
      ['Sitework', null, 'bids'],
      ['Concrete', null, 'empty'],
      ['Plumbing', 'self', 'self-unpriced'],
    ])
    expect([stageOf('buyout'), stageOf('closed'), stageOf('bidding')]).toEqual(['buyout', 'building', 'pursuing'])
  })

  it('an ask carries its newest quote, the office’s plug, its story newest first and the day it was last chased', () => {
    const s = boardStateFromRows(rows())
    const site = s.projects[0]!.packages[0]!
    const [lonestar, hillside] = site.invites
    expect(lonestar!.bid).toMatchObject({ amount: 52000, submittedOn: '2026-10-05', includes: { s1: 'yes', s2: 'no' }, plugs: { s2: 9000 }, goodForDays: 30, note: 'Paving by others.' })
    expect(hillside!.bid).toBeNull()
    expect(hillside!.contacts).toEqual([{ on: '2026-10-02', by: 'Rosa', how: 'call', note: 'Quote by Monday.', promisedBy: '2026-10-05' }])
    expect(hillside!.nudgedOn).toBe('2026-10-02')
  })

  it('the kernels read it as the prototype: the price with its hole, who to chase, the word they gave', () => {
    const s = boardStateFromRows(rows())
    const p = s.projects[0]!
    const totals = proposalTotals(p)
    // Our own trade's Trades mode bid is not read yet, so it is a hole until it is priced.
    expect(totals.holes.map((k) => k.trade)).toEqual(['Sitework', 'Concrete', 'Plumbing'])
    expect(priceStanding(s, p).rows.map((r) => [r.pkg.trade, r.standing])).toEqual([
      ['Sitework', 'pick'],
      ['Concrete', 'notAsked'],
      ['Plumbing', 'ownBid'],
    ])
    expect(followUps(s).map((f) => [f.partner.company, f.why])).toEqual([['Hillside Excavation', 'passed']])
    const hillside = s.partners.find((x) => x.id === 'hillside')!
    expect(wordRecord(s, hillside)).toEqual({ made: 1, kept: 0 })
  })

  it('a company: its counts from its asks, its vetting, its drive from a point when the app has one', () => {
    const s = boardStateFromRows(rows())
    const [lonestar, hillside] = s.partners
    expect([lonestar!.invited, lonestar!.bids, answerRecord(lonestar!)]).toEqual([1, 1, 'new'])
    expect(hillside!.vetting).toEqual({ status: 'new' })
    const site = s.projects[0]!.packages[0]!
    expect(awardGate(s, site, site.invites[1]!).ok).toBe(false)
    expect(travelFor(s, lonestar!, s.projects[0]!).miles).toBe(35)
    const pointed = boardStateFromRows(rows({ points: { '4410 Boerne Stage Rd, San Antonio': { lat: 29.4241, lng: -98.4936 }, '12 Oak St, Boerne': { lat: 29.7947, lng: -98.732 } } }))
    expect(pointed.partners[0]!.basePoint?.lat).toBe(29.4241)
    expect(travelFor(pointed, pointed.partners[0]!, pointed.projects[0]!).miles).toBe(35)
  })

  it('a company new to us carries the form it sent, and who decided an approval reads by name', () => {
    const form = { company_id: 'hillside', license: 'TX 4471', insurance: 'Lone Star Mutual', years_in_business: null, reference_list: 'Ana Ruiz', past_jobs: 'Two clinics', sent_on: '2026-10-04' }
    const [, hillside] = boardStateFromRows(rows({ vettingForms: [form] })).partners
    expect(hillside!.vetting).toEqual({ status: 'new', form: { license: 'TX 4471', insurance: 'Lone Star Mutual', yearsInBusiness: 0, references: 'Ana Ruiz', pastJobs: 'Two clinics', sentOn: '2026-10-04' } })
    const decided = rows({ userNames: { u1: 'Rosa' } })
    decided.companies[1] = { ...decided.companies[1]!, vetting_status: 'approved', vetting_limit: '150000', vetting_decided_on: '2026-10-07', vetting_decided_by: 'u1', vetting_note: 'Ana vouched.' }
    expect(boardStateFromRows(decided).partners[1]!.vetting).toEqual({ status: 'approved', limit: 150000, decidedOn: '2026-10-07', decidedBy: 'Rosa', note: 'Ana vouched.' })
  })

  it('the office’s note on an ask, such as its email waiting, is not a line of its story and not a chase', () => {
    const base = rows()
    const noted = rows({ contacts: [...base.contacts, { id: 'n3', company_id: 'hillside', invite_id: 'i2', contacted_on: '2026-10-07', by_user_id: 'u1', by_name: 'Rosa', how: 'note', note: 'Asked to quote. The invitation email goes out once the portal can send it.', promised_by: null, created_at: '2026-10-07T15:00:00Z' }] })
    const story = (r: typeof base) => boardStateFromRows(r).projects[0]!.packages[0]!.invites[1]!
    expect(story(noted).contacts).toEqual(story(base).contacts)
    expect(story(noted).nudgedOn).toBe(story(base).nudgedOn)
  })

  it('a promise with the day it moved from', () => {
    expect(boardStateFromRows(rows()).tradePromises).toEqual([
      { id: 'tp1', partnerId: 'lonestar', kind: 'insurance', what: 'the renewed insurance certificate', by: '2026-10-12', madeOn: '2026-10-06', from: 'office', moved: [{ by: '2026-10-09', on: '2026-10-07' }] },
    ])
  })
})
