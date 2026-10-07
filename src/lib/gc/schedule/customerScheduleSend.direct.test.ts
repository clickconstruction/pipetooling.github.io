/**
 * Main's own test for the customer's schedule as a printable page (G-94; the schedule's PR 1b). The
 * letter's words come from the Owner Billing lane, whose lift brings them, so the test gives a letter.
 */
import { describe, expect, it } from 'vitest'
import { customerScheduleHtml } from './customerScheduleSend'

describe('the customer’s schedule as a printable page (G-94)', () => {
  it('prints the letter under its subject, to its reader, one paragraph a line', () => {
    const html = customerScheduleHtml({ to: 'Elena Ruiz, Cibolo Creek Partners', subject: 'Your schedule on Fair Oaks Shops, Building D, Oct 2', lines: ['Hello Elena,', 'Call me with any question.', 'Robert Douglas, Click Construction'] })
    expect(html).toContain('<title>Your schedule on Fair Oaks Shops, Building D, Oct 2</title>')
    expect(html).toContain('<h1>Your schedule on Fair Oaks Shops, Building D, Oct 2</h1><div class="to">To Elena Ruiz, Cibolo Creek Partners</div>')
    expect(html).toContain('<p>Hello Elena,</p><p>Call me with any question.</p><p>Robert Douglas, Click Construction</p></body></html>')
  })

  it('keeps what the page would read as its own marks as words', () => {
    expect(customerScheduleHtml({ to: 'A & B', subject: '<b>', lines: ['1 < 2'] })).toContain('<title>&lt;b&gt;</title><style>')
    expect(customerScheduleHtml({ to: 'A & B', subject: 'x', lines: ['1 < 2'] })).toContain('<div class="to">To A &amp; B</div><p>1 &lt; 2</p>')
  })
})
