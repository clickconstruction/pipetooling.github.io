/**
 * The Day book's month rhythm grid (to-dos/day-book, PR 3).
 *
 * Rows are kinds of work, columns are days, a cell carries the initials of who did it.
 * The grid answers "is the work getting done, by whom, and where are the gaps" — it never
 * shades by volume. The signal is an empty run: three working days with nothing on a row
 * while that queue held work turn amber. Whether the queue held work is the caller's
 * knowledge (`queueHeldWork`); until history carries the queue, it answers `null` and the
 * grid stays honest — an empty run is `none`, never `gap`.
 *
 * Working days come from the sessions in the payload: a day nobody clocked in is `closed`
 * (a weekend, a holiday) and neither breaks nor extends a run. Today is outlined and does
 * not count toward a run — the day is not over. Pure.
 */
import { DAY_BOOK_CHIPS, dayBookShiftYmd, type DayBookChip, type DayBookKind, type DayBookView } from './dayBook'

export type RhythmCellState = 'done' | 'none' | 'gap' | 'closed' | 'today' | 'future'

export type RhythmCell = {
  day: string
  state: RhythmCellState
  /** Who did this kind of work that day, in first-seen order. */
  who: Array<{ initials: string; name: string; count: number }>
}

export type RhythmRow = {
  chip: DayBookChip
  label: string
  kinds: ReadonlyArray<DayBookKind>
  cells: RhythmCell[]
  /** Working days (up to today) on which someone did this kind of work. Work done on a closed day (a Saturday approval) shows in its cell but is not coverage. */
  doneDays: number
  /** The longest amber run, in working days (0 when the queue is unknown). */
  longestGap: number
}

export type RhythmGrid = {
  from: string
  to: string
  days: string[]
  /** Days with clock time in the payload, up to today. */
  workingDays: number
  rows: RhythmRow[]
  /** Initials → name, for the legend. */
  legend: Array<{ initials: string; name: string }>
}

export type RhythmOptions = {
  /** Today on the company calendar (YYYY-MM-DD). */
  today: string
  /**
   * Did this queue hold work at the end of that day? `true` makes an empty run eligible
   * for amber, `false` says the row was empty because there was nothing to do, `null`
   * says the app does not know (history before the queue is reconstructed).
   */
  queueHeldWork: (chip: DayBookChip, day: string) => boolean | null
  /** Working days of nothing, while the queue held work, before a run turns amber. Default 3. */
  gapAfterDays?: number
}

/** "Taunya" → "T", "Robert Douglas" → "RD", "Mary Ann Lee" → "ML". */
export function dayBookInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]!.charAt(0)
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return `${first}${last}`.toUpperCase()
}

/** Every YYYY-MM-DD from `from` to `to`, inclusive. */
export function dayBookDaysBetween(from: string, to: string): string[] {
  const out: string[] = []
  let d = from
  for (let i = 0; i < 400 && d <= to; i++) {
    out.push(d)
    d = dayBookShiftYmd(d, 1)
  }
  return out
}

/** The calendar month holding `ymd`. */
export function dayBookMonthOf(ymd: string): { from: string; to: string } {
  const d = new Date(`${ymd}T12:00:00Z`)
  const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12))
  const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** The month `months` away from the one holding `ymd`. */
export function dayBookShiftMonth(ymd: string, months: number): { from: string; to: string } {
  const d = new Date(`${ymd}T12:00:00Z`)
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 12))
  return dayBookMonthOf(first.toISOString().slice(0, 10))
}

/** "September 2026" */
export function dayBookMonthLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** The rows the grid draws: every chip that names kinds (Schedule joins with its ledger). */
export function rhythmRowDefs(): Array<{ chip: DayBookChip; label: string; kinds: ReadonlyArray<DayBookKind> }> {
  return DAY_BOOK_CHIPS.filter((c) => c.id !== 'everything' && c.kinds.length > 0).map((c) => ({ chip: c.id, label: c.label, kinds: c.kinds }))
}

export function buildRhythm(view: DayBookView, opts: RhythmOptions): RhythmGrid {
  const gapAfter = Math.max(1, opts.gapAfterDays ?? 3)
  const days = dayBookDaysBetween(view.from, view.to)
  const dayInfo = new Map(view.days.map((d) => [d.day, d] as const))
  const legendMap = new Map<string, string>()
  const initialsFor = (name: string): string => {
    let ini = dayBookInitials(name)
    // Two people with the same initials: the second takes a longer first-name prefix.
    const taken = legendMap.get(ini)
    if (taken && taken !== name) {
      const first = name.trim().split(/\s+/)[0] ?? name
      for (let n = 2; n <= first.length; n++) {
        const cand = `${first.slice(0, n)}${name.trim().split(/\s+/).length > 1 ? name.trim().split(/\s+/).pop()!.charAt(0) : ''}`
        const t = legendMap.get(cand)
        if (!t || t === name) {
          ini = cand
          break
        }
      }
    }
    legendMap.set(ini, name)
    return ini
  }

  const isWorking = (day: string): boolean => (dayInfo.get(day)?.hoursMs ?? 0) > 0 || (dayInfo.get(day)?.people.some((p) => p.spans.length > 0) ?? false)
  const workingDays = days.filter((d) => d <= opts.today && isWorking(d)).length

  const rows: RhythmRow[] = rhythmRowDefs().map((def) => {
    const kinds = new Set<string>(def.kinds)
    const cells: RhythmCell[] = days.map((day) => {
      const info = dayInfo.get(day)
      const who: RhythmCell['who'] = []
      if (info) {
        for (const p of info.people) {
          const count = p.lines.filter((l) => kinds.has(l.kind)).reduce((acc, l) => acc + l.count, 0)
          if (count > 0) who.push({ initials: initialsFor(p.name), name: p.name, count })
        }
      }
      let state: RhythmCellState
      if (day > opts.today) state = 'future'
      else if (who.length > 0) state = 'done'
      else if (day === opts.today) state = 'today'
      else if (!isWorking(day)) state = 'closed'
      else state = 'none'
      return { day, state, who }
    })

    // Runs of `none` while the queue held work; closed days are skipped, not counted.
    let run: number[] = []
    let longest = 0
    const flush = () => {
      if (run.length >= gapAfter) {
        for (const i of run) cells[i]!.state = 'gap'
        longest = Math.max(longest, run.length)
      }
      run = []
    }
    cells.forEach((c, i) => {
      if (c.state === 'closed') return
      if (c.state === 'none' && opts.queueHeldWork(def.chip, c.day) === true) run.push(i)
      else flush()
    })
    flush()

    return {
      chip: def.chip,
      label: def.label,
      kinds: def.kinds,
      cells,
      doneDays: cells.filter((c) => c.state === 'done' && isWorking(c.day)).length,
      longestGap: longest,
    }
  })

  const legend = [...legendMap.entries()].map(([initials, name]) => ({ initials, name })).sort((a, b) => a.name.localeCompare(b.name))
  return { from: view.from, to: view.to, days, workingDays, rows, legend }
}

/** The sentence a row's coverage reads as: "applied on 9 of 20 working days · longest gap 4 days". */
export function rhythmRowSentence(row: RhythmRow, workingDays: number): string {
  const verb: Record<DayBookChip, string> = {
    everything: 'done',
    billing: 'billed',
    deposits: 'applied',
    contracts: 'sent or filed',
    approvals: 'approved',
    schedule: 'updated',
  }
  const base = `${verb[row.chip]} on ${row.doneDays} of ${workingDays} working ${workingDays === 1 ? 'day' : 'days'}`
  return row.longestGap > 0 ? `${base} · longest gap ${row.longestGap} days` : base
}
