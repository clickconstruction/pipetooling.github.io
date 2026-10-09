/**
 * The audit queue (punch list #63, PR 4, v2.4234): the Audits lens's list as sections in the
 * order the estimator's minute is worth — Now (the open card), Up next (the workable pending
 * cards, by what a verdict unblocks), Opens when you send (the sealed shadows, folded, with
 * the due date of the bid they wait on), Digesting (finished, waiting on the robot's
 * receipts) and Digested (folded). Rows are named for the job, not the robot's copy, with the
 * delta as the one number and a why line: questions · notes · the kind of job and its gate
 * state · needs a fix first · the slate. A backtest slate can be parked (v2.5016, the owner's call
 * of 2026-10-09): its rows leave Up next for a Parked fold until Bring it back. Pure: no React, no
 * supabase.
 */
import { GATE_B_STREAK } from './confidenceBoard'
import { jobTypeLabel } from './robotScoreboard'

export type AuditQueueKind = 'backtest' | 'shadow'

export type AuditQueueItem = {
  id: string
  status: 'pending' | 'done' | 'digested'
  requestedAt: string
  /** The robot's copy: 'ZZ Twin MPH CASA LINDA (backtest R2)'. */
  shellName: string | null
  shellNumber: string | null
  /** The bid of ours it mirrors, when paired. */
  refNumber: string | null
  refDueDate: string | null
  refSentDate: string | null
  sealed: boolean
  unpriced: boolean
  openQuestions: number
  notes: number
  deltaPct: number | null
  /** The reference's axis (`bids.backtest_axis` / the run's axis), when known. */
  axis: string | null
  /** The axis's gate state: how many in a row within the band; met when it earned first drafts. */
  gate: { streak: number; met: boolean } | null
  /** A plans ask sits on the bid — the robot needs a fix before its next run. */
  needsFix: boolean
}

/** A parked slate: its key ('slate Aug 31') and its workable rows, in the stake order. */
export type ParkedSlate = { key: string; items: AuditQueueItem[] }

export type AuditQueueSections = {
  now: AuditQueueItem | null
  /** Where the open card sits in the stake order, 1-based, over the workable pending list (parked slates left out). */
  nowPosition: number | null
  workableCount: number
  upNext: AuditQueueItem[]
  /** The slates with rows in Up next, in the order they first appear there: the Skip this slate doors. */
  upNextSlates: Array<{ key: string; count: number }>
  sealed: AuditQueueItem[]
  /** The parked slates, folded, each with Bring it back. */
  parked: ParkedSlate[]
  digesting: AuditQueueItem[]
  digested: AuditQueueItem[]
}

/** 'ZZ Twin MPH CASA LINDA (backtest R2)' → 'MPH CASA LINDA'; 'ZZ Shadow Galloway Park' → 'Galloway Park'. */
export function jobNameFromShell(shellName: string | null | undefined): string {
  const name = (shellName ?? '').trim()
  if (!name) return 'Unknown project'
  return name.replace(/^ZZ\s+(Twin|Shadow)\s+/i, '').replace(/\s*\((?:backtest|shadow)[^)]*\)\s*$/i, '').trim() || name
}

/** A backtest's copy names its round: '(backtest R2)' is a re-bid; a plain '(backtest)' is a first-round slate. */
export function auditKind(item: Pick<AuditQueueItem, 'shellName'>): AuditQueueKind {
  return /\(backtest/i.test(item.shellName ?? '') ? 'backtest' : 'shadow'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monDay = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}
const mmdd = (ymd: string): string => ymd.slice(5, 10).replace('-', '/')

/** 're-bid Sep 5' for a round-two backtest, 'slate Aug 31' for a first round, 'shadow · sent 09/22' once our bid went out. */
export function slateLabel(item: Pick<AuditQueueItem, 'shellName' | 'requestedAt' | 'refSentDate'>): string {
  if (auditKind(item) === 'backtest') {
    const rebid = /\(backtest\s+R\d+\)/i.test(item.shellName ?? '')
    return `${rebid ? 're-bid' : 'slate'} ${monDay(item.requestedAt)}`
  }
  return item.refSentDate ? `shadow · sent ${mmdd(item.refSentDate)}` : 'shadow'
}

/** A backtest slate's key is its label ('re-bid Sep 5', 'slate Aug 31'), so the slate parks as one; a shadow has none. */
export function slateKey(item: Pick<AuditQueueItem, 'shellName' | 'requestedAt' | 'refSentDate'>): string | null {
  return auditKind(item) === 'backtest' ? slateLabel(item) : null
}

/** The gate word for a kind of job: 'Vet clinic, 1 of 5 in a row' · 'Fitness club · earned first drafts' · 'Schools & libraries'. */
export function jobTypeWords(axis: string | null, gate: AuditQueueItem['gate']): string | null {
  if (!axis) return null
  const label = jobTypeLabel(axis)
  if (!gate) return label
  if (gate.met) return `${label} · earned first drafts`
  if (gate.streak > 0) return `${label}, ${gate.streak} of ${GATE_B_STREAK} in a row`
  return label
}

/** The row's why line: '12 questions · 4 notes · Vet clinic, 1 of 5 in a row · needs a fix first · re-bid Sep 5'. */
export function whyLine(item: AuditQueueItem): string {
  const parts: string[] = []
  if (item.unpriced) parts.push('robot still working · no counts yet')
  else parts.push(item.openQuestions > 0 ? `${item.openQuestions} question${item.openQuestions === 1 ? '' : 's'}` : 'no questions')
  if (item.notes > 0) parts.push(`${item.notes} note${item.notes === 1 ? '' : 's'}`)
  const jt = jobTypeWords(item.axis, item.gate)
  if (jt) parts.push(jt)
  if (item.needsFix) parts.push('needs a fix first')
  parts.push(slateLabel(item))
  return parts.join(' · ')
}

/** 'opens when b494 goes out · due 10/01' — the sealed row's line. */
export function sealedLine(item: Pick<AuditQueueItem, 'refNumber' | 'refDueDate'>): string {
  const who = item.refNumber ? `b${item.refNumber}` : 'our bid'
  return `opens when ${who} goes out${item.refDueDate ? ` · due ${mmdd(item.refDueDate)}` : ''}`
}

/** The delta as the row's one number: '−8%', '+127%'; null when unpriced or unpaired. */
export function deltaWord(deltaPct: number | null): string | null {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return null
  const n = Math.round(deltaPct)
  return `${n < 0 ? '−' : '+'}${Math.abs(n)}%`
}

/**
 * The sections. `items` come in the tab's stake order (pending first, by what a verdict
 * unblocks; then done; then digested newest first); `openId` is the card open now; `parkedSlates`
 * holds the keys of the slates the estimator parked.
 */
export function buildAuditQueue(items: readonly AuditQueueItem[], openId: string | null, parkedSlates: ReadonlySet<string> = new Set()): AuditQueueSections {
  const pending = items.filter((i) => i.status === 'pending')
  const sealed = pending.filter((i) => i.sealed)
  const isParked = (i: AuditQueueItem) => {
    const key = slateKey(i)
    return key != null && parkedSlates.has(key)
  }
  const workable = pending.filter((i) => !i.sealed && !isParked(i))
  const now = openId ? (items.find((i) => i.id === openId) ?? null) : null
  const nowIndex = now ? workable.findIndex((i) => i.id === now.id) : -1
  const upNext = workable.filter((i) => i.id !== now?.id)
  const upNextSlates: Array<{ key: string; count: number }> = []
  for (const i of upNext) {
    const key = slateKey(i)
    if (!key) continue
    const slate = upNextSlates.find((x) => x.key === key)
    if (slate) slate.count++
    else upNextSlates.push({ key, count: 1 })
  }
  const parked: ParkedSlate[] = []
  for (const i of pending) {
    if (i.sealed || !isParked(i) || i.id === now?.id) continue
    const key = slateKey(i)!
    const slate = parked.find((x) => x.key === key)
    if (slate) slate.items.push(i)
    else parked.push({ key, items: [i] })
  }
  return {
    now,
    nowPosition: nowIndex >= 0 ? nowIndex + 1 : null,
    workableCount: workable.length,
    upNext,
    upNextSlates,
    sealed,
    parked,
    digesting: items.filter((i) => i.status === 'done' && i.id !== now?.id),
    digested: items.filter((i) => i.status === 'digested' && i.id !== now?.id),
  }
}

/** The card's Finish button names what opens next: 'Finish audit → next: Bonilla Law Firm'. */
export function finishLabel(sections: AuditQueueSections): string {
  const next = sections.upNext[0]
  return next ? `Finish audit → next: ${jobNameFromShell(next.shellName)}` : 'Finish audit'
}
