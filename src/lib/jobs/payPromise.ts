/**
 * The promise a GC made (punch list #49, step 5): the pay-by date on the
 * newest word, read against today. One rule for the call sheet, the worklist
 * and the GC's header — a date that has passed with money still owed is a
 * broken promise, and it is who to call first.
 */

/** A pay-by date the GC gave, against today: late once the day has passed with money still open. */
export type PayPromise = { payBy: string; late: boolean; daysLate: number }

const daysBetweenYmd = (fromYmd: string, toYmd: string): number => {
  const parse = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((parse(toYmd) - parse(fromYmd)) / 86400000)
}

/**
 * A promise is broken the day after the date they gave, while they still owe.
 * On the day itself it is not late — the check may be in the mail.
 */
export function payPromiseStatus(expectedPayBy: string | null | undefined, todayYmd: string, amountOpen: number): PayPromise | null {
  const payBy = (expectedPayBy ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payBy)) return null
  const daysLate = Math.max(0, daysBetweenYmd(payBy, todayYmd))
  return { payBy, late: daysLate > 0 && Math.round(amountOpen * 100) > 0, daysLate }
}

/** "promised Sep 20 — 7 days late" / "pays by Oct 10". */
export function payPromiseLabel(p: PayPromise): string {
  const [y, m, d] = p.payBy.split('-').map(Number)
  const day = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  return p.late ? `promised ${day} — ${p.daysLate} day${p.daysLate === 1 ? '' : 's'} late` : `pays by ${day}`
}
