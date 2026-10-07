/**
 * v2.4730 (punch list #50): every contract text a customer can sign charges interest on the same
 * clock — 45 days from the invoice date (Texas Property Code ch. 28), the owner's and the attorney's
 * call of 2026-10-06. The job agreement used to say 30 days after the due date.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN } from '../jobs/jobContractDocument'
import { WEBSITE_TERMS_TEXT } from './websiteTerms'

describe('interest clauses agree (v2.4730)', () => {
  it('the built-in job agreement and the website terms both count 45 days from the invoice date', () => {
    expect(DEFAULT_JOB_CONTRACT_TERMS_PLAIN).toContain('45 days from the invoice date')
    expect(WEBSITE_TERMS_TEXT).toContain('45 days from the invoice date')
  })

  it('neither text counts interest from the due date', () => {
    expect(DEFAULT_JOB_CONTRACT_TERMS_PLAIN).not.toMatch(/30 days after the due date/)
    expect(WEBSITE_TERMS_TEXT).not.toMatch(/days after the due date/)
  })
})
