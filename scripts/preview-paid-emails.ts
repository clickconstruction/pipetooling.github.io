/**
 * Dev-only preview harness for the paid-job-email renderers.
 *
 * Renders the real edge-function templates against a sample payload so the
 * office can review wording/layout without sending mail or touching prod.
 *
 *   npx vite-node scripts/preview-paid-emails.ts -- <outDir>
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  renderPaidJobEmailDetailed,
  renderPaidJobEmailSummary,
  paidJobEmailSubject,
  type PaidJobEmailPayload,
} from '../supabase/functions/paid-job-email/render.ts'

const base: PaidJobEmailPayload = {
  job: {
    id: 'demo-job',
    display_number: 'HCP 1482',
    job_name: 'Willow Creek Unit 12 — Rough In',
    job_address: '4418 Willow Creek Dr, Austin, TX 78745',
    customer_name: 'Hensel Phelps Construction',
    status: 'billed',
    service_type_name: 'Plumbing',
  },
  line_items: [
    { name: 'Water heater — 50 gal gas', count: 1, unit_price: 2450, amount: 2450, description: 'Bradford White, includes pan + expansion tank', invoice_status: 'paid' },
    { name: 'Tub/shower valve rough', count: 3, unit_price: 620, amount: 1860, description: 'Moen Posi-Temp', invoice_status: 'paid' },
    { name: 'Lavatory rough-in', count: 4, unit_price: 385, amount: 1540, description: null, invoice_status: 'billed' },
    { name: 'Water closet rough-in', count: 3, unit_price: 410, amount: 1230, description: null, invoice_status: 'billed' },
    { name: 'Hose bibb', count: 2, unit_price: 165, amount: 330, description: 'Frost-free, 12 in', invoice_status: 'ready_to_bill' },
  ],
  invoices: [
    { status: 'billed', amount: 4310, paid: 4310, sent_at: '2026-07-14', sent_day_offset: 1, channel: 'stripe', detail: 'Deposit — 50% at rough-in start', bill_to: null },
    { status: 'billed', amount: 2770, paid: 1500, sent_at: '2026-07-28', sent_day_offset: 0, channel: 'physical', detail: 'Progress bill #2', bill_to: null },
    { status: 'ready_to_bill', amount: 330, paid: 0, sent_at: null, channel: null, detail: 'Hazmat remediation fee', bill_to: 'Willow Creek HOA', is_hazmat: true },
  ],
  charge_events: [
    { source: 'payment', date_key: '2026-07-16', amount: 4310, label: 'Stripe payment' },
    { source: 'team_labor', date_key: '2026-07-10', amount: 1820, label: 'Crew labor' },
    { source: 'parts', date_key: '2026-07-09', amount: 2140, label: 'Parts' },
    { source: 'sub_labor', date_key: '2026-07-18', amount: 900, label: 'Sub sheet — Behar Kraja' },
    { source: 'payment', date_key: '2026-08-01', amount: 1500, label: 'Check 2281' },
  ],
  money: {
    revenue: 7410,
    payments: [
      { amount: 4310, payment_date: '2026-07-16', method: 'Stripe' },
      { amount: 1500, payment_date: '2026-08-01', method: 'Check 2281' },
    ],
    payments_total: 5810,
    last_payment: { amount: 1500, at: '2026-08-01T19:12:00Z' },
  },
  costs: {
    team_labor: {
      total: 1820,
      people: [
        { name: 'Kyle Draper', hours: 26.5, wage: 42, cost: 1113 },
        { name: 'Miguel Rodriguez', hours: 18, wage: 39.28, cost: 707 },
      ],
    },
    sub_labor_total: 900,
    parts_total: 2140,
    supply_house_total: 410,
    tally_total: 0,
    other_total: 0,
  },
  profit: 7410 - (1820 + 900 + 2140 + 410),
  timeline: [{ month: '2026-07', labor_cost: 2720, parts_cost: 2550, payments: 4310 }, { month: '2026-08', labor_cost: 0, parts_cost: 0, payments: 1500 }],
  dates: { job_start: '2026-07-08', last_work: '2026-07-27', paid_at: null },
}

/** The same job once the final payment lands — the existing Paid in Full email. */
const paidInFull: PaidJobEmailPayload = {
  ...base,
  job: { ...base.job, status: 'paid' },
  invoices: (base.invoices ?? []).map((i) => ({ ...i, paid: i.amount, status: i.status === 'ready_to_bill' ? 'billed' : i.status, sent_at: i.sent_at ?? '2026-08-02' })),
  money: { ...base.money, payments_total: 7410, last_payment: { amount: 1600, at: '2026-08-02T15:30:00Z' } },
  dates: { ...base.dates, paid_at: '2026-08-02T15:30:00Z' },
}

const outDir = process.argv[process.argv.length - 1] ?? '.'
mkdirSync(outDir, { recursive: true })

const cases: Array<[string, string, string]> = [
  ['payment-made-detailed', paidJobEmailSubject(base), renderPaidJobEmailDetailed(base, 'Preview — not sent')],
  ['payment-made-summary', paidJobEmailSubject(base), renderPaidJobEmailSummary(base, 'Preview — not sent')],
  ['paid-in-full-detailed', paidJobEmailSubject(paidInFull), renderPaidJobEmailDetailed(paidInFull, 'Preview — not sent')],
]

for (const [name, subject, html] of cases) {
  writeFileSync(join(outDir, `${name}.html`), html)
  console.log(`${name}\n  subject: ${subject}`)
}
