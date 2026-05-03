import { describe, expect, it } from 'vitest'
import { bankingMercuryNotesSubRowColSpans, bankingMercuryTableColSpan } from './bankingMercuryNotesSubRowColSpan'

describe('bankingMercuryNotesSubRowColSpan', () => {
  it('ledger default: cols before Counterparty = 4', () => {
    const s = bankingMercuryNotesSubRowColSpans({
      hideKindColumn: false,
      debitAndAccountAfterAmount: false,
      showAllocations: true,
      counterpartyNoteCombined: false,
    })
    const total = bankingMercuryTableColSpan({
      hideKindColumn: false,
      showAllocations: true,
      counterpartyNoteCombined: false,
    })
    expect(s.colsBeforeCounterparty).toBe(4)
    expect(s.colsFromCounterparty).toBe(total - 4)
  })

  it('user sort slice: cols before Counterparty = 5', () => {
    const s = bankingMercuryNotesSubRowColSpans({
      hideKindColumn: true,
      debitAndAccountAfterAmount: true,
      showAllocations: true,
      counterpartyNoteCombined: true,
    })
    expect(s.colsBeforeCounterparty).toBe(5)
    expect(s.colsFromCounterparty).toBe(3)
    expect(bankingMercuryTableColSpan({ hideKindColumn: true, showAllocations: true, counterpartyNoteCombined: true })).toBe(
      8,
    )
  })
})
