/**
 * Calibration — the labor book checks itself against finished jobs (the Labor
 * refresh PR 5). Two readings, both pure:
 *
 *   bookMultiplier   Over every job linked to a bid that priced with this book
 *                    (jobs_ledger.bid_id → bids.selected_labor_book_version_id),
 *                    Σ recorded field hours ÷ Σ hours the book predicted, with an
 *                    unfinished job's prediction scaled by its % done. A job counts
 *                    only when the book actually predicted hours for it, it is at
 *                    least 25 % done, and it has 8 or more field days — younger jobs
 *                    say nothing yet. "×1.18 light" means the crews ran 18 % over
 *                    the book.
 *   entryEvidence    Per book entry: the linked jobs whose count sheet matched it,
 *                    each with the hours the book put on that row and the job's
 *                    actual hours attributed to the row by the book's own share —
 *                    the row's predicted hours over the bid's predicted total — so
 *                    the fixture-level reading follows the same weights the estimate
 *                    used. Confidence is the count of jobs; the spread is "wide" when
 *                    the ratios disagree by more than a third.
 *
 * Nothing here writes: the drawer's Set button multiplies an entry's hours by
 * the median ratio and the tab persists it.
 */
import { matchLaborRow, type LaborBookMatchEntry } from './laborBookMatch'
import { laborRowHours } from './laborRowHours'

export const CALIBRATION_MIN_PCT_DONE = 25
export const CALIBRATION_MIN_FIELD_DAYS = 8
/** Ratios spread more than this (max ÷ min − 1) read as "wide". */
export const CALIBRATION_WIDE_SPREAD = 1 / 3

type PredictedRow = Parameters<typeof laborRowHours>[0] & { fixture: string | null }

export type CalibrationJob = {
  jobId: string
  label: string
  bidId: string
  /** 0–100; null = unknown. */
  pctDone: number | null
  fieldDays: number
  /** Recorded field hours on the job (team labor). */
  actualHours: number
  /** The bid's cost-estimate labor rows (what the book predicted, row by row). */
  rows: ReadonlyArray<PredictedRow>
}

export type CalibrationExclusion = 'no-prediction' | 'under-25-pct' | 'under-8-days' | 'no-hours'

export type CalibratedJob = {
  job: CalibrationJob
  predictedHours: number
  /** predicted × (% done ÷ 100) for an unfinished job; = predicted when done. */
  predictedToDate: number
  ratio: number
}

export type BookMultiplier = {
  /** Σ actual ÷ Σ predicted-to-date over the jobs used; null without any. */
  multiplier: number | null
  used: CalibratedJob[]
  excluded: Array<{ job: CalibrationJob; why: CalibrationExclusion }>
}

const predictedHoursOf = (rows: ReadonlyArray<PredictedRow>): number => rows.reduce((s, r) => s + laborRowHours(r), 0)

export function calibrationExclusion(job: CalibrationJob, predictedHours: number): CalibrationExclusion | null {
  if (!(predictedHours > 0)) return 'no-prediction'
  if (!(job.actualHours > 0)) return 'no-hours'
  if (job.pctDone == null || job.pctDone < CALIBRATION_MIN_PCT_DONE) return 'under-25-pct'
  if (job.fieldDays < CALIBRATION_MIN_FIELD_DAYS) return 'under-8-days'
  return null
}

export function bookMultiplier(jobs: ReadonlyArray<CalibrationJob>): BookMultiplier {
  const used: CalibratedJob[] = []
  const excluded: BookMultiplier['excluded'] = []
  for (const job of jobs) {
    const predicted = predictedHoursOf(job.rows)
    const why = calibrationExclusion(job, predicted)
    if (why) {
      excluded.push({ job, why })
      continue
    }
    const pct = Math.min(job.pctDone ?? 100, 100)
    const toDate = predicted * (pct / 100)
    used.push({ job, predictedHours: predicted, predictedToDate: toDate, ratio: job.actualHours / toDate })
  }
  const sumActual = used.reduce((s, u) => s + u.job.actualHours, 0)
  const sumPredicted = used.reduce((s, u) => s + u.predictedToDate, 0)
  return { multiplier: used.length > 0 && sumPredicted > 0 ? sumActual / sumPredicted : null, used, excluded }
}

/** "book runs ×1.18 light · 3 jobs" / "book runs ×0.92 heavy · 2 jobs" / "no linked finished jobs yet". */
export function bookMultiplierWords(m: BookMultiplier): string {
  if (m.multiplier == null) return m.excluded.length > 0 ? `no job says yet — ${m.excluded.length} linked but too young or unpriced` : 'no linked jobs yet'
  const n = m.used.length
  const x = m.multiplier
  const side = Math.abs(x - 1) < 0.03 ? 'on the money' : x > 1 ? 'light' : 'heavy'
  return `book runs ×${x.toFixed(2)} ${side} · ${n} job${n === 1 ? '' : 's'}`
}

export type EntryEvidenceRow = {
  jobId: string
  jobLabel: string
  pctDone: number | null
  /** The hours the book put on this row of the count sheet. */
  predictedHours: number
  /** The job's actual hours attributed to this row by the book's own share, scaled to the work done. */
  actualShareHours: number
  ratio: number
}

export type EntryEvidence = {
  entryId: string
  rows: EntryEvidenceRow[]
  /** Median of the ratios; null without rows. */
  medianRatio: number | null
  spread: 'agree' | 'wide' | 'none'
  words: string
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** The evidence behind every entry of the book, from the jobs the multiplier used. */
export function entryEvidence(entries: ReadonlyArray<LaborBookMatchEntry>, used: ReadonlyArray<CalibratedJob>): Map<string, EntryEvidence> {
  const rowsByEntry = new Map<string, EntryEvidenceRow[]>()
  for (const u of used) {
    const pct = Math.min(u.job.pctDone ?? 100, 100) / 100
    for (const row of u.job.rows) {
      const m = matchLaborRow(row.fixture, entries)
      if (!m) continue
      const predicted = laborRowHours(row)
      if (!(predicted > 0) || !(u.predictedHours > 0)) continue
      const share = predicted / u.predictedHours
      const actualShare = u.job.actualHours * share
      const predictedToDate = predicted * pct
      if (!(predictedToDate > 0)) continue
      const list = rowsByEntry.get(m.entry.id) ?? []
      list.push({ jobId: u.job.jobId, jobLabel: u.job.label, pctDone: u.job.pctDone, predictedHours: predicted, actualShareHours: actualShare, ratio: actualShare / predictedToDate })
      rowsByEntry.set(m.entry.id, list)
    }
  }
  const out = new Map<string, EntryEvidence>()
  for (const e of entries) {
    const rows = rowsByEntry.get(e.id) ?? []
    const med = median(rows.map((r) => r.ratio))
    const ratios = rows.map((r) => r.ratio)
    const spread: EntryEvidence['spread'] = rows.length === 0 ? 'none' : rows.length >= 2 && Math.max(...ratios) / Math.min(...ratios) - 1 > CALIBRATION_WIDE_SPREAD ? 'wide' : 'agree'
    const n = rows.length
    const words = n === 0 ? 'no jobs yet' : spread === 'wide' ? `${n} jobs · wide` : n === 1 ? '1 job' : `${n} jobs agree`
    out.set(e.id, { entryId: e.id, rows, medianRatio: med, spread, words })
  }
  return out
}

/** The hours Set would write: the entry's hours × the median ratio, to the quarter hour, never below 0. */
export function calibratedEntryHours(entry: Pick<LaborBookMatchEntry, 'rough' | 'top' | 'trim'>, medianRatio: number): { rough: number; top: number; trim: number } {
  const q = (n: number) => Math.max(0, Math.round(n * medianRatio * 4) / 4)
  return { rough: q(entry.rough), top: q(entry.top), trim: q(entry.trim) }
}
