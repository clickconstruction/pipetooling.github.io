import { describe, expect, it } from 'vitest'
import { filingDocHtml, filingDocText } from '../jobsDocuments/lienFilingDocuments'
import { JURAT_COURTESY_LINES, JURAT_NOTARY_TITLE, JURAT_STATE_LINE, juratCountyLine, juratSentence } from './juratWords'
import {
  DECLARANT_BLANK, DECLARATION_PERJURY_SENTENCE, DECLARATION_STATUTE_FORM, FORM_HELP_WORDS, OFFICE_COUNTY_DEFAULT, SIGNED_ON_LINE, STATEMENT_DRAFT_AMBER_DAYS,
  attachedToLine, declarantProblem, lastPrintWords, statementFilingProblem, statementFilingShows, declarationJurat, defaultStatementForm, defaultVenueCounty, incidentSpanWords, isStatementEntry, printCountWords, recordCheckHeading, recordCheckLines,
  statementByWords, statementChipWords, statementDraftProblem, statementFirmKindWords, statementHoldKey, statementKindWords, statementMetaOf, statementOpener, statementPaperBlocks, statementParagraphs,
  signatureRoleLine, statementPrintTitle, statementPrintedText, statementShowsLine, statementSignedWords, statementStateWords, suggestedStatementTitle, venueChoices,
  type StatementDraft, type StatementMeta,
} from './affidavitPaper'
import { plainWordsFailures } from '../plainWords'

const TODAY = '2026-10-30'
const alvarez = { kind: 'team' as const, userId: 'u-da', name: 'Daniel Alvarez', role: 'Responsible Master Plumber of record for Click Plumbing and Electrical, License No. M-00000' }
const nguyen = { kind: 'witness' as const, userId: null, name: 'Thanh Nguyen', role: 'the foreman for Brightline Electric, the electrical subcontractor on the job' }
const draft: StatementDraft = {
  title: 'Affidavit of Daniel Alvarez', affiant: alvarez, incidentOn: '2026-09-03', incidentTo: '2026-09-17', form: 'notary', venueCounty: 'Guadalupe',
  body: 'I am the Responsible Master Plumber of record. I was the plumber in charge of the rough-in at Quick Lube.\n3. On September 3, 2026, at about 7:40 in the morning, I was on the site with two of my crew.\n\nNorthline never called us back.',
}
const meta = (over: Partial<Record<string, unknown>> = {}) => statementMetaOf({ title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', user_id: 'u-da', name: 'Daniel Alvarez', role: alvarez.role }, form: 'notary', incident_to: '2026-09-17', venue_county: 'Guadalupe', state: 'draft', prints: [], signed_on: null, hand_changed: false, document_id: null, source: 'office', ...over })
const dayOf = (iso: string) => iso.slice(0, 10)

describe('the statute words, character for character', () => {
  it('the jurat is the Secretary of State’s form with the day and the month left for the notary', () => {
    expect(JURAT_STATE_LINE).toBe('STATE OF TEXAS')
    expect(juratCountyLine('Guadalupe')).toBe('COUNTY OF GUADALUPE')
    expect(juratCountyLine('')).toBe('COUNTY OF ___________')
    expect(juratSentence('Daniel Alvarez')).toBe('SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by Daniel Alvarez.')
    expect(juratSentence('')).toBe('SWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by _______________.')
    expect(JURAT_NOTARY_TITLE).toBe('Notary Public, State of Texas')
    expect(JURAT_COURTESY_LINES).toEqual(['Printed name: ______________________________', 'My commission expires: ______________________'])
  })
  it('the declaration’s jurat is § 132.001(d) whole', () => {
    expect(DECLARATION_STATUTE_FORM).toBe(
      'My name is __________ (First) __________ (Middle) __________ (Last), my date of birth is __________, and my address is __________ (Street), __________ (City), __________ (State), __________ (Zip Code), and __________ (Country). I declare under penalty of perjury that the foregoing is true and correct. Executed in __________ County, State of __________, on the ______ day of __________ (Month), __________ (Year).',
    )
    expect(DECLARATION_PERJURY_SENTENCE).toBe('I declare under penalty of perjury that the foregoing is true and correct.')
    expect(DECLARATION_STATUTE_FORM).toContain(DECLARATION_PERJURY_SENTENCE)
  })
  it('the lien affidavit and the Legal desk’s affidavit print one jurat', () => {
    const lien = filingDocText([{ kind: 'notarial', who: 'Malachi Click' }])
    expect(lien).toBe(`STATE OF TEXAS\nCOUNTY OF ___________\n\n${juratSentence('Malachi Click')}\n\n________________________________\nNotary Public, State of Texas`)
    const desk = filingDocText([{ kind: 'notarial', who: 'Daniel Alvarez', county: 'Guadalupe', courtesy: true }])
    expect(desk).toBe(`STATE OF TEXAS\nCOUNTY OF GUADALUPE\n\n${juratSentence('Daniel Alvarez')}\n\n________________________________\nNotary Public, State of Texas\n\nPrinted name: ______________________________\nMy commission expires: ______________________`)
    const html = filingDocHtml([{ kind: 'notarial', who: 'Daniel Alvarez', county: '', courtesy: true }])
    expect(html).toContain('COUNTY OF ___________')
    // v2.6249: no seal caption; the room above the signature stays blank for the notary's seal.
    expect(html).not.toContain('Seal')
    expect(html).toContain('margin:3.6em 0 0')
    expect(html).toContain('by Daniel Alvarez.')
    // The lien's block never grew the courtesy lines or a county.
    expect(filingDocHtml([{ kind: 'notarial', who: 'Malachi Click' }])).not.toContain('Printed name')
  })
})

describe('the opener and the paragraphs', () => {
  it('one of our team opens with their name and their oath to the facts; the noun follows the form', () => {
    expect(statementOpener(alvarez, 'notary')).toBe('My name is Daniel Alvarez. I am over eighteen years of age, of sound mind, and capable of making this affidavit. The facts stated in it are within my personal knowledge and are true and correct.')
    expect(statementOpener(alvarez, 'declaration')).toContain('capable of making this declaration.')
  })
  it('a witness says who they are and that they have no stake', () => {
    expect(statementOpener(nguyen, 'declaration')).toBe('My name is Thanh Nguyen. I am over eighteen years of age, of sound mind, and capable of making this declaration. I am the foreman for Brightline Electric, the electrical subcontractor on the job. I have no interest in the outcome of this dispute. The facts stated here are within my personal knowledge and are true and correct.')
    expect(statementOpener({ ...nguyen, role: '' }, 'notary')).not.toContain(' I am .')
  })
  it('the body splits on line breaks and drops a number the writer typed', () => {
    expect(statementParagraphs(draft.body)).toEqual(['I am the Responsible Master Plumber of record. I was the plumber in charge of the rough-in at Quick Lube.', 'On September 3, 2026, at about 7:40 in the morning, I was on the site with two of my crew.', 'Northline never called us back.'])
    expect(statementPrintedText(draft).split('\n')[0]).toMatch(/^1\. My name is Daniel Alvarez\./)
    expect(statementPrintedText(draft).split('\n')[3]).toBe('4. Northline never called us back.')
  })
  it('the suggested title and the by-line follow the affiant and the form', () => {
    expect(suggestedStatementTitle(alvarez, 'notary')).toBe('Affidavit of Daniel Alvarez')
    expect(suggestedStatementTitle(nguyen, 'declaration')).toBe('Declaration of Thanh Nguyen')
    expect(suggestedStatementTitle({ ...nguyen, name: ' ' }, 'notary')).toBe('')
    expect(statementByWords(alvarez)).toBe('Daniel Alvarez · team')
    expect(statementByWords(nguyen)).toBe('Thanh Nguyen · witness')
  })
})

describe('the three faces under each form', () => {
  const texts = (d: StatementDraft, face: 'whole' | 'statement' | 'signing', declarant = null as Parameters<typeof statementPaperBlocks>[0]['declarant']) => filingDocText(statementPaperBlocks({ draft: d, face, declarant }))

  it('before a notary, the whole paper: the title, the venue caption, the numbered paragraphs, the signature and the jurat with the county', () => {
    const t = texts(draft, 'whole')
    expect(t).toContain('AFFIDAVIT OF DANIEL ALVAREZ')
    expect(t.indexOf('STATE OF TEXAS\nCOUNTY OF GUADALUPE')).toBeLessThan(t.indexOf('1. My name is Daniel Alvarez.'))
    expect(t).toContain('2. I am the Responsible Master Plumber of record.')
    expect(t).toContain(SIGNED_ON_LINE)
    expect(t).toContain('Daniel Alvarez, Affiant\nResponsible Master Plumber of record for Click Plumbing and Electrical, License No. M-00000')
    expect(t).toContain(juratSentence('Daniel Alvarez'))
    expect(t).not.toContain('Seal')
    expect(t).toContain('My commission expires')
    // The jurat carries the county twice: the caption at the top and the certificate at the end.
    expect(t.match(/COUNTY OF GUADALUPE/g)).toHaveLength(2)
  })
  it('before a notary with the county left blank, both venue lines are the notary’s to fill', () => {
    const t = texts({ ...draft, venueCounty: '' }, 'whole')
    expect(t.match(/COUNTY OF ___________/g)).toHaveLength(2)
  })
  it('the statement alone has no signing block', () => {
    const t = texts(draft, 'statement')
    expect(t).toContain('3. On September 3, 2026')
    expect(t).not.toContain('SWORN TO')
    expect(t).not.toContain(SIGNED_ON_LINE)
    expect(t).not.toContain('Affiant')
  })
  it('the signing page alone names what it is stapled to, then the jurat', () => {
    const t = texts(draft, 'signing')
    expect(t.startsWith('JURAT\n\nThis jurat is attached to the handwritten statement of Daniel Alvarez, _____ pages, each initialed by the signer.')).toBe(true)
    expect(t).not.toContain('My name is')
    expect(t).toContain(juratSentence('Daniel Alvarez'))
    expect(attachedToLine('declaration', 'Thanh Nguyen')).toBe('This declaration is attached to the handwritten statement of Thanh Nguyen, _____ pages, each initialed by the signer.')
  })
  it('no notary, the whole paper: no venue caption, the § 132.001(d) block with the details typed at print time, the day left blank', () => {
    const d: StatementDraft = { ...draft, affiant: nguyen, form: 'declaration', title: 'Declaration of Thanh Nguyen', venueCounty: 'Williamson' }
    const declarant = { ...DECLARANT_BLANK, firstName: 'Thanh', middleName: 'Van', lastName: 'Nguyen', dateOfBirth: '1988-03-14', street: '1400 Example Rd', city: 'Round Rock', zip: '78664' }
    const t = texts(d, 'whole', declarant)
    expect(t).not.toContain('STATE OF TEXAS')
    expect(t).not.toContain('SWORN TO')
    expect(t).toContain('1. My name is Thanh Nguyen. I am over eighteen years of age, of sound mind, and capable of making this declaration. I am the foreman')
    expect(t).toContain('My name is Thanh Van Nguyen, my date of birth is March 14, 1988, and my address is 1400 Example Rd, Round Rock, Texas 78664, and United States of America. I declare under penalty of perjury that the foregoing is true and correct.')
    expect(t).toContain('Executed in Williamson County, State of Texas, on the ______ day of __________, __________.')
    expect(t).toContain('Thanh Nguyen, Declarant')
    expect(t).not.toContain('Notary Public')
  })
  it('no notary with no details yet: the statute’s own blanks print, so the paper can be filled by hand', () => {
    const d: StatementDraft = { ...draft, affiant: nguyen, form: 'declaration', venueCounty: '' }
    const t = texts(d, 'signing')
    expect(t).toContain('DECLARATION\n\nThis declaration is attached to the handwritten statement of Thanh Nguyen')
    expect(t).toContain('My name is __________ (First) __________ (Middle) __________ (Last), my date of birth is __________')
    expect(t).toContain('Executed in __________ County, State of Texas, on the ______ day of __________, __________.')
    expect(declarationJurat(null, '').statement).toBe(DECLARATION_STATUTE_FORM.slice(0, DECLARATION_STATUTE_FORM.indexOf(' Executed in')))
  })
  it('the declarant’s details are whole or the print waits', () => {
    expect(declarantProblem(DECLARANT_BLANK)).toBe('Type the declarant’s first and last name as the statute asks.')
    expect(declarantProblem({ ...DECLARANT_BLANK, firstName: 'Thanh', lastName: 'Nguyen' })).toBe('Type the declarant’s date of birth.')
    expect(declarantProblem({ ...DECLARANT_BLANK, firstName: 'Thanh', lastName: 'Nguyen', dateOfBirth: '1988-03-14' })).toBe('Type the declarant’s street, city, state, zip code and country.')
    expect(declarantProblem({ ...DECLARANT_BLANK, firstName: 'Thanh', lastName: 'Nguyen', dateOfBirth: '1988-03-14', street: '1 Rd', city: 'Seguin', zip: '78155' })).toBeNull()
  })
  it('the print title names the face', () => {
    expect(statementPrintTitle(draft, 'whole')).toBe('Affidavit of Daniel Alvarez')
    expect(statementPrintTitle(draft, 'statement')).toBe('Affidavit of Daniel Alvarez · the statement alone')
    expect(statementPrintTitle(draft, 'signing')).toBe('Jurat · Affidavit of Daniel Alvarez')
    expect(statementPrintTitle({ title: '', form: 'declaration' }, 'signing')).toBe('Declaration · Declaration')
  })
})

describe('the draft’s rules', () => {
  it('refuses what the RPC refuses, in the window’s words', () => {
    expect(statementDraftProblem(draft, TODAY)).toBeNull()
    // v2.6238: a picked team member with no name asks for the name on their ID; nobody picked asks for the pick.
    expect(statementDraftProblem({ ...draft, affiant: { ...alvarez, name: '' } }, TODAY)).toBe('Type their full name, as it reads on their ID.')
    expect(statementDraftProblem({ ...draft, affiant: { ...alvarez, userId: null, name: '' } }, TODAY)).toBe('Pick who swears it.')
    expect(statementDraftProblem({ ...draft, affiant: { ...nguyen, name: '' } }, TODAY)).toBe('Type the witness’s full name.')
    expect(statementDraftProblem({ ...draft, title: ' ' }, TODAY)).toBe('Give the statement a title.')
    expect(statementDraftProblem({ ...draft, incidentOn: '2026-02-30' }, TODAY)).toBe('Pick the day it is about.')
    expect(statementDraftProblem({ ...draft, incidentOn: '2026-11-01', incidentTo: '' }, TODAY)).toBe('The day it is about cannot be ahead of today.')
    expect(statementDraftProblem({ ...draft, incidentTo: '2026-09-01' }, TODAY)).toBe('The last day of the span comes before the first. Swap them.')
    expect(statementDraftProblem({ ...draft, incidentTo: '2026-11-02' }, TODAY)).toBe('The span cannot run past today.')
    expect(statementDraftProblem({ ...draft, body: '\n' }, TODAY)).toBe('Type the statement.')
    expect(statementDraftProblem({ ...draft, body: 'x'.repeat(20_001) }, TODAY)).toBe('Keep the statement under 20,000 characters.')
  })
  it('the defaults: a notary for everyone, the office’s county before a notary, the property’s for a declaration', () => {
    expect(defaultStatementForm('team')).toBe('notary')
    expect(defaultStatementForm('witness')).toBe('notary')
    expect(OFFICE_COUNTY_DEFAULT).toBe('Guadalupe')
    expect(defaultVenueCounty({ officeCounty: 'Guadalupe', propertyCounty: 'Williamson', form: 'notary' })).toBe('Guadalupe')
    expect(defaultVenueCounty({ officeCounty: 'Guadalupe', propertyCounty: 'Williamson', form: 'declaration' })).toBe('Williamson')
    expect(defaultVenueCounty({ officeCounty: 'Guadalupe', propertyCounty: null, form: 'declaration' })).toBe('Guadalupe')
  })
  it('the county picks: the office’s, the property’s, the blank; one county named twice is one pick', () => {
    expect(venueChoices({ officeCounty: 'Guadalupe', propertyCounty: 'Williamson', form: 'notary' }).map((c) => c.words)).toEqual(['Guadalupe County · the office’s', 'Williamson County · the property’s', 'Leave it blank for the notary'])
    expect(venueChoices({ officeCounty: 'Guadalupe', propertyCounty: 'guadalupe', form: 'notary' }).map((c) => c.value)).toEqual(['Guadalupe', ''])
    expect(venueChoices({ officeCounty: '', propertyCounty: null, form: 'notary' }).map((c) => c.value)).toEqual([''])
    for (const c of venueChoices({ officeCounty: 'Guadalupe', propertyCounty: 'Williamson', form: 'declaration' })) expect(plainWordsFailures(c.note)).toEqual([])
    expect(plainWordsFailures(FORM_HELP_WORDS)).toEqual([])
  })
})

describe('the meta and the state words', () => {
  it('reads defensively: a bare row is a draft by an unnamed team member, before a notary', () => {
    const m = statementMetaOf(null)
    expect(m).toEqual({ title: '', affiant: { kind: 'team', userId: null, name: '', role: '' }, form: 'notary', incidentTo: null, venueCounty: null, state: 'draft', prints: [], signedOn: null, handChanged: false, documentId: null, source: 'office' })
    expect(statementMetaOf({ prints: [{ at: '2026-10-28T19:14:00Z', by: 'u-g', face: 'signing', text: '1. x' }] }).state).toBe('printed')
    expect(statementMetaOf({ prints: [{ face: 'bogus' }] }).prints[0]!.face).toBe('whole')
    expect(isStatementEntry({ kind: 'statement' })).toBe(true)
    expect(isStatementEntry({ kind: 'event' })).toBe(false)
    expect(statementHoldKey('e1')).toBe('statement:e1')
  })
  it('a draft never printed, then printed, then stale, then signed', () => {
    const words = (m: StatementMeta) => statementStateWords(m, { todayYmd: TODAY, voided: false, voidReason: '', dayOfIso: dayOf })
    expect(words(meta())).toEqual({ state: 'planned', words: 'Draft · not signed.' })
    const once = meta({ state: 'printed', prints: [{ at: '2026-10-16T15:00:00Z', by: 'u-g', face: 'signing', text: '' }] })
    expect(words(once)).toEqual({ state: 'stale', words: 'Printed 14 days ago · no signed copy.' })
    const twice = meta({ state: 'printed', prints: [{ at: '2026-10-27T15:00:00Z', by: 'u-g', face: 'whole', text: '' }, { at: '2026-10-28T19:14:00Z', by: 'u-g', face: 'whole', text: '' }] })
    expect(words(twice)).toEqual({ state: 'planned', words: 'Printed twice · last Oct 28 · not signed.' })
    const onceFresh = meta({ state: 'printed', prints: [{ at: '2026-10-29T15:00:00Z', by: 'u-g', face: 'signing', text: '' }] })
    expect(words(onceFresh).words).toBe('Printed once · last Oct 29, the signing page alone · not signed.')
    const twoPrints = [{ at: '2026-10-27T15:00:00Z', by: 'u-g', face: 'whole', text: '' }, { at: '2026-10-28T19:14:00Z', by: 'u-g', face: 'whole', text: '' }]
    const signed = meta({ state: 'signed', prints: twoPrints, signed_on: '2026-10-29', document_id: 'd1' })
    expect(words(signed)).toEqual({ state: 'happened', words: 'Sworn Oct 29 before a notary in Guadalupe County. The signed copy is on Evidence. Printed twice before the signing.' })
    const hand = meta({ state: 'signed', prints: twoPrints, signed_on: '2026-10-29', document_id: 'd1', hand_changed: true })
    expect(words(hand).words).toMatch(/Changed by hand; the scan governs\.$/)
    expect(statementStateWords(meta(), { todayYmd: TODAY, voided: true, voidReason: 'would not sign the September paragraph', dayOfIso: dayOf })).toEqual({ state: 'undone', words: 'Undone: would not sign the September paragraph' })
    expect(STATEMENT_DRAFT_AMBER_DAYS).toBe(14)
    expect(printCountWords(3)).toBe('Printed 3 times')
  })
  it('the sworn words, the chip, the kind words for each side, and the Evidence line', () => {
    const signed = meta({ state: 'signed', signed_on: '2026-10-29', venue_county: 'Guadalupe' })
    expect(statementSignedWords(signed)).toBe('Sworn Oct 29 before a notary in Guadalupe County.')
    expect(statementSignedWords({ form: 'declaration', signedOn: '2026-10-29', venueCounty: null })).toBe('Signed Oct 29 under penalty of perjury.')
    expect(statementChipWords(meta(), dayOf)).toBe('draft · not signed')
    expect(statementChipWords(meta({ prints: [{ at: '2026-10-28T19:14:00Z', by: null, face: 'whole', text: '' }, { at: '2026-10-28T20:00:00Z', by: null, face: 'whole', text: '' }] }), dayOf)).toBe('printed 2× · last Oct 28')
    expect(statementChipWords(signed, dayOf)).toBe('signed Oct 29')
    expect(statementKindWords(meta())).toBe('sworn statement · draft')
    expect(statementKindWords(signed)).toBe('sworn statement')
    expect(statementKindWords(meta({ form: 'declaration', state: 'signed' }))).toBe('declaration')
    expect(statementFirmKindWords(signed)).toBe("sworn statement by the office's team")
    expect(statementFirmKindWords(meta({ form: 'declaration', affiant: { kind: 'witness', name: 'Thanh Nguyen' } }))).toBe('unsworn declaration by a witness · draft, not signed')
    expect(statementShowsLine(signed, '2026-09-03')).toBe('Sworn Oct 29 before a notary in Guadalupe County. What was seen or heard on Sep 3 to Sep 17.')
    expect(incidentSpanWords('2026-09-03', '2026-09-03')).toBe('Sep 3')
  })
})

describe('the record check beside the day', () => {
  const clockWords = (iso: string) => iso.slice(11, 16)
  it('lists the sessions, reports and notes in the span, the affiant’s own first, and names a day with nothing on it', () => {
    const lines = recordCheckLines({
      incidentOn: '2026-09-03', incidentTo: '2026-09-05', affiant: { userId: 'u-da', name: 'Daniel Alvarez' },
      sessions: [
        { userId: 'u-ro', userName: 'R. Ortiz', workDate: '2026-09-03', clockedInAt: '2026-09-03T07:10:00Z', clockedOutAt: '2026-09-03T08:05:00Z', jobLabel: '742' },
        { userId: 'u-da', userName: 'Daniel Alvarez', workDate: '2026-09-03', clockedInAt: '2026-09-03T07:12:00Z', clockedOutAt: null, jobLabel: '742' },
        { userId: 'u-da', userName: 'Daniel Alvarez', workDate: '2026-09-09', clockedInAt: '2026-09-09T07:12:00Z', clockedOutAt: '2026-09-09T09:00:00Z', jobLabel: '742' },
      ],
      reports: [{ authorName: 'Daniel Alvarez', templateName: 'Daily', createdOn: '2026-09-03', jobLabel: '742' }],
      notes: [{ authorName: null, createdOn: '2026-09-04', body: 'Called Northline, no answer,   left voicemail' }],
      clockWords,
    })
    expect(lines.map((l) => `${l.ymd} ${l.theirs ? '*' : ' '} ${l.text}`)).toEqual([
      '2026-09-03 * Clock session · Daniel Alvarez · 07:12, still open · job 742',
      '2026-09-03 * Field report · Daniel Alvarez · Daily · job 742',
      '2026-09-03   Clock session · R. Ortiz · 07:10 to 08:05 · job 742',
      '2026-09-04   Job thread · the office · “Called Northline, no answer, left voicemail”',
      '2026-09-05   Nothing recorded on this day. No clock session, report or note. The paragraph that names it rests on the affiant’s word alone.',
    ])
    expect(recordCheckHeading('2026-09-03', '2026-09-05')).toBe('What the record says about Sep 3 to Sep 5')
    expect(recordCheckHeading('', null)).toBe('What the record says about those days')
  })
  it('a witness with no roster row is matched by name; a span over a fortnight names no empty days; a bad day lists nothing', () => {
    const lines = recordCheckLines({ incidentOn: '2026-09-01', incidentTo: '2026-09-30', affiant: { userId: null, name: 'Thanh Nguyen' }, sessions: [], reports: [{ authorName: 'thanh nguyen', templateName: '', createdOn: '2026-09-09', jobLabel: '742' }], notes: [], clockWords })
    expect(lines).toEqual([{ ymd: '2026-09-09', kind: 'report', text: 'Field report · thanh nguyen · job 742', theirs: true }])
    expect(recordCheckLines({ incidentOn: 'soon', incidentTo: null, affiant: { userId: null, name: '' }, sessions: [], reports: [], notes: [], clockWords })).toEqual([])
  })
})

describe('filing the signed copy (punch list #220, v2.6212)', () => {
  const file = { size: 1024, type: 'application/pdf', name: 'signed.pdf' }
  const filing = { signedOn: '2026-10-29', asPrinted: true, incidentOn: '2026-09-03', incidentTo: '2026-09-17', whose: null, shows: 'Sworn Oct 29 before a notary in Guadalupe County. What was seen or heard on Sep 3 to Sep 17.' }
  it('refuses what the RPC refuses, in the panel’s words', () => {
    expect(statementFilingProblem(filing, file, TODAY)).toBeNull()
    expect(statementFilingProblem(filing, null, TODAY)).toBe('Choose the signed scan.')
    expect(statementFilingProblem({ ...filing, incidentOn: '' }, file, TODAY)).toBe('Pick the day it is about.')
    expect(statementFilingProblem({ ...filing, signedOn: '' }, file, TODAY)).toBe('Type the day it was signed, off the jurat.')
    expect(statementFilingProblem({ ...filing, signedOn: '2026-11-02' }, file, TODAY)).toBe('The day it was signed cannot be ahead of today.')
    expect(statementFilingProblem({ ...filing, signedOn: '2026-09-01' }, file, TODAY)).toBe('The day it was signed comes before the day it is about. Check the jurat.')
    expect(statementFilingProblem({ ...filing, incidentTo: '2026-09-01' }, file, TODAY)).toBe('The last day of the span comes before the first. Swap them.')
    expect(statementFilingProblem({ ...filing, shows: ' ' }, file, TODAY)).toBe('Say in one line what it shows.')
  })
  it('the shows line follows the form, the county and the days; the last print reads day and clock', () => {
    expect(statementFilingShows({ form: 'notary', venueCounty: 'Guadalupe' }, filing)).toBe('Sworn Oct 29 before a notary in Guadalupe County. What was seen or heard on Sep 3 to Sep 17.')
    expect(statementFilingShows({ form: 'declaration', venueCounty: null }, { ...filing, signedOn: '', incidentTo: '' })).toBe('Signed under penalty of perjury. What was seen or heard on Sep 3.')
    expect(lastPrintWords({ prints: [{ at: '2026-10-28T19:14:00Z', by: null, face: 'whole', text: '' }] }, (iso) => iso.slice(0, 10), (iso) => iso.slice(11, 16))).toBe('Oct 28 at 19:14')
    expect(lastPrintWords({ prints: [] }, (iso) => iso, (iso) => iso)).toBe('')
  })
})

describe('the role under a signature (v2.6238)', () => {
  it('drops a leading article, raises the first letter and drops a closing full stop; a capitalized line reads as typed', () => {
    expect(signatureRoleLine('the foreman for Brightline Electric, the electrical subcontractor on the job')).toBe('Foreman for Brightline Electric, the electrical subcontractor on the job')
    expect(signatureRoleLine('a neighbour on Elm Street.')).toBe('Neighbour on Elm Street')
    expect(signatureRoleLine('an owner of Click Plumbing and Electrical')).toBe('Owner of Click Plumbing and Electrical')
    expect(signatureRoleLine('custodian of records for Click Plumbing and Electrical')).toBe('Custodian of records for Click Plumbing and Electrical')
    expect(signatureRoleLine('Responsible Master Plumber of record for Click Plumbing and Electrical, License No. M-00000')).toBe('Responsible Master Plumber of record for Click Plumbing and Electrical, License No. M-00000')
    expect(signatureRoleLine('A-1 Plumbing’s foreman')).toBe('A-1 Plumbing’s foreman')
    expect(signatureRoleLine('  ')).toBe('')
  })
  it('the paper prints it under the signature while the opener keeps the words as typed', () => {
    const d: StatementDraft = { ...draft, affiant: nguyen, form: 'declaration', venueCounty: 'Williamson' }
    const t = filingDocText(statementPaperBlocks({ draft: d, face: 'whole', declarant: null }))
    expect(t).toContain('Thanh Nguyen, Declarant\nForeman for Brightline Electric, the electrical subcontractor on the job')
    expect(t).toContain('I am the foreman for Brightline Electric, the electrical subcontractor on the job.')
  })
})
