/**
 * Open bills with the ones a deal pays set apart (punch list #301, the sweep of the readers).
 *
 * A job on an in kind deal carries `jobs_ledger.in_kind_arrangement_id` (`jobIsScheduledInKind` on the client). Its
 * bill is paid down by credits, a month or a load at a time, so it is scheduled and never late. A reader that ages
 * open bills, or counts them as money coming, takes its rows through `splitInKind` first: the money rows go on to its
 * own rule, and the rows a deal pays are counted in `inKind` and named in one line (`inKindApartWords`). The line is
 * the point. A total that shrinks with no word reads as money lost.
 *
 * A job is on a deal or off it, whole. So a payer with some bills on a deal and some off keeps the bills off the deal
 * as money owed, aged as any other.
 *
 * It lives here so the screens and the emails read one file: `src/lib/inKind/inKindApart.ts` re-exports it, and a
 * sender imports it beside its own renderer. Pure, with no import, so it adds nothing to any function's bundle but
 * itself.
 */

const CENT = 0.005

/** The bills a reader left out because a deal pays them: how many, and what is still open on them. */
export type InKindApart = { count: number; dollars: number }

export const noInKindApart = (): InKindApart => ({ count: 0, dollars: 0 })

/** Whether a row is on a deal, by the job's own column name or the camel-cased one a shaped row carries. */
export function rowIsScheduledInKind(row: { in_kind_arrangement_id?: string | null; inKindArrangementId?: string | null } | null | undefined): boolean {
  return Boolean(row && (row.in_kind_arrangement_id || row.inKindArrangementId))
}

export type InKindSplit<T> = {
  /** The rows money pays, in the order they came. */
  money: T[]
  /** The rows a deal pays, in the order they came, settled ones included. */
  scheduled: T[]
  /** The rows a deal pays that still have money open on them, counted. */
  inKind: InKindApart
}

/**
 * The rows in two piles. `onDeal` says whether a row's job is on a deal; `openOf` is what is still open on the row.
 * A row on a deal with nothing open (paid off, not yet marked Paid) leaves the money pile too and is not counted, so
 * the count is of bills a credit still has to pay. A reader that keeps such a row as a Mark Paid to-do says so in its
 * own `onDeal`.
 */
export function splitInKind<T>(rows: readonly T[], onDeal: (row: T) => boolean, openOf: (row: T) => number): InKindSplit<T> {
  const money: T[] = []
  const scheduled: T[] = []
  const inKind = noInKindApart()
  for (const row of rows) {
    if (!onDeal(row)) {
      money.push(row)
      continue
    }
    scheduled.push(row)
    const open = Number(openOf(row))
    if (Number.isFinite(open) && open > CENT) {
      inKind.count += 1
      inKind.dollars += open
    }
  }
  inKind.dollars = Math.round(inKind.dollars * 100) / 100
  return { money, scheduled, inKind }
}

/** Two counts as one, for a reader that splits more than one list. */
export function addInKindApart(a: InKindApart, b: InKindApart): InKindApart {
  return { count: a.count + b.count, dollars: Math.round((a.dollars + b.dollars) * 100) / 100 }
}

const wholeDollars = (n: number): string => `$${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-US')}`

/**
 * The reader's one line on what it left out: "$14,643 on 8 bills is scheduled in kind, not money owed". The forecast
 * and Money waiting say the same sentence with their own last words. Null when no bill is set apart.
 */
export function inKindApartWords(inKind: InKindApart, notWhat: string): string | null {
  if (inKind.count <= 0) return null
  return `${wholeDollars(inKind.dollars)} on ${inKind.count} ${inKind.count === 1 ? 'bill' : 'bills'} is scheduled in kind, not ${notWhat}`
}
