/**
 * The Shadows lens story kernel (v2.2544): turns a twin_shadow_runs row (via
 * list_shadow_runs) into the five-step sealed-envelope journey, and scored
 * runs into per-axis Gate-B progress pips (fleet roadmap: 5 consecutive
 * within ±8% earns first-draft duty on that axis).
 */

export interface ShadowRunRow {
  id: string
  status: 'open' | 'locked' | 'scored' | string
  axis: string | null
  created_at: string | null
  locked_at: string | null
  scored_at: string | null
  shadow_bid_number: string | null
  reference_bid_number: string | null
  project_name: string | null
  requested_by_name: string | null
  reference_sent_at: string | null
  locked_total: number | null
  reference_value: number | null
  delta_pct: number | null
}

export interface ShadowStoryStep {
  label: string
  state: 'done' | 'now' | 'todo'
  /** Render the purple sealed style (step 3 while the envelope is closed). */
  seal?: boolean
}

const GATE_B_PCT = 8
const GATE_B_STREAK = 5

export function shadowStorySteps(run: ShadowRunRow): ShadowStoryStep[] {
  const requestedLabel = run.requested_by_name ? `Requested by ${run.requested_by_name}` : 'Robot picked it up'
  const scored = run.status === 'scored'
  const locked = scored || run.status === 'locked'
  const sent = scored || !!run.reference_sent_at
  const deltaLabel =
    scored && run.delta_pct != null
      ? `${run.delta_pct > 0 ? '+' : ''}${Number(run.delta_pct).toFixed(1)}%${Math.abs(Number(run.delta_pct)) <= GATE_B_PCT ? ' · close ✓' : ''}`
      : 'Opened & scored'
  return [
    { label: requestedLabel, state: 'done' },
    { label: 'Robot estimated (blind)', state: locked ? 'done' : 'now' },
    {
      label: scored ? 'Sealed until we sent' : 'Price sealed — no peeking, either way',
      state: locked ? 'done' : 'todo',
      seal: locked && !scored,
    },
    { label: sent ? 'We sent our bid' : 'Waiting on our bid', state: scored ? 'done' : locked && sent ? 'now' : locked ? 'now' : 'todo' },
    { label: deltaLabel, state: scored ? 'done' : 'todo' },
  ]
}

export interface GateProgress {
  /** Last up-to-5 scored runs for the axis, oldest → newest; hit = within ±8%. */
  pips: boolean[]
  /** Consecutive hits counting back from the most recent scored run. */
  streak: number
  gateMet: boolean
}

export function shadowGateProgress(runs: readonly ShadowRunRow[], axis: string | null): GateProgress {
  const scored = runs
    .filter((r) => r.status === 'scored' && (r.axis ?? null) === (axis ?? null) && r.delta_pct != null)
    .sort((a, b) => (a.scored_at ?? '').localeCompare(b.scored_at ?? ''))
  const hits = scored.map((r) => Math.abs(Number(r.delta_pct)) <= GATE_B_PCT)
  let streak = 0
  for (let i = hits.length - 1; i >= 0 && hits[i]; i--) streak++
  return { pips: hits.slice(-GATE_B_STREAK), streak, gateMet: streak >= GATE_B_STREAK }
}
