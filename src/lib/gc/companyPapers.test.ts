import { describe, expect, it } from 'vitest'
import { companyPapers, type CompanyPaperRow } from './companyPapers'

const CO = 'co-1'
const paper = (over: Partial<CompanyPaperRow>): CompanyPaperRow => ({
  id: over.id ?? `p-${Math.random().toString(36).slice(2)}`,
  company_id: CO,
  doc_type: 'agreement',
  status: 'unsent',
  sent_at: null,
  signed_at: null,
  expires_at: null,
  created_at: '2026-10-01T15:00:00Z',
  ...over,
})

describe('companyPapers', () => {
  it('reads none of the four papers for a company with no papers', () => {
    expect(companyPapers([], CO)).toEqual({ msa: 'none', msaSignedOn: null, w9: false, coiExpires: null })
  })

  it('reads a master agreement made but not sent as none', () => {
    expect(companyPapers([paper({ status: 'unsent' })], CO).msa).toBe('none')
  })

  it('reads an agreement out to sign as sent, with the day it went in the app’s day, not UTC’s', () => {
    // 02:00 UTC on Oct 6 is the evening of Oct 5 in Texas.
    expect(companyPapers([paper({ status: 'sent', sent_at: '2026-10-06T02:00:00Z' })], CO)).toEqual({ msa: 'sent', msaSignedOn: null, msaSentOn: '2026-10-05', w9: false, coiExpires: null })
  })

  it('reads a signed agreement as signed on its newest day, as the msaFirst gate does', () => {
    const papers = [
      paper({ id: 'old', status: 'signed', sent_at: '2026-09-01T15:00:00Z', signed_at: '2026-09-03' }),
      paper({ id: 'new', status: 'signed', sent_at: '2026-10-01T15:00:00Z', signed_at: '2026-10-02' }),
      paper({ id: 'out', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }),
    ]
    expect(companyPapers(papers, CO)).toMatchObject({ msa: 'signed', msaSignedOn: '2026-10-02', msaSentOn: '2026-10-08' })
  })

  it('keys the master agreement to its doc_type, never its name, and never to another paper', () => {
    expect(companyPapers([paper({ doc_type: 'other', status: 'signed', signed_at: '2026-10-02' }), paper({ doc_type: 'license', status: 'signed', signed_at: '2026-10-02' })], CO).msa).toBe('none')
  })

  it('reads a signed W-9 only', () => {
    expect(companyPapers([paper({ doc_type: 'w9', status: 'sent' })], CO).w9).toBe(false)
    expect(companyPapers([paper({ doc_type: 'w9', status: 'signed', signed_at: '2026-10-02' })], CO).w9).toBe(true)
  })

  it('reads the newest filed certificate’s last day, even when an older one runs longer', () => {
    const papers = [
      paper({ doc_type: 'coi', status: 'signed', signed_at: '2026-01-10', expires_at: '2027-01-10' }),
      paper({ doc_type: 'coi', status: 'signed', signed_at: '2026-10-01', expires_at: '2026-12-31' }),
      paper({ doc_type: 'coi', status: 'sent', expires_at: '2028-01-01' }),
    ]
    expect(companyPapers(papers, CO).coiExpires).toBe('2026-12-31')
  })

  it('never reads another company’s paper or a person’s', () => {
    const papers = [
      paper({ company_id: 'co-2', status: 'signed', signed_at: '2026-10-02' }),
      paper({ company_id: null, doc_type: 'w9', status: 'signed', signed_at: '2026-10-02' }),
      paper({ company_id: 'co-2', doc_type: 'coi', status: 'signed', signed_at: '2026-10-02', expires_at: '2027-01-01' }),
    ]
    expect(companyPapers(papers, CO)).toEqual({ msa: 'none', msaSignedOn: null, w9: false, coiExpires: null })
  })
})
