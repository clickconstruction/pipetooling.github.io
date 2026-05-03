/** Total `<th>` count for [`BankingMercuryTable`](src/pages/Banking.tsx) — must stay in sync with thead. */
export function bankingMercuryTableColSpan(args: {
  hideKindColumn: boolean
  showAllocations: boolean
  counterpartyNoteCombined: boolean
}): number {
  return (args.hideKindColumn ? 7 : 8) + (args.showAllocations ? 2 : 0) - (args.counterpartyNoteCombined ? 1 : 0)
}

/**
 * Split notes sub-row: spacer through columns before **Counterparty**, content from **Counterparty** rightward.
 * Order: Expand → Posted → Amount → [Kind] → [Debit card, Account early] → Counterparty → …
 */
export function bankingMercuryNotesSubRowColSpans(args: {
  hideKindColumn: boolean
  debitAndAccountAfterAmount: boolean
  showAllocations: boolean
  counterpartyNoteCombined: boolean
}): { colsBeforeCounterparty: number; colsFromCounterparty: number } {
  const tableColSpan = bankingMercuryTableColSpan(args)
  const colsBeforeCounterparty =
    3 + (args.hideKindColumn ? 0 : 1) + (args.debitAndAccountAfterAmount ? 2 : 0)
  const colsFromCounterparty = tableColSpan - colsBeforeCounterparty
  if (colsFromCounterparty < 1) {
    return { colsBeforeCounterparty: 0, colsFromCounterparty: tableColSpan }
  }
  return { colsBeforeCounterparty, colsFromCounterparty }
}
