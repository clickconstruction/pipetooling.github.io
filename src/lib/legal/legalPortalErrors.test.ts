/**
 * Punch list #85, item 7: a raw Postgres error never reaches the firm's browser; the words the
 * functions write for the firm still do.
 */
import { describe, expect, it, vi } from 'vitest'
import { LEGAL_PORTAL_FIRM_WRITTEN_5XX, LEGAL_PORTAL_GENERIC_ERROR, errorRefOf, firmFacingErrorLine, firmFacingErrorMessage, unexpectedErrorBody } from './legalPortalErrors'

describe('firmFacingErrorMessage', () => {
  it('keeps the 4xx sentences written for the firm', () => {
    expect(firmFacingErrorMessage(404, 'This link is no longer active. Please contact the office for a new one.')).toBe('This link is no longer active. Please contact the office for a new one.')
    expect(firmFacingErrorMessage(403, 'That matter is not with your firm.')).toBe('That matter is not with your firm.')
    expect(firmFacingErrorMessage(429, 'Too many changes in the last hour. Please try again later.')).toBe('Too many changes in the last hour. Please try again later.')
    expect(firmFacingErrorMessage(400, 'Enter an amount.')).toBe('Enter an amount.')
  })

  it('turns a raw database error on a 500 into the generic sentence', () => {
    const raw = 'column jobs_ledger.lien_retainage_held does not exist'
    expect(firmFacingErrorMessage(500, raw)).toBe(LEGAL_PORTAL_GENERIC_ERROR)
    expect(firmFacingErrorMessage(500, 'relation "public.legal_matter_entries" does not exist')).toBe(LEGAL_PORTAL_GENERIC_ERROR)
    expect(firmFacingErrorMessage(502, 'Bad gateway')).toBe(LEGAL_PORTAL_GENERIC_ERROR)
  })

  it('keeps the 5xx sentences the functions write themselves', () => {
    for (const s of LEGAL_PORTAL_FIRM_WRITTEN_5XX) expect(firmFacingErrorMessage(500, s)).toBe(s)
  })

  it('answers the generic sentence when there is no message at all', () => {
    expect(firmFacingErrorMessage(500, undefined)).toBe(LEGAL_PORTAL_GENERIC_ERROR)
    expect(firmFacingErrorMessage(404, '   ')).toBe(LEGAL_PORTAL_GENERIC_ERROR)
    expect(firmFacingErrorMessage(400, { message: 'x' })).toBe(LEGAL_PORTAL_GENERIC_ERROR)
  })

  it('says nothing of tables, columns or SQL in the generic sentence', () => {
    expect(LEGAL_PORTAL_GENERIC_ERROR).not.toMatch(/column|relation|table|sql|postgres|supabase/i)
  })
})

describe('unexpectedErrorBody', () => {
  it('logs the real error with a reference and answers with the generic sentence', () => {
    const log = vi.fn()
    const err = new Error('permission denied for table legal_portal_links')
    expect(unexpectedErrorBody('legal-portal', err, log, () => 'AB12CD34')).toEqual({ error: LEGAL_PORTAL_GENERIC_ERROR, ref: 'AB12CD34' })
    expect(log).toHaveBeenCalledWith('legal-portal: unexpected error (ref AB12CD34)', err)
  })

  it('mints a short reference of letters and digits by default', () => {
    const { ref } = unexpectedErrorBody('submit-legal-portal', new Error('x'), () => {})
    expect(ref).toMatch(/^[A-Z0-9]{8}$/)
  })
})

describe('firmFacingErrorLine', () => {
  it('adds the reference after an unexpected failure', () => {
    expect(firmFacingErrorLine(500, { error: 'syntax error at or near "from"', ref: 'AB12CD34' })).toBe(`${LEGAL_PORTAL_GENERIC_ERROR} Reference AB12CD34.`)
  })

  it('prints no reference on a 4xx, and none that is not letters and digits', () => {
    expect(firmFacingErrorLine(404, { error: 'This link is no longer active. Please contact the office.', ref: 'AB12CD34' })).toBe('This link is no longer active. Please contact the office.')
    expect(firmFacingErrorLine(500, { error: 'x', ref: '<b>hi</b>' })).toBe(LEGAL_PORTAL_GENERIC_ERROR)
    expect(errorRefOf(null)).toBeNull()
  })
})
