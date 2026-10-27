import { describe, expect, it } from 'vitest'
import { ledgerBulkWords, ledgerFailuresShown, ledgerRetryLabel, ledgerRowLabel } from './ledgerBulkAssign'
import { plainWordsFailures } from '../plainWords'

describe('ledgerRowLabel — a row the bulk press did not update is named (punch list #184)', () => {
  it('counterparty, day and amount', () => {
    expect(ledgerRowLabel({ counterparty_name: ' Vance Hardware ', posted_at: '2026-10-03T15:00:00Z', amount: -123.45 })).toBe('Vance Hardware · Oct 3, 2026 · -$123.45')
  })
  it('stands in for what is missing', () => {
    expect(ledgerRowLabel({ counterparty_name: null, posted_at: null, amount: null })).toBe('No counterparty · no date · $0.00')
  })
})

describe('ledgerBulkWords', () => {
  it('says what updated and what did not', () => {
    expect(ledgerBulkWords(12, 0)).toEqual({ line: 'Updated 12 transactions.', head: null, tone: 'success' })
    expect(ledgerBulkWords(3, 2)).toEqual({ line: 'Updated 3 transactions. 2 did not update.', head: '2 transactions did not update. They stay here with the reason.', tone: 'warning' })
    expect(plainWordsFailures(ledgerBulkWords(3, 2).head ?? '')).toEqual([])
  })
})

describe('ledgerRetryLabel and ledgerFailuresShown', () => {
  it('the door says how many it tries', () => {
    expect(ledgerRetryLabel(2)).toBe('Try the 2 again ▸')
    expect(ledgerRetryLabel(1)).toBe('Try it again ▸')
  })
  it('keeps only the rows the cell still lists', () => {
    const run = { value: 'u:1', failures: [{ txId: 'a', label: 'A', why: 'x' }, { txId: 'b', label: 'B', why: 'y' }] }
    expect(ledgerFailuresShown(run, new Set(['b', 'c']))).toEqual([{ txId: 'b', label: 'B', why: 'y' }])
    expect(ledgerFailuresShown(null, new Set(['b']))).toEqual([])
  })
})
