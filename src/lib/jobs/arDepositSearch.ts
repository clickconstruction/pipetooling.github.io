/**
 * Accounts Receivable's deposit search (v2.4273, punch list #74 PR 1).
 *
 * The search box over the deposit list used to look only at the list on
 * screen. On To match that is the pile still to apply, so a cheque that had
 * already been applied — the very thing the office goes looking for — came
 * back "No bank transactions match this search" and read as lost. Now a
 * search on To match also runs over the All rows (fully applied, returned,
 * closed out) and lists the extra hits under their own heading.
 *
 * Pure: the same predicate the modal used inline, plus the split. The date
 * formatter is passed in so the kernel carries no time zone.
 * Unit-tested in arDepositSearch.test.ts.
 */

export type ArDepositSearchSlice = {
  mercury_transaction_id: string
  counterparty_name: string | null
  note: string | null
  external_memo: string | null
  amount: number | string | null
  posted_at: string | null
}

const moneyWords = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Trimmed, lower-cased; '' means "no search". */
export function normalizeArDepositQuery(q: string): string {
  return q.trim().toLowerCase()
}

/** Counterparty, note, memo, the amount as "1,234.56", or the posted day as the formatter writes it. */
export function matchesArDepositSearch(row: ArDepositSearchSlice, q: string, postedLabel: (iso: string) => string): boolean {
  if (!q) return true
  const cp = (row.counterparty_name ?? '').toLowerCase()
  const note = (row.note ?? '').toLowerCase()
  const memo = (row.external_memo ?? '').toLowerCase()
  const amountStr = moneyWords(Math.abs(Number(row.amount) || 0)).toLowerCase()
  let posted = ''
  if (row.posted_at) {
    try {
      posted = postedLabel(row.posted_at).toLowerCase()
    } catch {
      posted = ''
    }
  }
  return cp.includes(q) || note.includes(q) || memo.includes(q) || amountStr.includes(q) || posted.includes(q)
}

export type ArSearchFallThrough<T> = {
  /** Rows of the list on screen that match. */
  hits: T[]
  /** Rows only All has that match — never a row already on screen. Empty when `hidden` is null (not fetched). */
  elsewhere: T[]
  /** The line above `elsewhere`, or null when there is nothing to head. */
  heading: 'Nothing to match · found in All' | 'Also found in All' | null
  /**
   * What to say under an empty list: 'nowhere' when All was searched too and
   * has nothing; 'unsearched' when the hidden rows are not loaded yet; null
   * when there is something to show.
   */
  empty: 'nowhere' | 'unsearched' | null
}

/**
 * The search over both lists. `hidden` is the All fetch (null until it lands);
 * on the All list itself pass null — everything is already visible.
 */
export function arSearchFallThrough<T extends ArDepositSearchSlice>(args: {
  query: string
  visible: ReadonlyArray<T>
  hidden: ReadonlyArray<T> | null
  postedLabel: (iso: string) => string
}): ArSearchFallThrough<T> {
  const q = normalizeArDepositQuery(args.query)
  const hits = q ? args.visible.filter((r) => matchesArDepositSearch(r, q, args.postedLabel)) : [...args.visible]
  if (!q || args.hidden == null) {
    return { hits, elsewhere: [], heading: null, empty: hits.length ? null : q ? 'unsearched' : null }
  }
  const seen = new Set(args.visible.map((r) => r.mercury_transaction_id))
  const elsewhere = args.hidden.filter((r) => !seen.has(r.mercury_transaction_id) && matchesArDepositSearch(r, q, args.postedLabel))
  const heading = elsewhere.length ? (hits.length ? 'Also found in All' : 'Nothing to match · found in All') : null
  return { hits, elsewhere, heading, empty: hits.length || elsewhere.length ? null : 'nowhere' }
}
