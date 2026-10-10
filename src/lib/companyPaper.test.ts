import { describe, expect, it } from 'vitest'
import { COMPANY_PAPER_PREFIX, companyIdFromPaperName, companyPaperName, isCompanyPaperName, paperForName } from '../../supabase/functions/_shared/companyPaper'

const id = 'ff11d0fb-269e-44de-b92a-e7256c180f67'

describe('a company’s papers under a name no person can have (GC mode, B6-b-i)', () => {
  it('the prefix is the database’s: person_contract_documents_company_paper holds the same words', () => {
    // A change here changes every company's stored name and the CHECK that holds it: a migration, not an edit.
    expect(COMPANY_PAPER_PREFIX).toBe('gc-company:')
    expect(companyPaperName(id)).toBe(`gc-company:${id}`)
  })

  it('reads a company back from its stored name, and nothing from a person’s', () => {
    expect(companyIdFromPaperName(companyPaperName(id))).toBe(id)
    expect(isCompanyPaperName(companyPaperName(id))).toBe(true)
    expect(companyIdFromPaperName('Dana Ruiz')).toBeNull()
    expect(isCompanyPaperName('Dana Ruiz')).toBe(false)
    expect(isCompanyPaperName(null)).toBe(false)
    // A stored name that is not well formed names no company (the database refuses it anyway).
    expect(companyIdFromPaperName('gc-company:not-a-uuid')).toBeNull()
  })

  it('says who a paper is for: the person, or the company by its name', () => {
    expect(paperForName('Dana Ruiz', 'Lonestar Earthworks')).toBe('Dana Ruiz')
    expect(paperForName(companyPaperName(id), 'GC test trade company, delete me')).toBe('GC test trade company, delete me')
    expect(paperForName(companyPaperName(id), null)).toBe('a trade partner company')
    expect(paperForName(companyPaperName(id), '  ')).toBe('a trade partner company')
  })
})
