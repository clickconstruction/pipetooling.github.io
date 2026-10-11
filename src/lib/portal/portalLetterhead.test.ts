import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — tested here.
import { PORTAL_GC_LETTERHEAD, PORTAL_TAGLINE, portalLetterhead } from '../../../supabase/functions/_shared/portalLetterhead'
import { PORTAL_COMPANY } from '../../../supabase/functions/_shared/portalCompany'
import { GC_COMPANY } from '../gc/company'

const billingJob = { billing_only: true }
const plumbingJob = { billing_only: false }
const oldRow = {}

describe('the portal letterhead (v2.5229)', () => {
  it('reads Click Construction for a customer whose every job is a GC job we build', () => {
    expect(portalLetterhead({ audience: 'all', gcJobCount: 1, jobs: [billingJob] })).toBe(PORTAL_GC_LETTERHEAD)
    expect(portalLetterhead({ audience: 'customer', gcJobCount: 2, jobs: [billingJob, billingJob] })).toBe(PORTAL_GC_LETTERHEAD)
    // Before the first pay application there is no billing job yet.
    expect(portalLetterhead({ audience: 'all', gcJobCount: 1, jobs: [] })).toBe(PORTAL_GC_LETTERHEAD)
  })

  it('reads the plumbing company when the jobs are mixed, when there is no GC job, and on a GC’s own link', () => {
    const plumbing = { ...PORTAL_COMPANY, tagline: PORTAL_TAGLINE }
    expect(portalLetterhead({ audience: 'all', gcJobCount: 1, jobs: [billingJob, plumbingJob] })).toEqual(plumbing)
    expect(portalLetterhead({ audience: 'all', gcJobCount: 1, jobs: [billingJob, oldRow] })).toEqual(plumbing)
    expect(portalLetterhead({ audience: 'all', gcJobCount: 0, jobs: [plumbingJob] })).toEqual(plumbing)
    expect(portalLetterhead({ audience: 'all', gcJobCount: 0, jobs: [] })).toEqual(plumbing)
    expect(portalLetterhead({ audience: 'gc', gcJobCount: 1, jobs: [billingJob] })).toEqual(plumbing)
  })

  it('a sample passes its own plumbing block, and gets the tagline with it', () => {
    const own = { name: 'Sample Co', cityLine: 'c', licenseLine: 'l', phone: 'p', email: 'e' }
    expect(portalLetterhead({ audience: 'all', gcJobCount: 0, jobs: [] }, own)).toEqual({ ...own, tagline: PORTAL_TAGLINE })
    expect(portalLetterhead({ audience: 'customer', gcJobCount: 1, jobs: [billingJob] }, own)).toBe(PORTAL_GC_LETTERHEAD)
  })

  it('Click Construction’s block carries none of the plumbing company’s lines: its name, its line, the office phone', () => {
    expect(PORTAL_GC_LETTERHEAD.name).toBe(GC_COMPANY.name)
    expect(PORTAL_GC_LETTERHEAD.tagline).toBe('Construction')
    expect(PORTAL_GC_LETTERHEAD.cityLine).toBe('')
    expect(PORTAL_GC_LETTERHEAD.licenseLine).toBe('')
    expect(PORTAL_GC_LETTERHEAD.email).toBe('')
    expect(PORTAL_GC_LETTERHEAD.phone).toBe(PORTAL_COMPANY.phone)
  })
})
