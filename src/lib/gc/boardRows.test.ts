import { describe, expect, it } from 'vitest'
import { carriedAmount, proposalTotals, packageCoverage } from './bids'
import { boardStateFromRows, customerContactsOf, stageOf } from './boardRows'
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

  it('a company’s papers come from its own rows (B6-b-ii): the master agreement as the msaFirst gate reads it, the W-9, the certificate', () => {
    expect(boardStateFromRows(rows()).partners.map((p) => [p.company, p.msa, p.w9, p.coiExpires])).toEqual([
      ['Lonestar Earthworks', 'none', false, null],
      ['Hillside Excavation', 'none', false, null],
    ])
    const papers = [
      { id: 'd1', company_id: 'lonestar', doc_type: 'agreement', status: 'signed', sent_at: '2026-10-01T15:00:00Z', signed_at: '2026-10-02', expires_at: null, created_at: '2026-10-01T15:00:00Z' },
      { id: 'd2', company_id: 'lonestar', doc_type: 'w9', status: 'signed', sent_at: '2026-10-01T15:00:00Z', signed_at: '2026-10-03', expires_at: null, created_at: '2026-10-01T15:00:00Z' },
      { id: 'd3', company_id: 'lonestar', doc_type: 'coi', status: 'signed', sent_at: null, signed_at: '2026-10-04', expires_at: '2027-04-30', created_at: '2026-10-04T15:00:00Z' },
      { id: 'd4', company_id: 'hillside', doc_type: 'agreement', status: 'sent', sent_at: '2026-10-07T16:00:00Z', signed_at: null, expires_at: null, created_at: '2026-10-07T16:00:00Z' },
    ]
    const s = boardStateFromRows(rows({ papers }))
    const [lonestar, hillside] = s.partners
    expect([lonestar!.msa, lonestar!.msaSignedOn, lonestar!.w9, lonestar!.coiExpires]).toEqual(['signed', '2026-10-02', true, '2027-04-30'])
    expect([hillside!.msa, hillside!.msaSentOn, hillside!.w9, hillside!.coiExpires]).toEqual(['sent', '2026-10-07', false, null])
  })

  it('every send of a paper reads oldest first as the kernels’ PaperSend, and a company counts the trades it won', () => {
    expect(boardStateFromRows(rows()).paperSends).toBeUndefined()
    const sends = [
      { id: 'ps2', company_id: 'hillside', paper: 'msa', project_id: null, package_id: null, sent_on: '2026-10-07', due_on: '2026-10-14', note: '', first: false, draws: null, created_at: '2026-10-07T16:00:00Z' },
      { id: 'ps1', company_id: 'hillside', paper: 'msa', project_id: null, package_id: null, sent_on: '2026-10-03', due_on: '2026-10-10', note: 'Call me with questions.', first: true, draws: null, created_at: '2026-10-03T16:00:00Z' },
    ]
    expect(boardStateFromRows(rows({ paperSends: sends })).paperSends).toEqual([
      { id: 'ps1', partnerId: 'hillside', paper: 'msa', on: '2026-10-03', by: '2026-10-10', note: 'Call me with questions.', first: true },
      { id: 'ps2', partnerId: 'hillside', paper: 'msa', on: '2026-10-07', by: '2026-10-14', note: '', first: false },
    ])
    expect(boardStateFromRows(rows()).partners.map((p) => p.won)).toEqual([0, 0])
    expect(boardStateFromRows(awardedClinicBoardRows()).partners.map((p) => [p.company, p.won])).toEqual([
      ['Lonestar Earthworks', 1],
      ['Hillside Excavation', 0],
    ])
  })

  it('Start anyway reads who by name, why and what was owed; a plain Start reads none (B6-c-ii)', () => {
    const base = rows()
    const anyway = boardStateFromRows(rows({ userNames: { u1: 'Rosa' }, boardDates: { p1: { ...base.boardDates.p1!, started_on: '2026-10-10', started_anyway_by: 'u1', started_anyway_reason: 'The owner needs the pad poured.', started_anyway_missing: ['Sitework: Send the master agreement.'] } } }))
    expect(anyway.projects[0]!.startedAnyway).toEqual({ by: 'Rosa', reason: 'The owner needs the pad poured.', missing: ['Sitework: Send the master agreement.'] })
    const plain = boardStateFromRows(rows({ boardDates: { p1: { ...base.boardDates.p1!, started_on: '2026-10-10' } } }))
    expect(plain.projects[0]!.startedAnyway).toBeUndefined()
  })

  it('our own crew is priced from its Trades mode bid once it is above 0 (call C), else our budget, not priced', () => {
    const own = (r: ReturnType<typeof rows>) => boardStateFromRows(r).projects[0]!.packages.find((k) => k.trade === 'Plumbing')!.selfPerform
    const base = rows()
    const bidId = base.projects[0]!.trades.find((t) => t.ours)!.ownBidId
    expect(own(base)).toMatchObject({ priced: false })
    expect(bidId).toBeTruthy()
    expect(own(rows({ ownBids: [{ id: bidId!, bid_value: '48250', bid_number: 'BP464' }] }))).toMatchObject({ ref: 'BP464', value: 48250, priced: true })
    expect(own(rows({ ownBids: [{ id: bidId!, bid_value: 0, bid_number: 'BP464' }] }))).toMatchObject({ priced: false })
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

describe('a customer’s call log (the Board’s B2b-v-ii)', () => {
  it('reads each customer’s own lines, newest first, as GcCustomer.contacts', () => {
    const withLog = {
      ...rows(),
      customerContacts: [
        { customer_id: 'c1', contacted_on: '2026-10-06', by_name: 'Rosa', note: 'Older.', created_at: '2026-10-06T15:00:00Z' },
        { customer_id: 'c1', contacted_on: '2026-10-08', by_name: 'Abe', note: 'Newest.', created_at: '2026-10-08T09:00:00Z' },
        { customer_id: 'c1', contacted_on: '2026-10-08', by_name: 'Rosa', note: 'Same day, earlier.', created_at: '2026-10-08T08:00:00Z' },
        { customer_id: 'zz', contacted_on: '2026-10-09', by_name: 'Rosa', note: 'Another customer.', created_at: '2026-10-09T08:00:00Z' },
      ],
    }
    expect(boardStateFromRows(withLog).customers.find((c) => c.id === 'c1')?.contacts).toEqual([
      { on: '2026-10-08', by: 'Abe', note: 'Newest.' },
      { on: '2026-10-08', by: 'Rosa', note: 'Same day, earlier.' },
      { on: '2026-10-06', by: 'Rosa', note: 'Older.' },
    ])
    expect(customerContactsOf([], 'c1')).toEqual([])
  })
})
