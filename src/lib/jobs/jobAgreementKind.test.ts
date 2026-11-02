import { describe, expect, it } from 'vitest'
import {
  DEFAULT_JOB_WARRANTY_TERMS_PLAIN,
  DEFAULT_WARRANTY_INITIAL_LINES,
  INITIAL_LINES_MAX,
  JOB_AGREEMENT_KINDS,
  JOB_AGREEMENT_WORDS,
  WARRANTY_CERTIFY_SENTENCE,
  cleanInitials,
  initialEntries,
  initialLinesProblem,
  initialsProblem,
  jobAgreementHeading,
  jobAgreementKindOf,
  parseInitialLines,
  parseInitials,
} from './jobAgreementKind'

describe('jobAgreementKind: the two kinds and their words', () => {
  it('reads a row’s kind, a row from before the column as a contract', () => {
    expect(JOB_AGREEMENT_KINDS).toEqual(['contract', 'warranty'])
    expect(jobAgreementKindOf('warranty')).toBe('warranty')
    expect(jobAgreementKindOf('contract')).toBe('contract')
    expect(jobAgreementKindOf(undefined)).toBe('contract')
    expect(jobAgreementKindOf('lease')).toBe('contract')
  })

  it('words each kind for a sentence, a chip and a file name', () => {
    expect(JOB_AGREEMENT_WORDS.contract).toMatchObject({ noun: 'contract', Noun: 'Contract', a: 'a contract', fileStem: 'Signed-agreement' })
    expect(JOB_AGREEMENT_WORDS.warranty).toMatchObject({ noun: 'warranty', Noun: 'Warranty', a: 'a warranty', fileStem: 'Signed-warranty' })
    expect(JOB_AGREEMENT_WORDS.warranty.signVerb).toBe('certify the work above and accept')
  })

  it('heads a warranty by the address, else the job’s name, else alone; a contract keeps its heading', () => {
    expect(jobAgreementHeading('warranty', { job_address: '407 E 6th St, Austin, TX', job_name: 'Water heater' })).toBe('Warranty for 407 E 6th St')
    expect(jobAgreementHeading('warranty', { job_address: '', job_name: 'Water heater' })).toBe('Warranty — Water heater')
    expect(jobAgreementHeading('warranty', { job_address: null, job_name: null })).toBe('Warranty')
    expect(jobAgreementHeading('contract', { job_address: '407 E 6th St, Austin, TX', job_name: null })).toBe('Service agreement for 407 E 6th St')
  })

  it('ships four lines to initial, the certify sentence and six numbered terms', () => {
    expect(DEFAULT_WARRANTY_INITIAL_LINES).toHaveLength(4)
    expect(initialLinesProblem(DEFAULT_WARRANTY_INITIAL_LINES)).toBeNull()
    expect(DEFAULT_WARRANTY_INITIAL_LINES[0]).toContain('the work I asked for')
    expect(DEFAULT_WARRANTY_INITIAL_LINES[2]).toContain('one year')
    expect(WARRANTY_CERTIFY_SENTENCE).toBe('I certify the work listed above and accept this warranty.')
    expect(DEFAULT_JOB_WARRANTY_TERMS_PLAIN.match(/^\d\. /gm)).toHaveLength(6)
    expect(DEFAULT_JOB_WARRANTY_TERMS_PLAIN).toContain('one year from the day the work is finished')
    expect(DEFAULT_JOB_WARRANTY_TERMS_PLAIN).toContain('Typed initials')
  })
})

describe('jobAgreementKind: the office’s lines', () => {
  it('needs at least one line, none blank, none too long, no more than twelve', () => {
    expect(initialLinesProblem([])).toBe('Add at least one line for them to initial.')
    expect(initialLinesProblem(['The work is as listed.', '  '])).toBe('A line to initial cannot be blank.')
    expect(initialLinesProblem(['x'.repeat(401)])).toContain('400 characters')
    expect(initialLinesProblem(Array.from({ length: INITIAL_LINES_MAX + 1 }, (_, i) => `Line ${i}`))).toBe('Keep it to 12 lines to initial.')
    expect(initialLinesProblem(['The work is as listed.'])).toBeNull()
  })

  it('reads the lines the row keeps, dropping anything that is not words', () => {
    expect(parseInitialLines(['  The work is as listed. ', '', 3, null, 'Paid on completion.'])).toEqual(['The work is as listed.', 'Paid on completion.'])
    expect(parseInitialLines(null)).toEqual([])
    expect(parseInitialLines('one line')).toEqual([])
  })
})

describe('jobAgreementKind: the customer’s initials', () => {
  const LINES = ['The work is as listed.', 'The price is as agreed.', 'One year on labor.']

  it('cleans typed initials: dots and spaces off, capitals on', () => {
    expect(cleanInitials('d.w.')).toBe('DW')
    expect(cleanInitials(' d w ')).toBe('DW')
    expect(cleanInitials('DWP')).toBe('DWP')
  })

  it('wants initials on every line, naming the first blank one', () => {
    expect(initialsProblem(LINES, ['DW', '', 'DW'])).toBe('Initial every line to continue. Line 2 is still blank.')
    expect(initialsProblem(LINES, ['DW'])).toBe('Initial every line to continue. Line 2 is still blank.')
    expect(initialsProblem(['One line.'], [''])).toBe('Initial the line above to continue.')
  })

  it('wants two to four letters, naming the line that is not', () => {
    expect(initialsProblem(LINES, ['DW', 'D', 'DW'])).toBe('Initials are two to four letters. Line 2 reads "D".')
    expect(initialsProblem(LINES, ['DW', 'Dana Whitfield', 'DW'])).toBe('Initials are two to four letters. Line 2 reads "Dana Whitfield".')
    expect(initialsProblem(LINES, ['DW', 'D2', 'DW'])).toBe('Initials are two to four letters. Line 2 reads "D2".')
    expect(initialsProblem(LINES, ['dw', 'D.W.', 'DWP'])).toBeNull()
    expect(initialsProblem([], [])).toBeNull()
  })

  it('keeps each line with its cleaned initials, and reads them back tolerant of junk', () => {
    const entries = initialEntries(LINES, ['dw', 'D.W.', ' DWP '])
    expect(entries).toEqual([
      { line: 'The work is as listed.', initials: 'DW' },
      { line: 'The price is as agreed.', initials: 'DW' },
      { line: 'One year on labor.', initials: 'DWP' },
    ])
    expect(parseInitials(entries)).toEqual(entries)
    expect(parseInitials([{ line: 'The work is as listed.', initials: 'd.w.' }, { line: '', initials: 'DW' }, { initials: 'DW' }, 'junk', null])).toEqual([{ line: 'The work is as listed.', initials: 'DW' }])
    expect(parseInitials(null)).toEqual([])
  })
})
