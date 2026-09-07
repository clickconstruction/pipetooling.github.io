import { describe, expect, it } from 'vitest'
import { parseBankingImportCsv } from './parseBankingImportCsv'

/** A QuickBooks-style account register export: title row, header, data, totals. */
const REGISTER = [
  'Checking - 1234,,,,,,,"Ending Balance: -$15,970.50"',
  '',
  'Date,Ref No.,Payee,Memo,Payment,Deposit,Reconciliation Status,Account',
  '08/01/2026,1001,Ferguson,PVC order,"$1,234.56",,Reconciled,Materials',
  '08/03/2026,,Stripe payout,,,"$2,000.00",Cleared,Income',
  '08/05/2026,1002,Shell,fuel,$45.10,,,Fuel',
  'Total,,,,,,,',
  '',
].join('\n')

describe('parseBankingImportCsv — register layout (Payment / Deposit columns)', () => {
  const r = parseBankingImportCsv(REGISTER)

  it('reads the account name and ending balance from the title row', () => {
    expect(r.accountName).toBe('Checking - 1234')
    expect(r.endingBalance).toBe(-15970.5)
  })

  it('turns Payment into a negative amount and Deposit into a positive one', () => {
    expect(r.rows.map((x) => x.amount)).toEqual([-1234.56, 2000, -45.1])
  })

  it('converts MM/DD/YYYY to YYYY-MM-DD and keeps the text columns', () => {
    expect(r.rows[0]).toEqual({
      postedDate: '2026-08-01',
      amount: -1234.56,
      payee: 'Ferguson',
      memo: 'PVC order',
      category: 'Materials',
      type: null,
      refNo: '1001',
      reconciliationStatus: 'Reconciled',
    })
    expect(r.rows[1]?.refNo).toBeNull()
    expect(r.rows[2]?.reconciliationStatus).toBeNull()
  })

  it('sums the parsed amounts', () => {
    expect(r.totalAmount).toBeCloseTo(-1234.56 + 2000 - 45.1, 6)
  })

  it('skips the totals row with a warning that counts it (blank lines are silent)', () => {
    expect(r.warnings).toEqual(['Skipped 1 row(s) without a valid date/amount (title, totals, or blank lines).'])
  })
})

describe('parseBankingImportCsv — other layouts', () => {
  it('reads a single signed Amount column with Debit/Credit aliases absent', () => {
    const r = parseBankingImportCsv('Date,Description,Amount,Type\n2026-08-02,Coffee,-4.50,card\n2026-08-04,Refund,12.00,ach\n')
    expect(r.rows.map((x) => [x.postedDate, x.amount, x.memo, x.type])).toEqual([
      ['2026-08-02', -4.5, 'Coffee', 'card'],
      ['2026-08-04', 12, 'Refund', 'ach'],
    ])
    expect(r.warnings).toEqual([])
  })

  it('accepts Debit / Credit as aliases for Payment / Deposit', () => {
    const r = parseBankingImportCsv('Date,Debit,Credit\n1/2/2026,10.00,\n1/3/2026,,25.00\n')
    expect(r.rows.map((x) => x.amount)).toEqual([-10, 25])
    expect(r.rows[0]?.postedDate).toBe('2026-01-02')
  })

  it('falls back to the first non-empty row above the header as the account name', () => {
    const r = parseBankingImportCsv('Acme Plumbing,,\nOperating Account,,\nDate,Amount\n2026-08-02,1.00\n')
    expect(r.accountName).toBe('Acme Plumbing')
    expect(r.endingBalance).toBeNull()
  })

  it('reports a missing header instead of guessing', () => {
    const r = parseBankingImportCsv('Posted,Money\n2026-08-02,1.00\n')
    expect(r.rows).toEqual([])
    expect(r.warnings).toEqual(['Could not find a header row with Date + Payment/Deposit (or Amount) columns.'])
  })

  it('skips a dated row whose amount is unreadable, and warns when nothing parsed', () => {
    const r = parseBankingImportCsv('Date,Amount\n2026-08-02,n/a\n')
    expect(r.rows).toEqual([])
    expect(r.warnings).toEqual([
      'Skipped 1 row(s) without a valid date/amount (title, totals, or blank lines).',
      'No transaction rows were found.',
    ])
  })

  it('treats a date it cannot read as a non-data row', () => {
    const r = parseBankingImportCsv('Date,Amount\nAugust 2 2026,1.00\n2026-08-03,2.00\n')
    expect(r.rows.map((x) => x.postedDate)).toEqual(['2026-08-03'])
  })
})
