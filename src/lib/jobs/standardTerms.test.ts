import { describe, expect, it } from 'vitest'
import { standardTermsLabel, standardTermsReachLine, standardTermsSaveBlocker } from './standardTerms'

describe('standardTermsLabel', () => {
  it('names the Book document and its version; the built-in wording has none', () => {
    expect(standardTermsLabel({ document_name: 'Service agreement', book_version_date: '2026-09-20' })).toBe('Service agreement · v. Sep 20')
    expect(standardTermsLabel({ document_name: 'Service agreement', book_version_date: null })).toBe('Service agreement')
    expect(standardTermsLabel(null)).toBe('Built-in service agreement terms')
  })
})

describe('standardTermsReachLine', () => {
  it('says how far the edit reaches, and what it never touches', () => {
    expect(standardTermsReachLine(105)).toContain('all 105 jobs still waiting')
    expect(standardTermsReachLine(1)).toContain('the 1 job still waiting')
    expect(standardTermsReachLine(3)).toContain('already sent or signed keep the wording')
    expect(standardTermsReachLine(0)).toContain("not only this job's")
    expect(standardTermsReachLine(0)).not.toContain('sweep')
  })
})

describe('standardTermsSaveBlocker', () => {
  const base = { name: 'Service agreement', body: 'new', originalBody: 'old', originalName: 'Service agreement' }
  it('lets a real change through', () => {
    expect(standardTermsSaveBlocker(base)).toBeNull()
    expect(standardTermsSaveBlocker({ ...base, body: 'old', name: 'Residential agreement' })).toBeNull()
  })
  it('refuses a blank name, blank terms, or no change', () => {
    expect(standardTermsSaveBlocker({ ...base, name: ' ' })).toMatch(/name/)
    expect(standardTermsSaveBlocker({ ...base, body: '  ' })).toMatch(/blank/)
    expect(standardTermsSaveBlocker({ ...base, body: 'old' })).toMatch(/Nothing changed/)
  })
})
