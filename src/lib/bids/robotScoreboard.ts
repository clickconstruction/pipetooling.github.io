/**
 * The Robots → Scoreboard lens in plain words (v2.3221). Reads the same
 * inputs the dev scoreboard always read — twin_run_scores, list_shadow_runs(),
 * the axis cards from confidenceBoard.ts — and turns them into what an
 * estimator can act on: the rule stated once, "your part" as sentences with
 * doors, job types ranked closest-to-ready with one lesson line each, live-bid
 * runs first and practice runs folded under. The gate math is untouched; this
 * module only phrases it.
 *
 * Pure module — no React, no Supabase.
 */
import {
  GATE_B_PCT,
  GATE_B_STREAK,
  isPracticeTeacherRun,
  isPracticeTeacherScore,
  normalizeBidNumber,
  type AxisCard,
  type RunScoreRow,
} from './confidenceBoard'
import type { RobotRowState } from './robotRowState'
import { shadowStorySteps, type ShadowRunRow, type ShadowStoryStep } from './shadowStory'

/* ---------------------------------------------------------------- words --- */

/** Axis slugs the operator uses → the name an estimator would say. */
export const JOB_TYPE_LABELS: Readonly<Record<string, string>> = {
  'bank-branch': 'Bank branch',
  'franchise-oil-change': 'Oil-change franchise',
  institutional: 'Schools & libraries',
  'kitchen/occupied': 'Kitchen & occupied space',
  'mid-size TI': 'Mid-size tenant finish-out',
  'mid-size TI (fitness)': 'Fitness club finish-out',
  'proto/auto-service': 'Auto-service prototype',
  'small TI': 'Small tenant finish-out',
  'vet-clinic': 'Vet clinic',
  'vet-clinic (med gas)': 'Vet clinic, med gas',
}

/** A plain name for an axis; unknown slugs are tidied, never hidden. */
export function jobTypeLabel(axis: string | null | undefined): string {
  const key = (axis ?? '').trim()
  if (!key) return 'Unsorted'
  const known = JOB_TYPE_LABELS[key]
  if (known) return known
  const words = key.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Within the Gate-B band. */
export function deltaWithin(pct: number | null | undefined): boolean {
  return pct != null && Number.isFinite(Number(pct)) && Math.abs(Number(pct)) <= GATE_B_PCT
}

/** "+44.2" → "44% high"; "−1.2" → "1% low"; "+413" → "5.1× high"; 0 → "on the nose". */
export function deltaPhrase(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(Number(pct))) return '—'
  const p = Number(pct)
  const abs = Math.abs(p)
  if (abs < 0.5) return 'on the nose'
  const dir = p > 0 ? 'high' : 'low'
  if (abs >= 100) {
    const times = 1 + abs / 100
    const t = times >= 10 ? Math.round(times).toString() : times.toFixed(1).replace(/\.0$/, '')
    return `${t}× high`
  }
  return `${Math.round(abs)}% ${dir}`
}

const money = (v: number | null | undefined) => (v == null ? null : `$${Math.round(Number(v)).toLocaleString()}`)

/* ------------------------------------------------------------ job types --- */

export type JobTypeTone = 'ready' | 'progress' | 'awaiting' | 'blocked'

export interface JobSlot {
  state: 'in' | 'out' | 'pending' | 'empty'
  label: string
  title: string
}

export interface JobTypeRow {
  axis: string
  label: string
  tone: JobTypeTone
  statusText: string
  streak: number
  scoredCount: number
  inFlight: number
  slots: JobSlot[]
  /** One plain sentence: what the robot learned, or what it is waiting on. */
  lesson: string
  /** The operator's raw note line from the axis card — dev-only reveal. */
  rawNote: string
}

/** A digest receipt the robot posted under a human's audit note, keyed by axis. */
export interface AxisReceipt {
  body: string
  /** The person whose audit the receipt answered, when known. */
  auditor: string | null
  createdAt: string | null
}

const RECEIPT_PREFIX = /^\s*(?:🤖\s*)?learned:?\s*/i

/** Strip the robot's "🤖 Learned:" prefix and cap the length for a one-line lesson. */
export function receiptSentence(body: string, max = 180): string {
  const raw = body.replace(RECEIPT_PREFIX, '').replace(/\s+/g, ' ').trim()
  const clean = raw.charAt(0).toUpperCase() + raw.slice(1)
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  // A real sentence end inside the window beats a word cut with an ellipsis.
  if (stop >= 20) return cut.slice(0, stop + 1).trim()
  return cut.replace(/\s+\S*$/, '').trim() + '…'
}

/** The dev card's chip tone → the plain state an estimator reads. */
export function jobTypeTone(card: Pick<AxisCard, 'chip'>): JobTypeTone {
  switch (card.chip.tone) {
    case 'met':
      return 'ready'
    case 'awaiting':
      return 'awaiting'
    case 'blocked':
      return 'blocked'
    default:
      return 'progress'
  }
}

export function jobTypeStatusText(tone: JobTypeTone, streak: number): string {
  if (tone === 'ready') return 'Ready for first drafts'
  if (tone === 'awaiting') return 'Waiting on a score'
  if (tone === 'blocked') return 'Needs a fix first'
  return `${streak} of ${GATE_B_STREAK} in a row`
}

/** Parse the dev card's "−57.5" / "+127.0" slot label back to a number (U+2212 minus). */
function slotDelta(label: string): number | null {
  const n = Number(label.replace(/−/g, '-').replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) && /\d/.test(label) ? n : null
}

/** The dev card's five slots, re-labelled in plain words. */
export function plainSlots(card: Pick<AxisCard, 'slots'>): JobSlot[] {
  return card.slots.map((s) => {
    if (s.state === 'pending') {
      return s.label === '·' || s.label === '…'
        ? { state: 'empty', label: '·', title: 'No run yet' }
        : { state: 'pending', label: `${s.label} 🔒`, title: `${s.title} — sealed, waiting on a score` }
    }
    const d = slotDelta(s.label)
    return { state: s.state, label: d == null ? s.label : deltaPhrase(d), title: s.title.replace(/[−+]?\d+(\.\d+)?%/, (m) => `${m} (${deltaPhrase(slotDelta(m))})`) }
  })
}

/** What the axis is waiting on, from its in-flight shadows. */
function pendingSentence(axis: string, shadows: readonly ShadowRunRow[]): string | null {
  const inFlight = shadows
    .filter((r) => (r.axis ?? '') === axis && (r.status === 'locked' || r.status === 'open'))
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const r = inFlight[0]
  if (!r) return null
  const ref = r.reference_bid_number ? `b${normalizeBidNumber(r.reference_bid_number)}` : 'the bid'
  const own = r.shadow_bid_number ? `b${normalizeBidNumber(r.shadow_bid_number)}` : 'a robot bid'
  if (r.status === 'open') return `The robot is working on ${own}, its blind copy of ${ref}.`
  return r.reference_sent_at
    ? `Sealed on ${own}. Scores once ${ref} has a bid value.`
    : `Sealed on ${own}. Scores the day we send ${ref}.`
}

export function lessonLine(
  card: Pick<AxisCard, 'axis' | 'chip' | 'streak' | 'scoredCount'>,
  receipt: AxisReceipt | null | undefined,
  shadows: readonly ShadowRunRow[],
): string {
  const tone = jobTypeTone(card)
  if (receipt) {
    const sentence = receiptSentence(receipt.body)
    return receipt.auditor ? `${sentence} After ${receipt.auditor}’s audit.` : sentence
  }
  const pending = pendingSentence(card.axis, shadows)
  if (tone === 'awaiting') return pending ?? 'No scored run yet.'
  if (tone === 'ready') return 'Five close runs in a row. Hold the streak.'
  if (tone === 'progress' && card.streak > 0) {
    const left = GATE_B_STREAK - card.streak
    return `Nothing to fix right now. ${left} more close run${left === 1 ? '' : 's'} to go.${pending ? ` ${pending}` : ''}`
  }
  return `The last run was off. Its audit is where the fix comes from.${pending ? ` ${pending}` : ''}`
}

const TONE_ORDER: Record<JobTypeTone, number> = { ready: 0, progress: 1, awaiting: 2, blocked: 3 }

/** Closest to ready first: ready, then streaks (longest first), then waiting, then blocked. */
export function rankJobTypeRows(rows: readonly JobTypeRow[]): JobTypeRow[] {
  return [...rows].sort((a, b) => {
    const t = TONE_ORDER[a.tone] - TONE_ORDER[b.tone]
    if (t !== 0) return t
    if (a.streak !== b.streak) return b.streak - a.streak
    if (a.scoredCount !== b.scoredCount) return b.scoredCount - a.scoredCount
    return a.label.localeCompare(b.label)
  })
}

export function buildJobTypeRows(
  cards: readonly AxisCard[],
  shadows: readonly ShadowRunRow[],
  receiptsByAxis: ReadonlyMap<string, AxisReceipt> = new Map(),
): JobTypeRow[] {
  const rows = cards.map<JobTypeRow>((card) => {
    const tone = jobTypeTone(card)
    const inFlight = shadows.filter((r) => (r.axis ?? '') === card.axis && (r.status === 'locked' || r.status === 'open')).length
    return {
      axis: card.axis,
      label: jobTypeLabel(card.axis),
      tone,
      statusText: jobTypeStatusText(tone, card.streak),
      streak: card.streak,
      scoredCount: card.scoredCount,
      inFlight,
      slots: plainSlots(card),
      lesson: lessonLine(card, receiptsByAxis.get(card.axis), shadows),
      rawNote: card.nextLine,
    }
  })
  return rankJobTypeRows(rows)
}

/** Which axis a robot bid number belongs to, from the run tables. */
export function axisByRobotBidNumber(scores: readonly RunScoreRow[], shadows: readonly ShadowRunRow[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const s of scores) {
    const n = normalizeBidNumber(s.twin_bid_number)
    if (n && s.axis) m.set(n, s.axis)
  }
  for (const r of shadows) {
    const n = normalizeBidNumber(r.shadow_bid_number)
    if (n && r.axis && !m.has(n)) m.set(n, r.axis)
  }
  return m
}

export interface ReceiptNoteRow {
  /** The robot bid the audit is on. */
  bid_id: string
  body: string
  created_at: string | null
  /** The human who finished the audit (bid_audits.completed_by), resolved to a name. */
  auditor: string | null
}

/** Newest receipt per axis; robot bids are matched to axes by number. */
export function receiptsByAxis(
  receipts: readonly ReceiptNoteRow[],
  robotBidNumberById: ReadonlyMap<string, string | null>,
  axisByNumber: ReadonlyMap<string, string>,
): Map<string, AxisReceipt> {
  const out = new Map<string, AxisReceipt>()
  const sorted = [...receipts].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  for (const r of sorted) {
    const n = normalizeBidNumber(robotBidNumberById.get(r.bid_id) ?? null)
    const axis = n ? axisByNumber.get(n) : undefined
    if (!axis || out.has(axis)) continue
    if (!r.body.trim()) continue
    out.set(axis, { body: r.body, auditor: r.auditor, createdAt: r.created_at })
  }
  return out
}

/* ---------------------------------------------------------- recent runs --- */

export interface RecentRun {
  label: string
  delta: number
  within: boolean
}

/** The last N scored runs that count, newest first — the page's trend line. */
export function recentRuns(
  scores: readonly RunScoreRow[],
  shadows: readonly ShadowRunRow[],
  standardTeacherIds: ReadonlySet<string> | undefined,
  n = GATE_B_STREAK,
): RecentRun[] {
  const all: Array<RecentRun & { at: string }> = []
  for (const s of scores) {
    if (!s.gate_eligible || s.delta_pct == null || isPracticeTeacherScore(s, standardTeacherIds)) continue
    all.push({ label: s.run_label, delta: Number(s.delta_pct), within: deltaWithin(s.delta_pct), at: s.scored_at ?? '' })
  }
  for (const r of shadows) {
    if (r.status !== 'scored' || r.delta_pct == null || isPracticeTeacherRun(r)) continue
    all.push({ label: r.shadow_bid_number ? `b${normalizeBidNumber(r.shadow_bid_number)}` : 'shadow', delta: Number(r.delta_pct), within: deltaWithin(r.delta_pct), at: r.scored_at ?? '' })
  }
  return all
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, n)
    .map(({ label, delta, within }) => ({ label, delta, within }))
}

/* ------------------------------------------------------------ your part --- */

export interface YourPartBid {
  id: string
  bid_number: string | null
  project_name: string | null
  bid_date_sent: string | null
  outcome: string | null
  estimator_id: string | null
}

export interface YourPartInput {
  viewerId: string | null
  /** The human bids on the page (the People scope). */
  bids: readonly YourPartBid[]
  /** The Bid Board icon's state for a bid — one kernel, so the strip and the icon agree. */
  stateFor: (bid: YourPartBid) => RobotRowState
  auditsPending: number
  questionsWaiting: number
  coverage: { covered: number; live: number } | null
}

export type YourPartTone = 'seal' | 'good' | 'accent' | 'amber' | 'red' | 'muted'

export interface YourPartDoor {
  label: string
  kind: 'bid' | 'audits' | 'bid-board'
  bidId?: string
  primary?: boolean
}

export interface YourPartLine {
  key: 'sealed' | 'scored' | 'queued' | 'cant-see' | 'waiting' | 'coverage'
  tone: YourPartTone
  text: string
  detail: string | null
  doors: YourPartDoor[]
}

const bidRef = (b: YourPartBid) => {
  const n = normalizeBidNumber(b.bid_number)
  const name = (b.project_name ?? '').trim()
  return n ? (name ? `b${n} ${name}` : `b${n}`) : name || 'a bid'
}
const bidTag = (b: YourPartBid) => {
  const n = normalizeBidNumber(b.bid_number)
  return n ? `b${n}` : 'bid'
}
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

export function buildYourPart(input: YourPartInput): YourPartLine[] {
  const lines: YourPartLine[] = []
  const live = input.bids.filter((b) => !b.outcome)
  const mine = (b: YourPartBid) => !!input.viewerId && b.estimator_id === input.viewerId
  const states = new Map<string, RobotRowState>()
  const stateOf = (b: YourPartBid) => {
    let s = states.get(b.id)
    if (!s) {
      s = input.stateFor(b)
      states.set(b.id, s)
    }
    return s
  }

  // Sealed — yours first, the office's when you have none.
  const sealedMine = live.filter((b) => mine(b) && stateOf(b).kind === 'sealed')
  const sealedAll = live.filter((b) => stateOf(b).kind === 'sealed')
  const sealedDetail = (bs: YourPartBid[], you: boolean) =>
    bs
      .slice(0, 3)
      .map((b) => `${bidRef(b)} scores ${b.bid_date_sent ? 'once it has a bid value' : you ? 'the day you send it' : 'the day it goes out'}.`)
      .join(' ')
  if (sealedMine.length > 0) {
    lines.push({
      key: 'sealed',
      tone: 'seal',
      text: `The robot has ${sealedMine.length === 1 ? 'a sealed number' : 'sealed numbers'} on ${sealedMine.length === 1 ? 'one of your bids' : `${sealedMine.length} of your bids`}.`,
      detail: sealedDetail(sealedMine, true),
      doors: sealedMine.slice(0, 3).map((b) => ({ label: `Open ${bidTag(b)}`, kind: 'bid', bidId: b.id })),
    })
  } else if (sealedAll.length > 0) {
    lines.push({
      key: 'sealed',
      tone: 'seal',
      text: `The robot has ${sealedAll.length === 1 ? 'a sealed number' : 'sealed numbers'} on ${sealedAll.length} live ${plural(sealedAll.length, 'bid')}.`,
      detail: `Locked before ours went out. ${sealedDetail(sealedAll, false)}`,
      doors: sealedAll.slice(0, 3).map((b) => ({ label: `Open ${bidTag(b)}`, kind: 'bid', bidId: b.id })),
    })
  }

  // Scored against your number.
  const scoredMine = input.bids.filter((b) => mine(b) && stateOf(b).kind === 'scored')
  if (scoredMine.length > 0) {
    const parts = scoredMine.slice(0, 3).map((b) => {
      const s = stateOf(b)
      const d = s.kind === 'scored' ? s.deltaPct : null
      return `${deltaPhrase(d)} on ${bidRef(b)}`
    })
    lines.push({
      key: 'scored',
      tone: 'good',
      text: scoredMine.length === 1 ? `The robot was ${parts[0]}.` : `The robot has scored against your number on ${scoredMine.length} bids.`,
      detail: scoredMine.length === 1 ? 'Click the robot on that row to see where the two of you differed.' : parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('. ') + '.',
      doors: scoredMine.slice(0, 3).map((b) => ({ label: `Compare ${bidTag(b)}`, kind: 'bid', bidId: b.id })),
    })
  }

  // Queued or working on yours.
  const queuedMine = live.filter((b) => mine(b) && !b.bid_date_sent && (stateOf(b).kind === 'queued' || stateOf(b).kind === 'working'))
  if (queuedMine.length > 0) {
    const working = queuedMine.filter((b) => stateOf(b).kind === 'working')
    const queued = queuedMine.filter((b) => stateOf(b).kind === 'queued')
    const bits: string[] = []
    if (working.length > 0) bits.push(`The robot is working on ${working.map(bidRef).slice(0, 2).join(' and ')} now.`)
    if (queued.length > 0) bits.push(`${queued.map(bidRef).slice(0, 2).join(' and ')} ${queued.length === 1 ? 'is' : 'are'} queued for the next weekday batch.`)
    lines.push({
      key: 'queued',
      tone: 'accent',
      text: bits[0] ?? '',
      detail: bits.slice(1).join(' ') || null,
      doors: queuedMine.slice(0, 3).map((b) => ({ label: `Open ${bidTag(b)}`, kind: 'bid', bidId: b.id })),
    })
  }

  // Bids the robots can't see — every live one, with how many are yours.
  const blocked = live.filter((b) => {
    if (b.bid_date_sent) return false
    const s = stateOf(b)
    return s.kind === 'needs' && s.gaps.some((g) => g.required)
  })
  if (blocked.length > 0) {
    const reasons = new Map<string, number>()
    for (const b of blocked) {
      const s = stateOf(b)
      const first = s.kind === 'needs' ? s.gaps.find((g) => g.required) : undefined
      const label = first ? first.label.toLowerCase() : 'something missing'
      reasons.set(label, (reasons.get(label) ?? 0) + 1)
    }
    const why = [...reasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, n]) => (n === blocked.length ? (n === 1 ? `It has ${label}` : n === 2 ? `Both have ${label}` : `All ${n} have ${label}`) : `${n} ${label}`))
      .join(', ')
    const yours = blocked.filter(mine)
    lines.push({
      key: 'cant-see',
      tone: 'amber',
      text: `Robots can’t see ${blocked.length} live ${plural(blocked.length, 'bid')}.`,
      detail: `${why}.${yours.length > 0 ? ` ${yours.length} ${yours.length === 1 ? 'is' : 'are'} yours.` : ''} The robot needs sheet on each row says what to attach.`,
      doors: yours.length > 0
        ? yours.slice(0, 3).map((b) => ({ label: `Fix ${bidTag(b)}`, kind: 'bid', bidId: b.id }))
        : [{ label: 'Open the Bid Board', kind: 'bid-board' }],
    })
  }

  // Waiting on anyone.
  if (input.auditsPending > 0 || input.questionsWaiting > 0) {
    const a = input.auditsPending
    const q = input.questionsWaiting
    const what =
      a > 0 && q > 0
        ? `${a} ${plural(a, 'audit')} and ${q} ${plural(q, 'question')} are waiting on anyone.`
        : a > 0
          ? `${a} ${plural(a, 'audit')} ${a === 1 ? 'is' : 'are'} waiting on anyone.`
          : `${q} ${plural(q, 'question')} ${q === 1 ? 'is' : 'are'} waiting on anyone.`
    lines.push({
      key: 'waiting',
      tone: 'red',
      text: what,
      detail: a > 0 ? 'Audits are what hold the robots back most. Fifteen minutes there unblocks every robot.' : 'One answer lands on every open copy of the question.',
      doors: [{ label: 'Open Audits', kind: 'audits', primary: true }],
    })
  }

  if (input.coverage && input.coverage.live > 0) {
    lines.push({
      key: 'coverage',
      tone: 'muted',
      text: `Robots are shadowing ${input.coverage.covered} of ${input.coverage.live} live bids with plans.`,
      detail: null,
      doors: [],
    })
  }
  return lines
}

/* ------------------------------------------------------------------ runs --- */

export interface LiveRun {
  key: string
  shadowNumber: string | null
  refNumber: string | null
  project: string
  jobType: string | null
  phase: 'working' | 'sealed' | 'scored' | 'void'
  /** What is happening, in plain words — after the project name on the row. */
  line: string
  deltaPct: number | null
  deltaText: string
  /** Counts toward the job type's five-in-a-row (a calibration standard's number). */
  counts: boolean
  steps: ShadowStoryStep[]
  at: string
}

/** Runs on live bids: in flight first (newest), then scored (newest), voided last. */
export function buildLiveRuns(
  shadows: readonly ShadowRunRow[],
  bids: readonly YourPartBid[],
  viewerId: string | null,
): LiveRun[] {
  const byNumber = new Map<string, YourPartBid>()
  for (const b of bids) {
    const n = normalizeBidNumber(b.bid_number)
    if (n) byNumber.set(n, b)
  }
  const rows = shadows.map<LiveRun>((r) => {
    const ref = normalizeBidNumber(r.reference_bid_number)
    const refBid = ref ? byNumber.get(ref) : undefined
    const yours = !!viewerId && refBid?.estimator_id === viewerId
    const refTag = ref ? `b${ref}` : 'the bid'
    const phase: LiveRun['phase'] = r.status === 'void' ? 'void' : r.status === 'scored' ? 'scored' : r.status === 'locked' ? 'sealed' : 'working'
    let line: string
    if (phase === 'working') line = 'the robot is working on its blind copy'
    else if (phase === 'sealed') line = r.reference_sent_at ? `sealed · scores once ${refTag} has a bid value` : `sealed · waiting on ${yours ? 'you' : 'us'} to send ${refTag}`
    else if (phase === 'scored') {
      const robot = money(r.locked_total)
      const ours = money(r.reference_value)
      line = robot && ours ? `robot ${robot}, ours ${ours}` : 'scored'
      if (r.teacher_name) line += ` · against ${r.teacher_name}’s number`
    } else line = 'didn’t count — voided by the operator'
    const at = r.scored_at ?? r.locked_at ?? r.created_at ?? ''
    return {
      key: r.id,
      shadowNumber: normalizeBidNumber(r.shadow_bid_number),
      refNumber: ref,
      project: (r.project_name ?? '').trim() || 'Untitled',
      jobType: r.axis ? jobTypeLabel(r.axis) : null,
      phase,
      line,
      deltaPct: r.delta_pct == null ? null : Number(r.delta_pct),
      deltaText: phase === 'scored' ? deltaPhrase(r.delta_pct) : phase === 'void' ? 'voided' : phase === 'sealed' ? '🔒 sealed' : 'working',
      counts: phase === 'scored' && r.teacher_standard === true,
      steps: shadowStorySteps(r),
      at,
    }
  })
  const order: Record<LiveRun['phase'], number> = { working: 0, sealed: 0, scored: 1, void: 2 }
  return rows.sort((a, b) => order[a.phase] - order[b.phase] || b.at.localeCompare(a.at))
}

export interface PracticeRun {
  key: string
  label: string
  refNumber: string | null
  project: string
  jobType: string | null
  robot: string | null
  ours: string | null
  deltaPct: number | null
  deltaText: string
  voided: boolean
  /** The operator's void note or the robot's counts check — shown on expand. */
  note: string | null
  counts: boolean
  at: string
}

/** Blind re-bids of decided jobs, newest first; voided runs kept and marked. */
export function buildPracticeRuns(scores: readonly RunScoreRow[], standardTeacherIds: ReadonlySet<string> | undefined): PracticeRun[] {
  return scores
    .map<PracticeRun>((s) => {
      const voided = !s.gate_eligible
      const practice = isPracticeTeacherScore(s, standardTeacherIds)
      return {
        key: s.id,
        label: s.run_label,
        refNumber: normalizeBidNumber(s.reference_bid_number),
        project: (s.project_name ?? '').trim() || 'Untitled',
        jobType: s.axis ? jobTypeLabel(s.axis) : null,
        robot: money(s.locked_total),
        ours: money(s.reference_value),
        deltaPct: s.delta_pct == null ? null : Number(s.delta_pct),
        deltaText: voided ? 'voided' : deltaPhrase(s.delta_pct),
        voided,
        note: voided ? (s.note ?? s.counts_note ?? null) : (s.counts_note ?? null),
        counts: !voided && !practice && !!(standardTeacherIds && s.teacher_user_id),
        at: s.scored_at ?? '',
      }
    })
    .sort((a, b) => b.at.localeCompare(a.at))
}
