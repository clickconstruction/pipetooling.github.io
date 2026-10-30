import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PoLedgerEntriesByCode, PoLedgerEntry } from '../supplyHouseInvoiceForm'
import { creditPairGuess, dueGuess, houseMatch, jobAccountDefault, jobByPlace, jobGuess, kindFromRead, nameTokens, placeTokens, ymdPlusDays, type MatchableAccount, type MatchableJob } from './billMatch'
import { readBillAnswer, type BillRead } from './billRead'

const FIXTURES = resolve(__dirname, '../../../test/fixtures/bills')
const readOf = (slug: string): BillRead => readBillAnswer(JSON.parse(readFileSync(resolve(FIXTURES, `${slug}.answer.json`), 'utf8')))!

const JOBS: MatchableJob[] = [
  { id: 'job-1042', label: 'J1042', name: 'Oakmont Dental build-out', address: '418 Cedar Bend Dr, Boerne TX' },
  { id: 'job-1031', label: 'J1031', name: 'Riverbend Self Storage', address: '2201 Hillside Rd, Kerrville TX' },
  { id: 'job-1057', label: 'J1057', name: 'Hill Country Smiles', address: '77 Main St, Comfort TX' },
]
const ACCOUNTS: MatchableAccount[] = [
  { jobId: 'job-1042', accountRef: 'CLICK PLUMBING', status: 'open' },
  { jobId: 'job-1031', accountRef: 'CP-2208', status: 'requested' },
]
const entry = (code: number, jobLedgerId: string | null): PoLedgerEntry => ({ code, jobLabel: 'J1042 · Oakmont Dental build-out', jobLedgerId, personName: 'Todd', createdAt: '2026-10-21T15:00:00Z', createdBy: 'Marisol', statedNeed: 'copper for the trim' })
const LEDGER: PoLedgerEntriesByCode = new Map([[41207, entry(41207, 'job-1042')]])

describe('houseMatch', () => {
  it('reads the letterhead against the house the form is open on, the generic words dropped', () => {
    expect(houseMatch('Ridgeway Supply', 'Ridgeway Supply')).toBe('same')
    expect(houseMatch('RIDGEWAY SUPPLY CO', 'Ridgeway Supply')).toBe('same')
    expect(houseMatch('Ridgeway', 'Ridgeway Supply, Inc.')).toBe('same')
    expect(houseMatch('Cedar Bend Pipe & Supply', 'Ridgeway Supply')).toBe('other')
    expect(houseMatch('Cedar Bend Pipe and Supply', 'Cedar Bend Supply')).toBe('same')
    expect(houseMatch('', 'Ridgeway Supply')).toBe('unknown')
    expect(nameTokens('Cedar Bend Pipe & Supply, Inc.')).toEqual(['cedar', 'bend'])
  })
})

describe('the job', () => {
  it('is a guess from the code on the ledger and the ship-to, together when they agree', () => {
    const g = jobGuess(readOf('ridgeway-S1183420'), { ledger: LEDGER, accounts: ACCOUNTS, jobs: JOBS })
    expect(g).toEqual({ jobId: 'job-1042', evidence: ['code', 'account', 'shipTo', 'jobText'], code: 41207 })
  })
  it('falls back to the account reference, then the printed place, when the PO prints the job name', () => {
    const noCode = jobGuess(readOf('ridgeway-S1183455-wrong-total'), { ledger: LEDGER, accounts: [], jobs: JOBS })
    expect(noCode).toEqual({ jobId: 'job-1042', evidence: ['shipTo', 'jobText'], code: null })
    const byAccount = jobGuess({ ...readOf('ridgeway-S1183455-wrong-total'), shipTo: '', jobText: '' }, { ledger: null, accounts: ACCOUNTS, jobs: JOBS })
    expect(byAccount).toEqual({ jobId: 'job-1042', evidence: ['account'], code: null })
  })
  it('the code wins over a place that points elsewhere, and names only its own evidence', () => {
    const read = { ...readOf('ridgeway-S1183420'), shipTo: '2201 Hillside Rd, Riverbend Self Storage', jobText: '', accountRef: '' }
    expect(jobGuess(read, { ledger: LEDGER, accounts: [], jobs: JOBS })).toEqual({ jobId: 'job-1042', evidence: ['code'], code: 41207 })
  })
  it('is nothing when nothing points at a job', () => {
    expect(jobGuess(readOf('cedar-bend-CB-77102'), { ledger: LEDGER, accounts: [], jobs: [JOBS[2]!] })).toBeNull()
    expect(jobGuess({ ...readOf('ridgeway-S1183420'), poText: '', accountRef: '', shipTo: '', jobText: '' }, { ledger: LEDGER, accounts: ACCOUNTS, jobs: JOBS })).toBeNull()
  })
  it('matches a place on two shared words, never one', () => {
    expect(jobByPlace('2201 HILLSIDE RD, RIVERBEND SELF STORAGE', JOBS)?.id).toBe('job-1031')
    expect(jobByPlace('Storage', JOBS)).toBeNull()
    expect(jobByPlace('', JOBS)).toBeNull()
    expect(placeTokens('418 CEDAR BEND DR, OAKMONT DENTAL')).toEqual(['418', 'cedar', 'bend', 'oakmont', 'dental'])
  })
  it('ticks the job account on only for an open account at this house', () => {
    expect(jobAccountDefault('job-1042', ACCOUNTS)).toBe(true)
    expect(jobAccountDefault('job-1031', ACCOUNTS)).toBe(false)
    expect(jobAccountDefault(null, ACCOUNTS)).toBe(false)
  })
})

describe('the kind and the pair', () => {
  const ROWS = [
    { id: 'inv-1', invoice_number: 'S1183420', amount: 952.28, document_kind: 'invoice', invoice_date: '2026-10-22' },
    { id: 'inv-2', invoice_number: 'S1183455', amount: 1284.1, document_kind: 'invoice', invoice_date: '2026-10-24' },
    { id: 'cr-1', invoice_number: 'CM-20880', amount: -40, document_kind: 'credit', invoice_date: '2026-10-20' },
  ]
  it('a credit memo is a credit; a statement starts as an invoice', () => {
    expect(kindFromRead(readOf('ridgeway-CM-20991'))).toBe('credit')
    expect(kindFromRead(readOf('ridgeway-S1183420'))).toBe('invoice')
    expect(kindFromRead(readOf('ridgeway-statement-oct-2026'))).toBe('invoice')
  })
  it('pairs the credit to the invoice its RE: line names, never to a credit', () => {
    expect(creditPairGuess(readOf('ridgeway-CM-20991'), ROWS)).toEqual({ invoiceId: 'inv-1', label: 'S1183420 · $952.28 · Oct 22, 2026' })
    expect(creditPairGuess({ referencesNumber: 's 1183420' }, ROWS)?.invoiceId).toBe('inv-1')
    expect(creditPairGuess({ referencesNumber: 'CM-20880' }, ROWS)).toBeNull()
    expect(creditPairGuess({ referencesNumber: 'S9999' }, ROWS)).toBeNull()
    expect(creditPairGuess({ referencesNumber: '' }, ROWS)).toBeNull()
  })
})

describe('the due date', () => {
  it('follows Net N on the paper, then due on receipt, then the house’s day, then nothing', () => {
    expect(dueGuess({ dateYmd: '2026-10-22', terms: 'Net 30' }, 10, '2026-10-29')).toEqual({ ymd: '2026-11-21', from: 'terms', days: 30 })
    expect(dueGuess({ dateYmd: '2026-10-22', terms: 'NET10' }, null, '2026-10-29')).toEqual({ ymd: '2026-11-01', from: 'terms', days: 10 })
    expect(dueGuess({ dateYmd: '2026-10-22', terms: 'Due on receipt' }, 10, '2026-10-29')).toEqual({ ymd: '2026-10-22', from: 'receipt', days: 0 })
    expect(dueGuess({ dateYmd: '2026-10-22', terms: '' }, 10, '2026-10-29')).toEqual({ ymd: '2026-11-10', from: 'house', days: null })
    expect(dueGuess({ dateYmd: '', terms: 'Net 30' }, null, '2026-10-29')).toEqual({ ymd: '', from: 'none', days: null })
  })
  it('adds days across a month and a year', () => {
    expect(ymdPlusDays('2026-12-15', 30)).toBe('2027-01-14')
    expect(ymdPlusDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(ymdPlusDays('bad', 1)).toBe('')
  })
})
