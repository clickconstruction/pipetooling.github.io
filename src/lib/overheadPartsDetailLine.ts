/**
 * A line of the overhead parts detail and where it came from, on their own so the accounting buckets
 * (`overheadPartsAccountingBuckets.ts`) and the pool snapshot take the shape without the reads behind it: on the edge a
 * function uploads every file an import names, a type import too, and dev-mcp carried the reads, the in-kind ledger, the
 * paging and the slim database types for this one type (punch list #359). `overheadOfficePartsReads.ts` re-exports
 * both, so every reader of the reads imports as before.
 */
export type OverheadPartsSource = 'mercury' | 'supply' | 'tally' | 'in_kind'

export type OverheadPartsDetailLine = {
  source: OverheadPartsSource
  amountUsd: number
  label: string
  sortKey: string
  /**
   * Mercury debit card UUID (lowercase, hyphenated) when this line came
   * from a Mercury allocation whose transaction `raw` JSON exposed a
   * debit-card-info object. `null` for non-Mercury lines or when no
   * debit card was used (e.g. ACH/wire/check). UI layers can resolve it
   * to a nickname via `useMercuryLedgerNicknames().nicknameByDebitCard`.
   */
  mercuryDebitCardId?: string | null
  /**
   * Underlying `mercury_transactions.id` for Mercury allocation lines.
   * `null` for supply / tally lines. UI layers use this to look up the
   * transaction's Banking → Accounting drag-sort label assignment and
   * bucket the line accordingly.
   */
  mercuryTransactionId?: string | null
}
