import { describe, expect, it } from 'vitest'
import { buildHazmatFeeMemo, extractHazmatClause } from './hazmatFee'

const TERMS = `Click Plumbing and Electrical Terms & Conditions

10. Severability

If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

11. Biohazard / Hazmat Exposure Fee

Customer is responsible for maintaining safe and sanitary access to all work areas. Customer shall pay a biohazard remediation fee of five hundred dollars ($500) per incident.

Click Plumbing and Electrical
5501 Balcones Dr, Ste A-141`

describe('extractHazmatClause', () => {
  it('pulls §11 from the heading to the company block', () => {
    const clause = extractHazmatClause(TERMS)
    expect(clause).toContain('11. Biohazard / Hazmat Exposure Fee')
    expect(clause).toContain('five hundred dollars ($500)')
    expect(clause).not.toContain('Click Plumbing and Electrical\n5501')
    expect(clause).not.toContain('Severability')
  })

  it('stops at a following numbered section', () => {
    const withNext = TERMS.replace(
      '\nClick Plumbing and Electrical\n5501 Balcones Dr, Ste A-141',
      '\n12. Another Section\n\nMore text.',
    )
    const clause = extractHazmatClause(withNext)
    expect(clause).toContain('$500')
    expect(clause).not.toContain('Another Section')
  })

  it('returns null when the clause is missing', () => {
    expect(extractHazmatClause('1. Payment Terms\n\nPay now.')).toBeNull()
    expect(extractHazmatClause('')).toBeNull()
  })
})

describe('buildHazmatFeeMemo', () => {
  it('matches the RPC memo shape', () => {
    expect(buildHazmatFeeMemo('07/20/2026')).toBe('Hazmat remediation fee — incident 07/20/2026')
  })
})
