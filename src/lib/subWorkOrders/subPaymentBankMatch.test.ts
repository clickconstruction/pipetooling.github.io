import { describe, expect, it } from 'vitest'
import type { LaborJobPayment } from '../../types/laborJob'
import { buildLedgerLines, type LedgerSheet } from './subPaymentsLedger'
import { bankCandidates, bankLineWords, bankLinesFromRows, bankMatchedWords, bankReadFromYmd, bankReadWords, daysApart, matchUnits, payeeReadsLike, suggestBankMatches, type BankLine } from './subPaymentBankMatch'

const pay = (id: string, amount: number, sent: string | null, over: Partial<LaborJobPayment> = {}): LaborJobPayment => ({ id, amount, memo: null, created_at: `${sent ?? '2026-11-01'}T15:00:00Z`, payment_date: sent, ...over })
const sheet = (over: Partial<LedgerSheet>): LedgerSheet => ({ id: 's', paidTo: 'Calloway Tile', paidToKey: 'id:calloway', crew: false, job: '2104 Larkspur', address: '', agreed: 0, payments: [], events: [], ...over })
const bank = (id: string, amount: number, ymd: string, payee = ''): BankLine => ({ id, amount, ymd, payee, memo: '' })

// A lone payment, a sending across two sheets with a credit kept, a back-charge and a line paid from credit.
const one = sheet({ id: 'one', agreed: 900, payments: [pay('p1', 400, '2026-11-05'), pay('bc', -50, null), pay('cr', 25, '2026-11-09', { method: 'credit' })] })
const two = sheet({ id: 'two', agreed: 2000, payments: [pay('s1', 1000, '2026-11-12', { sending_no: 12, credit_kept: 200 })] })
const three = sheet({ id: 'three', agreed: 300, payments: [pay('s2', 300, '2026-11-12', { sending_no: 12 })] })
const lines = buildLedgerLines([one, two, three])

describe('bankLinesFromRows', () => {
  it('keeps real money out and reads the day it posted in Central time', () => {
    const rows = [
      { id: 'a', amount: -400, posted_at: '2026-11-06T03:30:00Z', counterparty_name: ' Calloway Tile LLC ', note: null, external_memo: 'inv 4' },
      { id: 'b', amount: 250, posted_at: '2026-11-06T15:00:00Z' },
      { id: 'c', amount: -90, posted_at: null, created_at: '2026-11-07T15:00:00Z', status: 'failed' },
      { id: 'd', amount: -90, posted_at: '2026-11-07T15:00:00Z', status: 'Cancelled' },
      { id: 'e', amount: -90, posted_at: '2026-11-07T15:00:00Z', duplicate_of_transaction_id: 'a' },
      { id: 'f', amount: '-1500.5000', posted_at: null, created_at: '2026-11-08T15:00:00Z', note: 'wire' },
    ]
    expect(bankLinesFromRows(rows)).toEqual([
      // 03:30 UTC on the 6th is the evening of the 5th in Central time.
      { id: 'a', amount: 400, ymd: '2026-11-05', payee: 'Calloway Tile LLC', memo: 'inv 4' },
      { id: 'f', amount: 1500.5, ymd: '2026-11-08', payee: '', memo: 'wire' },
    ])
  })
})

describe('matchUnits', () => {
  it('a sending is one unit worth what was sent, and lines that moved no money are left out', () => {
    expect(matchUnits(lines)).toEqual([
      { paymentId: 'p1', lineIds: ['p1'], amount: 400, ymd: '2026-11-05', paidTo: 'Calloway Tile' },
      { paymentId: 's1', lineIds: ['s1', 's2'], amount: 1500, ymd: '2026-11-12', paidTo: 'Calloway Tile' },
    ])
  })
})

describe('bankCandidates', () => {
  const unit = matchUnits(lines)[0]!
  it('offers the same amount within three days, closest day first', () => {
    const lines3 = [bank('far', 400, '2026-11-09'), bank('near', 400, '2026-11-06'), bank('exact', 400, '2026-11-05'), bank('early', 400, '2026-11-02'), bank('other', 401, '2026-11-05')]
    expect(bankCandidates(unit, lines3, new Set()).map((c) => [c.id, c.days])).toEqual([['exact', 0], ['near', 1], ['early', 3]])
  })
  it('on the same day a payee that reads like the sub leads', () => {
    const tie = [bank('stranger', 400, '2026-11-05', 'Acme Supply'), bank('theirs', 400, '2026-11-05', 'CALLOWAY TILE LLC')]
    expect(bankCandidates(unit, tie, new Set()).map((c) => [c.id, c.namesAgree])).toEqual([['theirs', true], ['stranger', false]])
  })
  it('leaves out a line another payment already took, and offers nothing for a payment with no day', () => {
    expect(bankCandidates(unit, [bank('exact', 400, '2026-11-05')], new Set(['exact']))).toEqual([])
    expect(bankCandidates({ ...unit, ymd: '' }, [bank('exact', 400, '2026-11-05')], new Set())).toEqual([])
  })
  it('compares to the cent', () => {
    expect(bankCandidates({ ...unit, amount: 0.1 + 0.2 }, [bank('dime', 0.3, '2026-11-05')], new Set()).map((c) => c.id)).toEqual(['dime'])
  })
})

describe('suggestBankMatches', () => {
  const lines2 = [bank('b400', 400, '2026-11-05', 'Calloway Tile'), bank('b1500', 1500, '2026-11-13', 'Calloway Tile'), bank('b300', 300, '2026-11-12')]
  it('gives every line of a sending the sending’s candidates, by what was sent', () => {
    const found = suggestBankMatches(lines, lines2, new Map())
    expect([...found.keys()].sort()).toEqual(['p1', 's1', 's2'])
    expect(found.get('s1')!.map((c) => c.id)).toEqual(['b1500'])
    expect(found.get('s2')).toBe(found.get('s1'))
    // The 300 line is not offered: the sending left as one 1,500 movement.
    expect([...found.values()].flat().some((c) => c.id === 'b300')).toBe(false)
  })
  it('a matched payment is offered nothing more, and its bank line is offered to nobody else', () => {
    const found = suggestBankMatches(lines, lines2, new Map([['p1', 'b400']]))
    expect(found.has('p1')).toBe(false)
    const twin = buildLedgerLines([sheet({ id: 'twin', agreed: 400, payments: [pay('p9', 400, '2026-11-05')] })])
    expect(suggestBankMatches(twin, lines2, new Map([['p1', 'b400']])).size).toBe(0)
  })
  it('one line of a sending already matched means the whole sending is', () => {
    expect(suggestBankMatches(lines, lines2, new Map([['s2', 'b1500']])).has('s1')).toBe(false)
  })
})

describe('words and dates', () => {
  it('counts whole days either way', () => {
    expect(daysApart('2026-11-05', '2026-11-08')).toBe(3)
    expect(daysApart('2026-11-08', '2026-11-05')).toBe(3)
    expect(daysApart('2026-10-31', '2026-11-01')).toBe(1)
    expect(daysApart('', '2026-11-01')).toBe(Infinity)
  })
  it('a payee reads like a sub when they share a word that is not company filler', () => {
    expect(payeeReadsLike('CALLOWAY TILE LLC', 'Calloway Tile')).toBe(true)
    expect(payeeReadsLike('Brightline Electric LLC', 'Calloway Tile LLC')).toBe(false)
    expect(payeeReadsLike('', 'Calloway Tile')).toBe(false)
  })
  it('says a bank line, a match and what a read found', () => {
    expect(bankLineWords(bank('x', 1200, '2026-11-12', 'CALLOWAY TILE LLC'))).toBe('Nov 12 · CALLOWAY TILE LLC · $1,200.00')
    expect(bankLineWords(bank('x', 5, '2026-11-12'))).toBe('Nov 12 · no payee named · $5.00')
    expect(bankMatchedWords(bank('x', 1200, '2026-11-12', 'CALLOWAY TILE LLC'))).toBe('bank Nov 12 · CALLOWAY TILE LLC')
    expect(bankMatchedWords(null)).toBe('matched to the bank')
    expect(bankReadWords(3, 2)).toBe('3 bank lines read. 2 payments have one to match.')
    expect(bankReadWords(1, 1)).toBe('1 bank line read. 1 payment has one to match.')
    expect(bankReadWords(40, 0)).toBe('40 bank lines read. None lines up with a payment still to match.')
  })
  it('reads the bank from four days before the earliest payment', () => {
    expect(bankReadFromYmd(lines)).toBe('2026-11-01')
    expect(bankReadFromYmd([])).toBe('')
  })
})
