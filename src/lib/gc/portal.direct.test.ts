/**
 * Main's own tests for what the Portal lane's P0 moved to `portal.ts` that the spike's moved tests do not
 * reach: who at a company gets which email, back-charges, a trade's change requests, insurance, a lost
 * bid's words and the first visit. The spike's tests of these play the prototype's reducer and stay there.
 */
import { describe, expect, it } from 'vitest'
import {
  aYearFrom,
  backChargeCanTake,
  backChargeDraws,
  backChargesToAct,
  backChargeState,
  changeRequestState,
  contactGets,
  everyMailGroupCovered,
  lookAheadOwed,
  mailRecipients,
  openChangeRequests,
  PORTAL_CHANGE_WHY,
  PORTAL_MAIL_GROUPS,
  portalBackCharges,
  portalCanAskChange,
  portalClosedWords,
  portalFirstVisit,
  portalInsurance,
  portalMailGroup,
  portalSowExcluded,
  unclearLines,
  type PortalMessage,
} from './portal'
import { initialGcState } from './schedule/testState'
import type { BackCharge, ChangeOrder, Draw, GcProject, GcState, Partner, Sow, TradeChangeRequest, TradePackage } from './types'

const partner: Partner = {
  id: 'p1',
  company: 'Test Electric',
  contact: 'Dana Whitfield',
  trades: ['Electrical'],
  msa: 'none',
  msaSignedOn: null,
  coiExpires: '2026-12-31',
  w9: true,
  invited: 1,
  bids: 0,
  promisesMade: 0,
  promisesKept: 0,
  base: null,
  maxMiles: null,
  email: 'dana@example.com',
}
const bookkeeper = { id: 'x1', name: 'Marcus Lee', email: 'marcus@example.com', role: 'Bookkeeper', gets: ['pay' as const] }

const draws: Draw[] = [
  { id: 'd1', number: 1, requestedOn: '2026-09-01', gross: 1100, retainage: 100, net: 1000, status: 'approved', waiver: 'conditional', lines: [] },
  { id: 'd2', number: 2, requestedOn: '2026-09-15', gross: 5500, retainage: 500, net: 5000, status: 'approved', waiver: 'conditional', lines: [] },
  { id: 'd3', number: 3, requestedOn: '2026-08-25', gross: 9900, retainage: 900, net: 9000, status: 'paid', waiver: 'unconditional', lines: [] },
]
const charge: BackCharge = { id: 'bc1', amount: 1250, reason: 'Cleanup after the rough-in', photo: null, sentOn: '2026-09-28', answerBy: '2026-10-03', status: 'open' }

function sowWith(over: Partial<Sow> = {}): Sow {
  return { price: 50000, retainagePct: 10, basedOnRev: 0, signedOn: '2026-09-25', sov: [], draws, status: 'signed', ...over }
}
function pkgWith(sow: Sow | null): TradePackage {
  return {
    id: 'elec',
    trade: 'Electrical',
    scope: [
      { id: 'e-1', label: 'Panels and feeders' },
      { id: 'e-2', label: 'Lighting' },
    ],
    budget: 0,
    bidTab: null,
    selfPerform: null,
    invites: [{ id: 'i1', partnerId: 'p1', status: 'opened', invitedOn: '2026-09-28', seenRev: 0, bid: null }],
    carried: 'i1',
    awardedInviteId: 'i1',
    sow,
  }
}
function projectWith(over: Partial<GcProject>): GcProject {
  const base = initialGcState().projects[0]
  if (!base) throw new Error('no project in the test data')
  return { ...base, ...over }
}

describe('who at a company gets which email', () => {
  it('sends every kind to the main contact until the company changes it', () => {
    expect(contactGets(partner)).toEqual(PORTAL_MAIL_GROUPS)
    expect(mailRecipients(partner, 'pay')).toEqual([{ name: 'Dana Whitfield', email: 'dana@example.com', main: true }])
  })

  it('sends pay to the bookkeeper the company named, and the rest to the main contact', () => {
    const named = { ...partner, people: [bookkeeper], contactGets: ['quotes' as const, 'job' as const, 'contracts' as const] }
    expect(mailRecipients(named, 'pay')).toEqual([{ name: 'Marcus Lee', email: 'marcus@example.com', main: false }])
    expect(mailRecipients(named, 'quotes').map((r) => r.name)).toEqual(['Dana Whitfield'])
  })

  it('never sends a kind to no one', () => {
    expect(mailRecipients({ ...partner, contactGets: [] }, 'job')).toEqual([{ name: 'Dana Whitfield', email: 'dana@example.com', main: true }])
    expect(everyMailGroupCovered(['quotes', 'job'], [{ ...bookkeeper, gets: ['contracts'] }])).toBe(false)
    expect(everyMailGroupCovered(['quotes', 'job'], [{ ...bookkeeper, gets: ['contracts', 'pay'] }])).toBe(true)
  })

  it('reads the kind of an email: plans while we bid, the job once it is ours, a paper by its paper', () => {
    const s = initialGcState()
    const project = s.projects[0]!
    const state: GcState = {
      ...s,
      projects: [{ ...project, stage: 'pursuing' }],
      paperSends: [
        { id: 's1', partnerId: 'p1', paper: 'msa', on: '2026-10-01', by: '2026-10-08', note: '', first: true },
        { id: 's2', partnerId: 'p1', paper: 'waiver', on: '2026-10-01', by: '2026-10-08', note: '', first: false },
      ],
    }
    const m = (over: Partial<PortalMessage>): PortalMessage => ({ key: 'k', on: '2026-10-02', kind: 'plans', projectId: project.id, subject: '', lines: [], ...over })
    expect(portalMailGroup(state, m({}))).toBe('quotes')
    expect(portalMailGroup({ ...state, projects: [{ ...project, stage: 'building' }] }, m({}))).toBe('job')
    expect(portalMailGroup(state, m({ kind: 'backCharge' }))).toBe('pay')
    expect(portalMailGroup(state, m({ key: 'send:s1' }))).toBe('contracts')
    expect(portalMailGroup(state, m({ key: 'send:s2' }))).toBe('pay')
  })
})

describe('back-charges (owner, 2026-10-05)', () => {
  it('reads open until its answer day, then no answer; the office’s word and a draw after that', () => {
    expect(backChargeState(charge, '2026-10-03')).toBe('open')
    expect(backChargeState(charge, '2026-10-04')).toBe('noAnswer')
    expect(backChargeState({ ...charge, status: 'kept' }, '2026-10-04')).toBe('kept')
    expect(backChargeState({ ...charge, status: 'agreed', taken: { drawId: 'd2', on: '2026-10-05' } }, '2026-10-05')).toBe('taken')
  })

  it('can come off a draw once agreed, kept or never answered, and never while disputed or dropped', () => {
    const can = (c: BackCharge, today = '2026-10-02') => backChargeCanTake(c, today)
    expect([can(charge), can(charge, '2026-10-04'), can({ ...charge, status: 'agreed' }), can({ ...charge, status: 'kept' })]).toEqual([false, true, true, true])
    expect([can({ ...charge, status: 'disputed' }), can({ ...charge, status: 'dropped' })]).toEqual([false, false])
  })

  it('comes off an approved draw not paid yet that is big enough', () => {
    expect(backChargeDraws(sowWith(), charge).map((d) => d.id)).toEqual(['d2'])
  })

  it('lists what the office must act on: a dispute, and one it can take', () => {
    const disputed = { ...charge, id: 'bc2', status: 'disputed' as const }
    const agreed = { ...charge, id: 'bc3', status: 'agreed' as const }
    const dropped = { ...charge, id: 'bc4', status: 'dropped' as const }
    expect(backChargesToAct(sowWith({ backCharges: [charge, disputed, agreed, dropped] }), '2026-10-02').map((c) => c.id)).toEqual(['bc2', 'bc3'])
  })

  it('shows the company its own charges on a job that is ours, newest first, and no one else', () => {
    const later = { ...charge, id: 'bc2', sentOn: '2026-10-01', answerBy: '2026-10-06' }
    const pkg = pkgWith(sowWith({ backCharges: [charge, later] }))
    const project = projectWith({ stage: 'building', packages: [pkg] })
    const rows = portalBackCharges(project, pkg, 'p1', '2026-10-02')
    expect(rows.map((r) => [r.charge.id, r.line, r.tone, r.canAnswer])).toEqual([
      ['bc2', '$1,250 · sent Oct 1', 'amber', true],
      ['bc1', '$1,250 · sent Sep 28', 'amber', true],
    ])
    expect(portalBackCharges(project, pkg, 'p2', '2026-10-02')).toEqual([])
    expect(portalBackCharges({ ...project, stage: 'pursuing' }, pkg, 'p1', '2026-10-02')).toEqual([])
  })
})

describe('a trade asks for a change (owner, 2026-10-04)', () => {
  const request: TradeChangeRequest = { id: 'cr1', packageId: 'elec', partnerId: 'p1', askedOn: '2026-09-30', description: 'Rock at 3 ft', reason: 'field', amount: 14820, days: 2, file: null, changeOrderId: null, turnedDown: null }
  const co: ChangeOrder = { id: 'co1', number: 1, description: 'Rock at 3 ft', reason: 'field', schedule: '+2 days', packageId: 'elec', cost: 14820, price: 16302, status: 'draft', sentOn: null, answeredOn: null, pctDone: 0 }
  const withCo = (c: ChangeOrder) => projectWith({ changeOrders: [c] })

  it('follows the change order the office made of it, to the customer and back to the trade', () => {
    const made = { ...request, changeOrderId: 'co1' }
    const states = [
      changeRequestState(projectWith({}), request).state,
      changeRequestState(withCo(co), made).state,
      changeRequestState(withCo({ ...co, status: 'sent' }), made).state,
      changeRequestState(withCo({ ...co, status: 'declined' }), made).state,
      changeRequestState(withCo({ ...co, status: 'signed' }), made).state,
      changeRequestState(withCo({ ...co, status: 'signed', tradeChange: { status: 'sent', sentOn: '2026-10-02', signedOn: null, sovLineId: 's1' } }), made).state,
      changeRequestState(withCo({ ...co, status: 'signed', tradeChange: { status: 'signed', sentOn: '2026-10-02', signedOn: '2026-10-03', sovLineId: 's1' } }), made).state,
      changeRequestState(projectWith({}), { ...request, turnedDown: { on: '2026-10-01', note: 'In the scope.' } }).state,
    ]
    expect(states).toEqual(['asked', 'drafting', 'withCustomer', 'customerNo', 'customerYes', 'toSign', 'signed', 'turnedDown'])
  })

  it('waits on us only while no one has answered it', () => {
    const turnedDown = { ...request, id: 'cr2', turnedDown: { on: '2026-10-01', note: 'In the scope.' } }
    expect(openChangeRequests(projectWith({ changeRequests: [request, turnedDown] })).map((r) => r.id)).toEqual(['cr1'])
  })

  it('lets only the company on the work ask, once its statement of work is signed on a job that is ours', () => {
    const pkg = pkgWith(sowWith())
    const project = projectWith({ stage: 'building', packages: [pkg] })
    expect([portalCanAskChange(project, pkg, 'p1'), portalCanAskChange(project, pkg, 'p2')]).toEqual([true, false])
    expect(portalCanAskChange(project, pkgWith(sowWith({ status: 'sent' })), 'p1')).toBe(false)
    expect(portalCanAskChange({ ...project, stage: 'pursuing' }, pkg, 'p1')).toBe(false)
    expect(PORTAL_CHANGE_WHY.map((w) => w.reason)).toEqual(['field', 'owner', 'plans'])
  })
})

describe('insurance, a lost bid and what a statement of work leaves out', () => {
  it('says none on file, ran out, runs out soon, and good to', () => {
    const on = (coiExpires: string | null) => portalInsurance({ ...partner, coiExpires }, '2026-10-02')
    expect(on(null).words).toBe('none on file')
    expect([on('2026-09-30').words, on('2026-09-30').ranOut]).toEqual(['ran out Sep 30', true])
    expect([on('2026-10-02').words, on('2026-10-03').words, on('2026-10-12').words]).toEqual(['runs out today', 'runs out tomorrow, Oct 3', 'runs out Oct 12, in 10 days'])
    expect([on('2026-12-31').words, on('2026-12-31').soon]).toEqual(['good to Dec 31', false])
  })

  it('renews a year on, and a leap day the day before', () => {
    expect([aYearFrom('2026-10-02'), aYearFrom('2028-02-29')]).toEqual(['2027-10-02', '2029-02-28'])
  })

  it('says we did not win, or that the project stopped, and never the price or who won', () => {
    expect(portalClosedWords(projectWith({ lostWhy: 'price' }), true)).toEqual({ why: 'Click did not win this project.', next: 'Thank you for your quote.' })
    expect(portalClosedWords(projectWith({ lostWhy: 'project_died' }), false)).toEqual({
      why: 'The customer stopped this project or put it on hold.',
      next: 'You do not need to send a quote. Thank you for your time.',
    })
  })

  it('says what a statement of work leaves out, with a unit price where one was given', () => {
    const sow = sowWith({ excluded: [{ name: 'Rock', by: null, unitPrice: { amount: 38, unit: 'cy' } }, { name: 'Permits and fees', by: 'the owner' }] })
    expect(portalSowExcluded(sow)).toEqual(['Rock, $38 per cy if it comes up', 'Permits and fees (the owner does it)'])
  })

  it('lists the lines of a number the office could not read', () => {
    const pkg = pkgWith(null)
    const invite = { id: 'i1', partnerId: 'p1', status: 'bid' as const, invitedOn: '2026-09-28', seenRev: 0, bid: { amount: 1, basedOnRev: 0, submittedOn: '2026-09-28', note: '', includes: { 'e-1': 'unclear' as const, 'e-2': 'yes' as const }, plugs: {} } }
    expect(unclearLines(pkg, invite).map((l) => l.id)).toEqual(['e-1'])
  })
})

describe('the first visit and the look-ahead owed', () => {
  it('welcomes a company that never used its portal, and not once it did anything there', () => {
    const s = initialGcState()
    const project = { ...s.projects[0]!, packages: [{ ...pkgWith(null), invites: [{ id: 'i1', partnerId: 'p1', status: 'invited' as const, invitedOn: '2026-09-28', seenRev: null, bid: null }] }] }
    const state: GcState = { ...s, partners: [partner], projects: [project] }
    expect(portalFirstVisit(state, 'p1')).toBe(true)
    expect(portalFirstVisit({ ...state, partners: [{ ...partner, portalOpenedOn: '2026-10-01' }] }, 'p1')).toBe(false)
    expect(portalFirstVisit({ ...state, partners: [{ ...partner, msa: 'signed' }] }, 'p1')).toBe(false)
    const opened = { ...project, packages: [{ ...project.packages[0]!, invites: [{ id: 'i1', partnerId: 'p1', status: 'opened' as const, invitedOn: '2026-09-28', seenRev: 0, bid: null }] }] }
    expect(portalFirstVisit({ ...state, projects: [opened] }, 'p1')).toBe(false)
  })

  it('counts last week’s unmarked lines as late, and this week’s on a Friday', () => {
    const s = initialGcState()
    const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
    // Friday Oct 2: last week shows while unmarked, and this week's Lighting is the one unmarked line.
    expect(lookAheadOwed(s, 'pecanvalley', fairOaks).thisWeek).toBe(1)
    expect(lookAheadOwed({ ...s, today: '2026-09-29' }, 'pecanvalley', fairOaks).thisWeek).toBe(0)
  })
})
