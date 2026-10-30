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
 * was said. Pure.
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

/** A line's number as it stands this report: a paid draw is 100, else the tech's pick, else what is on record (0 when nothing is). */
export function linePct(row: StageProgressRow, picks: LinePicks): number {
  if (row.drawPaid) return 100
  const pick = picks[row.fixtureId]
  if (pick != null && Number.isFinite(pick)) return clamp(Math.round(pick))
  return stageEffectivePct(row)
}

export function lineIsDone(row: StageProgressRow, picks: LinePicks): boolean {
  return row.drawPaid || linePct(row, picks) >= 100
}

/** Σ share × line percent over every line, rounded to a whole point. */
export function jobPercentFromLines(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks): number {
  let sum = 0
  for (const r of rows) sum += (r.weightPct / 100) * linePct(r, picks)
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
    const pick = picks[r.fixtureId]
    if (pick == null || !Number.isFinite(pick)) continue
    const to = clamp(Math.round(pick))
    if (to === stageEffectivePct(r)) continue
    out.push({ fixtureId: r.fixtureId, name: r.name, from: r.progressPct, to })
  }
  return out
}

/**
 * The job line under the list: `before` is the job's number on record when the
 * caller has it (the office may have typed one the lines do not add up to), else
 * what the lines say; `after` is what the lines say with the picks.
 */
export function jobLine(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks, recordedPct?: number | null): { before: number; after: number; moved: boolean } {
  const fromLines = jobPercentFromLines(rows, {})
  const before = recordedPct != null && Number.isFinite(recordedPct) ? clamp(Math.round(recordedPct)) : fromLines
  const after = jobPercentFromLines(rows, picks)
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
 * saves and a table that does not add up is worse than none.
 */
export function howRows(rows: ReadonlyArray<StageProgressRow>, picks: LinePicks): { rows: HowRow[]; total: number } {
  const total = jobPercentFromLines(rows, picks)
  const raw = rows.map((r) => (r.weightPct / 100) * linePct(r, picks))
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
    const standing = r.drawPaid ? 'paid' : pct >= 100 ? 'done' : picks[r.fixtureId] == null && r.progressPct == null ? '—' : `${pct}%`
    return { fixtureId: r.fixtureId, name: r.name, sharePct: Math.round(r.weightPct), standing, points: points[i]! }
  })
  return { rows: out, total }
}
