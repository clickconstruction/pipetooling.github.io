/**
 * The Lien desk's first view on a phone, as one list by the day each row is due (punch list #352, PR 3).
 *
 * A computer reads the rows in the groups `groupLienNextUp` makes: whose move it is first, then *Needs you now*
 * and *Coming up* by a seven-day line. On a phone a person asks a plainer question: what is due, by when, and for
 * how much. So there the two day-driven groups are pooled and split by the day itself, each head saying the day,
 * how long is left and the money its jobs hold. The groups that say whose move it is (only you can sign, only you
 * can approve, waiting on the leader, the reminders) keep their place and their words: who must act is not a date.
 *
 * Pure. It regroups rows the desk already built; it reads nothing and counts no money of its own beyond the sum.
 */
import { lienMonthDayWords } from './lienMonthLine'
import type { LienNextUpGroup, LienNextUpRow } from './lienNextUp'
import { lienStepTiles, type LienStepAt, type LienStepLadder } from './lienNextUpSteps'

export type LienPhoneTone = 'red' | 'amber' | 'quiet'

export type LienPhoneGroup = {
  /** Unique on the list: the group's own name, or `day:2026-11-16`. */
  key: string
  /** The desk's group the rows came from; `day` for a day the phone made. */
  group: LienNextUpGroup | 'day'
  label: string
  /** How long is left to the group's day, for a day group; null for a group that is not a day. */
  left: string | null
  tone: LienPhoneTone
  rows: LienNextUpRow[]
  /** The open money on the group's jobs, each job once; null when no row's amount is known. */
  amount: number | null
}

type Grouped = { group: LienNextUpGroup; label: string; rows: ReadonlyArray<LienNextUpRow> }

/** The day-driven groups, in the two pools a phone draws as days: what needs a person now (at risk or on track), and what is coming. */
const POOLS: ReadonlyArray<ReadonlySet<LienNextUpGroup>> = [new Set<LienNextUpGroup>(['risk', 'now']), new Set<LienNextUpGroup>(['coming'])]

/** *3 days*, *today*, *2 days late*. */
export function lienPhoneLeftWords(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} ${daysLeft === -1 ? 'day' : 'days'} late`
  if (daysLeft === 0) return 'today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`
}

/** Red inside three days or late, amber inside a week: the desk's own lines for a deadline. */
export function lienPhoneTone(daysLeft: number | null): LienPhoneTone {
  if (daysLeft == null) return 'quiet'
  return daysLeft <= 3 ? 'red' : daysLeft <= 7 ? 'amber' : 'quiet'
}

function sumOnce(rows: ReadonlyArray<LienNextUpRow>, amountFor: (row: LienNextUpRow) => number | null): number | null {
  const byJob = new Map<string, number>()
  for (const r of rows) {
    const n = amountFor(r)
    if (n == null) continue
    // A job with two papers on the same day is one debt: keep it once.
    byJob.set(r.jobId ?? r.key, n)
  }
  if (byJob.size === 0) return null
  let total = 0
  for (const n of byJob.values()) total += n
  return total
}

/** The one group for the rows that have no day of their own. */
const NO_DAY_KEY = 'day:none'

function dayGroups(rows: ReadonlyArray<LienNextUpRow>, amountFor: (row: LienNextUpRow) => number | null): LienPhoneGroup[] {
  const byDay = new Map<string, LienNextUpRow[]>()
  for (const r of rows) {
    const day = r.dueOn ?? ''
    const list = byDay.get(day)
    if (list) list.push(r)
    else byDay.set(day, [r])
  }
  // Soonest first; the rows with no day of their own last. Inside a day the desk's own order stands.
  const days = [...byDay.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? -1 : a > b ? 1 : 0))
  return days.map((day) => {
    const list = byDay.get(day)!
    if (day === '') return { key: NO_DAY_KEY, group: 'day' as const, label: 'No day set', left: null, tone: 'quiet' as const, rows: list, amount: sumOnce(list, amountFor) }
    const daysLeft = list.find((r) => r.daysLeft != null)?.daysLeft ?? null
    const words = lienMonthDayWords(day)
    const label = daysLeft == null ? `Due ${words}` : daysLeft < 0 ? `Was due ${words}` : `Due ${words}`
    return { key: `day:${day}`, group: 'day' as const, label, left: daysLeft == null ? null : lienPhoneLeftWords(daysLeft), tone: lienPhoneTone(daysLeft), rows: list, amount: sumOnce(list, amountFor) }
  })
}

/**
 * The desk's groups as a phone draws them. The day-driven groups become days, each pool at the place the first of
 * its groups stood; every other group passes through with its label.
 *
 * Since v2.7371 (punch list #362, step 2) the days come in two pools. The rows that need a person now, at risk
 * and on track, are one run of days with the rows at risk first inside each day; the approvals the office waits
 * on follow them; the days coming up stand after, where *Coming up* stood. Before, every day stood together and
 * the waiting rows closed the list.
 *
 * The rows with no day of their own are one group, the list's last (the owner's go of 2026-11-23). Each pool ended
 * with its own, so a list with such a row in both pools said *No day set* twice, once in the middle of the days and
 * once at the end, under one key.
 */
export function lienPhoneGroups(groups: ReadonlyArray<Grouped>, amountFor: (row: LienNextUpRow) => number | null): LienPhoneGroup[] {
  const out: LienPhoneGroup[] = []
  const drawn = new Set<number>()
  for (const g of groups) {
    const pool = POOLS.findIndex((p) => p.has(g.group))
    if (pool >= 0) {
      if (!drawn.has(pool)) out.push(...dayGroups(groups.filter((x) => POOLS[pool]!.has(x.group)).flatMap((x) => x.rows), amountFor))
      drawn.add(pool)
      continue
    }
    out.push({ key: g.group, group: g.group, label: g.label, left: null, tone: 'quiet', rows: [...g.rows], amount: sumOnce(g.rows, amountFor) })
  }
  const noDay = out.filter((g) => g.key === NO_DAY_KEY)
  if (noDay.length === 0) return out
  const rows = noDay.flatMap((g) => g.rows)
  return [...out.filter((g) => g.key !== NO_DAY_KEY), { ...noDay[0]!, rows, amount: sumOnce(rows, amountFor) }]
}

type Owed = { jobId: string; openBalance: number }

/**
 * What each row's job still owes, from the entries the desk already holds: an affidavit row reads the affidavit's
 * entry, a retainage row the retainage entry, a notice row the notice's. A run row stands for many jobs and has no
 * one amount. A job with nothing open reads as no amount, not as $0.
 */
export function lienPhoneAmounts(input: { notices: ReadonlyArray<Owed>; affidavits: ReadonlyArray<Owed>; retainage: ReadonlyArray<Owed> }): (row: Pick<LienNextUpRow, 'kind' | 'jobId'>) => number | null {
  const map = (list: ReadonlyArray<Owed>) => new Map(list.map((e) => [e.jobId, e.openBalance]))
  const notices = map(input.notices)
  const affidavits = map(input.affidavits)
  const retainage = map(input.retainage)
  return (row) => {
    if (!row.jobId) return null
    const own = row.kind === 'affidavit' ? affidavits : row.kind === 'retainage' ? retainage : notices
    const n = own.get(row.jobId) ?? notices.get(row.jobId) ?? affidavits.get(row.jobId) ?? retainage.get(row.jobId)
    return n != null && n > 0 ? n : null
  }
}

/**
 * The step a row stands on, in words, beside its four dots: *File · you*, *Approve · leader*. On a phone the dots
 * take the place of four named tiles, and these words keep what the tiles said: the step's name and whose it is.
 */
export function lienPhoneStepWords(at: LienStepAt | null, ladder: LienStepLadder, viewerIsLeader: boolean): string {
  const now = lienStepTiles(at, ladder, viewerIsLeader)?.find((t) => t.state === 'now')
  if (!now) return ''
  return now.who ? `${now.label} · ${now.who}` : now.label
}
