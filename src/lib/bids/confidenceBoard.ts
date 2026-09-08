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
  /**
   * Teacher attribution on backtests (v2.3099): whose sent number the run was
   * measured against. Standing is decided at read time against the set of
   * calibration-standard user ids (users.calibration_standard) — see
   * `standardTeacherIds` in the build options. Absent on clients ahead of the
   * migration.
   */
  teacher_user_id?: string | null
  teacher_name?: string | null
}

export interface BoardOptions {
  /** Normalized bid numbers (see normalizeBidNumber) of holdout references. */
  holdoutReferenceNumbers?: ReadonlySet<string>
  /**
   * users.id of every calibration standard. When given, a backtest whose
   * teacher is known and NOT in the set is practice (shown, never gated) —
   * the same rule shadows carry via list_shadow_runs.teacher_standard. When
   * omitted, backtests gate on gate_eligible alone, as before.
   */
  standardTeacherIds?: ReadonlySet<string>
}

/** A backtest score whose teacher is known and is not a calibration standard. */
export function isPracticeTeacherScore(s: Pick<RunScoreRow, 'teacher_user_id'>, standardTeacherIds: ReadonlySet<string> | undefined): boolean {
  if (!standardTeacherIds || !s.teacher_user_id) return false
  return !standardTeacherIds.has(s.teacher_user_id)
}

export const GATE_B_PCT = 8
export const GATE_B_STREAK = 5

/** 'B376' / 'b376' / 376 → '376', for matching bids against run-table reference numbers. */
export function normalizeBidNumber(n: number | string | null | undefined): string | null {
  if (n == null) return null
  const s = String(n).trim().replace(/^[bB]/, '')
  return s.length > 0 ? s : null
}

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
  /**
   * Holdout awareness (v2.2942, LEARNING_PLAN lever 3): how many of this
   * axis's scored gate entries ran against a holdout reference vs a practice
   * one, plus how many of the CURRENT streak's runs are holdout. Counts only —
   * the gate itself still takes every eligible run; restricting denominators
   * to holdout runs is a future owner decision.
   */
  holdoutRuns: number
  practiceRuns: number
  streakHoldoutRuns: number
  /**
   * Teacher attribution (v2.3080, LEARNING_PLAN lever 2 lesson a): scored
   * shadows whose reference was sent by someone who is NOT a calibration
   * standard (users.calibration_standard) are set aside from the gate — they
   * are practice, not the standard the twin is calibrating to. Backtests
   * carry no teacher and keep their gate_eligible flag.
   */
  practiceTeacherRuns: number
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
  /** 'practice' = scored against a non-standard teacher (shown, not gated). */
  gate: 'eligible' | 'void' | 'pending' | 'practice'
  scoredAt: string | null
  /** WHOSE number the shadow scored (or will score) against; null for backtests. */
  teacher: string | null
  teacherStandard: boolean | null
}

/** A scored shadow whose teacher is known NOT to be a calibration standard. */
export function isPracticeTeacherRun(r: Pick<ShadowRunRow, 'teacher_standard'>): boolean {
  return r.teacher_standard === false
}

const fmtDelta = (d: number) => `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`

/** Scored, gate-eligible entries for an axis, oldest → newest. */
function scoredEntries(
  scores: readonly RunScoreRow[],
  shadows: readonly ShadowRunRow[],
  axis: string,
  holdoutRefs: ReadonlySet<string>,
  standardTeacherIds: ReadonlySet<string> | undefined,
) {
  const isHoldout = (ref: string | null | undefined) => {
    const n = normalizeBidNumber(ref)
    return n != null && holdoutRefs.has(n)
  }
  const fromScores = scores
    .filter((s) => s.gate_eligible && (s.axis ?? '') === axis && s.delta_pct != null && !isPracticeTeacherScore(s, standardTeacherIds))
    .map((s) => ({
      delta: Number(s.delta_pct),
      label: s.run_label,
      at: s.scored_at ?? '',
      holdout: isHoldout(s.reference_bid_number),
    }))
  const fromShadows = shadows
    .filter((r) => r.status === 'scored' && (r.axis ?? '') === axis && r.delta_pct != null && !isPracticeTeacherRun(r))
    .map((r) => ({
      delta: Number(r.delta_pct),
      label: r.shadow_bid_number ? `b${r.shadow_bid_number}` : 'shadow',
      at: r.scored_at ?? '',
      holdout: isHoldout(r.reference_bid_number),
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
  opts?: BoardOptions,
): AxisCard[] {
  const holdoutRefs = opts?.holdoutReferenceNumbers ?? new Set<string>()
  const standardIds = opts?.standardTeacherIds
  const axes = new Set<string>()
  for (const s of scores) if (s.axis) axes.add(s.axis)
  for (const r of shadows) if (r.axis) axes.add(r.axis)

  const cards: AxisCard[] = []
  for (const axis of [...axes].sort()) {
    const scored = scoredEntries(scores, shadows, axis, holdoutRefs, standardIds)
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

    const practiceTeacherRuns =
      shadows.filter((r) => r.status === 'scored' && (r.axis ?? '') === axis && r.delta_pct != null && isPracticeTeacherRun(r)).length +
      scores.filter((s) => s.gate_eligible && (s.axis ?? '') === axis && s.delta_pct != null && isPracticeTeacherScore(s, standardIds)).length

    const bits: string[] = []
    if (!gateMet && scored.length > 0) bits.push(`${GATE_B_STREAK - streak} more in-band to gate`)
    if (pending.length > 0) bits.push(`${pending.length} in flight`)
    if (practiceTeacherRuns > 0) bits.push(`${practiceTeacherRuns} practice-teacher run${practiceTeacherRuns === 1 ? '' : 's'} set aside`)
    if (lastScore?.note) bits.push(lastScore.note)
    if (bits.length === 0) bits.push(gateMet ? 'Gate B met — hold the streak' : 'No runs yet')

    const holdoutRuns = scored.filter((e) => e.holdout).length
    const streakHoldoutRuns = streak > 0 ? scored.slice(-streak).filter((e) => e.holdout).length : 0

    cards.push({
      axis,
      chip,
      slots,
      scoredCount: scored.length,
      streak,
      nextLine: bits.join(' · '),
      holdoutRuns,
      practiceRuns: scored.length - holdoutRuns,
      streakHoldoutRuns,
      practiceTeacherRuns,
    })
  }
  return cards
}

export function buildLedger(
  scores: readonly RunScoreRow[],
  shadows: readonly ShadowRunRow[],
  opts?: Pick<BoardOptions, 'standardTeacherIds'>,
): LedgerRow[] {
  const standardIds = opts?.standardTeacherIds
  const rows: LedgerRow[] = []
  for (const s of scores) {
    const practice = isPracticeTeacherScore(s, standardIds)
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
      gate: !s.gate_eligible ? 'void' : practice ? 'practice' : 'eligible',
      scoredAt: s.scored_at,
      teacher: s.teacher_name ?? null,
      // Standing is known only when a standard set was given and a teacher is stamped.
      teacherStandard: standardIds && s.teacher_user_id ? !practice : null,
    })
  }
  for (const r of shadows) {
    const gate: LedgerRow['gate'] =
      r.status === 'void' ? 'void'
        : r.status !== 'scored' ? 'pending'
          : isPracticeTeacherRun(r) ? 'practice'
            : 'eligible'
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
      gate,
      scoredAt: r.scored_at,
      teacher: r.teacher_name ?? null,
      teacherStandard: r.teacher_standard ?? null,
    })
  }
  return rows.sort((a, b) => (b.scoredAt ?? '9999').localeCompare(a.scoredAt ?? '9999'))
}
