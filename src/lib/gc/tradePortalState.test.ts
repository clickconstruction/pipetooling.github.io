/**
 * The trade portal's slice as the prototype's shapes (P1b-i): rows as `gc-trade-portal` reads them, through the slice
 * builder and the mapper, then through the portal's kernels, the way the portal page will.
 */
import { describe, expect, it } from 'vitest'
import { AWARDED_ELSEWHERE, tradePortalSlice, type TradePortalRows } from '../../../supabase/functions/_shared/gcTradePortalSlice'
import { quotesWantedOn } from './planQuestions'
import { inviteMessage, mailRecipients, portalAsks, portalBackCharges, portalCanAskChange, portalChangeRequests, portalPlanNews, portalPromiseLine, portalPromises, portalQuestions, portalVetting } from './portal'
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

  it('reads a company new to us as being checked once it sent its form, from the day alone (P5b-1)', () => {
    const newRows = { ...rows(), company: { ...rows().company, vetting_status: 'new', vetting_limit: null, vetting_decided_on: null } }
    const notSent = tradePortalState(tradePortalSlice(newRows, ME), TODAY).state.partners[0]!
    expect([notSent.vetting, portalVetting(notSent, 'en').state]).toEqual([{ status: 'new' }, 'send'])
    const sent = tradePortalState(tradePortalSlice({ ...newRows, vettingForm: { company_id: ME, sent_on: '2026-10-07' } }, ME), TODAY).state.partners[0]!
    expect(sent.vetting?.form?.sentOn).toBe('2026-10-07')
    expect(portalVetting(sent, 'en')).toEqual({ state: 'checking', words: expect.stringContaining('Oct 7') })
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

  it('reads its statement of work’s lines in order, each by its scope item or its own id, and what it will not do (P2c-ii)', () => {
    const r = workRows()
    const withLines: TradePortalRows = {
      ...r,
      sows: (r.sows ?? []).map((s) => ({ ...s, status: 'sent', signed_on: null, excluded: [{ name: 'Permits and fees', by: 'the owner' }, { name: 'Trenching', by: null, unitPrice: { amount: 18, unit: 'ft' } }, { name: '' }] })),
      sowLines: [
        { id: 'sl-co', sow_id: 'sow-1', position: 2, label: 'Rot repair', amount: 14820, scope_item_id: null },
        { id: 'sl-1', sow_id: 'sow-1', position: 0, label: 'Panels and feeders', amount: 40000, scope_item_id: 'si-1' },
        { id: 'sl-2', sow_id: 'sow-1', position: 1, label: 'Lighting', amount: 24200, scope_item_id: 'si-2' },
      ],
    }
    const sow = tradePortalState(tradePortalSlice(withLines, ME), TODAY).state.projects[0]?.packages[0]?.sow
    expect([sow?.id, sow?.status, sow?.signedOn]).toEqual(['sow-1', 'sent', null])
    expect(sow?.sov).toEqual([
      { id: 'si-1', label: 'Panels and feeders', amount: 40000, pctReported: 0, pctBilled: 0 },
      { id: 'si-2', label: 'Lighting', amount: 24200, pctReported: 0, pctBilled: 0 },
      { id: 'sl-co', label: 'Rot repair', amount: 14820, pctReported: 0, pctBilled: 0 },
    ])
    expect(sow?.excluded).toEqual([
      { name: 'Permits and fees', by: 'the owner' },
      { name: 'Trenching', by: null, unitPrice: { amount: 18, unit: 'ft' } },
    ])
    // None excluded and no lines: no list, and an empty schedule of values.
    expect([pkg.sow?.excluded, pkg.sow?.sov]).toEqual([undefined, []])
  })

  it('reads a slice from a function deployed before P4b-i as no work at all', () => {
    const { sows: _s, backCharges: _b, changeRequests: _r, changeOrders: _o, ...older } = tradePortalSlice(rows(), ME)
    const { state: olderState } = tradePortalState(older, TODAY)
    expect([olderState.projects[0]?.packages[0]?.sow, olderState.projects[0]?.changeRequests, olderState.projects[0]?.changeOrders]).toEqual([null, [], []])
  })
})

describe('the job’s work, through Building’s own row mappers (P5c-1)', () => {
  /** The same awarded, signed Electrical on a job being built, with each kind of the job's row on it. */
  function jobRows(): TradePortalRows {
    const r = workRows()
    return {
      ...r,
      projects: r.projects.map((p) => ({ ...p, gc: { ...p.gc, stage: 'building', closed_on: null } })),
      sows: (r.sows ?? []).map((s) => ({ ...s, accepted_on: '2026-10-07' })),
      sowLines: [
        { id: 'sl-1', sow_id: 'sow-1', position: 0, label: 'Panels and feeders', amount: 40000, scope_item_id: 'si-1' },
        { id: 'sl-2', sow_id: 'sow-1', position: 1, label: 'Lighting', amount: 24200, scope_item_id: 'si-2' },
        { id: 'sl-co', sow_id: 'sow-1', position: 2, label: 'Change order 5: Two outlets.', amount: 900, scope_item_id: null },
      ],
      draws: [
        { id: 'dr-1', sow_id: 'sow-1', number: 1, seq: 1, requested_on: '2026-09-25', status: 'paid', gross: 20000, retainage: 2000, net: 18000, final: false, waiver: 'conditional', waiver_on: null, approved_on: '2026-09-27', paid_on: '2026-10-02', asked: null, sent_back_on: null, sent_back_note: null, period_to: '2026-09-25', address: '1 Main St', license: 'TECL 1', signed_by: 'Dana', signed_title: 'Owner', signed_on: '2026-09-25' },
      ],
      drawLines: [{ draw_id: 'dr-1', sow_line_id: 'sl-1', to_pct: 50, stored: 0, we_see: null }],
      lineReports: [{ sow_line_id: 'sl-1', pct: 70, reported_on: '2026-10-08', seq: 4 }],
      changeOrders: [...(r.changeOrders ?? []), { id: 'co-5', number: 5, status: 'signed', sent_on: '2026-10-05', answered_on: '2026-10-06', cost: 900, package_id: 'pkg-elec', reason: 'owner', description: 'Two outlets.' }],
      changeSends: [{ change_order_id: 'co-5', sow_id: 'sow-1', sent_on: '2026-10-05', signed_on: '2026-10-06', sow_line_id: 'sl-co' }],
      submittals: [{ id: 'sub-1', project_id: 'proj-1', package_id: 'pkg-elec', number: '26 24 16-01', title: 'Panelboards', kind: 'product data', spec_section: null, lead_days: 14, needed_by: '2026-10-20', asked_on: '2026-10-01', created_at: '2026-10-01T15:00:00Z' }],
      submittalHolds: [{ submittal_id: 'sub-1', scope_item_id: 'si-1' }],
      submittalRounds: [{ id: 'sr-1', submittal_id: 'sub-1', round: 1, sent_on: '2026-10-03', sent_by: 'trade', file_name: 'panels.pdf', drive_url: null, note: '', to_architect_on: '2026-10-04', answered_on: '2026-10-07', answer: 'revise', answer_note: 'Use the 42-circuit panel.' }],
      rfis: [{ id: 'rfi-1', project_id: 'proj-1', package_id: 'pkg-elec', number: 3, question: 'Recessed panel?', sheets: ['E-201'], asked_on: '2026-10-05', needed_days: 3, sent_to_architect_on: '2026-10-05', answered_on: '2026-10-06', answer_text: 'Recessed.', answered_by: 'architect', impact: 'cost', days: 1, asked_by_company_id: ME }],
      rfiHolds: [{ rfi_id: 'rfi-1', scope_item_id: 'si-1' }],
      punch: [
        { id: 'pu-2', project_id: 'proj-1', package_id: 'pkg-elec', position: 1, text: 'Label the panel.', where_on: null, added_on: '2026-10-08', fixed_on: '2026-10-09', checked_on: null, sent_back_times: 0, sent_back_note: null, sent_back_on: null },
        { id: 'pu-1', project_id: 'proj-1', package_id: 'pkg-elec', position: 0, text: 'Cover plate missing.', where_on: 'Exam 2', added_on: '2026-10-08', fixed_on: null, checked_on: null, sent_back_times: 1, sent_back_note: 'Still loose.', sent_back_on: '2026-10-09' },
      ],
    }
  }
  const { state } = tradePortalState(tradePortalSlice(jobRows(), ME), TODAY)
  const project = state.projects[0]!
  const sow = project.packages[0]!.sow!

  it('reads each line’s newest report and what its approved and paid draws billed, the draw, and the day we accepted the work', () => {
    expect(sow.sov.map((l) => [l.id, l.pctReported, l.pctBilled])).toEqual([
      ['si-1', 70, 50],
      ['si-2', 0, 0],
      ['sl-co', 0, 0],
    ])
    expect(sow.draws.map((d) => [d.id, d.number, d.status, d.net, d.waiver])).toEqual([['dr-1', 1, 'paid', 18000, 'conditional']])
    expect(sow.acceptedOn).toBe('2026-10-07')
  })

  it('reads a change order sent to it with its words, signed, and the line it became', () => {
    const co = project.changeOrders?.find((c) => c.id === 'co-5')
    expect([co?.description, co?.price, co?.cost, co?.packageId, co?.tradeChange]).toEqual(['Two outlets.', 0, 900, 'pkg-elec', { status: 'signed', sentOn: '2026-10-05', signedOn: '2026-10-06', sovLineId: 'sl-co' }])
  })

  it('reads its submittals, its RFIs as its own with no cost, and its punch list in order', () => {
    expect(project.submittals?.map((x) => [x.id, x.lineIds, x.rounds.map((r) => r.answer)])).toEqual([['sub-1', ['si-1'], ['revise']]])
    expect(project.rfis?.map((r) => [r.id, r.partnerId, r.answer?.cost, r.holds])).toEqual([['rfi-1', ME, 0, ['si-1']]])
    expect(project.punch?.map((p) => [p.id, p.fixedOn, p.sentBack?.note ?? null])).toEqual([
      ['pu-1', null, 'Still loose.'],
      ['pu-2', '2026-10-09', null],
    ])
  })

  it('reads a slice from a function deployed before P5c-1 as no job work', () => {
    const { state: older } = tradePortalState(tradePortalSlice(workRows(), ME), TODAY)
    const p = older.projects[0]!
    expect([p.submittals, p.rfis, p.punch, p.packages[0]?.sow?.draws]).toEqual([[], [], [], []])
  })
})
