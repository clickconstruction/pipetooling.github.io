import { describe, expect, it } from 'vitest'
import { carriedAmount, proposalTotals, packageCoverage } from './bids'
import { boardStateFromRows, stageOf } from './boardRows'
import { awardedClinicBoardRows, clinicBoardRows as rows } from './boardTestRows'
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

  it('a customer carries the phone and email on its customer record, for the call list’s Call (the schedule’s 7c-ii)', () => {
    const base = rows()
    const s = boardStateFromRows(rows({ customers: base.customers.map((c) => (c.id === 'c1' ? { ...c, contact_info: { phone: '(210) 555-0190', email: 'ops@oakstreet.test' } } : c)) }))
    expect(s.customers.map((c) => [c.name, c.phone, c.email])).toEqual([
      ['Oak Street Partners', '(210) 555-0190', 'ops@oakstreet.test'],
      ['Studio Ocotillo', '', ''],
    ])
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

  it('our number’s inputs come from the money rows, and read 0 for someone outside the money team', () => {
    const p = boardStateFromRows(rows()).projects[0]!
    expect([p.generalConditions, p.contingencyPct, p.feePct]).toEqual([12000, 3, 8])
    const outside = boardStateFromRows(rows({ money: [], moneyShown: false })).projects[0]!
    expect([outside.generalConditions, outside.contingencyPct, outside.feePct]).toEqual([0, 0, 0])
    // Their price is the trades alone: nothing of ours is added.
    expect(proposalTotals(outside).price).toBe(proposalTotals(outside).trades)
    const { money: _none, ...unread } = rows()
    expect(boardStateFromRows(unread).projects[0]!.generalConditions).toBe(0)
  })

  it('a trade carries its shared bid tab and the companies that opened it', () => {
    const s = boardStateFromRows(rows({ bidTabs: [{ package_id: 'k1', shared_on: '2026-10-08', show_names: true }], bidTabViews: [{ package_id: 'k1', company_id: 'hillside', seen_on: '2026-10-08' }] }))
    const [site, concrete] = s.projects[0]!.packages
    expect(site!.bidTab).toEqual({ sharedOn: '2026-10-08', showNames: true, seenBy: ['hillside'] })
    expect(concrete!.bidTab).toBeNull()
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

  it('a company carries the people it named and the emails its main contact gets', () => {
    const base = rows()
    const named = rows({
      companies: base.companies.map((c) => (c.id === 'lonestar' ? { ...c, contact_gets: ['quotes', 'job', 'kudos'] } : c)),
      people: [
        { id: 'pp1', company_id: 'lonestar', name: 'Ana Ruiz', email: 'ana@lonestar.test', role: 'Bookkeeper', gets: ['pay', 'contracts'] },
        { id: 'pp2', company_id: 'hillside', name: 'Bo Park', email: '', role: '', gets: [] },
      ],
    })
    const [lonestar, hillside] = boardStateFromRows(named).partners
    expect(lonestar!.contactGets).toEqual(['quotes', 'job'])
    expect(lonestar!.people).toEqual([{ id: 'pp1', name: 'Ana Ruiz', email: 'ana@lonestar.test', role: 'Bookkeeper', gets: ['contracts', 'pay'] }])
    expect(hillside!.people?.map((p) => p.name)).toEqual(['Bo Park'])
    expect(hillside!.contactGets).toBeUndefined()
    expect(boardStateFromRows(base).partners[0]!.people).toBeUndefined()
  })

  it('a trade carries the quote on its ask, or our budget, and a quote reads back the exclusions it answered', () => {
    const base = rows()
    const carried = rows({
      projects: base.projects.map((p) => ({ ...p, trades: p.trades.map((t) => (t.id === 'k1' ? { ...t, carriedInviteId: 'i1' } : t.id === 'k2' ? { ...t, carryBudget: true } : t)) })),
      quotes: base.quotes.map((q) => (q.id === 'q1' ? { ...q, exclusions_answered: ['Dewatering'] } : q)),
    })
    const [sitework, concrete, plumbing] = boardStateFromRows(carried).projects[0]!.packages
    expect([sitework!.carried, concrete!.carried, plumbing!.carried]).toEqual(['i1', 'plug', 'self'])
    expect(sitework!.invites[0]!.bid?.exclusionsAnswered).toEqual(['Dewatering'])
    expect(boardStateFromRows(base).projects[0]!.packages[0]!.carried).toBeNull()
  })

  it('an award carries its ask, who decided and the day, and the statement of work reads back as gc_award drafts it', () => {
    // The bed's Lonestar award (supabase/tests/gc_award): 66,500 all in, split 33,200 and 33,300.
    const awarded = awardedClinicBoardRows()
    const sitework = boardStateFromRows(awarded).projects[0]!.packages[0]!
    // The award carries its ask, over what was carried while we bid (the prototype's award does the same).
    expect([sitework.carried, sitework.awardedInviteId, sitework.awardedBy, sitework.awardedOn]).toEqual(['i1', 'i1', 'Rosa', '2026-10-08'])
    expect(sitework.sow).toEqual({
      status: 'sent',
      price: 66500,
      retainagePct: 10,
      basedOnRev: 0,
      sov: [
        { id: 's1', label: 'Clearing and grading', amount: 33200, pctReported: 0, pctBilled: 0 },
        { id: 's2', label: 'Paving', amount: 33300, pctReported: 0, pctBilled: 0 },
      ],
      signedOn: null,
      draws: [],
      sentOn: '2026-10-09',
      theirSov: [
        { label: 'Mobilize', amount: 5000 },
        { label: 'Grading', amount: 47000 },
      ],
      excluded: [
        { name: 'Dewatering', by: null },
        { name: 'Rock', by: null, unitPrice: { amount: 38, unit: 'cy' } },
      ],
    })
    // What the trade carries is now the statement of work's price.
    expect(carriedAmount(sitework)).toBe(66500)
  })

  it('a cancelled statement of work reads as none, and a trade not awarded has none', () => {
    const sow = { id: 'w1', package_id: 'k1', status: 'cancelled', price: 1, retainage_pct: 10, based_on_rev: 0, their_sov: null, excluded: null, sent_on: null, signed_on: null, accepted_on: null }
    const [sitework, concrete] = boardStateFromRows(rows({ sows: [sow] })).projects[0]!.packages
    expect([sitework!.sow, sitework!.awardedInviteId, concrete!.sow]).toEqual([null, null, null])
    // A change order's line keeps its own id, since it has no scope item.
    const signed = boardStateFromRows(
      rows({
        sows: [{ ...sow, status: 'signed', signed_on: '2026-10-12' }],
        sowLines: [{ id: 'l9', sow_id: 'w1', position: 0, label: 'Change order 1', amount: 1, scope_item_id: null, change_order_id: 'co1' }],
      }),
    ).projects[0]!.packages[0]!.sow
    expect([signed?.status, signed?.signedOn, signed?.sov[0]]).toEqual(['signed', '2026-10-12', { id: 'l9', label: 'Change order 1', amount: 1, pctReported: 0, pctBilled: 0, changeOrderId: 'co1' }])
  })

  it('a promise with the day it moved from', () => {
    expect(boardStateFromRows(rows()).tradePromises).toEqual([
      { id: 'tp1', partnerId: 'lonestar', kind: 'insurance', what: 'the renewed insurance certificate', by: '2026-10-12', madeOn: '2026-10-06', from: 'office', moved: [{ by: '2026-10-09', on: '2026-10-07' }] },
    ])
  })
})
