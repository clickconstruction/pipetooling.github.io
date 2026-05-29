import { describe, expect, it } from 'vitest'
import {
  buildCoverLetterHtml,
  buildCoverLetterText,
  numberToWords,
  serviceTypeWordForCoverLetter,
  DEFAULT_EXCLUSIONS,
  DEFAULT_TERMS_AND_WARRANTY,
} from './coverLetter'

const FIXTURES = [
  { fixture: 'Water Closet', count: 3 },
  { fixture: 'Lavatory', count: 2 },
]

function html(opts: { includeSignature?: boolean; includeFixturesPerPlan?: boolean } = {}) {
  return buildCoverLetterHtml(
    'John Doe',
    '123 Main St, Austin, TX 78701',
    'Acme Tower',
    '456 Job Rd, Austin, TX 78702',
    'One Hundred 00/100 Dollars',
    '$100.00',
    FIXTURES,
    '',
    '',
    '',
    null,
    'Plumbing',
    opts.includeSignature ?? true,
    opts.includeFixturesPerPlan ?? true,
  )
}

describe('numberToWords', () => {
  it('formats whole and cents', () => {
    expect(numberToWords(31420.5)).toBe('Thirty One Thousand Four Hundred Twenty 50/100 Dollars')
    expect(numberToWords(0)).toBe('Zero 00/100 Dollars')
    expect(numberToWords(1)).toBe('One 00/100 Dollars')
  })
})

describe('serviceTypeWordForCoverLetter', () => {
  it('maps known trades and defaults to plumbing', () => {
    expect(serviceTypeWordForCoverLetter('Electrical')).toBe('electrical')
    expect(serviceTypeWordForCoverLetter('HVAC')).toBe('HVAC')
    expect(serviceTypeWordForCoverLetter('Plumbing')).toBe('plumbing')
    expect(serviceTypeWordForCoverLetter('')).toBe('plumbing')
  })
})

describe('buildCoverLetterHtml', () => {
  it('bolds the proposed amount and includes the signature block by default', () => {
    const out = html()
    expect(out).toContain('<strong>One Hundred 00/100 Dollars ($100.00)</strong>')
    expect(out).toContain('Acceptance of estimate')
  })

  it('omits the signature block when includeSignature is false', () => {
    const out = html({ includeSignature: false })
    expect(out).not.toContain('Acceptance of estimate')
  })

  it('omits the fixtures-per-plan line when includeFixturesPerPlan is false', () => {
    const out = html({ includeFixturesPerPlan: false })
    expect(out).not.toContain('Fixtures provided and installed by us per plan')
  })

  it('falls back to default exclusions and terms when none provided', () => {
    const out = html()
    expect(out).toContain('Concrete cutting')
    expect(out).toContain('workmanlike manner')
  })

  it('matches the established output (parity snapshot)', () => {
    expect(html()).toMatchInlineSnapshot(`"<p style="margin:0;line-height:1;white-space:pre-wrap"><strong>John Doe</strong><br/>123 Main St<br/>Austin, TX 78701<br/><br/><strong>Acme Tower</strong><br/>456 Job Rd<br/>Austin, TX 78702<br/><br/>As per plumbing plans and specifications, we propose to do the plumbing in the amount of: <strong>One Hundred 00/100 Dollars ($100.00)</strong><br/><br/><strong>Inclusions:</strong><br/>     • Fixtures provided and installed by us per plan:<br/>            • [3] Water Closet<br/>            • [2] Lavatory<br/><br/><strong>Exclusions and Scope:</strong><br/>     • Concrete cutting, removal, and/or pour back is excluded from this proposal.<br/>     • This proposal excludes all impact fees.<br/>     • This proposal excludes any work not specifically described within.<br/>     • This proposal excludes any electrical, fire protection, fire alarm, drywall, framing, or architectural finishes of any type.<br/><br/>All work to be completed in a workmanlike manner in accordance with uniform code and/or specifications; workmanship warranty of one year for new construction projects considering substantial completion date. All material is guaranteed to be as specified; warranty by manufacturer, labor not included. No liability, no warranty on customer provided materials. All agreements contingent upon strikes, accidents or delays beyond our control. This estimate is subject to acceptance within thirty (30) days and is void thereafter at the option of Click Plumbing and Electrical. Any alteration or deviation from above specifications involving extra cost, including rock excavation and removal or haul-off of spoils or debris will become an extra charge over and above the estimate. Anything outside the scope of work described in this estimate, including any additional trips or visits beyond the standard rough-in, top-out, and trim phases, will be charged as a change order and will include a trip charge. Additionally, any trips or delays caused by builder, general contractor error, scheduling issues, or failure to provide timely access will be charged as a trip charge.<br/><br/>No work shall commence until Click Plumbing and Electrical has received acceptance of the estimate.<br/>Respectfully submitted by Click Plumbing and Electrical<br/><br/>_______________________________<br/>The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.<br/><br/><strong>Acceptance of estimate</strong><br/>General Contractor / Builder Signature:<br/><br/>____________________________________<br/><br/>Date: ____________________________________</p>"`)
  })
})

describe('buildCoverLetterText', () => {
  it('matches the established output (parity snapshot)', () => {
    const out = buildCoverLetterText(
      'John Doe',
      '123 Main St, Austin, TX 78701',
      'Acme Tower',
      '456 Job Rd, Austin, TX 78702',
      'One Hundred 00/100 Dollars',
      '$100.00',
      FIXTURES,
      '',
      '',
      '',
      null,
      'Plumbing',
      true,
      true,
    )
    expect(out).toMatchInlineSnapshot(`
      "John Doe
      123 Main St
      Austin, TX 78701

      Acme Tower
      456 Job Rd
      Austin, TX 78702

      As per plumbing plans and specifications, we propose to do the plumbing in the amount of: One Hundred 00/100 Dollars ($100.00)

      Inclusions:
           • Fixtures provided and installed by us per plan:
                  • [3] Water Closet
                  • [2] Lavatory

      Exclusions and Scope:
           • Concrete cutting, removal, and/or pour back is excluded from this proposal.
           • This proposal excludes all impact fees.
           • This proposal excludes any work not specifically described within.
           • This proposal excludes any electrical, fire protection, fire alarm, drywall, framing, or architectural finishes of any type.

      All work to be completed in a workmanlike manner in accordance with uniform code and/or specifications; workmanship warranty of one year for new construction projects considering substantial completion date. All material is guaranteed to be as specified; warranty by manufacturer, labor not included. No liability, no warranty on customer provided materials. All agreements contingent upon strikes, accidents or delays beyond our control. This estimate is subject to acceptance within thirty (30) days and is void thereafter at the option of Click Plumbing and Electrical. Any alteration or deviation from above specifications involving extra cost, including rock excavation and removal or haul-off of spoils or debris will become an extra charge over and above the estimate. Anything outside the scope of work described in this estimate, including any additional trips or visits beyond the standard rough-in, top-out, and trim phases, will be charged as a change order and will include a trip charge. Additionally, any trips or delays caused by builder, general contractor error, scheduling issues, or failure to provide timely access will be charged as a trip charge.

      No work shall commence until Click Plumbing and Electrical has received acceptance of the estimate.
      Respectfully submitted by Click Plumbing and Electrical

      _______________________________
      The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to perform the work as specified.

      Acceptance of estimate
      General Contractor / Builder Signature:

      ____________________________________

      Date: ____________________________________"
    `)
  })
})

describe('default constants are non-empty', () => {
  it('exports defaults', () => {
    expect(DEFAULT_EXCLUSIONS.length).toBeGreaterThan(0)
    expect(DEFAULT_TERMS_AND_WARRANTY.length).toBeGreaterThan(0)
  })
})
