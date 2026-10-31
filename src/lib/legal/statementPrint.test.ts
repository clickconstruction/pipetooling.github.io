import { describe, expect, it } from 'vitest'
import { DECLARANT_BLANK, type StatementDraft } from './affidavitPaper'
import { printNeedsDeclarant, statementPdfFilename, statementPrintFooter, statementPrintHtml, statementPrintRecordText } from './statementPrint'

const alvarez = { kind: 'team' as const, userId: 'u-da', name: 'Daniel Alvarez', role: 'RMP of record' }
const draft: StatementDraft = { title: 'Affidavit of Daniel Alvarez', affiant: alvarez, incidentOn: '2026-09-03', incidentTo: '', form: 'notary', venueCounty: 'Guadalupe', body: 'Northline never called us back.\nI drove past the site.' }
const declaration: StatementDraft = { ...draft, title: 'Declaration of Thanh Nguyen', affiant: { kind: 'witness', userId: null, name: 'Thanh Nguyen', role: 'the foreman' }, form: 'declaration', venueCounty: 'Williamson' }
const details = { ...DECLARANT_BLANK, firstName: 'Thanh', lastName: 'Nguyen', dateOfBirth: '1988-03-14', street: '1400 Example Rd', city: 'Round Rock', zip: '78664' }

describe('the printed statement (punch list #220, v2.6211)', () => {
  it('a declaration waits on the declarant for the whole paper and the signing page, never for the statement alone or a notary', () => {
    expect(printNeedsDeclarant('declaration', 'whole', null)).toBe(true)
    expect(printNeedsDeclarant('declaration', 'signing', { ...DECLARANT_BLANK, firstName: 'T' })).toBe(true)
    expect(printNeedsDeclarant('declaration', 'whole', details)).toBe(false)
    expect(printNeedsDeclarant('declaration', 'statement', null)).toBe(false)
    expect(printNeedsDeclarant('notary', 'whole', null)).toBe(false)
  })
  it('the page is a light document with the title, the paragraphs, the jurat and the footer', () => {
    const html = statementPrintHtml({ draft, face: 'whole', declarant: null, accountWords: 'Northline Builders · job 742' })
    expect(html.startsWith('<!doctype html><html data-theme="light">')).toBe(true)
    expect(html).toContain('<title>Affidavit of Daniel Alvarez</title>')
    expect(html).toContain('1. My name is Daniel Alvarez.')
    expect(html).toContain('3. I drove past the site.')
    expect(html).toContain('SWORN TO AND SUBSCRIBED BEFORE ME')
    expect(html).toContain('COUNTY OF GUADALUPE')
    expect(html).toContain('Affidavit of Daniel Alvarez · Northline Builders · job 742')
    const signing = statementPrintHtml({ draft, face: 'signing', declarant: null, accountWords: '' })
    expect(signing).toContain('<title>Jurat · Affidavit of Daniel Alvarez</title>')
    expect(signing).not.toContain('My name is')
    const decl = statementPrintHtml({ draft: declaration, face: 'whole', declarant: details, accountWords: '' })
    expect(decl).toContain('my date of birth is March 14, 1988')
    expect(decl).not.toContain('Notary Public')
  })
  it('the footer, the PDF name and the record text follow the face', () => {
    expect(statementPrintFooter(draft, 'statement', 'Northline Builders')).toBe('Affidavit of Daniel Alvarez · the statement alone · Northline Builders')
    expect(statementPrintFooter(draft, 'whole', '')).toBe('Affidavit of Daniel Alvarez')
    expect(statementPdfFilename(draft, 'whole')).toBe('affidavit-of-daniel-alvarez.pdf')
    expect(statementPdfFilename(declaration, 'signing')).toBe('declaration-declaration-of-thanh-nguyen.pdf')
    expect(statementPdfFilename({ title: '', form: 'notary' }, 'whole')).toBe('affidavit.pdf')
    expect(statementPrintRecordText(draft, 'whole').split('\n')).toHaveLength(3)
    expect(statementPrintRecordText(draft, 'statement')).toBe(statementPrintRecordText(draft, 'whole'))
    expect(statementPrintRecordText(draft, 'signing')).toBe('This jurat is attached to the handwritten statement of Daniel Alvarez, _____ pages, each initialed by the signer.')
  })
})
