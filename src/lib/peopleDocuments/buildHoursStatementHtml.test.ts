import { describe, expect, it } from 'vitest'
import { buildHoursStatement } from '../people/hoursStatement'
import { buildHoursStatementHtml, hoursStatementDocumentTitle } from './buildHoursStatementHtml'

// Made-up worker, job, hours and amounts.
const statement = buildHoursStatement({
  kind: 'clock',
  periodStart: '2025-09-01',
  periodEnd: '2026-06-13',
  withPay: true,
  worker: { name: 'Marcus Reyes' },
  rows: [
    { day: '2026-06-01', hours: 8.5, note: 'Rough-in, 2nd floor stacks', inLabel: '7:02 am', outLabel: '3:34 pm' },
    { day: '2026-06-05', hours: 4, note: 'Fittings', pending: true },
  ],
  dayRates: { '2026-06-01': 24 },
  payGroups: [{ key: 'stub-1', label: 'Week of May 31', from: '2026-05-31', to: '2026-06-06', due: 864, payments: [{ on: '2026-06-12', amount: 864, memo: null, sourceKind: 'cashapp', sourceId: 'D-7K2M4Q' }] }],
  firstRecordedDay: '2026-03-12',
  addStatedBlock: true,
  statedDays: [{ day: '2025-09-15', hours: 9, note: 'Set water heaters, Bldg A', statedBy: 'Worker, 2026-10-30' }],
})

const ctx = {
  statement,
  recordId: null,
  worker: { name: 'Marcus Reyes', standing: 'helper' },
  job: { number: '1042', name: 'Cedar Ridge Phase 2, Bldg B', customer: 'Ridgeway Builders', site: '4810 Cedar Ridge Dr, Georgetown, TX 78628' },
  approvedBy: 'D. Okafor',
  preparedBy: 'T. Alvarez',
  preparedOn: 'October 29, 2026',
  asOf: 'October 29, 2026 6:12 pm',
  company: { name: 'Click Plumbing', ein: '00-0000000', address: '1200 Commerce St, Georgetown, TX 78626' },
}

describe('buildHoursStatementHtml', () => {
  const html = buildHoursStatementHtml(ctx)
  it('is a light Letter page with the packet’s page rule and the stamp in the margin', () => {
    expect(html).toContain('<html lang="en" data-theme="light">')
    expect(html).toContain('@page { size: letter; margin: 0.5in 0.5in 0.6in;')
    expect(html).toContain('counter(pages)')
    expect(html).toContain('Record not yet filed (draft)')
  })
  it('carries the header facts, the rows, the pending day, the totals and the pay', () => {
    expect(html).toContain('Statement of hours worked and paid')
    expect(html).toContain('<b>Marcus Reyes</b> (helper)')
    expect(html).toContain('1042 · Cedar Ridge Phase 2, Bldg B')
    expect(html).toContain('4810 Cedar Ridge Dr, Georgetown, TX 78628')
    expect(html).toContain('Ridgeway Builders')
    expect(html).toContain('D. Okafor')
    expect(html).toContain('<td>Mon Jun 1</td><td>7:02 am</td><td>3:34 pm</td><td class="n">8.5</td><td>Rough-in, 2nd floor stacks</td><td class="n">$24.00</td><td class="n">$204.00</td>')
    expect(html).toContain('1 session of 4 h waiting for approval · not counted')
    expect(html).toContain('Recorded in the app, this job')
    expect(html).toContain('paid in full $864.00 on June 12, 2026 · Cash App #D-7K2M4Q')
  })
  it('says the gap in the company’s words with the stated rows under it, and the attestation', () => {
    expect(html).toContain('Days the company’s records do not show (September 1, 2025 – March 11, 2026)')
    expect(html).toContain('The company kept no clock before March 12, 2026.')
    expect(html).toContain('<td>2025-09-15</td><td class="n">9</td><td>Set water heaters, Bldg A</td><td class="src">Worker, 2026-10-30</td>')
    expect(html).toContain('that the days marked stated are true to the best of my memory')
    expect(html).toContain('Signature of the worker · printed name')
    expect(html).toContain('Prepared from the company’s records by T. Alvarez')
  })
  it('has no column saying how a row was recorded', () => {
    expect(html).not.toMatch(/<th>Record<\/th>/)
    expect(html).not.toMatch(/Clocked · GPS|Typed · 2nd look|Quick add/)
  })
  it('escapes what the rows carry', () => {
    const s = buildHoursStatement({ kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-07', withPay: false, worker: { name: 'A <b>' }, rows: [{ day: '2026-06-01', hours: 1, note: '<script>x</script>' }] })
    const h = buildHoursStatementHtml({ ...ctx, statement: s, worker: { name: 'A <b>', standing: 'helper' } })
    expect(h).not.toContain('<script>x')
    expect(h).toContain('&lt;script&gt;x')
    expect(h).toContain('Statement of hours worked</h1>')
  })
  it('names the document after the worker, the job and the period', () => {
    expect(hoursStatementDocumentTitle(ctx)).toBe('Statement of hours worked · Marcus Reyes · Job 1042 · September 1, 2025 – June 13, 2026')
  })
  it('draws a sub’s sheets by sheet with the line words', () => {
    const sheet = buildHoursStatement({
      kind: 'sheet',
      periodStart: '2026-05-04',
      periodEnd: '2026-05-22',
      withPay: true,
      worker: { name: 'Dale Whitfield', company: 'Whitfield Plumbing Services' },
      rows: [{ day: '2026-05-04', hours: 30, note: 'Tub and shower rough-in', rate: 60, amount: 1800, group: { key: 'a', label: 'Sheet 1042-A · agreed May 4' } }],
      payGroups: [{ key: 'a', label: 'Sheet 1042-A', from: '2026-05-04', to: '2026-05-04', due: 1800, payments: [] }],
    })
    const h = buildHoursStatementHtml({ ...ctx, statement: sheet, worker: { name: 'Dale Whitfield', standing: 'subcontractor', company: 'Whitfield Plumbing Services' } })
    expect(h).toContain('<th>Sheet</th><th>Day</th><th>Line</th>')
    expect(h).toContain('<td>Sheet 1042-A</td><td>Mon May 4</td><td>Tub and shower rough-in</td><td class="n">30</td><td class="n">$60.00</td><td class="n">$1,800.00</td>')
    expect(h).toContain('On the sheets, this job')
    expect(h).toContain('Sheet 1042-A · $1,800.00 · not yet paid')
    expect(h).toContain('Signature of the worker for Whitfield Plumbing Services')
  })
})
