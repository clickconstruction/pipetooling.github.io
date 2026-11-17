/**
 * Made-up rows for the sub's papers (punch list #371): one sub, four sheets, as the `sub-portal` function reads them.
 * The kernel test and the function's run test share them. Every name, job and amount is invented.
 *
 *  - `cedar-1`: Harlan's alone. Two priced lines, a part payment, a back-charge with no Date sent, and a second part
 *    payment that is one of two rows of sending 231.
 *  - `cedar-2`: Harlan's, with a teammate riding along. Paid in full by the other row of sending 231.
 *  - `alder-1`: Harlan's alone. A payment from before sendings whose memo the office hid, and one that kept a credit.
 *  - `ridge-1`: shared by Harlan and another sub, so it is nobody's paper.
 *  - `ora-1`: another sub's own sheet. Never Harlan's.
 */
import type { PapersAckRow, PapersRegisterRow, SubPortalPapersRows } from '../../../supabase/functions/_shared/subPortalPapers'

export const HARLAN = '00000000-0000-4000-8000-0000000371e1'
export const ORA = '00000000-0000-4000-8000-0000000371e2'
export const TESS = '00000000-0000-4000-8000-0000000371e3'
export const TESS_LOGIN = '00000000-0000-4000-8000-0000000371a3'
export const ORA_LOGIN = '00000000-0000-4000-8000-0000000371a2'

export const CEDAR_1 = '00000000-0000-4000-8000-0000000371b1'
export const CEDAR_2 = '00000000-0000-4000-8000-0000000371b2'
export const ALDER_1 = '00000000-0000-4000-8000-0000000371b3'
export const RIDGE_1 = '00000000-0000-4000-8000-0000000371b4'
export const ORA_1 = '00000000-0000-4000-8000-0000000371b5'

export const JOB_CEDAR = '00000000-0000-4000-8000-0000000371f1'
export const JOB_ALDER = '00000000-0000-4000-8000-0000000371f2'

export const SENDING_226 = '00000000-0000-4000-8000-0000000371d1'
export const SENDING_231 = '00000000-0000-4000-8000-0000000371d2'

export const PAY_OCT = '00000000-0000-4000-8000-0000000371c1'
export const PAY_BACKCHARGE = '00000000-0000-4000-8000-0000000371c2'
export const PAY_NOV_A = '00000000-0000-4000-8000-0000000371c3'
export const PAY_NOV_B = '00000000-0000-4000-8000-0000000371c4'
export const PAY_SEP_HIDDEN = '00000000-0000-4000-8000-0000000371c5'
export const PAY_SEP_CASH = '00000000-0000-4000-8000-0000000371c6'
export const PAY_ORA = '00000000-0000-4000-8000-0000000371c7'

/** The memo the office hid from the sub. It must never leave the function. */
export const HIDDEN_MEMO = 'Advance, do not show'

export const PEOPLE = [
  { id: HARLAN, name: 'Harlan Mechanical', kind: 'sub', account_user_id: null, email: null },
  { id: ORA, name: 'Ora Plumbing', kind: 'sub', account_user_id: ORA_LOGIN, email: null },
  // A teammate carries kind `sub` too: the login's role tells them apart.
  { id: TESS, name: 'Tess Lead', kind: 'sub', account_user_id: TESS_LOGIN, email: null },
]
export const USERS = [
  { id: ORA_LOGIN, role: 'subcontractor' },
  { id: TESS_LOGIN, role: 'superintendent' },
]

export const SHEETS = [
  { id: CEDAR_1, assigned_to_name: 'Harlan Mechanical', address: '410 Cedar Hollow Rd', job_number: '2041', job_ledger_id: JOB_CEDAR, job_date: '2026-10-28', created_at: '2026-10-27T15:00:00Z', labor_rate: 75 },
  { id: CEDAR_2, assigned_to_name: 'Harlan Mechanical | Tess Lead', address: '410 Cedar Hollow Rd', job_number: '2041', job_ledger_id: JOB_CEDAR, job_date: null, created_at: '2026-11-04T02:30:00Z', labor_rate: 75 },
  { id: ALDER_1, assigned_to_name: 'Harlan Mechanical', address: '12 Alder Ct', job_number: ' 2033 ', job_ledger_id: JOB_ALDER, job_date: '2026-09-01', created_at: '2026-08-30T15:00:00Z', labor_rate: null },
  { id: RIDGE_1, assigned_to_name: 'Harlan Mechanical | Ora Plumbing', address: 'Ridgeway Builders, Lot 12', job_number: null, job_ledger_id: null, job_date: '2026-11-03', created_at: '2026-11-03T15:00:00Z', labor_rate: null },
  { id: ORA_1, assigned_to_name: 'Ora Plumbing', address: '9 Birch Ln', job_number: '2050', job_ledger_id: null, job_date: '2026-11-05', created_at: '2026-11-05T15:00:00Z', labor_rate: null },
]

export const ITEMS = [
  { id: 'i2', job_id: CEDAR_1, fixture: 'Top-out', count: 10, hrs_per_unit: 2, is_fixed: false, labor_rate: null, direct_labor_amount: null, sequence_order: 1 },
  { id: 'i1', job_id: CEDAR_1, fixture: 'Rough-in', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null, direct_labor_amount: 2600, sequence_order: 0 },
  { id: 'i3', job_id: CEDAR_2, fixture: ' ', count: 3, hrs_per_unit: 16, is_fixed: true, labor_rate: null, direct_labor_amount: null, sequence_order: 0 },
  { id: 'i4', job_id: ALDER_1, fixture: 'Finish', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null, direct_labor_amount: 1800, sequence_order: 0 },
  { id: 'i5', job_id: RIDGE_1, fixture: 'Underground', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null, direct_labor_amount: 2500, sequence_order: 0 },
  { id: 'i6', job_id: ORA_1, fixture: 'Trim', count: 1, hrs_per_unit: 0, is_fixed: false, labor_rate: null, direct_labor_amount: 700, sequence_order: 0 },
]

export const PAYMENTS = [
  { id: PAY_OCT, job_id: CEDAR_1, amount: 1500, memo: 'First draw', payment_date: '2026-10-31', created_at: '2026-10-31T20:00:00Z', hidden_from_sub: false, method: 'check', method_ref: '1182', sending_id: SENDING_226, sequence_order: 0 },
  // A back-charge with no Date sent: it reads "recorded" on the day it was typed, in Central time.
  { id: PAY_BACKCHARGE, job_id: CEDAR_1, amount: -100, memo: 'Damaged drywall', payment_date: null, created_at: '2026-11-10T15:00:00Z', hidden_from_sub: false, method: null, method_ref: null, sending_id: null, sequence_order: 1 },
  { id: PAY_NOV_A, job_id: CEDAR_1, amount: 1000, memo: null, payment_date: '2026-11-12', created_at: '2026-11-12T16:00:00Z', hidden_from_sub: false, method: 'zelle', method_ref: '8841', sending_id: SENDING_231, sequence_order: 2 },
  { id: PAY_NOV_B, job_id: CEDAR_2, amount: 1200, memo: null, payment_date: '2026-11-12', created_at: '2026-11-12T16:00:00Z', hidden_from_sub: false, method: 'zelle', method_ref: '8841', sending_id: SENDING_231, sequence_order: 0 },
  // From before sendings, with a memo the office hid.
  { id: PAY_SEP_HIDDEN, job_id: ALDER_1, amount: 900, memo: HIDDEN_MEMO, payment_date: null, created_at: '2026-09-02T17:00:00Z', hidden_from_sub: true, method: 'check', method_ref: '1140', sending_id: null, sequence_order: 0 },
  { id: PAY_SEP_CASH, job_id: ALDER_1, amount: 900, memo: 'Balance', payment_date: '2026-09-20', created_at: '2026-09-20T17:00:00Z', hidden_from_sub: false, method: 'cash', method_ref: null, sending_id: null, sequence_order: 1 },
  { id: PAY_ORA, job_id: ORA_1, amount: 300, memo: 'Ora only', payment_date: '2026-11-06', created_at: '2026-11-06T17:00:00Z', hidden_from_sub: false, method: 'check', method_ref: '1201', sending_id: null, sequence_order: 0 },
]

export const ASSIGNEES = [
  { labor_job_id: CEDAR_1, person_id: HARLAN },
  { labor_job_id: CEDAR_2, person_id: HARLAN },
  { labor_job_id: CEDAR_2, person_id: TESS },
  { labor_job_id: ALDER_1, person_id: HARLAN },
  { labor_job_id: RIDGE_1, person_id: HARLAN },
  { labor_job_id: RIDGE_1, person_id: ORA },
  { labor_job_id: ORA_1, person_id: ORA },
]

export const JOBS_LEDGER = [
  { id: JOB_CEDAR, job_name: 'Cedar Hollow Clinic', hcp_number: '2041', click_number: null, job_plans_link: null, bid: null },
  { id: JOB_ALDER, job_name: ' Alder Court Remodel ', hcp_number: '2033', click_number: null, job_plans_link: null, bid: null },
]

export const SENDINGS = [
  { id: SENDING_226, number: 226, person_id: HARLAN },
  { id: SENDING_231, number: '231', person_id: HARLAN },
]

/** The cash payment came in $50 past what the sheet needed, kept as Harlan's credit. */
export const CREDITS = [{ id: 'k1', person_id: HARLAN, payment_id: PAY_SEP_CASH, amount: 50 }]

export const PAPER_CEDAR_1_REV_1 = '00000000-0000-4000-8000-0000000371p1'
export const PAPER_CEDAR_1_REV_2 = '00000000-0000-4000-8000-0000000371p2'
export const PAPER_CEDAR_2 = '00000000-0000-4000-8000-0000000371p3'
export const PAPER_ALDER_VOID = '00000000-0000-4000-8000-0000000371p4'
export const PAPER_SENDING_226 = '00000000-0000-4000-8000-0000000371p5'

/** The register as the office left it. `fingerprint` of the live copy of `cedar-1` is set by the test that needs it. */
export function registerRows(cedar1Fingerprint = 'not today'): Array<PapersRegisterRow & { person_id: string }> {
  return [
    { id: PAPER_CEDAR_1_REV_1, person_id: HARLAN, kind: 'work_statement', number: 'WS-2041-1', revision: 1, labor_job_id: CEDAR_1, sending_id: null, payment_id: null, issued_at: '2026-10-29T15:00:00Z', replaced_by: PAPER_CEDAR_1_REV_2, voided_at: null, fingerprint: 'the first copy' },
    { id: PAPER_CEDAR_1_REV_2, person_id: HARLAN, kind: 'work_statement', number: 'WS-2041-1', revision: 2, labor_job_id: CEDAR_1, sending_id: null, payment_id: null, issued_at: '2026-11-13T15:00:00Z', replaced_by: null, voided_at: null, fingerprint: cedar1Fingerprint },
    { id: PAPER_CEDAR_2, person_id: HARLAN, kind: 'work_statement', number: 'WS-2041-2', revision: 1, labor_job_id: CEDAR_2, sending_id: null, payment_id: null, issued_at: '2026-11-05T15:00:00Z', replaced_by: null, voided_at: null, fingerprint: 'before it was paid' },
    // A voided paper keeps its number in the register and gives the sheet none on the page.
    { id: PAPER_ALDER_VOID, person_id: HARLAN, kind: 'work_statement', number: 'WS-2033-1', revision: 1, labor_job_id: ALDER_1, sending_id: null, payment_id: null, issued_at: '2026-09-03T15:00:00Z', replaced_by: null, voided_at: '2026-09-04T15:00:00Z', fingerprint: 'void' },
    { id: PAPER_SENDING_226, person_id: HARLAN, kind: 'payment_record', number: 'PR-0226', revision: 1, labor_job_id: null, sending_id: SENDING_226, payment_id: null, issued_at: '2026-10-31T21:00:00Z', replaced_by: null, voided_at: null, fingerprint: 'pr' },
  ]
}

/** The rows the function hands the kernel for Harlan: his four sheets, never Ora's own. */
export function harlanRows(over: { register?: PapersRegisterRow[]; acks?: PapersAckRow[] } = {}): SubPortalPapersRows {
  const mine = new Set(ASSIGNEES.filter((a) => a.person_id === HARLAN).map((a) => a.labor_job_id))
  return {
    personId: HARLAN,
    sheets: SHEETS.filter((s) => mine.has(s.id)),
    items: ITEMS.filter((i) => mine.has(i.job_id)),
    payments: PAYMENTS.filter((p) => mine.has(p.job_id)),
    assignees: ASSIGNEES.filter((a) => mine.has(a.labor_job_id)),
    people: PEOPLE,
    users: USERS,
    jobNames: { [JOB_CEDAR]: 'Cedar Hollow Clinic', [JOB_ALDER]: 'Alder Court Remodel' },
    sendings: SENDINGS,
    credits: CREDITS,
    register: over.register ?? registerRows(),
    acks: over.acks ?? [],
  }
}
