import { describe, expect, it } from 'vitest'
import type { LaborJobPayment } from '../../types/laborJob'
import { buildLedgerLines, type LedgerSheet } from './subPaymentsLedger'
import { suggestBankMatches, bankLinesFromRows, type BankRow } from './subPaymentBankMatch'
import { bankLinePaidWords, bankSideRead, bankSideSheets, bankSideUnits, subPaymentCandidates, subPaymentPickWords } from './bankLineSubPayments'

const pay = (id: string, amount: number, sent: string | null, over: Partial<LaborJobPayment> = {}): LaborJobPayment => ({ id, amount, memo: null, created_at: `${sent ?? '2026-11-01'}T15:00:00Z`, payment_date: sent, ...over })
const sheet = (over: Partial<LedgerSheet>): LedgerSheet => ({ id: 's', paidTo: 'Calloway Tile', paidToKey: 'id:calloway', crew: false, job: '2104 Larkspur', address: '', agreed: 0, payments: [], events: [], ...over })
const row = (id: string, amount: number, ymd: string, payee = '', over: Partial<BankRow> = {}): BankRow => ({ id, amount, posted_at: `${ymd}T18:00:00Z`, counterparty_name: payee, ...over })

// A lone payment, a sending across two sheets with a credit kept, a back-charge, a line paid from credit, and
// another sub paid the same amount as the lone payment a day later.
const one = sheet({ id: 'one', agreed: 900, payments: [pay('p1', 400, '2026-11-05'), pay('bc', -50, null), pay('cr', 25, '2026-11-09', { method: 'credit' })] })
const two = sheet({ id: 'two', job: '1048 Trask', agreed: 2000, payments: [pay('s1', 1000, '2026-11-12', { sending_no: 12, credit_kept: 200 })] })
const three = sheet({ id: 'three', job: '2210 Alder', agreed: 300, payments: [pay('s2', 300, '2026-11-12', { sending_no: 12 })] })
const other = sheet({ id: 'other', paidTo: 'Harlow Drywall', paidToKey: 'id:harlow', job: '77 Birch', agreed: 400, payments: [pay('h1', 400, '2026-11-06'), pay('undated', 75, null, { created_at: '' })] })
const lines = buildLedgerLines([one, two, three, other])
const none = new Map<string, string>()

describe('bankSideSheets', () => {
  const roster = [
    { id: 'sub-1', name: 'Calloway Tile', kind: 'sub', accountRole: null },
    { id: 'mate-1', name: 'Jordan Vance', kind: 'sub', accountRole: 'superintendent' },
  ]
  const read = {
    payments: [
      { ...pay('p1', 400, '2026-11-05'), job_id: 'a' },
      { ...pay('p2', 150, '2026-11-07'), job_id: 'b' },
    ],
    sheets: [
      { id: 'a', assigned_to_name: 'Calloway Tile | Jordan Vance', address: '8 Cedar Ct', job_number: '2104', job_ledger_id: 'j1' },
      { id: 'b', assigned_to_name: 'Somebody Typed', address: '9 Elm', job_number: null, job_ledger_id: null },
    ],
    jobNamesById: { j1: 'Larkspur' },
    assigneesBySheetId: new Map([['a', [{ personId: 'sub-1', personName: 'Calloway Tile' }, { personId: 'mate-1', personName: 'Jordan Vance' }]]]),
  }

  it('names who a sheet pays by the Pay view’s rule, and the job as the ledger does', () => {
    const sheets = bankSideSheets(read, roster)
    expect(sheets.map((s) => [s.id, s.paidTo, s.paidToKey, s.job, s.payments.map((p) => p.id)])).toEqual([
      // The teammate rides along: the sheet is the sub's.
      ['a', 'Calloway Tile', 'id:sub-1', '2104 Larkspur', ['p1']],
      ['b', 'Somebody Typed', 'somebody typed', '9 Elm', ['p2']],
    ])
    expect(bankSideUnits(buildLedgerLines(sheets)).map((u) => [u.paymentId, u.paidTo, u.amount])).toEqual([
      ['p1', 'Calloway Tile', 400],
      ['p2', 'Somebody Typed', 150],
    ])
  })

  it('a teammate’s own sheet is theirs and not crew, and a sheet several teammates share is not crew either', () => {
    const mates = [...roster, { id: 'mate-2', name: 'Priya Oduya', kind: 'sub', accountRole: 'assistant' }]
    const sheets = bankSideSheets(
      {
        payments: [{ ...pay('p3', 500, '2026-11-08'), job_id: 'c' }],
        sheets: [
          { id: 'c', assigned_to_name: 'Jordan Vance', address: '4 Oak', job_number: '2110', job_ledger_id: null },
          { id: 'd', assigned_to_name: 'Jordan Vance | Priya Oduya', address: '5 Oak', job_number: '2111', job_ledger_id: null },
          { id: 'e', assigned_to_name: '', address: '6 Oak', job_number: '2112', job_ledger_id: null },
        ],
        jobNamesById: {},
        assigneesBySheetId: new Map([
          ['c', [{ personId: 'mate-1', personName: 'Jordan Vance' }]],
          ['d', [{ personId: 'mate-1', personName: 'Jordan Vance' }, { personId: 'mate-2', personName: 'Priya Oduya' }]],
        ]),
      },
      mates,
    )
    // Taunya, 2026-11-15: a sheet that names one teammate and no sub is owed to that teammate.
    expect(sheets.map((s) => [s.id, s.paidTo, s.paidToKey, s.crew])).toEqual([
      ['c', 'Jordan Vance', 'id:mate-1', false],
      ['d', 'Jordan Vance | Priya Oduya', 'jordan vance | priya oduya', false],
      // No name on it: owed to nobody, as before.
      ['e', 'nobody named', 'sheet:e', true],
    ])
    expect(bankSideUnits(buildLedgerLines(sheets)).map((u) => [u.paymentId, u.paidTo, u.amount])).toEqual([['p3', 'Jordan Vance', 500]])
  })
})

describe('bankSideUnits', () => {
  it('names a sending by its number and every job its lines sit on', () => {
    const units = bankSideUnits(lines)
    expect(units.find((u) => u.paymentId === 's1')).toEqual({ paymentId: 's1', lineIds: ['s1', 's2'], amount: 1500, ymd: '2026-11-12', paidTo: 'Calloway Tile', sendingNo: 12, jobs: ['1048 Trask', '2210 Alder'] })
    expect(units.find((u) => u.paymentId === 'p1')).toMatchObject({ sendingNo: null, jobs: ['2104 Larkspur'] })
    // A back-charge and a line paid from credit moved no money.
    expect(units.map((u) => u.paymentId).sort()).toEqual(['h1', 'p1', 's1', 'undated'])
  })
})

describe('subPaymentCandidates', () => {
  const units = bankSideUnits(lines)
  const line = (r: BankRow) => bankLinesFromRows([r])[0]!

  it('offers the payments with the same amount to the cent within three days, closest day first', () => {
    const got = subPaymentCandidates(line(row('b', -400, '2026-11-06')), units, none)
    expect(got.map((c) => [c.paymentId, c.days])).toEqual([
      ['h1', 0],
      ['p1', 1],
    ])
    expect(subPaymentCandidates(line(row('b', -400.01, '2026-11-06')), units, none)).toEqual([])
    expect(subPaymentCandidates(line(row('b', -400, '2026-11-10')), units, none)).toEqual([])
  })

  it('a payee that reads like the sub breaks a tie on the day', () => {
    const tied = bankSideUnits(buildLedgerLines([sheet({ id: 'a', payments: [pay('a1', 250, '2026-11-04')] }), sheet({ id: 'b', paidTo: 'Harlow Drywall', payments: [pay('b1', 250, '2026-11-04')] })]))
    expect(subPaymentCandidates(line(row('x', -250, '2026-11-04', 'HARLOW DRYWALL LLC')), tied, none).map((c) => [c.paymentId, c.namesAgree])).toEqual([
      ['b1', true],
      ['a1', false],
    ])
  })

  it('holds a sending against what was sent: its lines and the credit kept with them', () => {
    expect(subPaymentCandidates(line(row('b', -1500, '2026-11-13')), units, none).map((c) => c.paymentId)).toEqual(['s1'])
    // Neither line of the sending is offered by itself.
    expect(subPaymentCandidates(line(row('b', -1000, '2026-11-12')), units, none)).toEqual([])
    expect(subPaymentCandidates(line(row('b', -300, '2026-11-12')), units, none)).toEqual([])
  })

  it('leaves out a payment that is matched already, and one with no day', () => {
    expect(subPaymentCandidates(line(row('b', -400, '2026-11-06')), units, new Map([['h1', 'elsewhere']])).map((c) => c.paymentId)).toEqual(['p1'])
    // A sending is taken once any of its lines is.
    expect(subPaymentCandidates(line(row('b', -1500, '2026-11-12')), units, new Map([['s2', 'elsewhere']]))).toEqual([])
    expect(subPaymentCandidates(line(row('b', -75, '2026-11-01')), units, none)).toEqual([])
  })
})

describe('bankSideRead', () => {
  const rows = [
    row('lone', -400, '2026-11-05', 'CALLOWAY TILE'),
    row('check', -1500, '2026-11-12', 'CALLOWAY TILE'),
    row('in', 400, '2026-11-05'),
    row('failed', -400, '2026-11-05', '', { status: 'failed' }),
    row('dupe', -400, '2026-11-05', '', { duplicate_of_transaction_id: 'lone' }),
    row('own', -400, '2026-11-05', 'Mercury Savings', { kind: 'internalTransfer' }),
    row('stranger', -62.18, '2026-11-05', 'Corner Fuel'),
  ]

  it('offers real money out alone, and leaves a row with nothing to say out of the map', () => {
    const got = bankSideRead(rows, lines, none)
    expect([...got.keys()].sort()).toEqual(['check', 'lone'])
    expect(got.get('lone')).toMatchObject({ paid: null })
    expect(got.get('lone')!.offers.map((c) => c.paymentId)).toEqual(['p1', 'h1'])
  })

  it('a bank line a payment took says what it paid and is offered nothing more', () => {
    const got = bankSideRead(rows, lines, new Map([['s1', 'check'], ['s2', 'check']]))
    expect(got.get('check')).toEqual({ paid: { paymentIds: ['s1'], paidTo: ['Calloway Tile'], sendingNos: [12], lineCount: 2, amount: 1500 }, offers: [] })
    expect(bankLinePaidWords(got.get('check')!.paid!)).toBe('paid Calloway Tile · sending 12 · 2 sheets')
  })

  it('a taken line says so even when it has become a duplicate or failed since', () => {
    const got = bankSideRead(rows, lines, new Map([['p1', 'dupe']]))
    expect(got.get('dupe')!.paid).toMatchObject({ paymentIds: ['p1'], lineCount: 1 })
    expect(bankLinePaidWords(got.get('dupe')!.paid!)).toBe('paid Calloway Tile')
  })

  it('payments typed one per sheet can share a line, and taking it back clears each', () => {
    const got = bankSideRead([row('shared', -800, '2026-11-06')], lines, new Map([['p1', 'shared'], ['h1', 'shared']]))
    expect(got.get('shared')!.paid).toEqual({ paymentIds: ['p1', 'h1'], paidTo: ['Calloway Tile', 'Harlow Drywall'], sendingNos: [], lineCount: 2, amount: 800 })
    expect(bankLinePaidWords(got.get('shared')!.paid!)).toBe('paid Calloway Tile and Harlow Drywall · 2 sheets')
  })

  it('a match this login cannot read the payment of still says a sub was paid', () => {
    const got = bankSideRead([row('lone', -400, '2026-11-05')], [], new Map([['hidden', 'lone']]))
    expect(got.get('lone')!.paid).toEqual({ paymentIds: [], paidTo: [], sendingNos: [], lineCount: 0, amount: 0 })
    expect(bankLinePaidWords(got.get('lone')!.paid!)).toBe('paid a sub')
  })

  it('agrees with the ledger’s side: a line is offered a payment exactly when the payment is offered the line', () => {
    const matched = new Map([['h1', 'gone']])
    const fromBank = bankSideRead(rows, lines, matched)
    const fromLedger = suggestBankMatches(lines, bankLinesFromRows(rows), matched)
    const pairsFromBank = [...fromBank].flatMap(([tx, v]) => v.offers.flatMap((c) => c.lineIds.map((id) => `${id}>${tx}`))).sort()
    const pairsFromLedger = [...fromLedger].flatMap(([id, found]) => found.map((b) => `${id}>${b.id}`)).sort()
    expect(pairsFromBank).toEqual(pairsFromLedger)
    expect(pairsFromBank).toEqual(['p1>lone', 's1>check', 's2>check'])
  })
})

describe('the words', () => {
  it('a lone payment names its job, a sending its number and its sheets', () => {
    const units = bankSideUnits(lines)
    expect(subPaymentPickWords(units.find((u) => u.paymentId === 'p1')!)).toBe('Nov 5 · Calloway Tile · 2104 Larkspur · $400.00')
    expect(subPaymentPickWords(units.find((u) => u.paymentId === 's1')!, true)).toBe('Nov 12, 2026 · Calloway Tile · sending 12, 2 sheets · $1,500.00')
  })

  it('three subs on one line are counted', () => {
    expect(bankLinePaidWords({ paymentIds: ['a', 'b', 'c'], paidTo: ['A', 'B', 'C'], sendingNos: [], lineCount: 3, amount: 9 })).toBe('paid 3 subs · 3 sheets')
  })
})
