import { describe, expect, it } from 'vitest'
import { buildLeanJobNumberOr, buildLeanJobSearchOr, sanitizeLeanSearchTerm } from './leanJobSearch'

describe('sanitizeLeanSearchTerm', () => {
  it('strips PostgREST breakers and squeezes whitespace', () => {
    expect(sanitizeLeanSearchTerm('  Frantzen, (Water) "Heater" *  ')).toBe('Frantzen Water Heater')
    expect(sanitizeLeanSearchTerm('plain')).toBe('plain')
  })
})

describe('buildLeanJobSearchOr', () => {
  it('covers the five flat columns with contains patterns', () => {
    const or = buildLeanJobSearchOr('tovi')
    expect(or).toBe(
      'hcp_number.ilike.*tovi*,click_number.ilike.*tovi*,job_name.ilike.*tovi*,job_address.ilike.*tovi*,customer_name.ilike.*tovi*',
    )
  })

  it('sanitized input cannot smuggle extra clauses', () => {
    const or = buildLeanJobSearchOr('a,status.eq.paid')
    expect(or.includes(',status.eq.paid')).toBe(false)
    expect(or).toContain('*a status.eq.paid*')
  })
})

describe('buildLeanJobNumberOr', () => {
  it('prefix-matches both number columns, digits only', () => {
    expect(buildLeanJobNumberOr(' 56x1 ')).toBe('hcp_number.ilike.561*,click_number.ilike.561*')
  })
})
