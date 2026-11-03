/**
 * Report by line (punch list #130, v2.5661 — the owner's ask of 2026-10-20).
 *
 * A field report used to ask "How complete is the job?", and a tech halfway
 * through the rough-in typed 50, meaning the piece they stood in. On a job
 * with two or more priced lines the report now lists the lines in plan order
 * and asks how far along each one is; the job's percent is Σ share × line
 * percent, the share a line's part of the priced lines' value, computed by
 * `list_job_stage_progress` so no price reaches the field (the v2.3192 rule,
 * with many lines moved at once instead of one stage). The derived number
 * still lands in "How complete is the job?", so nothing downstream changes.
 *
 * The rows are v2.3192's `StageProgressRow`s: an Order stage (declared on the
 * Bill tab or recognized by name) is numbered, an Any-time line reads ◆, a
 * discount row never lists, and a line whose draw is paid is done whatever
 * was said.
 *
 * Since v2.6391 (job 804, 2026-11-02) a line nobody has reported does not count
 * as 0 when the job's recorded percent says otherwise: the office had billed
 * 804 in full and set it to 100, a crew report moved Rough In to 100, and the
 * two stages nobody had ever reported counted as 0, so the job fell to 40 and
 * the report read *job 100% → 40%*. `unreportedLineSeed` holds the rule; every
 * sum that is given the recorded percent reads through it. Pure.
 */

import { stageEffectivePct, type StageProgressRow } from './stageProgressReport'

/** The lines the tech moved this report: fixture id → the percent they set. */
export type LinePicks = Readonly<Record<string, number>>

export type MovedLine = {
  fixtureId: string
  name: string
  /** The number on record before this report; null when nobody had said one. */
  from: number | null
  to: number
}

/** Since punch list #189, PR 5a, the question says stage, the owner's word; the kernel keeps its line names. */
export const LINES_QUESTION = 'How far along is each stage?'
export const LINES_HINT = 'Move the ones you worked on. The rest stay as they are.'
export const WHOLE_JOB_LINK = 'Set the whole-job % instead'
export const MARK_EACH_LINE_LINK = 'Mark each line instead'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** The list shows on a job with two or more priced lines; a one-line job keeps the slider. */
export function linesModeAvailable(rows: ReadonlyArray<StageProgressRow>): boolean {
  return rows.length >= 2
}

/** "—" for a number nobody has said, else "50%". */
export function pctWord(n: number | null | undefined): string {
  return n == null ? '—' : `${n}%`
}

/** The tech's pick on a line when it differs from what is on record (0 when nothing is); a pick put back where it stood is no pick. */
function pickOf(row: StageProgressRow, picks: LinePicks): number | null {
  const pick = picks[row.fixtureId]
  if (pick == null || !Number.isFinite(pick)) return null
  const to = clamp(Math.round(pick))
  return to === stageEffectivePct(row) ? null : to
}

/**
 * What a line nobody has reported counts as in the job's sum, given the job's
 * recorded percent: the points the recorded percent carries beyond the lines
 * that have a number (and the paid draws), spread evenly by weight over the
 * lines with none, clamped to 0..100 and left unrounded so the lines add up to
 * the record. A job at 100 with nothing reported reads every line as done; a
 * job at 60 reads them at 60; a job at 40 because Rough In (40% of it) is done
 * reads the rest at 0, where "every unreported line reads the job's %" would
 * count Rough In twice. null when there is no record, or no line is unreported.
 */
export function unreportedLineSeed(rows: ReadonlyArray<StageProgressRow>, recordedPct?: number | null): number | null {
  if (recordedPct == null || !Number.isFinite(recordedPct)) return null
  let knownPts = 0
  let openWeight = 0
  for (const r of rows) {
    if (r.drawPaid || r.progressPct != null) knownPts += (r.weightPct / 100) * stageEffectivePct(r)
    else openWeight += r.weightPct
  }
  if (openWeight <= 0) return null
  return clamp(((clamp(recordedPct) - knownPts) / openWeight) * 100)
}

/**
 * A line's number as it stands this report: a paid draw is 100, else the tech's pick, else what is
 * on record, else the seed when the caller has one (`unreportedLineSeed`), else 0. The seed is the
 * sum's business: the row on the screen still reads *not started* and its control opens on 0.
 */
export function linePct(row: StageProgressRow, picks: LinePicks, seedPct?: number | null): number {
  if (row.drawPaid) return 100
  const pick = pickOf(row, picks)
  if (pick != null) return pick
  if (row.progressPct == null && seedPct != null && Number.isFinite(seedPct)) return clamp(seedPct)
  return stageEffectivePct(row)
}

export function lineIsDone(row: StageProgressRow, picks: LinePicks): boolean {
  return row.drawPaid || linePct(row, picks) >= 100
}

/**
 * Σ share × line percent over every line, rounded to a whole point. With the job's recorded percent
 * the lines nobody has reported count as `unreportedLineSeed` says, so a move on one line changes
 * the sum by that line's share alone and the job never falls because of lines nobody touched.
 */
export function jobPercentFromLines(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks, recordedPct?: number | null): number {
  const seed = unreportedLineSeed(rows, recordedPct)
  let sum = 0
  for (const r of rows) sum += (r.weightPct / 100) * linePct(r, picks, seed)
  return clamp(Math.round(sum))
}

/** The row that opens by itself: the first Order stage not yet done, else the first Any-time line not done, else none. */
export function defaultOpenLine(rows: ReadonlyArray<StageProgressRow>): StageProgressRow | null {
  const notDone = (r: StageProgressRow) => !lineIsDone(r, {})
  return rows.find((r) => r.kind === 'order' && notDone(r)) ?? rows.find((r) => r.kind === 'any' && notDone(r)) ?? null
}

/** The lines whose pick differs from what is on record, in row order; a paid draw never moves. */
export function movedLines(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks): MovedLine[] {
  const out: MovedLine[] = []
  for (const r of rows) {
    if (r.drawPaid) continue
    const to = pickOf(r, picks)
    if (to == null) continue
    out.push({ fixtureId: r.fixtureId, name: r.name, from: r.progressPct, to })
  }
  return out
}

/**
 * The job line under the list: `before` is the job's number on record when the
 * caller has it (the office may have typed one the lines do not add up to), else
 * what the lines say; `after` is what the lines say with the picks, the lines
 * nobody has reported seeded from the record (v2.6391).
 */
export function jobLine(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks, recordedPct?: number | null): { before: number; after: number; moved: boolean } {
  const before = recordedPct != null && Number.isFinite(recordedPct) ? clamp(Math.round(recordedPct)) : jobPercentFromLines(rows, {})
  const after = jobPercentFromLines(rows, picks, recordedPct)
  return { before, after, moved: movedLines(rows, picks).length > 0 }
}

/**
 * The report's "Stage progress" field, one clause per moved line and the job's
 * move: "Rough In 35% → 50% · Water heater — → 100% · job 32% → 43%". Empty
 * when nothing moved, so the field is left off the report.
 */
export function lineProgressFieldValue(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks, recordedPct?: number | null): string {
  const moved = movedLines(rows, picks)
  if (moved.length === 0) return ''
  const { before, after } = jobLine(rows, picks, recordedPct)
  return [...moved.map((m) => `${m.name} ${pctWord(m.from)} → ${pctWord(m.to)}`), `job ${before}% → ${after}%`].join(' · ')
}

export type LineWordsTone = 'paid' | 'done' | 'up' | 'down' | 'plain' | 'none'

/** A row nobody has reported yet reads this (punch list #189, PR 5a); the saved field keeps "—". */
export const LINE_NOT_STARTED = 'not started'
/** The how? table's standing for such a row when the job's record seeds it: "counts as 60%" (v2.6391). */
export const LINE_COUNTS_AS = 'counts as'

/** The right side of a row: "✓ Paid" · "✓ Done" · "35% → 50%" (moved) · "35%" · "not started". */
export function lineWords(row: StageProgressRow, picks: LinePicks): { text: string; tone: LineWordsTone } {
  if (row.drawPaid) return { text: '✓ Paid', tone: 'paid' }
  const was = stageEffectivePct(row)
  const now = linePct(row, picks)
  if (now !== was) {
    const toWord = now >= 100 ? '✓ Done' : `${now}%`
    return { text: `${pctWord(row.progressPct)} → ${toWord}`, tone: now > was ? 'up' : 'down' }
  }
  if (now >= 100) return { text: '✓ Done', tone: 'done' }
  if (row.progressPct == null) return { text: LINE_NOT_STARTED, tone: 'none' }
  return { text: `${now}%`, tone: 'plain' }
}

export type HowRow = { fixtureId: string; name: string; sharePct: number; standing: string; points: number }

/**
 * The arithmetic behind the job line, for the tech who asks: each line's share,
 * where it stands, its points. The points are whole numbers that add up to the
 * job's number exactly (largest-remainder rounding — found on the live walk,
 * where 55 + 23 sat over a total of 77), since the total is what the report
 * saves and a table that does not add up is worse than none. A line nobody has
 * reported stands *counts as 60%* when the record seeds it, so the tech can see
 * where the job's points sit.
 */
export function howRows(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks, recordedPct?: number | null): { rows: HowRow[]; total: number } {
  const seed = unreportedLineSeed(rows, recordedPct)
  const total = jobPercentFromLines(rows, picks, recordedPct)
  const raw = rows.map((r) => (r.weightPct / 100) * linePct(r, picks, seed))
  const points = raw.map((p) => Math.floor(p))
  let left = total - points.reduce((s, n) => s + n, 0)
  const byRemainder = raw.map((p, i) => ({ i, frac: p - Math.floor(p) })).sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of byRemainder) {
    if (left <= 0) break
    points[i] = points[i]! + 1
    left -= 1
  }
  const out: HowRow[] = rows.map((r, i) => {
    const pct = linePct(r, picks)
    const standing = r.drawPaid
      ? 'paid'
      : pickOf(r, picks) == null && r.progressPct == null
        ? seed == null
          ? '—'
          : `${LINE_COUNTS_AS} ${Math.round(seed)}%`
        : pct >= 100
          ? 'done'
          : `${pct}%`
    return { fixtureId: r.fixtureId, name: r.name, sharePct: Math.round(r.weightPct), standing, points: points[i]! }
  })
  return { rows: out, total }
}
