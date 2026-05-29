import { describe, expect, it } from 'vitest'
import { buildChangeOrderHtml, buildChangeOrderText, type ChangeOrderFormData } from './changeOrder'

function form(p: Partial<ChangeOrderFormData> = {}): ChangeOrderFormData {
  return {
    bidSubmittedDate: p.bidSubmittedDate ?? '2026-01-01',
    submittedTo: p.submittedTo ?? 'General Contractor',
    companyName: p.companyName ?? 'Click Plumbing',
    contactPerson: p.contactPerson ?? 'Jane',
    phoneEmail: p.phoneEmail ?? 'jane@example.com',
    responseRequestDate: p.responseRequestDate ?? '2026-01-08',
    detailedDescriptionOfChange: p.detailedDescriptionOfChange ?? 'Reroute the 3in waste line around the new beam.',
    reasonForChange: p.reasonForChange ?? 'Structural beam added after bid.',
    impactOnCost: p.impactOnCost ?? '+$1,200',
    impactOnSchedule: p.impactOnSchedule ?? '+2 days',
  }
}

describe('buildChangeOrderHtml', () => {
  it('includes all four labeled sections', () => {
    const html = buildChangeOrderHtml('John Doe', '123 Main St, Austin, TX', 'Acme Tower', '456 Job Rd, Austin, TX', form())
    expect(html).toContain('<strong>Detailed Description of the Change</strong>')
    expect(html).toContain('<strong>Reason for the Change</strong>')
    expect(html).toContain('<strong>Impact on Cost (Contract Sum Adjustment)</strong>')
    expect(html).toContain('<strong>Impact on Schedule (Contract Time Adjustment)</strong>')
  })

  it('escapes HTML and converts newlines to <br/>', () => {
    const html = buildChangeOrderHtml('A & B', 'addr', 'P <x>', 'paddr', form({ detailedDescriptionOfChange: 'line1\nline2' }))
    expect(html).toContain('A &amp; B')
    expect(html).toContain('P &lt;x&gt;')
    expect(html).toContain('line1<br/>line2')
  })

  it('renders em dashes for empty required fields', () => {
    const html = buildChangeOrderHtml('n', 'a', 'p', 'pa', form({ detailedDescriptionOfChange: '', reasonForChange: '' }))
    // empty description/reason collapse to the literal em dash placeholder
    expect(html).toContain('<p style="margin: 0 0 0.5em 0">—</p>')
  })
})

describe('buildChangeOrderText', () => {
  it('produces a plain-text document with unescaped content', () => {
    const text = buildChangeOrderText('A & B', '123 Main St, Austin, TX', 'Acme Tower', '456 Job Rd, Austin, TX', form())
    expect(text).toContain('A & B')
    expect(text).toContain('Detailed Description of the Change')
    expect(text).toContain('Reroute the 3in waste line around the new beam.')
    expect(text).not.toContain('<br/>')
  })
})
