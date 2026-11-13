/**
 * The History look's folds (the Gray Fox spike, 2026-11-02). One act by one person on one piece on one
 * day often leaves many lines: the Nov 1 merge of six HouseCall Pro shells into JP629 wrote ten *Combined
 * … into this job* notes and five identical *Ready to Bill · moved from Paid* moves, fifteen lines before
 * the first other thing. A run of three or more neighbouring lines that share the day, the kind, the verb,
 * the piece and the person folds into one line that says how many and carries every detail, so *more ›*
 * opens the whole of it. Questions, answers and kept entries never fold: each is its own act. Pure.
 */
import type { ChangeKind, ChangeLine } from './whatChanged'

/** A run shorter than this stays as it is: two lines read fine on their own. */
export const FOLD_RUN_MIN = 3

/** The kinds that fold: what the records wrote by themselves, never what a person asked or kept. */
const FOLDABLE: ReadonlySet<ChangeKind> = new Set<ChangeKind>(['note', 'stage', 'billed', 'paid', 'plans', 'sent', 'contact', 'new_bid', 'new_job', 'won', 'lost'])

const NOUNS: Partial<Record<ChangeKind, [string, string]>> = {
  note: ['note', 'notes'],
  stage: ['stage move', 'stage moves'],
  billed: ['bill', 'bills'],
  paid: ['payment', 'payments'],
  plans: ['plan filing', 'plan filings'],
  sent: ['send', 'sends'],
  contact: ['contact', 'contacts'],
  new_bid: ['new bid', 'new bids'],
  new_job: ['new job', 'new jobs'],
  won: ['win', 'wins'],
  lost: ['loss', 'losses'],
}

export type FoldedLine = ChangeLine & {
  /** How many lines the fold holds; absent on a line that stands alone. */
  foldedCount?: number
  /** The lines inside, newest first. */
  folded?: ChangeLine[]
}

function runKey(line: ChangeLine, dayKey: (iso: string) => string): string | null {
  if (!FOLDABLE.has(line.kind) || line.waitingDays != null) return null
  return [dayKey(line.at), line.kind, line.verb, line.about.kind, line.about.id ?? '', line.by ?? ''].join('\u0000')
}

/** The one line a run becomes: the newest line's stamp and badge, the count in the words, every detail inside. */
export function foldRun(run: readonly ChangeLine[]): FoldedLine {
  const first = run[0]!
  const n = run.length
  const [one, many] = NOUNS[first.kind] ?? ['line', 'lines']
  const details = run.map((l) => (l.detail ?? '').trim()).filter(Boolean)
  const distinct = [...new Set(details)]
  let detail: string
  if (distinct.length === 0) detail = `${n} ${many} this day`
  else if (distinct.length === 1) detail = `${distinct[0]} · ${n} ${n === 1 ? one : many} this day`
  else detail = `${n} ${many} this day:\n${details.join('\n')}`
  return { ...first, id: `fold:${first.id}`, detail, foldedCount: n, folded: [...run] }
}

/**
 * The feed with its runs folded. `dayKey` says which calendar day a stamp falls on (the app's time zone,
 * not the browser's). Lines arrive newest first and only neighbours fold, so a line of another kind
 * between two notes keeps them apart, as it should: something else happened in between.
 */
export function foldSameDayRuns(lines: readonly ChangeLine[], dayKey: (iso: string) => string, minRun: number = FOLD_RUN_MIN): FoldedLine[] {
  const out: FoldedLine[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const key = runKey(line, dayKey)
    if (key === null) {
      out.push(line)
      i += 1
      continue
    }
    let j = i + 1
    while (j < lines.length && runKey(lines[j]!, dayKey) === key) j += 1
    const run = lines.slice(i, j)
    if (run.length >= minRun) out.push(foldRun(run))
    else out.push(...run)
    i = j
  }
  return out
}
