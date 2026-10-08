/**
 * The trade partner portal's slice (P1a, read by P1b's gc-trade-portal): a trade never sees our price to the customer. Every field
 * outside the list carries a marked value here, and the slice's JSON must contain none of them, as a
 * number or as words. A field added to a table later is kept out until it is named in
 * TRADE_PORTAL_FIELDS, and naming one is a reviewed change.
 */
import { describe, expect, it } from 'vitest'
import { TRADE_PORTAL_FIELDS, tradePortalSlice, type TradePortalRows } from '../../../supabase/functions/_shared/gcTradePortalSlice'

const ME = 'co-me'
const THEM = 'co-them'

/** The marked values: each one is something a trade must never read. */
const NEVER = {
  budget: 777777,
  generalConditions: 616161,
  contingencyPct: 4.321,
  feePct: 12.34,
  plug: 55555,
  cover: 44444,
  takenAlternate: 'TAKEN-ALTERNATE-SECRET',
  customerChangeOrderPrice: 98765,
  otherCompanyName: 'Rival Electric LLC',
  otherCompanyNumber: 123456,
  officeCallNote: 'OFFICE-CALL-NOTE-SECRET',
  officeQuoteNote: 'OFFICE-QUOTE-NOTE-SECRET',
  declineNote: 'DECLINE-NOTE-SECRET',
  lostNote: 'LOST-NOTE-SECRET',
  wonBy: 'WON-BY-SECRET',
  customerId: 'cust-SECRET',
  ownBidId: 'own-bid-SECRET',
  vettingNote: 'VETTING-NOTE-SECRET',
  otherQuestion: 'OTHER-QUESTION-SECRET',
  otherAsker: 'Rival Electric asked',
  otherMessage: 'OTHER-MESSAGE-SECRET',
  removedPerson: 'REMOVED-PERSON-SECRET',
  companyNote: 'COMPANY-NOTE-SECRET',
  architect: 'arch-SECRET',
  projectManagerId: 'pm-user-SECRET',
  otherProject: 'OTHER-PROJECT-SECRET',
} as const

function rows(): TradePortalRows {
  return {
    company: { id: ME, name: 'Test Electric', contact_name: 'Dana Whitfield', email: 'dana@example.com', phone: '210-555-0100', trades: ['Electrical'], contact_gets: null, address: '1 Main St', license: 'TECL 1', lang: 'en', portal_opened_on: null, vetting_status: null, vetting_limit: null, vetting_decided_on: null, vetting_decided_by: 'u-office', vetting_note: NEVER.vettingNote, created_by: 'u-office' },
    people: [
      { id: 'pp1', company_id: ME, name: 'Marcus Lee', email: 'marcus@example.com', role: 'Bookkeeper', gets: ['pay'], added_by: 'trade', removed_at: null },
      { id: 'pp2', company_id: ME, name: NEVER.removedPerson, email: 'gone@example.com', role: '', gets: ['job'], added_by: 'office', removed_at: '2026-10-01T00:00:00Z' },
    ],
    invites: [
      { id: 'inv-me', package_id: 'pkg-elec', company_id: ME, status: 'bid', invited_on: '2026-09-28', invited_by: 'u-office', seen_rev: 0, declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: { 'si-2': NEVER.plug }, exclusion_covers: { 'Permits and fees': NEVER.cover }, taken_alternates: [NEVER.takenAlternate] },
      { id: 'inv-them', package_id: 'pkg-elec', company_id: THEM, status: 'declined', invited_on: '2026-09-28', seen_rev: 0, declined_why: 'cant', decline_reason: 'busy', decline_note: NEVER.declineNote, declined_on: '2026-09-29', plugs: {}, exclusion_covers: {}, taken_alternates: [] },
    ],
    quotes: [
      { id: 'q-me', invite_id: 'inv-me', amount: 64200, based_on_rev: 0, submitted_on: '2026-10-01', includes: { 'si-1': 'yes', 'si-2': 'no' }, note: NEVER.officeQuoteNote, good_for_days: 30, alternates: [], quote_file: '', sov: null, exclusions: null, exclusions_answered: null, source: 'office', created_by: 'u-office' },
      { id: 'q-them', invite_id: 'inv-them', amount: NEVER.otherCompanyNumber, based_on_rev: 0, submitted_on: '2026-10-01', includes: {}, note: '', source: 'trade' },
    ],
    contacts: [
      { id: 'c1', company_id: ME, invite_id: 'inv-me', contacted_on: '2026-09-30', by_user_id: 'u-office', by_name: 'Wendi', how: 'call', note: NEVER.officeCallNote, promised_by: '2026-10-02' },
      { id: 'c2', company_id: ME, invite_id: 'inv-me', contacted_on: '2026-10-01', by_user_id: null, by_name: 'Dana Whitfield', how: 'portal', note: 'Friday at the latest', promised_by: '2026-10-03' },
      { id: 'c3', company_id: ME, invite_id: null, contacted_on: '2026-09-01', by_name: 'Wendi', how: 'note', note: NEVER.companyNote, promised_by: null },
      { id: 'c4', company_id: THEM, invite_id: 'inv-them', contacted_on: '2026-09-30', how: 'call', note: NEVER.officeCallNote, promised_by: null },
    ],
    promises: [{ id: 'pr1', company_id: ME, kind: 'insurance', project_id: null, package_id: null, what: 'the renewed insurance certificate', due_on: '2026-10-09', made_on: '2026-10-01', source: 'trade', kept_on: null, created_by: 'u-office' }],
    projects: [
      {
        project: { id: 'proj-1', name: 'Fair Oaks Shops', address: '9 Oak Rd', customer_id: NEVER.customerId, plans_link: null, master_user_id: 'u-office' },
        gc: { project_id: 'proj-1', stage: 'pursuing', bid_due: '2026-10-16', lost_on: null, lost_why: null, lost_note: NEVER.lostNote, won_by: NEVER.wonBy, general_conditions: NEVER.generalConditions, contingency_pct: NEVER.contingencyPct, fee_pct: NEVER.feePct, architect_customer_id: NEVER.architect, project_manager_user_id: NEVER.projectManagerId, size_note: '', sq_ft: 12000 },
        team: [{ role: 'projectManager', name: 'Avery Lin', phone: '210-555-0199', email: 'avery@example.com', user_id: NEVER.projectManagerId }],
      },
      {
        project: { id: 'proj-2', name: NEVER.otherProject, address: '', customer_id: NEVER.customerId },
        gc: { project_id: 'proj-2', stage: 'pursuing', bid_due: null, general_conditions: NEVER.generalConditions },
        team: [],
      },
    ],
    packages: [
      { id: 'pkg-elec', project_id: 'proj-1', trade: 'Electrical', position: 3, budget: NEVER.budget, ours: false, own_bid_id: NEVER.ownBidId },
      { id: 'pkg-other', project_id: 'proj-2', trade: 'Roofing', position: 1, budget: NEVER.budget, ours: false, own_bid_id: null },
    ],
    scopeItems: [
      { id: 'si-1', package_id: 'pkg-elec', position: 0, label: 'Panels and feeders', sheets: ['E-101'], specs: null, added_in_set_id: null },
      { id: 'si-x', package_id: 'pkg-other', position: 0, label: NEVER.otherProject, sheets: null, specs: null, added_in_set_id: null },
    ],
    exclusions: [{ id: 'ex-1', package_id: 'pkg-elec', position: 0, label: 'Permits and fees', by: 'the owner' }],
    sets: [
      { id: 'set-0', project_id: 'proj-1', rev: 0, label: 'Bid set', kind: 'bid', issued_on: '2026-09-25', note: '', drive_url: 'https://drive.google.com/x', drive_access: 'anyone', checked_by_user_id: NEVER.projectManagerId, created_by: 'u-office' },
      { id: 'set-x', project_id: 'proj-2', rev: 0, label: NEVER.otherProject, kind: 'bid', issued_on: '2026-09-25', note: '', drive_url: '' },
    ],
    setItems: [{ id: 'it-1', set_id: 'set-0', position: 0, kind: 'sheet', number: 'E-101', title: 'Power plan', change: 'issued', was_title: null, discipline: null, page: 4 }],
    questions: [
      { id: 'qu-mine', project_id: 'proj-1', package_id: 'pkg-elec', company_id: ME, asked_by_name: 'Test Electric', text: 'Which panel schedule?', sheets: ['E-101'], asked_on: '2026-10-01', sent_to_architect_on: null, answered_on: null, answer: '', answer_sent_to: [], in_set_id: null },
      { id: 'qu-them-answered', project_id: 'proj-1', package_id: 'pkg-elec', company_id: THEM, asked_by_name: NEVER.otherAsker, text: 'Is the feeder copper?', sheets: [], asked_on: '2026-09-30', answered_on: '2026-10-01', answer: 'Copper.', answer_sent_to: [ME, THEM], in_set_id: null },
      { id: 'qu-them-open', project_id: 'proj-1', package_id: 'pkg-elec', company_id: THEM, asked_by_name: NEVER.otherAsker, text: NEVER.otherQuestion, sheets: [], asked_on: '2026-09-30', answered_on: null, answer: '', answer_sent_to: [], in_set_id: null },
    ],
    messages: [
      { id: 'm1', company_id: ME, project_id: 'proj-1', kind: 'invite', mail_group: 'quotes', msg_key: 'proj-1:invite:pkg-elec', lang: 'en', subject: 'Quote Electrical on Fair Oaks Shops', lines: ['Hello Dana,'], to_names: ['Dana Whitfield'], sent_on: '2026-09-28', sent_by: 'u-office', email_send_log_id: 'log-1' },
      { id: 'm2', company_id: THEM, project_id: 'proj-1', kind: 'invite', mail_group: 'quotes', msg_key: 'x', lang: 'en', subject: NEVER.otherMessage, lines: [], to_names: [NEVER.otherCompanyName], sent_on: '2026-09-28' },
    ],
    setSends: [
      { set_id: 'set-0', company_id: ME, touched: true, email_send_log_id: 'log-2' },
      { set_id: 'set-0', company_id: THEM, touched: false, email_send_log_id: 'log-3' },
      { set_id: 'set-x', company_id: ME, touched: true },
    ],
  }
}

describe('a trade never sees our price to the customer', () => {
  const json = JSON.stringify(tradePortalSlice(rows(), ME))

  it.each(Object.entries(NEVER))('never carries %s', (_name, value) => {
    expect(json).not.toContain(String(value))
  })

  it('names only reviewed fields, never our money', () => {
    const named = Object.values(TRADE_PORTAL_FIELDS).flat()
    for (const f of ['budget', 'general_conditions', 'contingency_pct', 'fee_pct', 'plugs', 'exclusion_covers', 'taken_alternates', 'own_bid_id', 'won_by', 'lost_note', 'customer_id', 'vetting_note', 'answer_sent_to', 'asked_by_name', 'decline_note']) {
      expect(named).not.toContain(f)
    }
  })
})

describe('what a company reads about itself', () => {
  const slice = tradePortalSlice(rows(), ME)

  it('reads its own ask, its quote and the day it gave, with its own words only', () => {
    expect(slice.invites.map((i) => i.id)).toEqual(['inv-me'])
    expect(slice.quotes.map((q) => [q.id, q.amount, q.note])).toEqual([['q-me', 64200, '']])
    expect(slice.contacts.map((c) => [c.id, c.how, c.promised_by, c.note])).toEqual([
      ['c1', 'call', '2026-10-02', ''],
      ['c2', 'portal', '2026-10-03', 'Friday at the latest'],
    ])
  })

  it('reads the asked project, its trade, its plans and who to call, and no other project', () => {
    expect(slice.projects.map((p) => [p.project.name, p.gc.stage, p.team.map((t) => t.name)])).toEqual([['Fair Oaks Shops', 'pursuing', ['Avery Lin']]])
    expect(slice.packages.map((p) => [p.id, p.trade])).toEqual([['pkg-elec', 'Electrical']])
    expect(slice.scopeItems.map((s) => s.id)).toEqual(['si-1'])
    expect(slice.sets.map((s) => s.label)).toEqual(['Bid set'])
    expect(slice.setItems.map((i) => i.number)).toEqual(['E-101'])
  })

  it('reads its own questions, and an answer sent to it without who asked', () => {
    expect(slice.questions.map((q) => [q.id, q.mine])).toEqual([
      ['qu-mine', true],
      ['qu-them-answered', false],
    ])
  })

  it('reads which sets changed its trade, on its own projects only', () => {
    expect(slice.setSends).toEqual([{ set_id: 'set-0', touched: true }])
  })

  it('reads its people still on its emails, and the messages we sent it', () => {
    expect(slice.people.map((p) => p.name)).toEqual(['Marcus Lee'])
    expect(slice.messages.map((m) => m.subject)).toEqual(['Quote Electrical on Fair Oaks Shops'])
  })

  it('reads nothing of another company’s ask when its own link opens', () => {
    const theirs = tradePortalSlice(rows(), THEM)
    expect(theirs.invites.map((i) => i.id)).toEqual(['inv-them'])
    expect(JSON.stringify(theirs)).not.toContain('64200')
    expect(JSON.stringify(theirs)).not.toContain('Friday at the latest')
  })
})
