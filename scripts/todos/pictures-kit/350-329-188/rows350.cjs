// Invented rows for #350: Sam Plumber's sheets, payments and registered papers.
const id = (group, n) => `00000000-0000-4194-${group}-${String(n).padStart(12, '0')}`
const JOB = (n) => id('8002', n)
const SAM = id('8008', 8)
const MASTER = '00000000-0000-4194-8000-000000000002'
const ROSA = '00000000-0000-4194-8000-000000000003'
const SHEET = (n) => id('8e01', n)
const PAY = (n) => id('8e02', n)
const SEND = (n) => id('8e03', n)
const at = (day, time = '15:00:00') => `${day}T${time}.000Z`

const sheet = (n, job, number, address, day, stage) => ({
  id: SHEET(n), assigned_to_name: 'Sam Plumber', address, job_number: number, job_ledger_id: JOB(job), labor_rate: 0, job_date: day, created_at: at(day),
  distance_miles: null, invoice_link: null, project_id: null, step_id: null, stage, stage_changed_at: null, stage_changed_by: null, stage_source: null, stage_note: null,
  payable_after: null, pay_hold_reason: null, progress_pct: null, progress_at: null, master_user_id: MASTER, paid_at: null, draw_invoice_id: null,
})
const sheets = [
  sheet(1, 3, '1321', 'San Marcos, TX', '2026-10-06', 'customer_pay'),
  sheet(2, 3, '1321', 'San Marcos, TX', '2026-10-27', 'customer_pay'),
  sheet(3, 2, '1318', '500 Sample Blvd, Kyle, TX', '2026-11-10', 'walkthrough'),
  sheet(4, 5, '1327', '100 Sample St, Kyle, TX', '2026-11-19', 'working'),
]
let itemN = 0
const item = (s, seq, fixture, amount) => ({ id: id('8e04', ++itemN), job_id: SHEET(s), fixture, count: 1, hrs_per_unit: 0, is_fixed: true, labor_rate: null, direct_labor_amount: amount, sequence_order: seq, created_at: at('2026-10-06') })
const items = [
  item(1, 1, 'Building C, floor 1 rough-in, units 101 to 108', 3600),
  item(1, 2, 'Floor 1 water heater closets', 1200),
  item(2, 1, 'Building C, floor 2 rough-in, units 201 to 208', 3600),
  item(2, 2, 'Floor 2 water heater closets', 1200),
  item(2, 3, 'Roof vents, building C', 400),
  item(3, 1, 'Retail shell, underground and rough-in', 2800),
  item(3, 2, 'Two restroom groups, top out', 800),
  item(4, 1, 'Slab leak, reroute the hot line overhead', 850),
]
const pay = (n, s, seq, amount, day, method, ref, sending, memo) => ({
  id: PAY(n), job_id: SHEET(s), amount, memo, created_at: at(day, '20:10:00'), hidden_from_sub: false, payment_date: day, method, method_ref: ref, sending_id: sending, sequence_order: seq, checked_at: null, checked_by: null, checked_by_name: null,
})
const payments = [
  pay(1, 1, 1, 2400, '2026-10-16', 'check', '2041', SEND(1), 'First half, floor 1'),
  pay(2, 1, 2, 2400, '2026-10-30', 'zelle', null, SEND(2), 'Floor 1, paid in full'),
  pay(3, 2, 1, -150, '2026-11-05', null, null, null, 'Replaced a cracked closet flange in unit 204'),
  pay(4, 2, 2, 2000, '2026-11-14', 'check', '2068', SEND(3), 'Part payment, floor 2'),
  pay(5, 3, 1, 1200, '2026-11-14', 'check', '2068', SEND(3), 'Part payment, retail shell'),
]
const sendings = [
  { id: SEND(1), number: 12, person_id: SAM, created_by: ROSA, created_at: at('2026-10-16', '20:10:00') },
  { id: SEND(2), number: 14, person_id: SAM, created_by: ROSA, created_at: at('2026-10-30', '20:10:00') },
  { id: SEND(3), number: 17, person_id: SAM, created_by: ROSA, created_at: at('2026-11-14', '20:10:00') },
]
const assignees = sheets.map((s) => ({ labor_job_id: s.id, person_id: SAM }))
const paper = (n, kind, number, sheetN, periodTo, day, extra = {}) => ({
  id: id('8e05', n), kind, number, revision: 1, labor_job_id: sheetN ? SHEET(sheetN) : null, period_from: null, period_to: periodTo, issued_at: at(day, '21:00:00'), issued_by: ROSA, issued_by_name: 'Rosa Sample',
  person_id: SAM, replaced_by: null, voided_at: null, void_reason: null, sending_id: null, payment_id: null, snapshot: {}, fingerprint: 'lens-' + n, comes_to: null, still_open: null, ...extra,
})
const papers = [
  paper(1, 'work_statement', 'WS-1321-1', 1, null, '2026-10-16'),
  paper(2, 'work_statement', 'WS-1321-2', 2, null, '2026-10-31'),
  paper(3, 'statement_of_account', 'SA-4', null, '2026-10-31', '2026-10-31'),
  paper(4, 'work_statement', 'WS-1318-1', 3, null, '2026-11-14'),
]
const issuer = {
  key: 'physical_invoice_issuer_v1',
  value_text: JSON.stringify({ companyName: 'Sample Plumbing Co.', addressText: '200 Sample Way\nKyle, TX 78640', phone: '(512) 555-0100', email: 'office@lens.example.com' }),
  value_num: null,
}
module.exports = {
  SAM, SHEET, PAY, SEND, issuer,
  extra: {
    tables: { people_labor_jobs: sheets, people_labor_job_items: items, people_labor_job_payments: payments, people_labor_job_assignees: assignees, sub_payment_sendings: sendings, sub_papers: papers, sub_paper_acks: [], sub_credit_entries: [] },
  },
}
