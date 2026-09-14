import type { JobDayLedger } from './jobDayLedger'
import { JOB_RUN_AS_OF_JUMPS, asOfYmdForDaysBack, buildStatusSpans, jobRunDeltaSince, type JobRunDeltaSince } from './jobRunningTimeline'

/**
 * The Days view's since-then strip (item 7 of the Job Summary follow-ups):
 * the same "what changed since" counts Timeline shows under a rewound chart,
 * driven by a week chip instead of a slider. Days has no as-of state of its
 * own, so the kernel derives everything from the day ledger the view already
 * holds: status spans → today's rows → `jobRunDeltaSince` from the as-of day.
 */
export type JobDaysDeltaJump = { daysBack: number; label: string }

/** The week chips that fit inside the window (a 30-day ledger offers 1–4 wk, not 8). Never the "today" jump — a zero rewind has nothing to count. */
export function jobDaysDeltaJumps(dayCount: number): JobDaysDeltaJump[] {
  const maxBack = Math.max(0, dayCount - 1)
  return JOB_RUN_AS_OF_JUMPS.filter((j) => j.daysBack > 0 && j.daysBack <= maxBack).map((j) => ({ daysBack: j.daysBack, label: j.label }))
}

export type JobDaysDelta = { asOfYmd: string; delta: JobRunDeltaSince }

/**
 * Counts since `daysBack` days before today over the ledger's status spans.
 * Null when there is nothing to rewind to (no days, or daysBack ≤ 0). The
 * as-of day clamps to the window's first day, exactly as the Timeline slider does.
 */
export function jobDaysDeltaSince(args: {
  ledger: JobDayLedger
  /** jobs_ledger.status per job from the page's list (wins over the ledger's own snapshot). */
  statusByJob: ReadonlyMap<string, string | null | undefined>
  todayYmd: string
  daysBack: number
}): JobDaysDelta | null {
  const { ledger, statusByJob, todayYmd, daysBack } = args
  if (daysBack <= 0 || ledger.days.length === 0) return null
  const firstYmd = ledger.days[0]?.ymd
  const asOfYmd = asOfYmdForDaysBack(todayYmd, daysBack, firstYmd)
  if (asOfYmd >= todayYmd) return null
  const merged = new Map<string, string | null | undefined>()
  for (const [id, l] of ledger.jobLabels ?? []) merged.set(id, l.status)
  for (const [id, s] of statusByJob) if (s != null) merged.set(id, s)
  const rowsToday = buildStatusSpans({ ledger, statusSpansByJob: ledger.statusSpansByJob ?? new Map(), statusByJob: merged, todayYmd })
  return { asOfYmd, delta: jobRunDeltaSince(rowsToday, asOfYmd, todayYmd) }
}
