/**
 * GC mode, the trade partner portal's sample (P1b-ii, to-dos/gc-mode/PORTAL_REAL_BUILD.md → decision 12): what
 * `gc-trade-portal` answers for the sample token (`?t=sample`, `/t/sample`), so What customers see shows the portal with
 * no company's rows. Made-up rows, dated from today so the page always reads as current, and run through
 * `tradePortalSlice` like every real one, so the sample can never show what a trade may not see. Its own file, never
 * `customerSampleFixtures.ts`, which most functions import.
 */
import { tradePortalSlice, type TradePortalRows, type TradePortalSlice } from './gcTradePortalSlice.ts'

/** The sample's ids: real uuids, so a press on the sample passes the submit function's shape check (P2b-ii). */
export const SAMPLE_TRADE_IDS = {
  company: '00000000-5a00-4000-8000-000000000001',
  person: '00000000-5a00-4000-8000-000000000002',
  ask: '00000000-5a00-4000-8000-000000000003',
  askPassed: '00000000-5a00-4000-8000-000000000004',
  quoteDay: '00000000-5a00-4000-8000-000000000005',
  project: '00000000-5a00-4000-8000-000000000006',
  project2: '00000000-5a00-4000-8000-000000000007',
  trade: '00000000-5a00-4000-8000-000000000008',
  trade2: '00000000-5a00-4000-8000-000000000009',
  line1: '00000000-5a00-4000-8000-000000000010',
  line2: '00000000-5a00-4000-8000-000000000011',
  line3: '00000000-5a00-4000-8000-000000000012',
  exclusion: '00000000-5a00-4000-8000-000000000013',
  set0: '00000000-5a00-4000-8000-000000000014',
  set1: '00000000-5a00-4000-8000-000000000015',
  questionMine: '00000000-5a00-4000-8000-000000000016',
  questionOther: '00000000-5a00-4000-8000-000000000017',
  otherCompany: '00000000-5a00-4000-8000-000000000018',
  message: '00000000-5a00-4000-8000-000000000019',
  // A job of ours (P4b-i): its award, its signed statement of work, a charge and a change request.
  job: '00000000-5a00-4000-8000-000000000020',
  jobTrade: '00000000-5a00-4000-8000-000000000021',
  jobAsk: '00000000-5a00-4000-8000-000000000022',
  jobQuote: '00000000-5a00-4000-8000-000000000023',
  sow: '00000000-5a00-4000-8000-000000000024',
  charge: '00000000-5a00-4000-8000-000000000025',
  request: '00000000-5a00-4000-8000-000000000026',
  changeOrder: '00000000-5a00-4000-8000-000000000027',
  msa: '00000000-5a00-4000-8000-000000000028',
  w9: '00000000-5a00-4000-8000-000000000029',
  coi: '00000000-5a00-4000-8000-000000000030',
  // The job's scope and its statement of work's lines (P2c-ii).
  jobLine1: '00000000-5a00-4000-8000-000000000031',
  jobLine2: '00000000-5a00-4000-8000-000000000032',
  sowLine1: '00000000-5a00-4000-8000-000000000033',
  sowLine2: '00000000-5a00-4000-8000-000000000034',
  // The job's work (P5c-1): a paid draw, a punch item, a submittal and a question while we build.
  draw1: '00000000-5a00-4000-8000-000000000035',
  punch1: '00000000-5a00-4000-8000-000000000036',
  submittal1: '00000000-5a00-4000-8000-000000000037',
  rfi1: '00000000-5a00-4000-8000-000000000038',
} as const

const ID = SAMPLE_TRADE_IDS
const COMPANY = ID.company

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10)
}

/**
 * The sample's rows: one company asked to quote one trade on one project, with what it has given and what we sent it,
 * one ask it passed on, and one job of ours it was awarded and signed for, with its report, a paid draw, a punch item, a
 * submittal and a question while we build (P5c-1), a charge to answer and a change it asked
 * for that is with the customer.
 */
export function gcTradePortalSampleRows(today: string): TradePortalRows {
  const d = (n: number) => addDays(today, n)
  return {
    company: { id: COMPANY, name: 'Sample Electric Co.', contact_name: 'Dana Ortiz', email: 'dana@example.com', phone: '(210) 555-0142', trades: ['Electrical'], contact_gets: ['quotes', 'job', 'contracts'], address: '400 Sample St, Boerne', license: 'TECL 00000', lang: 'en', portal_opened_on: d(-6), vetting_status: null, vetting_limit: null, vetting_decided_on: null },
    people: [{ id: ID.person, company_id: COMPANY, name: 'Marcus Lee', email: 'marcus@example.com', role: 'Bookkeeper', gets: ['pay'], added_by: 'trade', removed_at: null }],
    invites: [
      { id: ID.ask, package_id: ID.trade, company_id: COMPANY, status: 'opened', invited_on: d(-8), seen_rev: 0, declined_why: null, declined_on: null },
      { id: ID.askPassed, package_id: ID.trade2, company_id: COMPANY, status: 'declined', invited_on: d(-20), seen_rev: 0, declined_why: 'cant', declined_on: d(-18) },
      { id: ID.jobAsk, package_id: ID.jobTrade, company_id: COMPANY, status: 'bid', invited_on: d(-60), seen_rev: 0, declined_why: null, declined_on: null },
    ],
    quotes: [
      { id: ID.jobQuote, invite_id: ID.jobAsk, amount: 48600, based_on_rev: 0, submitted_on: d(-52), includes: {}, note: '', good_for_days: 30, alternates: [], quote_file: '', sov: null, exclusions: null, exclusions_answered: null, source: 'trade', created_at: `${d(-52)}T15:00:00Z` },
    ],
    contacts: [{ id: ID.quoteDay, company_id: COMPANY, invite_id: ID.ask, contacted_on: d(-3), how: 'portal', note: 'Sending it Friday.', promised_by: d(4) }],
    promises: [],
    projects: [
      {
        project: { id: ID.project, name: 'Sample Retail Shell', address: '1 Sample Rd, Boerne' },
        gc: { project_id: ID.project, stage: 'bidding', bid_due: d(14), size_note: '9,600 sq ft retail shell, four bays', lost_on: null, lost_why: null },
        team: [{ role: 'projectManager', name: 'Avery Lin', phone: '(210) 555-0199', email: 'avery@example.com' }],
      },
      {
        project: { id: ID.project2, name: 'Sample Clinic Finish Out', address: '2 Sample Ave, Helotes' },
        gc: { project_id: ID.project2, stage: 'bidding', bid_due: d(5), size_note: '3,100 sq ft tenant finish out', lost_on: null, lost_why: null },
        team: [],
      },
      {
        project: { id: ID.job, name: 'Sample Dental Office', address: '3 Sample Ln, Fair Oaks Ranch' },
        gc: { project_id: ID.job, stage: 'building', bid_due: d(-45), size_note: '4,200 sq ft dental office', lost_on: null, lost_why: null },
        team: [{ role: 'superintendent', name: 'Jordan Reyes', phone: '(210) 555-0170', email: 'jordan@example.com' }],
      },
    ],
    packages: [
      { id: ID.trade, project_id: ID.project, trade: 'Electrical', position: 0 },
      { id: ID.trade2, project_id: ID.project2, trade: 'Electrical', position: 0 },
      { id: ID.jobTrade, project_id: ID.job, trade: 'Electrical', position: 0, awarded_invite_id: ID.jobAsk },
    ],
    scopeItems: [
      { id: ID.line1, package_id: ID.trade, position: 0, label: 'Service and gear', sheets: ['E-101'], specs: null, added_in_set_id: null },
      { id: ID.line2, package_id: ID.trade, position: 1, label: 'Panels and feeders', sheets: ['E-201'], specs: null, added_in_set_id: null },
      { id: ID.line3, package_id: ID.trade, position: 2, label: 'Lighting', sheets: ['E-301'], specs: null, added_in_set_id: ID.set1 },
      { id: ID.jobLine1, package_id: ID.jobTrade, position: 0, label: 'Rough-in', sheets: ['E-101'], specs: null, added_in_set_id: null },
      { id: ID.jobLine2, package_id: ID.jobTrade, position: 1, label: 'Trim and fixtures', sheets: ['E-301'], specs: null, added_in_set_id: null },
    ],
    exclusions: [{ id: ID.exclusion, package_id: ID.trade, position: 0, label: 'Permits and fees', by: 'the owner' }],
    sets: [
      { id: ID.set0, project_id: ID.project, rev: 0, label: 'Bid set', kind: 'bid', issued_on: d(-9), note: '', drive_url: 'https://drive.google.com/drive/folders/sample' },
      { id: ID.set1, project_id: ID.project, rev: 1, label: 'Addendum 1', kind: 'addendum', issued_on: d(-2), note: 'Lighting added to the shell.', drive_url: 'https://drive.google.com/drive/folders/sample' },
    ],
    setItems: [],
    questions: [
      { id: ID.questionMine, project_id: ID.project, package_id: ID.trade, company_id: COMPANY, text: 'Is the site lighting on its own panel?', sheets: ['E-101'], asked_on: d(-1), answered_on: null, answer: '', answer_sent_to: [] },
      { id: ID.questionOther, project_id: ID.project, package_id: ID.trade, company_id: ID.otherCompany, text: 'Are the feeders copper or aluminum?', sheets: ['E-201'], asked_on: d(-5), answered_on: d(-4), answer: 'Copper, as the panel schedules say.', answer_sent_to: [COMPANY] },
    ],
    messages: [
      {
        id: ID.message,
        company_id: COMPANY,
        project_id: ID.project,
        kind: 'invite',
        mail_group: 'quotes',
        lang: 'en',
        subject: 'Click Construction asks you to quote Electrical on Sample Retail Shell',
        lines: ['We would like your quote for Electrical on Sample Retail Shell.', '1 Sample Rd, Boerne. 9,600 sq ft retail shell, four bays.', { items: ['Service and gear', 'Panels and feeders'] }],
        to_names: ['Dana Ortiz'],
        sent_on: d(-8),
      },
    ],
    setSends: [{ set_id: ID.set1, company_id: COMPANY, touched: true }],
    sows: [{ id: ID.sow, package_id: ID.jobTrade, invite_id: ID.jobAsk, company_id: COMPANY, status: 'signed', price: 48600, retainage_pct: 10, based_on_rev: 0, sent_on: d(-35), signed_on: d(-33), excluded: null }],
    sowLines: [
      { id: ID.sowLine1, sow_id: ID.sow, position: 0, label: 'Rough-in', amount: 29160, scope_item_id: ID.jobLine1 },
      { id: ID.sowLine2, sow_id: ID.sow, position: 1, label: 'Trim and fixtures', amount: 19440, scope_item_id: ID.jobLine2 },
    ],
    backCharges: [
      {
        id: ID.charge,
        project_id: ID.job,
        package_id: ID.jobTrade,
        company_id: COMPANY,
        sow_id: ID.sow,
        amount: 850,
        reason: 'Cleanup after rough-in: wire scraps and boxes left in exam rooms 2 and 3.',
        photo_url: 'https://drive.google.com/file/d/sample-photo',
        sent_on: d(-2),
        answer_by: d(3),
        status: 'open',
        answered_on: null,
        answer_note: null,
        settled_on: null,
        settled_note: null,
        taken_draw_id: null,
        taken_on: null,
        created_at: `${d(-2)}T15:00:00Z`,
      },
    ],
    changeRequests: [
      {
        id: ID.request,
        project_id: ID.job,
        package_id: ID.jobTrade,
        company_id: COMPANY,
        sow_id: ID.sow,
        asked_on: d(-10),
        description: 'Two more circuits for the dental chairs the owner added in rooms 4 and 5.',
        reason: 'owner',
        amount: 3400,
        days: 1,
        file_url: null,
        change_order_id: ID.changeOrder,
        turned_down_on: null,
        turned_down_note: null,
        created_at: `${d(-10)}T15:00:00Z`,
      },
    ],
    // Its price to the customer is here only to show the slice drops it: the company reads its part, $3,400.
    changeOrders: [{ id: ID.changeOrder, number: 2, status: 'sent', sent_on: d(-6), answered_on: null, cost: 3400, price: 3910 }],
    // Its papers (B6-b-ii): the master agreement signed before its statement of work, its W-9, a certificate good for
    // a year. The link is here only to show the slice drops it.
    papers: [
      { id: ID.msa, company_id: COMPANY, doc_type: 'agreement', status: 'signed', sent_at: `${d(-40)}T15:00:00Z`, signed_at: d(-38), expires_at: null, url: 'https://example.com/never-passes' },
      { id: ID.w9, company_id: COMPANY, doc_type: 'w9', status: 'signed', sent_at: `${d(-40)}T15:00:00Z`, signed_at: d(-38), expires_at: null },
      { id: ID.coi, company_id: COMPANY, doc_type: 'coi', status: 'signed', sent_at: null, signed_at: d(-38), expires_at: d(327) },
    ],
    // The job's work (P5c-1): the rough-in reported at 60% and billed to half, paid with its conditional waiver; a punch
    // item to fix; a submittal waiting on the company; and a question it asked, answered by the architect.
    lineReports: [
      { sow_line_id: ID.sowLine1, pct: 60, reported_on: d(-2), seq: 2 },
      { sow_line_id: ID.sowLine2, pct: 0, reported_on: d(-20), seq: 1 },
    ],
    draws: [
      {
        id: ID.draw1,
        sow_id: ID.sow,
        number: 1,
        seq: 1,
        requested_on: d(-14),
        status: 'paid',
        gross: 14580,
        retainage: 1458,
        net: 13122,
        final: false,
        waiver: 'conditional',
        waiver_on: null,
        approved_on: d(-12),
        paid_on: d(-3),
        asked: null,
        sent_back_on: null,
        sent_back_note: null,
        period_to: d(-14),
        address: '400 Sample St, Boerne',
        license: 'TECL 00000',
        signed_by: 'Dana Ortiz',
        signed_title: 'Owner',
        signed_on: d(-14),
        file_name: null,
        drive_url: null,
      },
    ],
    drawLines: [{ draw_id: ID.draw1, sow_line_id: ID.sowLine1, to_pct: 50, stored: 0, we_see: null }],
    changeSends: [],
    punch: [
      { id: ID.punch1, project_id: ID.job, package_id: ID.jobTrade, position: 0, text: 'Cover plate missing in operatory 2.', where_on: 'Operatory 2', added_on: d(-1), fixed_on: null, checked_on: null, sent_back_times: 0, sent_back_note: null, sent_back_on: null, removed_at: null },
    ],
    submittals: [
      { id: ID.submittal1, project_id: ID.job, package_id: ID.jobTrade, number: '26 24 16-01', title: 'Panelboards', kind: 'product data', spec_section: '26 24 16', lead_days: 14, needed_by: d(10), asked_on: d(-5), created_at: `${d(-5)}T15:00:00Z` },
    ],
    submittalHolds: [{ submittal_id: ID.submittal1, scope_item_id: ID.jobLine1 }],
    submittalRounds: [],
    rfis: [
      { id: ID.rfi1, project_id: ID.job, package_id: ID.jobTrade, number: 1, question: 'Is the panel in operatory 2 recessed or surface mounted?', sheets: ['E-201'], asked_by_company_id: COMPANY, asked_on: d(-4), needed_days: 3, sent_to_architect_on: d(-4), answered_on: d(-2), answer_text: 'Recessed, as the elevation on E-201 shows.', answered_by: 'architect', impact: 'none', days: null },
    ],
    rfiHolds: [{ rfi_id: ID.rfi1, scope_item_id: ID.jobLine1 }],
  }
}

/** The sample company's slice, as `gc-trade-portal` returns it for the sample token. */
export function gcTradePortalSample(today: string): TradePortalSlice {
  return tradePortalSlice(gcTradePortalSampleRows(today), COMPANY)
}
