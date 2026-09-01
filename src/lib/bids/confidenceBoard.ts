/**
 * Twin confidence scoreboard kernel (v2.2560): folds structured backtest
 * scores (twin_run_scores) and shadow runs (list_shadow_runs) into per-axis
 * gate cards — the 5-slot Gate-B bar with in-flight runs as pending slots —
 * plus a unified run ledger. The gate rule mirrors shadowStory.ts: 5
 * consecutive runs within ±8% per axis.
 */
import type { ShadowRunRow } from './shadowStory'

export interface RunScoreRow {
  id: string
  run_label: string
  kind: string
  axis: string | null
  project_name: string | null
  twin_bid_number: string | null
  reference_bid_number: string | null
  locked_total: number | null
  reference_value: number | null
  delta_pct: number | null
  counts_note: string | null
  scope_verdict: string | null
  gate_eligible: boolean
  note: string | null
  scored_at: string | null
}

export const GATE_B_PCT = 8
export const GATE_B_STREAK = 5

export interface GateSlot {
  state: 'in' | 'out' | 'pending'
  /** Short label shown inside the slot: a delta ("−2.6") or a bid ("b423"). */
  label: string
  title: string
}

export interface AxisCard {
  axis: string
  chip: { text: string; tone: 'met' | 'progress' | 'blocked' | 'awaiting' }
  slots: GateSlot[]
  scoredCount: number
  streak: number
  nextLine: string
}

export interface LedgerRow {
  key: string
  label: string
  kind: 'backtest' | 'shadow'
  axis: string
  project: string
  locked: number | null
  reference: number | null
  deltaPct: number | null
  countsNote: string
  gate: 'eligible' | 'void' | 'pending'
  scoredAt: string | null
}

const fmtDelta = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`

/** Scored, gate-eligible entries for an axis, oldest → newest. */
function scoredEntries(scores: readonly RunScoreRow[], shadows: readonly ShadowRunRow[], axis: string) {
  const fromScores = scores
    .filter((s) => s.gate_eligible && (s.axis ?? '') === axis && s.delta_pct != null)
    .map((s) => ({ delta: Number(s.delta_pct), label: s.run_label, at: s.scored_at ?? '' }))
  const fromShadows = shadows
    .filter((r) => r.status === 'scored' && (r.axis ?? '') === axis && r.delta_pct != null)
    .map((r) => ({
      delta: Number(r.delta_pct),
      label: r.shadow_bid_number ? `b${r.shadow_bid_number}` : 'shadow',
      at: r.scored_at ?? '',
    }))
  return [...fromScores, ...fromShadows].sort((a, b) => a.at.localeCompare(b.at))
}

/** In-flight (open/locked) shadows for an axis, oldest first. */
function pendingEntries(shadows: readonly ShadowRunRow[], axis: string) {
  return shadows
    .filter((r) => (r.status === 'open' || r.status === 'locked') && (r.axis ?? '') === axis)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .map((r) => ({
      label: r.shadow_bid_number ? `b${r.shadow_bid_number}` : '…',
      title: r.project_name ?? 'shadow in flight',
    }))
}

export function buildAxisCards(
  scores: readonly RunScoreRow[],
  shadows: readonly ShadowRunRow[],
): AxisCard[] {
  const axes = new Set<string>()
  for (const s of scores) if (s.axis) axes.add(s.axis)
  for (const r of shadows) if (r.axis) axes.add(r.axis)

  const cards: AxisCard[] = []
  for (const axis of [...axes].sort()) {
    const scored = scoredEntries(scores, shadows, axis)
    const pending = pendingEntries(shadows, axis)
    const hits = scored.map((e) => Math.abs(e.delta) <= GATE_B_PCT)
    let streak = 0
    for (let i = hits.length - 1; i >= 0 && hits[i]; i--) streak++
    const gateMet = streak >= GATE_B_STREAK

    const recent = scored.slice(-GATE_B_STREAK)
    const slots: GateSlot[] = recent.map((e) => ({
      state: Math.abs(e.delta) <= GATE_B_PCT ? 'in' : 'out',
      label: fmtDelta(e.delta),
      title: `${e.label}: ${fmtDelta(e.delta)}%`,
    }))
    for (const p of pending) {
      if (slots.length >= GATE_B_STREAK) break
      slots.push({ state: 'pending', label: p.label, title: p.title })
    }
    while (slots.length < GATE_B_STREAK) slots.push({ state: 'pending', label: '·', title: 'no run yet' })

    const axisScores = scores
      .filter((s) => (s.axis ?? '') === axis)
      .sort((a, b) => (a.scored_at ?? '').localeCompare(b.scored_at ?? ''))
    const lastScore = axisScores.length > 0 ? axisScores[axisScores.length - 1] : undefined
    const lastOut = hits.length > 0 && !hits[hits.length - 1]

    let chip: AxisCard['chip']
    if (gateMet) chip = { text: 'GATE B MET', tone: 'met' }
    else if (scored.length === 0) chip = { text: 'AWAITING SCORE', tone: 'awaiting' }
    else if (lastOut && lastScore?.note) chip = { text: 'BLOCKED', tone: 'blocked' }
    else chip = { text: `GATE B · ${streak}/${GATE_B_STREAK}`, tone: 'progress' }

    const bits: string[] = []
    if (!gateMet && scored.length > 0) bits.push(`${GATE_B_STREAK - streak} more in-band to gate`)
    if (pending.length > 0) bits.push(`${pending.length} in flight`)
    if (lastScore?.note) bits.push(lastScore.note)
    if (bits.length === 0) bits.push(gateMet ? 'Gate B met — hold the streak' : 'No runs yet')

    cards.push({ axis, chip, slots, scoredCount: scored.length, streak, nextLine: bits.join(' · ') })
  }
  return cards
}

export function buildLedger(
  scores: readonly RunScoreRow[],
  shadows: readonly ShadowRunRow[],
): LedgerRow[] {
  const rows: LedgerRow[] = []
  for (const s of scores) {
    rows.push({
      key: `score-${s.id}`,
      label: s.run_label,
      kind: 'backtest',
      axis: s.axis ?? '—',
      project: s.project_name ?? '',
      locked: s.locked_total,
      reference: s.reference_value,
      deltaPct: s.delta_pct == null ? null : Number(s.delta_pct),
      countsNote: s.counts_note ?? '—',
      gate: s.gate_eligible ? 'eligible' : 'void',
      scoredAt: s.scored_at,
    })
  }
  for (const r of shadows) {
    rows.push({
      key: `shadow-${r.id}`,
      label: r.shadow_bid_number ? `SH b${r.shadow_bid_number}` : 'shadow',
      kind: 'shadow',
      axis: r.axis ?? '—',
      project: r.project_name ?? '',
      locked: r.locked_total,
      reference: r.reference_value,
      deltaPct: r.delta_pct == null ? null : Number(r.delta_pct),
      countsNote: '—',
      gate: r.status === 'scored' ? 'eligible' : 'pending',
      scoredAt: r.scored_at,
    })
  }
  return rows.sort((a, b) => (b.scoredAt ?? '9999').localeCompare(a.scoredAt ?? '9999'))
}
