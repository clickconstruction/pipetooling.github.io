import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import {
  LEGEND,
  NO_PDF_LINE,
  PDF_PANE_NOTE,
  START_WORDS,
  STATUS_YOURS,
  billOfferWords,
  billsToRecordWords,
  countLine,
  dayWords,
  dollars,
  dueWords,
  duplicateWords,
  houseWords,
  jobAccountGuessWords,
  jobFromPairWords,
  jobGuessWords,
  jobSettledWords,
  notABillWords,
  pairGuessWords,
  pairMissingWords,
  paperworkWords,
  statementWords,
  sumWords,
  threadChip,
} from './billWords'

/** The words of the approved drawing (the canvas of 2026-10-29), and the plain-words rules over every sentence a first-timer reads. */

describe('the drawing’s words', () => {
  it('the count line', () => {
    expect(countLine({ checks: 2, yours: 1, typed: 0 })).toBe('Filled in from the PDF. Two things to check, marked below. One thing is yours to set. Change anything you like. What you type stays.')
    expect(countLine({ checks: 1, yours: 1, typed: 1 })).toBe('Filled in from the PDF. One thing to check, marked below. One thing is yours to set. One field you typed is kept. Change anything you like. What you type stays.')
    expect(countLine({ checks: 0, yours: 1, typed: 2 })).toBe('Filled in from the PDF. Nothing left to check. One thing is yours to set. 2 fields you typed are kept. Press Save when it reads right.')
    expect(countLine({ checks: 4, yours: 0, typed: 0 })).toContain('4 things to check')
  })
  it('the sum, right and off', () => {
    expect(sumWords({ kind: 'right', lineCount: 5, sumCents: 95228, totalCents: 95228, withTax: true }, 'invoice')).toEqual({
      tone: 'right',
      line: 'The 5 lines on the paper add up to $952.28 with the tax, so the total is right. The lines are kept with the invoice.',
      presses: null,
    })
    expect(sumWords({ kind: 'right', lineCount: 1, sumCents: 13899, totalCents: 13899, withTax: true }, 'credit')?.line).toBe('The 1 line on the paper adds up to $138.99 with the tax, so the credit is right. The line is kept with the credit.')
    expect(sumWords({ kind: 'off', lineCount: 7, sumCents: 124810, totalCents: 128410, withTax: true }, 'invoice')).toEqual({
      tone: 'off',
      line: 'The paper prints $1,284.10, and its 7 lines add up to $1,248.10 with the tax. One of the two is off.',
      presses: { useSum: 'Use $1,248.10', keepTotal: 'Keep $1,284.10' },
    })
    expect(sumWords({ kind: 'none' }, 'invoice')).toBeNull()
  })
  it('the job guess, settled, and from the pair', () => {
    expect(jobGuessWords({ jobId: 'j', evidence: ['code', 'shipTo'], code: 41207 }, 'J1042 · Oakmont Dental build-out')).toEqual({
      title: 'J1042 · Oakmont Dental build-out',
      check: 'Check this',
      line: 'The paper names no job. J1042 is a guess from PO 41207 and the ship-to address. Right job?',
      yes: 'Yes, J1042',
      another: 'Pick another job',
    })
    expect(jobGuessWords({ jobId: 'j', evidence: ['account'], code: null }, 'J1042').line).toBe('The paper names no job. J1042 is a guess from the account reference. Right job?')
    expect(jobGuessWords({ jobId: 'j', evidence: ['code', 'account', 'shipTo'], code: 41207 }, 'J1042').line).toContain('PO 41207, the account reference and the ship-to address')
    expect(jobSettledWords('J1042 · Oakmont Dental build-out')).toEqual({ check: 'Yours', line: 'J1042 · Oakmont Dental build-out, as you said.' })
    expect(jobFromPairWords('J1042 · Oakmont Dental build-out', 'S1183420').line).toBe('J1042 is the job on S1183420, the invoice this credit names. The parts go back off that job.')
    expect(jobAccountGuessWords('Ridgeway Supply')).toEqual({ label: 'On Ridgeway Supply’s job account', why: 'A guess, since the account is open. Untick if this bill is not on it.' })
  })
  it('the other checks and the pair', () => {
    expect(duplicateWords({ invoiceId: 'x', number: 'S1183420', dateYmd: '2026-10-22', amountCents: 95228 }, 'Ridgeway Supply')).toEqual({ line: 'S1183420 is already on Ridgeway Supply’s list, Oct 22, $952.28. This may be the same bill twice.', press: 'Open it' })
    expect(houseWords('Cedar Bend Pipe & Supply', 'Ridgeway Supply')).toBe('This reads as a bill from Cedar Bend Pipe & Supply, not Ridgeway Supply. Open their row to record it there, or save it here if the paper is theirs.')
    expect(statementWords(['S1183420', 'S1183455', 'S1184020', 'CM-20991'])).toBe('This is a statement listing 4 invoices: S1183420, S1183455, S1184020, CM-20991. One bill at a time: pick each from the thread, or type the ones that are not there.')
    expect(statementWords([])).toBe('This is a statement. One bill at a time: pick each from the thread, or type the ones that are not there.')
    expect(pairGuessWords('S1183420')).toEqual({ line: 'The paper says RE: invoice S1183420, which is on this house’s list. Right invoice?', yes: 'Yes', another: 'Pick another' })
    expect(pairMissingWords('S9')).toContain('not on this house’s list')
  })
  it('the due date, the paperwork, the doors', () => {
    expect(dueWords({ ymd: '2026-11-21', from: 'terms', days: 30 }, 'Ridgeway Supply', 10, 'invoice')).toBe('Net 30 on the paper. The house’s usual day is the 10th.')
    expect(dueWords({ ymd: '2026-10-22', from: 'receipt', days: 0 }, 'Ridgeway Supply', null, 'invoice')).toBe('Due on receipt on the paper.')
    expect(dueWords({ ymd: '2026-11-10', from: 'house', days: null }, 'Ridgeway Supply', 10, 'invoice')).toBe('Ridgeway Supply’s payment day is the 10th. The paper prints no terms.')
    expect(dueWords({ ymd: '', from: 'none', days: null }, 'Ridgeway Supply', null, 'invoice')).toBeNull()
    expect(dueWords({ ymd: '', from: 'none', days: null }, 'Ridgeway Supply', 10, 'credit')).toBe('A credit has no due date. Leave it blank.')
    expect(paperworkWords('invoice', 'S1183420.pdf', true)).toEqual({ line: 'Invoice PDF: S1183420.pdf, our copy from the thread.', press: 'Use a Drive link instead' })
    expect(paperworkWords('credit', 'CM-20991.pdf', false).line).toBe('Credit PDF: CM-20991.pdf, our copy.')
    expect(billOfferWords('Ridgeway Supply')).toMatchObject({ line: 'This reads like a bill from Ridgeway Supply.', record: 'Record this bill', notABill: 'Not a bill' })
    expect(billsToRecordWords(2)).toEqual({ pill: '2 bills to record', press: 'Record them' })
    expect(billsToRecordWords(1)).toEqual({ pill: '1 bill to record', press: 'Record it' })
    expect(billsToRecordWords(0)).toBeNull()
    expect(threadChip('S1183420.pdf', '2026-10-22')).toBe('S1183420.pdf · Oct 22, on the thread')
    expect(notABillWords('Marisol', '2026-10-29')).toBe('Not a bill · Marisol, Oct 29')
    expect(dayWords('2026-10-22')).toBe('Oct 22')
    expect(dollars(128410)).toBe('$1,284.10')
  })
})

describe('plain words', () => {
  const sentences: Array<[string, string]> = [
    ['countLine 2/1/0', countLine({ checks: 2, yours: 1, typed: 0 })],
    ['countLine 0/1/3', countLine({ checks: 0, yours: 1, typed: 3 })],
    ['NO_PDF_LINE', NO_PDF_LINE],
    ['sum right', sumWords({ kind: 'right', lineCount: 5, sumCents: 95228, totalCents: 95228, withTax: true }, 'invoice')!.line],
    ['sum off', sumWords({ kind: 'off', lineCount: 7, sumCents: 124810, totalCents: 128410, withTax: true }, 'invoice')!.line],
    ['duplicate', duplicateWords({ invoiceId: 'x', number: 'S1183420', dateYmd: '2026-10-22', amountCents: 95228 }, 'Ridgeway Supply').line],
    ['house', houseWords('Cedar Bend Pipe & Supply', 'Ridgeway Supply')],
    ['statement', statementWords(['S1183420', 'S1183455', 'S1184020', 'CM-20991'])],
    ['job guess', jobGuessWords({ jobId: 'j', evidence: ['code', 'account', 'shipTo'], code: 41207 }, 'J1042 · Oakmont Dental build-out').line],
    ['job from pair', jobFromPairWords('J1042 · Oakmont Dental build-out', 'S1183420').line],
    ['job account', jobAccountGuessWords('Ridgeway Supply').why],
    ['pair', pairGuessWords('S1183420').line],
    ['pair missing', pairMissingWords('S1183420')],
    ['due terms', dueWords({ ymd: '2026-11-21', from: 'terms', days: 30 }, 'Ridgeway Supply', 10, 'invoice')!],
    ['due house', dueWords({ ymd: '2026-11-10', from: 'house', days: null }, 'Ridgeway Supply', 10, 'invoice')!],
    ['due credit', dueWords({ ymd: '', from: 'none', days: null }, 'Ridgeway Supply', 10, 'credit')!],
    ['paperwork', paperworkWords('invoice', 'S1183420.pdf', true).line],
    ['pdf pane', PDF_PANE_NOTE],
    ['drop', START_WORDS.drop],
    ['offer', billOfferWords('Ridgeway Supply').line],
    ['not a bill title', billOfferWords('Ridgeway Supply').notABillTitle],
    ['legend', `${LEGEND.paper}. ${LEGEND.guess}. ${LEGEND.yours}.`],
    ['status', STATUS_YOURS],
  ]
  it.each(sentences)('%s', (_name, text) => {
    expect(plainWordsFailures(text)).toEqual([])
  })
})
