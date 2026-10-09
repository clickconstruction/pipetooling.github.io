/**
 * The trade portal's slice as the prototype's shapes (P1b-i): rows as `gc-trade-portal` reads them, through the slice
 * builder and the mapper, then through the portal's kernels, the way the portal page will.
 */
import { describe, expect, it } from 'vitest'
import { AWARDED_ELSEWHERE, tradePortalSlice, type TradePortalRows } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import { quotesWantedOn } from './planQuestions'
import { inviteMessage, mailRecipients, portalAsks, portalBackCharges, portalCanAskChange, portalChangeRequests, portalPlanNews, portalPromiseLine, portalPromises, portalQuestions } from './portal'
import { portalHomeGroups } from './tradePortalPage'
import { stageOf, tradePortalState } from './tradePortalState'

const ME = 'co-me'
const TODAY = '2026-10-08'

function rows(): TradePortalRows {
  return {
    company: { id: ME, name: 'Test Electric', contact_name: 'Dana Whitfield', email: 'dana@example.com', phone: '210-555-0100', trades: ['Electrical'], contact_gets: ['quotes', 'job', 'contracts'], address: '1 Main St, Boerne', license: 'TECL 1', lang: 'es', portal_opened_on: '2026-10-07', vetting_status: 'approved', vetting_limit: 50000, vetting_decided_on: '2026-10-01' },
    people: [{ id: 'pp1', company_id: ME, name: 'Marcus Lee', email: 'marcus@example.com', role: 'Bookkeeper', gets: ['pay'], added_by: 'trade', removed_at: null }],
    invites: [{ id: 'inv-1', package_id: 'pkg-elec', company_id: ME, status: 'bid', invited_on: '2026-10-01', seen_rev: 0 }],
    quotes: [
      { id: 'q-old', invite_id: 'inv-1', amount: 60000, based_on_rev: 0, submitted_on: '2026-10-02', includes: { 'si-1': 'yes' }, note: 'first', source: 'trade', created_at: '2026-10-02T10:00:00Z', alternates: [] },
      { id: 'q-new', invite_id: 'inv-1', amount: 64200, based_on_rev: 0, submitted_on: '2026-10-03', includes: { 'si-1': 'yes', 'si-2': 'unclear' }, note: 'second', source: 'trade', created_at: '2026-10-03T10:00:00Z', good_for_days: 30, alternates: [] },
    ],
    contacts: [
      { id: 'c1', company_id: ME, invite_id: 'inv-1', contacted_on: '2026-10-02', how: 'call', note: 'office words', promised_by: '2026-10-05' },
      { id: 'c2', company_id: ME, invite_id: 'inv-1', contacted_on: '2026-10-04', how: 'portal', note: 'Monday', promised_by: '2026-10-06' },
    ],
    promises: [{ id: 'pr1', company_id: ME, kind: 'insurance', project_id: null, package_id: null, what: 'the renewed insurance certificate', due_on: '2026-10-10', made_on: '2026-10-01', source: 'trade', kept_on: null }],
    projects: [
      {
        project: { id: 'proj-1', name: 'Fair Oaks Shops', address: '9 Oak Rd, Fair Oaks Ranch' },
        gc: { project_id: 'proj-1', stage: 'bidding', bid_due: '2026-10-16', size_note: '9,600 sq ft retail shell', lost_on: null, lost_why: null },
        team: [{ role: 'projectManager', name: 'Avery Lin', phone: '210-555-0199', email: 'avery@example.com' }],
      },
    ],
    packages: [{ id: 'pkg-elec', project_id: 'proj-1', trade: 'Electrical', position: 3 }],
    scopeItems: [
      { id: 'si-2', package_id: 'pkg-elec', position: 1, label: 'Lighting' },
      { id: 'si-1', package_id: 'pkg-elec', position: 0, label: 'Panels and feeders' },
    ],
    exclusions: [{ id: 'ex-1', package_id: 'pkg-elec', position: 0, label: 'Permits and fees', by: 'the owner' }],
    sets: [
      { id: 'set-1', project_id: 'proj-1', rev: 1, label: 'Addendum 1', kind: 'addendum', issued_on: '2026-10-06', note: 'Panel moved', drive_url: '' },
      { id: 'set-0', project_id: 'proj-1', rev: 0, label: 'Bid set', kind: 'bid', issued_on: '2026-09-28', note: '', drive_url: 'https://drive.google.com/x' },
    ],
    setItems: [],
    questions: [
      { id: 'qu-mine', project_id: 'proj-1', package_id: 'pkg-elec', company_id: ME, text: 'Which panel schedule?', sheets: ['E-101'], asked_on: '2026-10-03', answered_on: null, answer: '', answer_sent_to: [] },
      { id: 'qu-other', project_id: 'proj-1', package_id: 'pkg-elec', company_id: 'co-them', text: 'Copper feeders?', sheets: [], asked_on: '2026-10-02', answered_on: '2026-10-04', answer: 'Copper.', answer_sent_to: [ME] },
    ],
    messages: [],
    setSends: [{ set_id: 'set-1', company_id: ME, touched: true }],
  }
}

const mapped = tradePortalState(tradePortalSlice(rows(), ME), TODAY)
const { state, partnerId } = mapped
const project = state.projects[0]!
const pkg = project.packages[0]!

describe('the company', () => {
  it('reads as one partner in its language, with the people on its emails', () => {
    expect([partnerId, mapped.lang, state.partners.length]).toEqual([ME, 'es', 1])
    const partner = state.partners[0]!
    expect([partner.company, partner.contact, partner.portalOpenedOn, partner.vetting]).toEqual(['Test Electric', 'Dana Whitfield', '2026-10-07', { status: 'approved', limit: 50000, decidedOn: '2026-10-01' }])
    expect(mailRecipients(partner, 'pay').map((r) => r.name)).toEqual(['Marcus Lee'])
    expect(mailRecipients(partner, 'quotes').map((r) => r.name)).toEqual(['Dana Whitfield'])
  })
})

describe('a project and its trade', () => {
  it('reads the row’s stage in the prototype’s words, and never a dollar of ours', () => {
    expect([stageOf('bidding'), stageOf('buyout'), stageOf('building'), stageOf('closed')]).toEqual(['pursuing', 'buyout', 'building', 'building'])
    expect([project.stage, project.generalConditions, project.feePct, pkg.budget]).toEqual(['pursuing', 0, 0, 0])
    expect(project.team).toEqual([{ role: 'projectManager', name: 'Avery Lin', phone: '210-555-0199', email: 'avery@example.com' }])
  })

  it('keeps the scope lines and known exclusions in their order', () => {
    expect(pkg.scope.map((s) => s.label)).toEqual(['Panels and feeders', 'Lighting'])
    expect(pkg.excludes).toEqual([{ label: 'Permits and fees', by: 'the owner' }])
  })

  it('counts the newest quote, and its lines newest first with the day the company gave', () => {
    const invite = pkg.invites[0]!
    expect([invite.bid?.amount, invite.bid?.note, invite.seenRev]).toEqual([64200, 'second', 0])
    expect(invite.contacts?.map((c) => [c.how, c.promisedBy, c.note])).toEqual([
      ['portal', '2026-10-06', 'Monday'],
      ['call', '2026-10-05', ''],
    ])
  })

  it('marks the set that changed its trade, from the send that told it so', () => {
    expect(project.planSets.map((s) => [s.rev, s.label, s.touches])).toEqual([
      [0, 'Bid set', []],
      [1, 'Addendum 1', ['pkg-elec']],
    ])
    const news = portalPlanNews(project, pkg, pkg.invites[0]!)
    expect([news.latest?.label, news.behind, news.forTrade.map((s) => s.rev)]).toEqual(['Addendum 1', true, [1]])
  })
})

describe('through the portal’s kernels', () => {
  it('sorts the ask as bidding, with its unread line and the day it gave', () => {
    const asks = portalAsks(state, partnerId)
    expect(asks.map((a) => [a.kind, a.unclear.map((u) => u.id), a.promise])).toEqual([['bidding', ['si-2'], null]])
    expect(portalPromiseLine(pkg.invites[0]!, TODAY, 'Click')).toBeNull()
  })

  it('shows its own question, and the answer sent to it without who asked', () => {
    expect(portalQuestions(project, 'pkg-elec', partnerId).map((r) => [r.q.id, r.mine, r.state, r.answerOn])).toEqual([
      ['qu-mine', true, 'asked', null],
      ['qu-other', false, 'answered', '2026-10-04'],
    ])
  })

  it('wants quotes three days before our bid is due, and words the invitation from the rows', () => {
    expect(quotesWantedOn(project)).toBe('2026-10-13')
    const m = inviteMessage(project, pkg, pkg.invites[0]!, state.partners[0]!, 'en')
    expect(m.lines.slice(1, 4)).toEqual(['We would like your quote for Electrical on Fair Oaks Shops.', '9 Oak Rd, Fair Oaks Ranch. 9,600 sq ft retail shell.', 'Your quote is due Tue Oct 13.'])
  })

  it('lists the company’s open promise', () => {
    expect(portalPromises(state, partnerId).map((r) => [r.p.kind, r.p.by, r.p.from])).toEqual([['insurance', '2026-10-10', 'trade']])
  })
})

/**
 * Its work (P4b-i): the same rows, with the trade awarded to this company and signed, a charge it disputed and the
 * office kept, and a change it asked for that the customer has.
 */
function workRows(): TradePortalRows {
  const r = rows()
  return {
    ...r,
    projects: r.projects.map((p) => ({ ...p, gc: { ...p.gc, stage: 'building' } })),
    packages: r.packages.map((p) => ({ ...p, awarded_invite_id: 'inv-1' })),
    sows: [{ id: 'sow-1', package_id: 'pkg-elec', invite_id: 'inv-1', company_id: ME, status: 'signed', price: 64200, retainage_pct: 10, based_on_rev: 0, sent_on: '2026-10-05', signed_on: '2026-10-06' }],
    backCharges: [
      { id: 'bc-1', project_id: 'proj-1', package_id: 'pkg-elec', company_id: ME, sow_id: 'sow-1', amount: 1250, reason: 'Cleanup.', photo_url: 'https://drive.google.com/file/d/bc', sent_on: '2026-10-01', answer_by: '2026-10-06', status: 'kept', answered_on: '2026-10-02', answer_note: 'We swept.', settled_on: '2026-10-07', settled_note: 'Our photos show it.', taken_draw_id: null, taken_on: null },
    ],
    changeRequests: [
      { id: 'cr-1', project_id: 'proj-1', package_id: 'pkg-elec', company_id: ME, sow_id: 'sow-1', asked_on: '2026-10-03', description: 'Hidden rot.', reason: 'field', amount: 14820, days: 2, file_url: null, change_order_id: 'co-1', turned_down_on: null, turned_down_note: null },
    ],
    changeOrders: [{ id: 'co-1', project_id: 'proj-1', number: 3, status: 'sent', sent_on: '2026-10-05', answered_on: null, cost: 14820, price: 16302, description: 'Rot repair, unit 3' }],
  }
}

describe('its work, on the prototype’s shapes (P4b-i)', () => {
  const { state, partnerId } = tradePortalState(tradePortalSlice(workRows(), ME), TODAY)
  const project = state.projects[0]!
  const pkg = project.packages[0]!

  it('reads its own award and signed statement of work, so the job is its', () => {
    expect([pkg.awardedInviteId, pkg.sow?.status, pkg.sow?.price, pkg.sow?.retainagePct, pkg.sow?.signedOn]).toEqual(['inv-1', 'signed', 64200, 10, '2026-10-06'])
    expect(portalAsks(state, partnerId).map((a) => a.kind)).toEqual(['job'])
    expect(portalCanAskChange(project, pkg, partnerId)).toBe(true)
  })

  it('reads a charge with its answer and the office’s keep', () => {
    expect(pkg.sow?.backCharges).toEqual([
      { id: 'bc-1', amount: 1250, reason: 'Cleanup.', photo: 'https://drive.google.com/file/d/bc', sentOn: '2026-10-01', answerBy: '2026-10-06', status: 'kept', answer: { on: '2026-10-02', note: 'We swept.' }, settled: { on: '2026-10-07', note: 'Our photos show it.' } },
    ])
    expect(portalBackCharges(project, pkg, partnerId, TODAY).map((r) => [r.state, r.canAnswer])).toEqual([['kept', false]])
  })

  it('reads a change it asked for and only its part of the change order, never the customer’s price or our words', () => {
    expect(project.changeOrders).toEqual([
      { id: 'co-1', number: 3, description: '', reason: 'field', schedule: '', packageId: 'pkg-elec', cost: 14820, price: 0, status: 'sent', sentOn: '2026-10-05', answeredOn: null, pctDone: 0 },
    ])
    const [row] = portalChangeRequests(project, pkg, partnerId)
    expect(row?.state).toBe('withCustomer')
    expect(row?.words).toContain('$14,820')
  })

  it('reads a trade awarded elsewhere as lost, under the home’s past asks', () => {
    const lost = workRows()
    const { state: lostState } = tradePortalState(tradePortalSlice({ ...lost, packages: lost.packages.map((p) => ({ ...p, awarded_invite_id: 'inv-other' })), sows: [], backCharges: [], changeRequests: [], changeOrders: [] }, ME), TODAY)
    expect(lostState.projects[0]?.packages[0]?.awardedInviteId).toBe(AWARDED_ELSEWHERE)
    const asks = portalAsks(lostState, ME)
    expect(asks.map((a) => a.kind)).toEqual(['lost'])
    expect(portalHomeGroups(asks).past).toHaveLength(1)
  })

  it('reads a slice from a function deployed before P4b-i as no work at all', () => {
    const { sows: _s, backCharges: _b, changeRequests: _r, changeOrders: _o, ...older } = tradePortalSlice(rows(), ME)
    const { state: olderState } = tradePortalState(older, TODAY)
    expect([olderState.projects[0]?.packages[0]?.sow, olderState.projects[0]?.changeRequests, olderState.projects[0]?.changeOrders]).toEqual([null, [], []])
  })
})
