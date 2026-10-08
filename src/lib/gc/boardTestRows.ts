/**
 * Test data only: the app never reads it. A small GC project as `gc_create_project` writes it, with
 * two sitework companies asked (one quoted, one promised a day that passed), a call log and a
 * promise, as the company record's tables hold them (B1), and our number's inputs (B5). The board's
 * mapper test and its render test read it.
 */
import type { BoardRows } from './boardRows'
import { gcProjectFromRows, type GcProjectRows } from './projectRows'

/** A small clinic as gc_create_project writes it: sitework and concrete hired out, plumbing ours. */
export function clinicProjectRows(): GcProjectRows {
  return {
    project: { id: 'p1', name: 'Hill Country Clinic', address: '12 Oak St, Boerne', customer_id: 'c1', plans_link: null },
    gc: { stage: 'bidding', bid_due: '2026-10-20', sq_ft: '6800', size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: 'c2', project_manager_user_id: null, drive_folder_url: '', lost_on: null },
    packages: [
      { id: 'k1', trade: 'Sitework', position: 0, budget: 60000, ours: false, own_bid_id: null },
      { id: 'k2', trade: 'Concrete', position: 1, budget: '84000', ours: false, own_bid_id: null },
      { id: 'k3', trade: 'Plumbing', position: 2, budget: 30000, ours: true, own_bid_id: 'b7' },
    ],
    scopeItems: [
      { id: 's1', package_id: 'k1', position: 0, label: 'Clearing and grading', sheets: null, specs: null, added_in_set_id: null },
      { id: 's2', package_id: 'k1', position: 1, label: 'Paving', sheets: null, specs: null, added_in_set_id: null },
      { id: 's3', package_id: 'k2', position: 0, label: 'Foundations', sheets: null, specs: null, added_in_set_id: null },
    ],
    exclusions: [],
    sets: [{ id: 'set0', rev: 0, label: 'Bid set', kind: 'Bid set', issued_on: '2026-10-01', note: '', checked_by_user_id: 'u1', drive_url: '', drive_access: null, drive_checked_on: null }],
    setItems: [],
    questions: [],
  }
}

/** The clinic with two sitework companies asked: one quoted (leaving paving out, with a plug), one promised a day that passed. */
export function clinicBoardRows(over: Partial<BoardRows> = {}): BoardRows {
  return {
    today: '2026-10-08',
    projects: [gcProjectFromRows(clinicProjectRows())],
    boardDates: { p1: { our_bid_sent_on: null, permit_on: null, start_date: null, owner_contract_sent_on: null, started_on: null, lost_why: null, won_by: null } },
    customers: [
      { id: 'c1', name: 'Oak Street Partners' },
      { id: 'c2', name: 'Studio Ocotillo' },
    ],
    companies: [
      { id: 'lonestar', name: 'Lonestar Earthworks', trades: ['Sitework'], contact_name: 'Ray Ortiz', phone: '210-555-0101', email: '', address: '4410 Boerne Stage Rd, San Antonio', max_miles: 60, license: '', lang: 'en', vetting_status: null, vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' },
      { id: 'hillside', name: 'Hillside Excavation', trades: ['Sitework'], contact_name: 'Dee Park', phone: '', email: 'dee@example.com', address: '', max_miles: null, license: '', lang: 'es', vetting_status: 'new', vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' },
    ],
    invites: [
      { id: 'i1', package_id: 'k1', company_id: 'lonestar', status: 'bid', invited_on: '2026-10-01', declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: { s2: 9000 }, exclusion_covers: {}, taken_alternates: [] },
      { id: 'i2', package_id: 'k1', company_id: 'hillside', status: 'opened', invited_on: '2026-10-01', declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: {}, exclusion_covers: {}, taken_alternates: [] },
    ],
    quotes: [
      { id: 'q0', invite_id: 'i1', amount: '58000', based_on_rev: 0, submitted_on: '2026-10-03', includes: { s1: 'yes', s2: 'yes' }, note: '', good_for_days: null, alternates: [], quote_file: '', exclusions: null, created_at: '2026-10-03T10:00:00Z' },
      { id: 'q1', invite_id: 'i1', amount: 52000, based_on_rev: 0, submitted_on: '2026-10-05', includes: { s1: 'yes', s2: 'no' }, note: 'Paving by others.', good_for_days: 30, alternates: [], quote_file: '', exclusions: null, created_at: '2026-10-05T10:00:00Z' },
    ],
    contacts: [
      { id: 'n1', company_id: 'hillside', invite_id: 'i2', contacted_on: '2026-10-02', by_user_id: 'u1', by_name: 'Rosa', how: 'call', note: 'Quote by Monday.', promised_by: '2026-10-05', created_at: '2026-10-02T15:00:00Z' },
      { id: 'n2', company_id: 'hillside', invite_id: null, contacted_on: '2026-10-03', by_user_id: 'u1', by_name: 'Rosa', how: 'note', note: 'New to us; met at the pre-bid.', promised_by: null, created_at: '2026-10-03T15:00:00Z' },
    ],
    promises: [{ id: 'tp1', company_id: 'lonestar', kind: 'insurance', project_id: null, package_id: null, what: 'the renewed insurance certificate', due_on: '2026-10-12', made_on: '2026-10-06', source: 'office', kept_on: null }],
    promiseMoves: [{ promise_id: 'tp1', was_due_on: '2026-10-09', moved_on: '2026-10-07', created_at: '2026-10-07T12:00:00Z' }],
    // Our number's inputs, as the money team reads them (B5-c).
    money: [{ project_id: 'p1', general_conditions: '12000', contingency_pct: 3, fee_pct: '8' }],
    moneyShown: true,
    ...over,
  }
}
