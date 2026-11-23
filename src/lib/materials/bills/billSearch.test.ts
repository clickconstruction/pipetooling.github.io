import { describe, expect, it } from 'vitest'
import { BILL_SEARCH_WORDS, billSearchArgs, billSearchJobsWords, billSearchViewerItems, type BillSearchHit } from './billSearch'
import { plainWordsFailures } from '../../plainWords'

/** A made-up hit. */
function hit(over: Partial<BillSearchHit> = {}): BillSearchHit {
  return {
    invoice_id: 'inv-1',
    invoice_number: 'BW 7602-01',
    invoice_date: '2026-10-15',
    amount: '1085.58',
    supply_house_id: 'house-1',
    supply_house_name: 'Brightwater Pipe & Valve',
    purchase_order_number: null,
    is_paid: false,
    has_pdf: true,
    jobs: [],
    on_paper: null,
    on_paper_code: null,
    ...over,
  }
}

describe('billSearchArgs: what a person typed, as the database takes it', () => {
  it('plain words go as words', () => {
    expect(billSearchArgs('ball valve')).toEqual({ words: ['ball', 'valve'], year: null, month: null, day: null })
    expect(billSearchArgs('  BW7731 ')).toEqual({ words: ['bw7731'], year: null, month: null, day: null })
  })
  it('a day, a month and a year narrow by the date and are not words', () => {
    expect(billSearchArgs('valve nov 16')).toEqual({ words: ['valve'], year: null, month: 11, day: 16 })
    expect(billSearchArgs('11/16/2026')).toEqual({ words: [], year: 2026, month: 11, day: 16 })
    expect(billSearchArgs('october 2026 harlow')).toEqual({ words: ['harlow'], year: 2026, month: 10, day: null })
    expect(billSearchArgs('oct')).toEqual({ words: [], year: null, month: 10, day: null })
    expect(billSearchArgs('2026-10')).toEqual({ words: [], year: 2026, month: 10, day: null })
  })
  it('an amount keeps its marks: the database reads them', () => {
    expect(billSearchArgs('$1,085.58')).toEqual({ words: ['1,085.58'], year: null, month: null, day: null })
  })
  it('the first date is the date, and a second month is read as a word', () => {
    expect(billSearchArgs('oct may')).toEqual({ words: ['may'], year: null, month: 10, day: null })
    expect(billSearchArgs('11/16 11/17')).toEqual({ words: [], year: null, month: 11, day: 16 })
  })
  it('nothing worth asking is no search', () => {
    expect(billSearchArgs('')).toBeNull()
    expect(billSearchArgs('   ')).toBeNull()
    expect(billSearchArgs('a')).toBeNull()
    expect(billSearchArgs('$')).toBeNull()
    // Two letters, or two words of one letter each, are enough.
    expect(billSearchArgs('bw')).not.toBeNull()
    expect(billSearchArgs('b w')).not.toBeNull()
  })
})

describe('reading a hit', () => {
  it('names the jobs a bill is on, with each share when it is split', () => {
    expect(billSearchJobsWords(hit())).toBe('No job on this bill')
    expect(billSearchJobsWords(hit({ jobs: null }))).toBe('No job on this bill')
    expect(billSearchJobsWords(hit({ jobs: [{ id: 'j1', hcp_number: '', click_number: 'JP9431', job_name: 'ZZ Test Larkspur Commons', pct: 100 }] }))).toBe('JP9431 · ZZ Test Larkspur Commons')
    expect(
      billSearchJobsWords(
        hit({
          jobs: [
            { id: 'j1', hcp_number: '4127', click_number: null, job_name: 'ZZ Test Oak Hollow', pct: '50' },
            { id: 'j2', hcp_number: null, click_number: null, job_name: 'ZZ Test Cedar Bend', pct: 50 },
          ],
        }),
      ),
    ).toBe('4127 · ZZ Test Oak Hollow (50%), ZZ Test Cedar Bend (50%)')
    expect(billSearchJobsWords(hit({ jobs: [{ id: 'j1', hcp_number: null, click_number: null, job_name: '  ', pct: 100 }] }))).toBe('a job')
  })
  it('hands the viewer the hits in the order found', () => {
    expect(billSearchViewerItems([hit(), hit({ invoice_id: 'inv-2', invoice_number: 'HS-204418', amount: 560, invoice_date: null })])).toEqual([
      { invoiceId: 'inv-1', number: 'BW 7602-01', house: 'Brightwater Pipe & Valve', dateYmd: '2026-10-15', amount: 1085.58 },
      { invoiceId: 'inv-2', number: 'HS-204418', house: 'Brightwater Pipe & Valve', dateYmd: '', amount: 560 },
    ])
  })
  it('counts in words, and says so when the search stopped at its limit', () => {
    expect(BILL_SEARCH_WORDS.count(1, false)).toBe('1 bill')
    expect(BILL_SEARCH_WORDS.count(12, false)).toBe('12 bills')
    expect(BILL_SEARCH_WORDS.count(60, true)).toBe('the first 60 bills')
  })
  it('every sentence is plain words', () => {
    for (const words of Object.values(BILL_SEARCH_WORDS)) if (typeof words === 'string') expect(plainWordsFailures(words)).toEqual([])
  })
})
