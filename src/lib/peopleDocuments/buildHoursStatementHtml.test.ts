import { describe, expect, it } from 'vitest'
import { buildHoursStatement } from '../people/hoursStatement'
import { buildHoursStatementHtml, hoursStatementDocumentTitle, hoursStatementHours2, hoursStatementUniformRate, HOURS_STATEMENT_NOTE_FITS } from './buildHoursStatementHtml'

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

/** The slice of the paper between two markers. */
const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to))

describe('buildHoursStatementHtml', () => {
  const html = buildHoursStatementHtml(ctx)
  it('is a light Letter page with the packet’s page rule and the stamp in the margin', () => {
    expect(html).toContain('<html lang="en" data-theme="light">')
    expect(html).toContain('@page { size: letter; margin: 0.5in 0.5in 0.6in;')
    expect(html).toContain('counter(pages)')
    expect(html).toContain('Record not yet filed (draft)')
  })
  it('reads as one full-width paper: the facts band closes before the table, and nothing is a two-column grid', () => {
    const band = between(html, '<div class="facts">', '<table class="days">')
    expect(band.split('<div').length).toBe(band.split('</div>').length)
    expect(html).toContain('<div class="facts">')
    expect(html).not.toMatch(/grid-template-columns: 1fr 1fr;/)
    expect(html).toContain('.sheet { width: 100%; max-width: 8.5in;')
  })
  it('carries the header facts as one band, the rate once when every row shares it', () => {
    expect(html).toContain('Statement of hours worked and paid')
    expect(html).toContain('<span>Worker</span> · <b>Marcus Reyes</b> (helper)</div>')
    expect(html).toContain('<span>Period</span> · <b>September 1, 2025 – June 13, 2026</b>')
    expect(html).toContain('<span>Rate</span> · <b>$24.00 an hour</b>')
    expect(html).toContain('1042 · Cedar Ridge Phase 2, Bldg B')
    expect(html).toContain('Ridgeway Builders')
    expect(html).toContain('D. Okafor')
    expect(html).toContain('<div class="wide"><span>Site</span> · <b>4810 Cedar Ridge Dr, Georgetown, TX 78628</b></div>')
    expect(hoursStatementUniformRate(statement)).toBe(24)
  })
  it('draws the table full width: one line per day with In – Out as one cell, two-decimal hours, no Rate column, the week’s subtotals under Hours and Amount', () => {
    expect(html).toContain('<thead><tr><th>Day</th><th>In – Out</th><th class="n">Hours</th><th>What they were working on</th><th class="n">Amount</th></tr></thead>')
    expect(html).not.toContain('<th class="n">Rate</th>')
    expect(html).toContain('<tr class="wk"><td colspan="2">Week of May 31</td><td class="n">8.50</td><td></td><td class="n">$204.00</td></tr>')
    expect(html).toContain('<tr class="day"><td class="d">Mon Jun 1</td><td class="io">7:02 am – 3:34 pm</td><td class="n">8.50</td><td class="w">Rough-in, 2nd floor stacks</td><td class="n">$204.00</td></tr>')
    expect(html).toContain('<tr class="pend"><td class="d">Fri Jun 5</td><td colspan="4"><i>1 session of 4 h waiting for approval · not counted</i></td></tr>')
    expect(html).toContain('<tr class="tot"><td colspan="2">Recorded in the app, this job</td><td class="n">8.50</td><td>1 day · 1 waiting for approval, not counted</td><td class="n">$204.00</td></tr>')
    expect(html).not.toMatch(/<td class="n">8\.5<\/td>/)
  })
  it('repeats the column header on every page and keeps a row, a week heading and a day with its note together', () => {
    expect(html).toContain('thead { display: table-header-group; }')
    expect(html).toContain('tr { break-inside: avoid; page-break-inside: avoid; }')
    expect(html).toContain('tr.wk, tr.hasnote { break-after: avoid; page-break-after: avoid; }')
    expect(html).toContain('tr.nt { break-before: avoid; page-break-before: avoid; }')
    expect(html).toContain('.attest, .sig { break-before: avoid; page-break-before: avoid; }')
  })
  it('drops a long note to its own line under its day, kept with the day', () => {
    const note = 'Moved the water heater pad to the north wall after the inspector failed the clearance, re-ran the flue and the gas drop.'
    expect(note.length).toBeGreaterThan(HOURS_STATEMENT_NOTE_FITS)
    const s = buildHoursStatement({ kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-07', withPay: true, worker: { name: 'Marcus Reyes' }, rows: [{ day: '2026-06-01', hours: 2.17, note, inLabel: '7:00 am', outLabel: '9:10 am' }], dayRates: { '2026-06-01': 24 } })
    const h = buildHoursStatementHtml({ ...ctx, statement: s })
    expect(h).toContain('<tr class="day hasnote"><td class="d">Mon Jun 1</td><td class="io">7:00 am – 9:10 am</td><td class="n">2.17</td><td class="w"></td><td class="n">$52.08</td></tr>')
    expect(h).toMatch(/<\/tr>\s*<tr class="nt"><td><\/td><td colspan="4">Moved the water heater pad/)
  })
  it('draws the Rate column per row only when the rate changes inside the period', () => {
    const s = buildHoursStatement({
      kind: 'clock',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-14',
      withPay: true,
      worker: { name: 'Marcus Reyes' },
      rows: [
        { day: '2026-06-01', hours: 8, note: '', inLabel: '7:00 am', outLabel: '3:00 pm' },
        { day: '2026-06-08', hours: 8, note: '', inLabel: '7:00 am', outLabel: '3:00 pm' },
      ],
      dayRates: { '2026-06-01': 24, '2026-06-08': 26 },
    })
    const h = buildHoursStatementHtml({ ...ctx, statement: s })
    expect(hoursStatementUniformRate(s)).toBeNull()
    expect(h).not.toContain('<span>Rate</span>')
    expect(h).toContain('<th>What they were working on</th><th class="n">Rate</th><th class="n">Amount</th>')
    expect(h).toContain('<td class="n">8.00</td><td class="w"></td><td class="n">$24.00</td><td class="n">$192.00</td></tr>')
    expect(h).toContain('<td class="n">8.00</td><td class="w"></td><td class="n">$26.00</td><td class="n">$208.00</td></tr>')
    expect(h).toContain('<tr class="wk"><td colspan="2">Week of June 7</td><td class="n">8.00</td><td></td><td></td><td class="n">$208.00</td></tr>')
    expect(h).toContain('<td>2 days</td><td></td><td class="n">$400.00</td></tr>')
  })
  it('draws Paid as a full-width band, each line the week in bold with the kernel’s words after it', () => {
    expect(html).toContain('<div class="band"><h2>Paid</h2><div class="pay">')
    expect(html).toContain('<b>Week of May 31</b><div>$204.00 earned on this job of $864.00 for the week · paid in full $864.00 on June 12, 2026 · Cash App #D-7K2M4Q</div>')
    expect(html).toContain('A week’s pay covers every job that week.')
  })
  it('says the gap in the company’s words with the stated rows under it, and the attestation', () => {
    expect(html).toContain('Days the company’s records do not show (September 1, 2025 – March 11, 2026)')
    expect(html).toContain('The company kept no clock before March 12, 2026.')
    expect(html).toContain('<td>2025-09-15</td><td class="n">9.00</td><td>Set water heaters, Bldg A</td><td class="src">Worker, 2026-10-30</td>')
    expect(html).toContain('that the days marked stated are true to the best of my memory')
    expect(html).toContain('Signature of the worker · printed name')
    expect(html).toContain('Prepared from the company’s records by T. Alvarez')
  })
  it('has no column saying how a row was recorded', () => {
    expect(html).not.toMatch(/<th>Record<\/th>/)
    expect(html).not.toMatch(/Clocked · GPS|Typed · 2nd look|Quick add/)
  })
  it('with the pay off, carries hours alone: no rate, no Amount column, no Paid band', () => {
    const s = buildHoursStatement({ kind: 'clock', periodStart: '2026-06-01', periodEnd: '2026-06-07', withPay: false, worker: { name: 'Marcus Reyes' }, rows: [{ day: '2026-06-01', hours: 8, note: 'Gas test', inLabel: '7:00 am', outLabel: '3:00 pm' }] })
    const h = buildHoursStatementHtml({ ...ctx, statement: s })
    expect(h).toContain('Statement of hours worked</h1>')
    expect(h).not.toContain('<span>Rate</span>')
    expect(h).toContain('<thead><tr><th>Day</th><th>In – Out</th><th class="n">Hours</th><th>What they were working on</th></tr></thead>')
    expect(h).toContain('<tr class="wk"><td colspan="2">Week of May 31</td><td class="n">8.00</td><td></td></tr>')
    expect(h).toContain('<tr class="day"><td class="d">Mon Jun 1</td><td class="io">7:00 am – 3:00 pm</td><td class="n">8.00</td><td class="w">Gas test</td></tr>')
    expect(h).not.toContain('<h2>Paid</h2>')
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
  it('prints hours to two decimals', () => {
    expect(hoursStatementHours2(8)).toBe('8.00')
    expect(hoursStatementHours2(2.166)).toBe('2.17')
    expect(hoursStatementHours2(26.17)).toBe('26.17')
  })
  it('draws a sub’s sheets by sheet with the line words, the sheet named by its heading row', () => {
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
    expect(h).toContain('<thead><tr><th>Day</th><th>Line</th><th class="n">Hours</th><th class="n">Amount</th></tr></thead>')
    expect(h).toContain('<span>Rate</span> · <b>$60.00 an hour</b>')
    expect(h).toContain('<tr class="wk"><td colspan="2">Sheet 1042-A · agreed May 4</td><td class="n">30.00</td><td class="n">$1,800.00</td></tr>')
    expect(h).toContain('<tr class="day"><td class="d">Mon May 4</td><td class="w">Tub and shower rough-in</td><td class="n">30.00</td><td class="n">$1,800.00</td></tr>')
    expect(h).toContain('<tr class="tot"><td colspan="2">On the sheets, this job</td><td class="n">30.00</td><td class="n">$1,800.00</td></tr>')
    expect(h).toContain('<b>Sheet 1042-A</b><div>$1,800.00 · not yet paid</div>')
    expect(h).toContain('Signature of the worker for Whitfield Plumbing Services')
  })
})
