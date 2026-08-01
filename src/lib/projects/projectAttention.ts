/**
 * Run-of-show attention model for the Projects list (RUN_SUBS_PLAN Phase 1,
 * PR 1.1). Pure: takes a workflow's steps (already fetched) plus today's
 * calendar date and answers "where is this project, who is it waiting on, and
 * what needs attention" — the phase bar, current-step chip, and attention
 * pills all render from this one result.
 *
 * Current-step resolution pins the legacy Projects.tsx memo exactly:
 * first rejected wins, else first in_progress, else first pending.
 */

export type AttentionStepInput = {
  name: string
  status: string
  sequence_order: number
  assigned_to_name?: string | null
  started_at?: string | null
  scheduled_start_date?: string | null
  scheduled_end_date?: string | null
}

export type ProjectAttentionFlag =
  | { kind: 'rejected'; stepName: string }
  | { kind: 'waiting'; stepName: string; assignee: string; days: number }
  | { kind: 'unassigned-current'; stepName: string }
  | { kind: 'no-schedule'; stepName: string }

export type ProjectAttention = {
  /** All steps in sequence order (for the phase bar). */
  steps: Array<{ name: string; status: string }>
  current: {
    name: string
    position: number
    assignee: string | null
    /** Whole days since started_at for an in_progress step (0 = started today); null otherwise. */
    daysInStep: number | null
  } | null
  total: number
  flags: ProjectAttentionFlag[]
  /** Sort weight: higher = needs attention sooner. 0 = quiet. */
  attentionScore: number
}

/** An in_progress step this many whole days old earns the "waiting" pill. */
export const WAITING_DAYS_THRESHOLD = 3

/** Whole days between two YYYY-MM-DD strings (b - a); null on bad input. */
function daysBetweenYmd(a: string, b: string): number | null {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  if (pa.length !== 3 || pb.length !== 3 || pa.some(Number.isNaN) || pb.some(Number.isNaN)) return null
  const [ay, am, ad] = pa as [number, number, number]
  const [by, bm, bd] = pb as [number, number, number]
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export function buildProjectAttention(
  stepsInput: AttentionStepInput[],
  todayYmd: string,
  /** Converts an ISO timestamp to a calendar YYYY-MM-DD in the app timezone. */
  toCalendarYmd: (iso: string) => string,
): ProjectAttention {
  const sorted = [...stepsInput].sort((a, b) => a.sequence_order - b.sequence_order)
  const steps = sorted.map((s) => ({ name: s.name, status: s.status }))
  const empty: ProjectAttention = { steps, current: null, total: sorted.length, flags: [], attentionScore: 0 }
  if (sorted.length === 0) return empty

  const firstRejected = sorted.find((s) => s.status === 'rejected')
  const currentStep =
    firstRejected ??
    sorted.find((s) => s.status === 'in_progress') ??
    sorted.find((s) => s.status === 'pending') ??
    null
  if (!currentStep) return empty

  const position = sorted.indexOf(currentStep) + 1
  const assignee = (currentStep.assigned_to_name ?? '').trim() || null

  let daysInStep: number | null = null
  if (currentStep.status === 'in_progress' && currentStep.started_at) {
    const startedYmd = toCalendarYmd(currentStep.started_at)
    daysInStep = startedYmd ? daysBetweenYmd(startedYmd, todayYmd) : null
    if (daysInStep != null && daysInStep < 0) daysInStep = 0
  }

  const flags: ProjectAttentionFlag[] = []
  if (firstRejected) {
    flags.push({ kind: 'rejected', stepName: firstRejected.name })
  }
  if (!firstRejected) {
    if (!assignee) {
      flags.push({ kind: 'unassigned-current', stepName: currentStep.name })
    } else if (currentStep.status === 'in_progress' && daysInStep != null && daysInStep >= WAITING_DAYS_THRESHOLD) {
      flags.push({ kind: 'waiting', stepName: currentStep.name, assignee, days: daysInStep })
    }
    if (!currentStep.scheduled_start_date && !currentStep.scheduled_end_date) {
      flags.push({ kind: 'no-schedule', stepName: currentStep.name })
    }
  }

  let attentionScore = 0
  for (const f of flags) {
    if (f.kind === 'rejected') attentionScore += 4
    else if (f.kind === 'waiting') attentionScore += 2
    else attentionScore += 1
  }

  return {
    steps,
    current: { name: currentStep.name, position, assignee, daysInStep },
    total: sorted.length,
    flags,
    attentionScore,
  }
}
