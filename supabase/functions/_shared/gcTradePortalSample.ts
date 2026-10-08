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
} as const

const ID = SAMPLE_TRADE_IDS
const COMPANY = ID.company

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10)
}

/** The sample's rows: one company asked to quote one trade on one project, with what it has given and what we sent it. */
export function gcTradePortalSampleRows(today: string): TradePortalRows {
  const d = (n: number) => addDays(today, n)
  return {
    company: { id: COMPANY, name: 'Sample Electric Co.', contact_name: 'Dana Ortiz', email: 'dana@example.com', phone: '(210) 555-0142', trades: ['Electrical'], contact_gets: ['quotes', 'job', 'contracts'], address: '400 Sample St, Boerne', license: 'TECL 00000', lang: 'en', portal_opened_on: d(-6), vetting_status: null, vetting_limit: null, vetting_decided_on: null },
    people: [{ id: ID.person, company_id: COMPANY, name: 'Marcus Lee', email: 'marcus@example.com', role: 'Bookkeeper', gets: ['pay'], added_by: 'trade', removed_at: null }],
    invites: [
      { id: ID.ask, package_id: ID.trade, company_id: COMPANY, status: 'opened', invited_on: d(-8), seen_rev: 0, declined_why: null, declined_on: null },
      { id: ID.askPassed, package_id: ID.trade2, company_id: COMPANY, status: 'declined', invited_on: d(-20), seen_rev: 0, declined_why: 'cant', declined_on: d(-18) },
    ],
    quotes: [],
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
    ],
    packages: [
      { id: ID.trade, project_id: ID.project, trade: 'Electrical', position: 0 },
      { id: ID.trade2, project_id: ID.project2, trade: 'Electrical', position: 0 },
    ],
    scopeItems: [
      { id: ID.line1, package_id: ID.trade, position: 0, label: 'Service and gear', sheets: ['E-101'], specs: null, added_in_set_id: null },
      { id: ID.line2, package_id: ID.trade, position: 1, label: 'Panels and feeders', sheets: ['E-201'], specs: null, added_in_set_id: null },
      { id: ID.line3, package_id: ID.trade, position: 2, label: 'Lighting', sheets: ['E-301'], specs: null, added_in_set_id: ID.set1 },
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
  }
}

/** The sample company's slice, as `gc-trade-portal` returns it for the sample token. */
export function gcTradePortalSample(today: string): TradePortalSlice {
  return tradePortalSlice(gcTradePortalSampleRows(today), COMPANY)
}
