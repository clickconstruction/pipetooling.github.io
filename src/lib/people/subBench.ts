/**
 * The bench (v2.2846, owner pick C from the 2026-09-05 mockups): a sub is Active or On the
 * bench, and the decision is a person's. The app only nudges — an active sub who has gone
 * quiet gets a "Bench…" prompt, a benched sub who turns up on a new sheet gets a
 * "Reactivate?" prompt. Nothing moves on its own, so a slow season never benches anyone.
 *
 * Storage reuses the roster row: `people.end_date` set = on the bench since that day;
 * `people.start_date` is re-stamped on reactivation; the reason lives as a dated line in
 * `people.notes` (`[bench 2026-06-02] Moved to Houston` / `[back 2026-09-05]`). No new
 * columns — archiving stays what it is for subs who are gone for good.
 */

export type SubBenchInput = {
  /** `people.end_date` — set means on the bench since that day. */
  endDate: string | null
  /** `people.start_date` — re-stamped on reactivation; informational. */
  startDate: string | null
  /** `people.created_at` as YYYY-MM-DD; drives the "never worked" nudge. */
  createdYmd: string | null
  /** `people.notes` — the bench reason is parsed from it. */
  notes: string | null
  /** Newest sheet job date / paid date / accepted work order, YYYY-MM-DD; null = never. */
  lastWorkedYmd: string | null
}

export type SubBenchNudge = { kind: 'bench'; text: string } | { kind: 'reactivate'; text: string }

export type SubBenchStatus = {
  kind: 'active' | 'bench'
  /** Bench start, YYYY-MM-DD; null when active. */
  since: string | null
  /** The one-line reason typed when benching; null when none or when active. */
  reason: string | null
  lastWorkedYmd: string | null
  /** "last worked Aug 28" / "last worked May 2 · 4 months" / "never worked · added Jul 1". */
  lastWorkedLine: string
  /** green = worked lately; amber = quiet or benched-but-busy; gray = long quiet or benched. */
  tone: 'green' | 'amber' | 'gray'
  nudge: SubBenchNudge | null
}

/** Days an active sub can go without work before the Bench… nudge. */
export const BENCH_QUIET_DAYS = 90
/** Days after being added before a never-worked sub gets the nudge. */
export const BENCH_NEVER_WORKED_DAYS = 60
/** Inside this many days the dot is green. */
export const RECENT_WORK_DAYS = 60
/** Beyond this many days the dot is gray. */
export const LONG_QUIET_DAYS = 180

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseYmd(ymd: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

/** Civil day difference b − a (no zone math). Null when either is malformed. */
export function daysBetweenYmd(a: string | null | undefined, b: string | null | undefined): number | null {
  const pa = parseYmd(a)
  const pb = parseYmd(b)
  if (!pa || !pb) return null
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000)
}

/** "2026-08-28" → "Aug 28" (same year as today) or "Aug 28, 2025". */
export function shortDateLabel(ymd: string, todayYmd: string): string {
  const p = parseYmd(ymd)
  if (!p) return ymd
  const t = parseYmd(todayYmd)
  const base = `${MONTHS[p.m - 1]} ${p.d}`
  return t && t.y === p.y ? base : `${base}, ${p.y}`
}

/** "4 months" / "1 month" / "3 weeks" / "6 days" for a positive day count. */
export function agoLabel(days: number): string {
  if (days >= 60) return `${Math.floor(days / 30)} months`
  if (days >= 30) return '1 month'
  if (days >= 14) return `${Math.floor(days / 7)} weeks`
  if (days >= 7) return '1 week'
  return `${Math.max(days, 0)} day${days === 1 ? '' : 's'}`
}

const BENCH_LINE = /^\[bench (\d{4}-\d{2}-\d{2})\]\s*(.*)$/
const BACK_LINE = /^\[back (\d{4}-\d{2}-\d{2})\]\s*$/

/** The note line written when benching. */
export function benchNoteLine(ymd: string, reason: string): string {
  const r = reason.trim().replace(/\s+/g, ' ')
  return r ? `[bench ${ymd}] ${r}` : `[bench ${ymd}]`
}

/** The note line written when reactivating. */
export function backNoteLine(ymd: string): string {
  return `[back ${ymd}]`
}

/** Append a dated line to the roster notes, keeping whatever was there. */
export function appendNoteLine(notes: string | null | undefined, line: string): string {
  const base = (notes ?? '').replace(/\s+$/, '')
  return base ? `${base}\n${line}` : line
}

/**
 * The reason from the newest `[bench …]` line that is not followed by a `[back …]` line.
 * Null when the notes carry no bench line for the current stint.
 */
export function currentBenchReason(notes: string | null | undefined): string | null {
  const lines = (notes ?? '').split(/\r?\n/)
  let reason: string | null = null
  for (const raw of lines) {
    const line = raw.trim()
    const b = BENCH_LINE.exec(line)
    if (b) {
      reason = (b[2] ?? '').trim() || null
      continue
    }
    if (BACK_LINE.test(line)) reason = null
  }
  return reason
}

export function subBenchStatus(input: SubBenchInput, todayYmd: string): SubBenchStatus {
  const onBench = Boolean(parseYmd(input.endDate))
  const last = parseYmd(input.lastWorkedYmd) ? input.lastWorkedYmd!.slice(0, 10) : null
  const daysSinceWork = last ? daysBetweenYmd(last, todayYmd) : null
  const daysSinceAdded = input.createdYmd ? daysBetweenYmd(input.createdYmd.slice(0, 10), todayYmd) : null

  const lastWorkedLine = last
    ? daysSinceWork != null && daysSinceWork >= RECENT_WORK_DAYS
      ? `last worked ${shortDateLabel(last, todayYmd)} · ${agoLabel(daysSinceWork)}`
      : `last worked ${shortDateLabel(last, todayYmd)}`
    : input.createdYmd
      ? `never worked · added ${shortDateLabel(input.createdYmd.slice(0, 10), todayYmd)}`
      : 'never worked'

  if (onBench) {
    const since = input.endDate!.slice(0, 10)
    const workedAfterBench = last != null && last > since
    return {
      kind: 'bench',
      since,
      reason: currentBenchReason(input.notes),
      lastWorkedYmd: last,
      lastWorkedLine,
      tone: workedAfterBench ? 'amber' : 'gray',
      nudge: workedAfterBench ? { kind: 'reactivate', text: `New work on ${shortDateLabel(last!, todayYmd)}` } : null,
    }
  }

  let tone: SubBenchStatus['tone'] = 'green'
  if (daysSinceWork == null) tone = daysSinceAdded != null && daysSinceAdded >= BENCH_NEVER_WORKED_DAYS ? 'gray' : 'amber'
  else if (daysSinceWork >= LONG_QUIET_DAYS) tone = 'gray'
  else if (daysSinceWork >= RECENT_WORK_DAYS) tone = 'amber'

  let nudge: SubBenchNudge | null = null
  if (daysSinceWork != null && daysSinceWork >= BENCH_QUIET_DAYS) nudge = { kind: 'bench', text: `Quiet for ${agoLabel(daysSinceWork)}` }
  else if (daysSinceWork == null && daysSinceAdded != null && daysSinceAdded >= BENCH_NEVER_WORKED_DAYS) nudge = { kind: 'bench', text: `No work in ${agoLabel(daysSinceAdded)}` }

  return { kind: 'active', since: null, reason: null, lastWorkedYmd: last, lastWorkedLine, tone, nudge }
}

/** Active rows: money first (as the table always did), then most recently worked, then name. Bench rows: most recently worked, then name. */
export function compareSubsForBench<T extends { balanceDue: number; committedTotal: number; name: string }>(a: T, b: T, sa: SubBenchStatus, sb: SubBenchStatus): number {
  if (sa.kind !== sb.kind) return sa.kind === 'active' ? -1 : 1
  if (sa.kind === 'active') {
    const money = b.balanceDue - a.balanceDue || b.committedTotal - a.committedTotal
    if (money !== 0) return money
  }
  const la = sa.lastWorkedYmd ?? ''
  const lb = sb.lastWorkedYmd ?? ''
  if (la !== lb) return la > lb ? -1 : 1
  return a.name.localeCompare(b.name)
}
