import { describe, expect, it } from 'vitest'
import { buildRfiHtml, buildRfiText, type RfiFormData } from './rfi'

function form(p: Partial<RfiFormData> = {}): RfiFormData {
  return {
    bidSubmittedDate: p.bidSubmittedDate ?? '2026-01-01',
    submittedTo: p.submittedTo ?? 'General Contractor',
    companyName: p.companyName ?? 'Click Plumbing',
    contactPerson: p.contactPerson ?? 'Jane',
    phoneEmail: p.phoneEmail ?? 'jane@example.com',
    responseRequestDate: p.responseRequestDate ?? '2026-01-08',
    detailedDescription: p.detailedDescription ?? 'Need clarification on riser routing.',
    impactStatement: p.impactStatement ?? 'Affects rough-in schedule.',
  }
}

describe('buildRfiHtml', () => {
  it('includes question and impact sections', () => {
    const html = buildRfiHtml('John Doe', '123 Main St, Austin, TX', 'Acme Tower', '456 Job Rd, Austin, TX', form())
    expect(html).toContain('<strong>Question/Issue</strong>')
    expect(html).toContain('<strong>Impact</strong>')
    expect(html).toContain('Need clarification on riser routing.')
  })

  it('renders em dash for empty fields and escapes HTML', () => {
    const html = buildRfiHtml('A & B', 'addr', 'P', 'paddr', form({ detailedDescription: '', submittedTo: '<x>' }))
    expect(html).toContain('A &amp; B')
    expect(html).toContain('The bid was submitted to &lt;x&gt;')
  })

  it('converts newlines in description to <br/>', () => {
    const html = buildRfiHtml('n', 'a', 'p', 'pa', form({ detailedDescription: 'line1\nline2' }))
    expect(html).toContain('line1<br/>line2')
  })

  it('matches the established output (parity snapshot)', () => {
    const html = buildRfiHtml('John Doe', '123 Main St, Austin, TX', 'Acme Tower', '456 Job Rd, Austin, TX', form())
    expect(html).toMatchInlineSnapshot(`"<div style="white-space: pre-wrap"><p style="margin: 0 0 0.5em 0"><strong>John Doe</strong><br/>123 Main St<br/>Austin, TX<br/><br/><strong>Acme Tower</strong><br/>456 Job Rd<br/>Austin, TX</p><p style="margin: 0 0 0.5em 0">&nbsp;</p><p style="margin: 0 0 0.5em 0">Bid was submitted: 2026-01-01<br/>The bid was submitted to General Contractor</p><p style="margin: 0 0 0.5em 0">&nbsp;</p><p style="margin: 0 0 0.5em 0">Response requested by 2026-01-08</p><p style="margin: 0 0 0.5em 0">&nbsp;</p><p style="margin: 0 0 0.5em 0"><strong>Question/Issue</strong></p><p style="margin: 0 0 0.5em 0">Need clarification on riser routing.</p><p style="margin: 0 0 0.5em 0">&nbsp;</p><p style="margin: 0 0 0.5em 0"><strong>Impact</strong></p><p style="margin: 0 0 0.5em 0">Affects rough-in schedule.</p><p style="margin: 0 0 0.5em 0">&nbsp;</p><p style="margin: 0 0 0.5em 0">From Click Plumbing<br/>Jane<br/>jane@example.com</p></div>"`)
  })
})

describe('buildRfiText', () => {
  it('includes the labeled question and impact sections as plain text', () => {
    const text = buildRfiText('John Doe', '123 Main St, Austin, TX', 'Acme Tower', '456 Job Rd, Austin, TX', form())
    expect(text).toContain('Question/Issue')
    expect(text).toContain('Need clarification on riser routing.')
    expect(text).toContain('Impact')
    expect(text).toContain('From Click Plumbing')
    expect(text).not.toContain('<br/>')
  })

  it('uses em dashes for empty fields and does not escape HTML', () => {
    const text = buildRfiText('A & B', 'addr', 'P', 'paddr', form({ detailedDescription: '', submittedTo: '<x>' }))
    expect(text).toContain('A & B')
    expect(text).toContain('The bid was submitted to <x>')
    expect(text).toContain('Question/Issue\n—')
  })

  it('matches the established output (parity snapshot)', () => {
    const text = buildRfiText('John Doe', '123 Main St, Austin, TX', 'Acme Tower', '456 Job Rd, Austin, TX', form())
    expect(text).toMatchInlineSnapshot(`
      "John Doe
      123 Main St
      Austin, TX

      Acme Tower
      456 Job Rd
      Austin, TX

      Bid was submitted: 2026-01-01
      The bid was submitted to General Contractor

      Response requested by 2026-01-08

      Question/Issue
      Need clarification on riser routing.

      Impact
      Affects rough-in schedule.

      From Click Plumbing
      Jane
      jane@example.com"
    `)
  })
})
