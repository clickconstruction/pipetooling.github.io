/**
 * The Robot Board as a mirror of the Bid Board (v2.3222).
 *
 * The lens used to list the robots' scratch bids — 45 `ZZ` shells that can
 * never be sent (twin_no_send_guard), so they sat in "Unsent" forever with $0
 * everywhere. The mirror lists OUR bids instead, in the sections the human
 * board already puts them in, with a robot column that says how the robot did
 * on each one: sealed / queued / working before we send, the robot's number
 * and the delta after.
 *
 * Pairing: a shell's `twin_source_bid_id` wins; a shadow run's reference
 * number (list_shadow_runs) fills in for shadows opened before the v2.2543
 * stamp; a backtest score's `reference_bid_number` (twin_run_scores) covers
 * the seeded BT-6..16 rows that never had a shell in PipeTooling.
 *
 * The seal holds here exactly as on the human board's robot icon: while the
 * human bid is unsent, a run shows status only — list_shadow_runs already
 * NULLs the money until scored, and this kernel never reads a shell's draft
 * total for a live bid.
 *
 * Pure module — no React, no Supabase.
 */
import { getSubmissionSectionKey, type SubmissionSectionKey } from './submissionSections'
import { normalizeBidNumber, isPracticeTeacherScore, type RunScoreRow } from './confidenceBoard'
import { shadowCoverage, type ShadowCoverageBid } from './shadowCoverage'
import type { ShadowRunRow } from './shadowStory'
import type { RobotGap, RobotRowState } from './robotRowState'
import { bestEffortGap, summarizeBestEffortMoves } from './bestEffort'

export type MirrorSection = SubmissionSectionKey

export interface MirrorBid extends ShadowCoverageBid {
  id: string
  outcome: string | null
  bid_value: number | string | null
  working_board_archived_at?: string | null
  robot_requested_at?: string | null
  /** Live rows without a robot sort by due date, as the human board does. */
  bid_due_date?: string | null
}

export interface MirrorShell {
  id: string
  bid_number: string | null
  project_name: string | null
  twin_source_bid_id: string | null
}

export interface MirrorAudit {
  id: string
  bid_id: string
  status: 'pending' | 'done' | 'digested' | string
  requested_at: string
}

/**
 * 'audited' = the robot filed its audit and its draft is priced in PipeTooling, but no
 * ledger row scored it yet (the first backtest slate ran before score_backtest existed).
 * The number shown is the draft total, exactly as the Audits lens prices it — and only
 * once the human bid is sent.
 */
/**
 * v2.3225 — two more states for a live bid with NO run, so the mirror lists the
 * same rows the human board does: 'needs' (the robot can't start until a person
 * fixes the bid — no plans link, plans it can't open, a question it asked) and
 * 'off' (opted out, or a division robots don't bid). Both come from the Bid
 * Board icon's own kernel (`rowStateFor`), so the mirror and the icon agree.
 */
export type MirrorRunStatus = 'queued' | 'working' | 'audited' | 'sealed' | 'scored' | 'void' | 'needs' | 'off'

/** A shell's priced draft (computeAuditDraftTotal), for audited-but-unscored runs. */
export type MirrorDraftTotal = { total: number; rowCount: number }

export interface RobotMirrorRun {
  kind: 'shadow' | 'backtest'
  /** The robot's `ZZ` shell in PipeTooling, when one exists (seeded scores have none). */
  shellBidId: string | null
  shellNumber: string | null
  /** 'shadow b418' · 'backtest R2' · 'backtest BT-9' */
  label: string
  status: MirrorRunStatus
  /** The robot's sealed number — only once the run is scored (never before send). */
  robotTotal: number | null
  /** The human number the run scored against (the run's snapshot, else the bid's value). */
  ourValue: number | null
  deltaPct: number | null
  /** Scored against a practice teacher — shown, never gated. */
  practice: boolean
  teacherName: string | null
  /** Sort key: scored → locked → created. */
  at: string
  audit: { id: string; status: string } | null
  /** 'needs' only: the first blocking gap (null when it's questions alone) and the open question count. */
  need?: { gap: RobotGap | null; questions: number; plansAsks: number }
  /** 'off' only. */
  offReason?: 'opt-out' | 'division'
  /** v2.3234: which human number a scored shadow measured against (list_shadow_runs.reference_kind); null when unknown. */
  scoredAgainst?: 'best_effort' | 'sent' | null
}

/** v2.3234: a bid's recorded best effort (bid_best_efforts). */
export interface MirrorBestEffort {
  value: number | string
  recorded_at: string
  recorded_by: string | null
}

export interface RobotMirrorRow<B extends MirrorBid = MirrorBid> {
  bid: B
  section: MirrorSection
  latest: RobotMirrorRun
  earlier: RobotMirrorRun[]
  /** A row-level caveat: 'no bid value on record' (sent without a value, so nothing scored). */
  note: string | null
  /** v2.3234: the recorded best effort, when one exists (absent on rows built without the record map). */
  bestEffort?: MirrorBestEffort | null
  /** v2.3234: best effort → sent value, when both exist and differ — the robot's measured influence on this bid. */
  gap?: { best: number; sent: number; diff: number; pct: number } | null
}

export interface RobotMirror<B extends MirrorBid = MirrorBid> {
  sections: Record<MirrorSection, RobotMirrorRow<B>[]>
  /** Our bids with at least one robot run. */
  rowCount: number
  /** Every row the mirror lists — bids with a run plus the live bids waiting on a robot or a person (the tab label's count). */
  listedCount: number
  /** Live bids the robot can't start on until a person fixes something. */
  needsCount: number
  /** Live bids with a sealed number, waiting on our send. */
  sealedCount: number
  /** Live shadow-eligible bids with no robot run yet (the unsent header's coverage line). */
  uncoveredLive: number
  /** Live shadow-eligible bids in total (coverage denominator). */
  liveEligible: number
  /** Shells that pair to no human bid — pair or archive. */
  orphanShells: MirrorShell[]
  /** v2.3234: sent bids that moved off their recorded best effort, and the total dollars moved (the robot's worth, summed). */
  moved: { count: number; total: number }
}

export interface RobotMirrorInput<B extends MirrorBid> {
  humanBids: readonly B[]
  shells: readonly MirrorShell[]
  shadowRuns: readonly ShadowRunRow[]
  scores: readonly RunScoreRow[]
  audits: readonly MirrorAudit[]
  /** users.calibration_standard ids; when given, a backtest against anyone else is practice. */
  standardTeacherIds?: ReadonlySet<string>
  /** Shell bid id → priced draft, for shells with an audit but no score row. Optional; loaded lazily by the lens. */
  draftTotals?: ReadonlyMap<string, MirrorDraftTotal>
  /**
   * The Bid Board icon's state for a human bid (robotRowState over the page's
   * inputs). When given, every live bid with no run lists too — queued, needs,
   * or off — so the Unsent section mirrors the human board row for row.
   */
  rowStateFor?: (bid: B) => RobotRowState
  /** v2.3234: human bid id → recorded best effort. Optional; loaded by the lens (staff-readable, never by twins). */
  bestEfforts?: ReadonlyMap<string, MirrorBestEffort>
}

export const MIRROR_SECTION_ORDER: MirrorSection[] = ['unsent', 'pending', 'won', 'startedOrComplete', 'lost']

export const MIRROR_SECTION_LABELS: Record<MirrorSection, string> = {
  unsent: 'Unsent / Working',
  pending: 'Not yet won or lost',
  won: 'Won',
  startedOrComplete: 'Started or Complete',
  lost: 'Lost',
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** 'ZZ Twin MPH CASA LINDA (backtest R2)' → 'backtest R2'; plain '(backtest)' → 'backtest'. */
export function backtestLabel(shellName: string | null | undefined, runLabel?: string | null): string {
  const m = (shellName ?? '').match(/\(backtest(?:\s+(R\d+))?\)/i)
  if (m) return m[1] ? `backtest ${m[1].toUpperCase()}` : 'backtest'
  if (runLabel) return `backtest ${runLabel.replace(/^BT-?/i, 'BT-')}`
  return 'backtest'
}

function shadowStatus(run: ShadowRunRow): MirrorRunStatus {
  switch (run.status) {
    case 'scored':
      return 'scored'
    case 'locked':
      return 'sealed'
    case 'void':
      return 'void'
    default:
      return 'working'
  }
}

/** The newest run leads the row; the rest fold behind it. */
export function sortRunsNewestFirst(runs: RobotMirrorRun[]): RobotMirrorRun[] {
  return [...runs].sort((a, b) => b.at.localeCompare(a.at))
}

export function buildRobotMirror<B extends MirrorBid>(input: RobotMirrorInput<B>): RobotMirror<B> {
  const humanById = new Map<string, B>()
  const humanByNumber = new Map<string, B>()
  for (const b of input.humanBids) {
    humanById.set(b.id, b)
    const n = normalizeBidNumber(b.bid_number)
    if (n) humanByNumber.set(n, b)
  }
  const shellByNumber = new Map<string, MirrorShell>()
  for (const s of input.shells) {
    const n = normalizeBidNumber(s.bid_number)
    if (n) shellByNumber.set(n, s)
  }
  const auditByShellId = new Map<string, MirrorAudit>()
  for (const a of [...input.audits].sort((x, y) => y.requested_at.localeCompare(x.requested_at))) {
    // Newest audit per shell wins (a re-opened audit is a new row).
    if (!auditByShellId.has(a.bid_id)) auditByShellId.set(a.bid_id, a)
  }
  const auditFor = (shellId: string | null): RobotMirrorRun['audit'] => {
    if (!shellId) return null
    const a = auditByShellId.get(shellId)
    return a ? { id: a.id, status: a.status } : null
  }

  const runsByHumanId = new Map<string, RobotMirrorRun[]>()
  const push = (humanId: string, run: RobotMirrorRun) => {
    const list = runsByHumanId.get(humanId) ?? []
    list.push(run)
    runsByHumanId.set(humanId, list)
  }
  const pairedShellIds = new Set<string>()

  // 1. Shadow runs (the live stream): status from the run, money only when scored.
  const shadowedShellNumbers = new Set<string>()
  for (const r of input.shadowRuns) {
    const refNum = normalizeBidNumber(r.reference_bid_number)
    const shellNum = normalizeBidNumber(r.shadow_bid_number)
    const shell = shellNum ? shellByNumber.get(shellNum) : undefined
    const human = (shell?.twin_source_bid_id ? humanById.get(shell.twin_source_bid_id) : undefined) ?? (refNum ? humanByNumber.get(refNum) : undefined)
    if (shellNum) shadowedShellNumbers.add(shellNum)
    if (!human) continue
    if (shell) pairedShellIds.add(shell.id)
    const scored = r.status === 'scored'
    push(human.id, {
      kind: 'shadow',
      shellBidId: shell?.id ?? null,
      shellNumber: shellNum,
      label: shellNum ? `shadow b${shellNum}` : 'shadow',
      status: shadowStatus(r),
      robotTotal: scored ? num(r.locked_total) : null,
      ourValue: scored ? (num(r.reference_value) ?? num(human.bid_value)) : null,
      deltaPct: scored ? num(r.delta_pct) : null,
      practice: r.teacher_standard === false,
      teacherName: r.teacher_name ?? null,
      at: r.scored_at ?? r.locked_at ?? r.created_at ?? '',
      audit: auditFor(shell?.id ?? null),
      scoredAgainst: scored ? (r.reference_kind === 'best_effort' || r.reference_kind === 'sent' ? r.reference_kind : null) : null,
    })
  }

  // 2. Backtest scores: one per unseal; the shell (when it exists) carries the audit.
  const scoredShellNumbers = new Set<string>()
  for (const s of input.scores) {
    const refNum = normalizeBidNumber(s.reference_bid_number)
    const twinNum = normalizeBidNumber(s.twin_bid_number)
    const shell = twinNum ? shellByNumber.get(twinNum) : undefined
    const human = (shell?.twin_source_bid_id ? humanById.get(shell.twin_source_bid_id) : undefined) ?? (refNum ? humanByNumber.get(refNum) : undefined)
    if (twinNum) scoredShellNumbers.add(twinNum)
    if (!human) continue
    if (shell) pairedShellIds.add(shell.id)
    const delta = num(s.delta_pct)
    push(human.id, {
      kind: 'backtest',
      shellBidId: shell?.id ?? null,
      shellNumber: twinNum,
      label: backtestLabel(shell?.project_name, s.run_label),
      status: s.gate_eligible === false && delta == null ? 'void' : s.gate_eligible === false && /void/i.test(s.scope_verdict ?? '') ? 'void' : 'scored',
      robotTotal: num(s.locked_total),
      ourValue: num(s.reference_value) ?? num(human.bid_value),
      deltaPct: delta,
      practice: isPracticeTeacherScore(s, input.standardTeacherIds),
      teacherName: s.teacher_name ?? null,
      at: s.scored_at ?? '',
      audit: auditFor(shell?.id ?? null),
    })
  }

  // 3. Shells with no run row yet (a backtest still being worked): status from the audit.
  const orphanShells: MirrorShell[] = []
  for (const shell of input.shells) {
    if (pairedShellIds.has(shell.id)) continue
    const shellNum = normalizeBidNumber(shell.bid_number)
    if (shellNum && (shadowedShellNumbers.has(shellNum) || scoredShellNumbers.has(shellNum))) continue
    const human = shell.twin_source_bid_id ? humanById.get(shell.twin_source_bid_id) : undefined
    if (!human) {
      orphanShells.push(shell)
      continue
    }
    pairedShellIds.add(shell.id)
    const audit = auditFor(shell.id)
    const isBacktest = /backtest/i.test(shell.project_name ?? '') || !!human.bid_date_sent
    // Audited and priced, human bid sent: the draft total stands in for the missing score
    // row. Seal rule: an unsent human bid never sees the draft, whatever the audit says.
    const draft = input.draftTotals?.get(shell.id)
    const ours = num(human.bid_value)
    const audited = !!audit && !!human.bid_date_sent && !!draft && draft.rowCount > 0 && draft.total > 0
    push(human.id, {
      kind: isBacktest ? 'backtest' : 'shadow',
      shellBidId: shell.id,
      shellNumber: shellNum,
      label: isBacktest ? backtestLabel(shell.project_name) : shellNum ? `shadow b${shellNum}` : 'shadow',
      status: audited ? 'audited' : 'working',
      robotTotal: audited ? draft.total : null,
      ourValue: audited ? ours : null,
      deltaPct: audited && ours != null && ours > 0 ? Math.round(((draft.total - ours) / ours) * 1000) / 10 : null,
      practice: false,
      teacherName: null,
      at: audit ? auditByShellId.get(shell.id)?.requested_at ?? '' : '',
      audit,
    })
  }

  // 4. Live bids with no run yet. With the icon kernel in hand every one lists —
  //    queued (next batch), needs (a person's fix first), off (opted out / other
  //    division) — the human board's Unsent section, row for row. Without it,
  //    only front-of-the-line requests list (the v2.3222 behaviour).
  const blank = (): Omit<RobotMirrorRun, 'label' | 'status' | 'at'> => ({
    kind: 'shadow',
    shellBidId: null,
    shellNumber: null,
    robotTotal: null,
    ourValue: null,
    deltaPct: null,
    practice: false,
    teacherName: null,
    audit: null,
  })
  for (const b of input.humanBids) {
    if (runsByHumanId.has(b.id)) continue
    if (b.bid_date_sent || b.outcome) continue
    // The human board hides working-board-archived bids from Unsent (v2.518); so does the mirror.
    if (b.working_board_archived_at) continue
    if (/^zz /i.test((b.project_name ?? '').trimStart())) continue
    const state = input.rowStateFor?.(b)
    if (!state) {
      if (!b.robot_requested_at) continue
      push(b.id, { ...blank(), label: 'next batch', status: 'queued', at: b.robot_requested_at })
      continue
    }
    if (state.kind === 'needs') {
      const gap = state.gaps.find((g) => g.required) ?? null
      push(b.id, { ...blank(), label: gap ? 'no robot yet' : 'robot asked', status: 'needs', at: '', need: { gap, questions: state.questions, plansAsks: gap ? 0 : state.questions } })
    } else if (state.kind === 'off') {
      push(b.id, { ...blank(), label: 'not this bid', status: 'off', at: '', offReason: state.reason })
    } else if (state.kind === 'queued' || state.kind === 'none') {
      push(b.id, { ...blank(), label: b.robot_requested_at ? 'front of the line' : 'next batch', status: 'queued', at: b.robot_requested_at ?? '' })
    }
    // 'working' / 'sealed' / 'scored' without a run row cannot happen (those states come from runs).
  }

  const sections: Record<MirrorSection, RobotMirrorRow<B>[]> = { unsent: [], pending: [], won: [], startedOrComplete: [], lost: [] }
  let rowCount = 0
  let listedCount = 0
  let needsCount = 0
  let sealedCount = 0
  for (const b of input.humanBids) {
    const runs = runsByHumanId.get(b.id)
    if (!runs?.length) continue
    const section = getSubmissionSectionKey(b)
    if (!section) continue
    const [latest, ...earlier] = sortRunsNewestFirst(runs)
    if (!latest) continue
    const sentWithoutValue = !!b.bid_date_sent && !(num(b.bid_value) != null && (num(b.bid_value) as number) > 0)
    const note = latest.status === 'sealed' && sentWithoutValue ? 'no bid value on record' : null
    const bestEffort = input.bestEfforts?.get(b.id) ?? null
    const gap = bestEffort && b.bid_date_sent ? bestEffortGap(bestEffort.value, b.bid_value) : null
    sections[section].push({ bid: b, section, latest, earlier, note, bestEffort, gap })
    listedCount++
    if (latest.status === 'needs') needsCount++
    else if (latest.status !== 'off' && latest.status !== 'queued') rowCount++
    if (latest.status === 'sealed' && !b.bid_date_sent) sealedCount++
  }
  // Within a section the robot's perspective leads: rows with a robot on them by newest
  // activity, then what a person must fix (nearest due first), then the queue, then the
  // bids robots leave alone.
  for (const key of MIRROR_SECTION_ORDER) sections[key].sort(compareMirrorRows)

  const coverage = shadowCoverage(
    input.humanBids,
    input.shadowRuns.map((r) => r.reference_bid_number),
  )
  return {
    sections,
    rowCount,
    listedCount,
    needsCount,
    sealedCount,
    uncoveredLive: Math.max(0, coverage.live - coverage.covered),
    liveEligible: coverage.live,
    orphanShells,
    moved: (() => {
      const s = summarizeBestEffortMoves(
        input.humanBids
          .filter((b) => !!b.bid_date_sent && input.bestEfforts?.has(b.id))
          .map((b) => ({ best: input.bestEfforts!.get(b.id)!.value, sent: b.bid_value })),
      )
      return { count: s.moved, total: s.total }
    })(),
  }
}

const ROW_RANK: Record<MirrorRunStatus, number> = { sealed: 0, working: 0, scored: 0, audited: 0, void: 0, needs: 1, queued: 2, off: 3 }

/** Robot activity first (newest leads), then needs → queued → off by due date (undated last). */
export function compareMirrorRows(a: RobotMirrorRow, b: RobotMirrorRow): number {
  const ra = ROW_RANK[a.latest.status]
  const rb = ROW_RANK[b.latest.status]
  if (ra !== rb) return ra - rb
  if (ra === 0) return b.latest.at.localeCompare(a.latest.at)
  const da = a.bid.bid_due_date ?? ''
  const db = b.bid.bid_due_date ?? ''
  if (da !== db) {
    if (!da) return 1
    if (!db) return -1
    return da.localeCompare(db)
  }
  return normalizeBidNumber(a.bid.bid_number)?.localeCompare(normalizeBidNumber(b.bid.bid_number) ?? '') ?? 0
}

/** 'sealed' | 'queued' | … → the row's short status word and its tone. */
export function mirrorStatusLabel(run: RobotMirrorRun): { text: string; sub: string | null } {
  switch (run.status) {
    case 'queued':
      return { text: 'queued', sub: 'next weekday batch' }
    case 'working':
      return { text: 'estimating', sub: run.audit ? 'no counts in PipeTooling yet' : 'counting in CountTooling' }
    case 'needs': {
      const q = run.need?.questions ?? 0
      const gap = run.need?.gap ?? null
      if (gap) return { text: gap.label, sub: q > 0 ? `${q} open question${q === 1 ? '' : 's'} · ${gap.fix}` : gap.fix }
      return { text: q === 1 ? '1 question' : `${q} questions`, sub: 'answer them and the robot goes on its next run' }
    }
    case 'off':
      return { text: run.offReason === 'division' ? 'not plumbing' : 'opted out', sub: run.offReason === 'division' ? 'robots bid plumbing only' : 'on the bid form' }
    case 'audited':
      return { text: 'audited', sub: 'draft total · not scored on the ledger' }
    case 'sealed':
      return { text: 'sealed', sub: 'opens when we send' }
    case 'void':
      return { text: 'voided', sub: null }
    case 'scored':
      return { text: 'scored', sub: null }
  }
}

/** A live row a person must act on before the robot can start. */
export function mirrorRowNeedsPerson(run: RobotMirrorRun): boolean {
  return run.status === 'needs'
}

/** A run the estimator can open the envelope on: it has a robot number and an audit still waiting. */
export function mirrorRunReviewable(run: RobotMirrorRun): boolean {
  return (run.status === 'scored' || run.status === 'audited') && run.robotTotal != null && run.audit?.status === 'pending'
}

/** The audit chip on a row: what the human still owes the robot. */
export function mirrorAuditChip(run: RobotMirrorRun): { text: string; tone: 'audit' | 'done' | 'practice' | 'void' | 'seal' } | null {
  if (run.status === 'void') return { text: 'void', tone: 'void' }
  if (run.status === 'sealed') return { text: 'review at send', tone: 'seal' }
  if (run.audit?.status === 'pending' && (run.status === 'scored' || run.status === 'audited')) return { text: 'audit waiting', tone: 'audit' }
  if (run.audit?.status === 'done') return { text: 'digesting', tone: 'done' }
  if (run.audit?.status === 'digested') return { text: 'digested', tone: 'done' }
  if (run.practice) return { text: 'practice teacher', tone: 'practice' }
  return null
}
