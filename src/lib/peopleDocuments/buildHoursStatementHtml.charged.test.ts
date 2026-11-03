import { describe, expect, it } from 'vitest'
import { buildHoursStatement } from '../people/hoursStatement'
import { buildHoursStatementHtml } from './buildHoursStatementHtml'

/**
 * The charged paper's print (punch list #251, PR 2): its title, its Charged band in place of Paid, and the prepared line.
 * Every name, job and place here is made up.
 */
describe('the charged paper on the page', () => {
  const statement = buildHoursStatement({
    kind: 'clock',
    periodStart: '2026-04-20',
    periodEnd: '2026-04-26',
    basis: 'charged',
    chargeWords: 'master with a helper throughout · $285.00 the crew’s hour',
    rows: [
      { day: '2026-04-20', hours: 9.93, note: 'with Zed · master with a helper · the job’s rule', inLabel: '8:00 am', outLabel: '5:00 pm', chargeRate: 285 },
      { day: '2026-04-25', hours: 9.44, note: 'alone · a tech alone · adjusted', inLabel: '8:00 am', outLabel: '5:26 pm', chargeRate: 185 },
    ],
    withPay: true,
    worker: { name: 'Toby' },
  })
  const html = buildHoursStatementHtml({
    statement,
    worker: { name: 'Toby', standing: 'primary' },
    job: { number: '1042', name: 'ROUGH IN: house and barn', customer: 'Example Builders', site: '1 Field Rd, Anytown', isOfficeJob: false },
    approvedBy: 'Dana',
    recordId: 'HS-1042-0002',
    preparedBy: 'Dana',
    preparedOn: 'November 3, 2026',
    asOf: 'Nov 3, 9:00 AM',
  })

  it('is titled a statement of hours charged, carries the Charged band and no Paid band, and the prepared line names how it was charged', () => {
    expect(html).toContain('<h1>Statement of hours charged</h1>')
    expect(html).toContain('<h2>Charged</h2>')
    expect(html).not.toContain('<h2>Paid</h2>')
    expect(html).toContain('Prepared from the company’s records, charged as master with a helper throughout · $285.00 the crew’s hour by Dana')
    expect(html).toContain('Nothing on this paper is what the worker was paid.')
  })

  it('prices each day at its own rate in the Rate and Amount columns', () => {
    expect(html).toContain('<th class="n">Rate</th>')
    expect(html).toContain('<th class="n">Amount</th>')
    expect(html).toContain('$285.00')
    expect(html).toContain('$185.00')
    expect(html).toContain('$2,830.05')
    expect(html).toContain('$1,746.40')
  })
})
