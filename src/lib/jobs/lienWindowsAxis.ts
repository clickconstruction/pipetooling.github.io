/**
 * The lien calendar's axis (v2.4652): the span the Windows view draws, in whole months.
 * It holds every bar and today, and is never shorter than three months — a one-month
 * story (job 890 on 2026-10-06: nothing open, nothing ahead) drew a one-month axis with
 * today cutting through rows that were sentences, so a short story gets a month of air
 * on each side. Pure; 'YYYY-MM-DD' in and out.
 */

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

export function monthEnd(ymd: string): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7))
  return new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10)
}

/** The first of the month `n` months from the one holding `ymd` (n may be negative). */
export function monthShift(ymd: string, n: number): string {
  const y = Number(ymd.slice(0, 4))
  const m = Number(ymd.slice(5, 7)) - 1 + n
  return new Date(Date.UTC(y, m, 1, 12)).toISOString().slice(0, 10)
}

/** Whole months from the one holding `a` to the one holding `b`, both counted. */
function monthsAcross(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7)) + 1
}

export interface LienWindowsAxis {
  /** The first day drawn — the 1st of a month. */
  first: string
  /** The last day drawn — the last of a month. */
  last: string
  /** The 1st of every month drawn, in order. */
  ticks: string[]
}

export function windowsAxis(todayYmd: string, bars: ReadonlyArray<{ start: string; end: string }>): LienWindowsAxis {
  let first = monthStart([todayYmd, ...bars.map((b) => b.start)].sort()[0] ?? todayYmd)
  let last = monthEnd([todayYmd, ...bars.map((b) => b.end)].sort().slice(-1)[0] ?? todayYmd)
  if (monthsAcross(first, last) < 3) {
    first = monthShift(first, -1)
    last = monthEnd(monthShift(last, 1))
  }
  const ticks: string[] = []
  for (let t = first; t <= last; t = monthShift(t, 1)) ticks.push(t)
  return { first, last, ticks }
}
