/**
 * The Collect desk, PR C (v2.5854): the one move on each payer, the words to
 * say, and the lien paper beside it. The move is the first rule that matches,
 * top to bottom; the opener is built only from facts the kernel holds and
 * asks for what it does not. A statement is a move, not a call: Friday's
 * "calls that ended with a date" counts only the calls. The owner and the day
 * come from the recorded plan, never from here. Pure.
 *
 * v2.5873: the sheet keeps what the after-the-call sheet promises. A dispute
 * leaves it for the owner; a call that named no date waits TOUCH_QUIET_DAYS;
 * a live promise with nothing else late waits for its day. Each still shows
 * on its row, off the copied sheet and the plan. A second miss on the
 * account puts the owner on the call.
 */
import type { LienArChip } from '../../jobs/lienArChip'
import { TOUCH_QUIET_DAYS } from '../../jobs/paymentChase'
import type { CallMove } from '../calls'
import { stageUsd } from '../stageFlow'
import type { CollectBillRead } from './collectPile'
import type { CollectPayer, CollectPayerCut } from './collectPayers'
import { QUIET_OUTCOMES, addDaysYmd } from './collectWords'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'

export type CollectMoveKind = 'call_promise' | 'call_payapp' | 'call_date' | 'statement_call' | 'ask_one' | 'statement' | 'call_which' | 'owner_dispute' | 'quiet' | 'promised_wait'

export type CollectMove = {
  kind: CollectMoveKind
  /** The button. */
  title: string
  /** The "Say:" line; null on a statement. */
  opener: string | null
  isCall: boolean
  /** The lien paper beside the move, from the chip: its words and its door. */
  paper: { label: string; href: string } | null
  /** Whoever the recorded plan named for this move, '' when nobody. */
  owner: string
  /** The dollars the move asks for: the payer's late and promised money, or the whole account on a statement. */
  askUsd: number
  /** False when the payer waits off the sheet: a dispute on the owner, a quiet spell after a call, a promise not yet due. */
  onSheet: boolean
  /** A second miss on the account: the owner makes this call. */
  escalated: boolean
}

export type CollectMoveOptions = {
  chip?: LienArChip | null
  todayYmd: string
  dayLabel: (ymd: string) => string
  /** Over this many bills the move is a statement before the call. */
  statementBills?: number
  /** Under this the move is a statement alone. */
  smallUsd?: number
  lienHref?: ((door: LienArChip['door']) => string) | null
  /** This week's recorded plan, for the owner on each move. */
  recordedMoves?: ReadonlyArray<CallMove> | null
  /** Days a payer waits off the sheet after a call that named no date. */
  quietDays?: number
}

const monthWords = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })

function paperFor(chip: LienArChip | null | undefined, lienHref: CollectMoveOptions['lienHref']): CollectMove['paper'] {
  if (!chip || !lienHref) return null
  return { label: chip.words, href: lienHref(chip.door) }
}

function largest(bills: ReadonlyArray<CollectBillRead>, pick: (b: CollectBillRead) => boolean): CollectBillRead | null {
  let best: CollectBillRead | null = null
  for (const b of bills) if (pick(b) && (!best || b.usd > best.usd)) best = b
  return best
}

export function collectMoveFor(p: CollectPayer, opts: CollectMoveOptions): CollectMove {
  const statementBills = opts.statementBills ?? 6
  const smallUsd = opts.smallUsd ?? 10_000
  const paper = paperFor(opts.chip, opts.lienHref)
  const late = p.byState.late + p.byState.broken
  const lateBills = p.bills.filter((b) => b.state === 'late' || b.state === 'broken')
  const owner = (title: string): string => opts.recordedMoves?.find((m) => m.title === title)?.who ?? ''
  const escalated = p.misses >= 2
  const done = (kind: CollectMoveKind, title: string, opener: string | null, isCall: boolean, askUsd: number): CollectMove => ({ kind, title, opener, isCall, paper, owner: escalated && isCall ? 'the owner' : owner(title), askUsd, onSheet: true, escalated: escalated && isCall })
  const wait = (kind: CollectMoveKind, title: string): CollectMove => ({ kind, title, opener: null, isCall: false, paper, owner: '', askUsd: 0, onSheet: false, escalated: false })

  const touch = p.lastTouch && !p.lastTouch.resolvedAt ? p.lastTouch : null
  if (touch?.outcome === 'dispute') return wait('owner_dispute', 'On the owner: the dispute')
  if (touch && QUIET_OUTCOMES.has(touch.outcome)) {
    const back = addDaysYmd(calendarYmdInAppTzFromIso(touch.createdAt), opts.quietDays ?? TOUCH_QUIET_DAYS)
    if (back > opts.todayYmd) return wait('quiet', `Back on the sheet ${opts.dayLabel(back)}`)
  }
  if (p.promise.state === 'promised' && p.promise.promise && late === 0 && p.byState.doubtful === 0) return wait('promised_wait', `Promised for ${opts.dayLabel(p.promise.promise.promisedYmd)}`)

  if (p.promise.state === 'broken' && p.promise.promise) {
    const day = opts.dayLabel(p.promise.promise.promisedYmd)
    return done('call_promise', `Call: the ${day} promise`, `Say: the ${stageUsd(p.promise.usd)} promised for ${day} has not landed. What happened, and what is the new date?`, true, Math.max(late, p.promise.usd))
  }
  // A pay application is the account when its hand-marked bill is at least half of what is open; a small hand-marked bill on a long account is the statement's.
  const handMarked = largest(p.bills, (b) => b.sentFromHere === false && b.state !== 'doubtful')
  if (p.isGc && handMarked && handMarked.billedYmd && handMarked.usd >= p.usd * 0.5) {
    const marked = opts.dayLabel(handMarked.billedYmd)
    const title = handMarked.state === 'notdue' ? 'Call for the pay date' : 'Call: is the pay app approved?'
    return done(handMarked.state === 'notdue' ? 'call_date' : 'call_payapp', title, `Say: the pay application for ${stageUsd(handMarked.usd)}, marked billed here ${marked}. When did it go in, is it approved, and which pay run is it on?`, true, late > 0 ? late : handMarked.usd)
  }
  if (p.billCount > statementBills) {
    const oldest = p.bills.reduce<CollectBillRead | null>((o, b) => (b.billedYmd && (!o || (o.billedYmd && b.billedYmd < o.billedYmd)) ? b : o), null)
    return done('statement_call', 'Send the statement, then call', `Say: ${p.billCount} open bills, ${stageUsd(p.usd)}${oldest?.billedYmd ? `, the oldest from ${monthWords(oldest.billedYmd)}` : ''}. Which can you pay this week, and when?`, true, p.usd)
  }
  if (lateBills.length > 0 && lateBills.length <= 2 && p.byState.notdue > 0 && p.paceDays != null && p.paceDays > 0) {
    const one = largest(lateBills, () => true)!
    const times = one.ageDays != null ? Math.max(2, Math.round(one.ageDays / p.paceDays)) : null
    return done('ask_one', `Ask about the ${stageUsd(one.usd)}`, `Say: the ${stageUsd(one.usd)} from ${one.billedYmd ? opts.dayLabel(one.billedYmd) : 'before'} is ${times != null ? `${times} times` : 'past'} your usual pace. Is something wrong with it?`, true, late)
  }
  if (p.usd < smallUsd && p.promise.state === 'none') return done('statement', 'Send the statement', null, false, p.usd)
  return done('call_which', 'Call for a date', `Say: ${p.billCount} ${p.billCount === 1 ? 'bill' : 'bills'}, ${stageUsd(p.usd)}${p.oldestAgeDays != null ? `, the oldest ${p.oldestAgeDays} days old` : ''}. Which can you pay this week, and when?`, true, p.usd)
}

export type CollectSheetRow = { payer: CollectPayer; move: CollectMove }

export type CollectSheet = {
  rows: CollectSheetRow[]
  /** The rows on the sheet: every row but those waiting off it. */
  moves: number
  /** The rows waiting off the sheet: a dispute, a quiet spell, a promise not yet due. */
  waiting: number
  calls: number
  statements: number
  /** What the moves ask for together. */
  askUsd: number
  /** The money on the cut that pays itself: not yet due, on accounts with nothing late. */
  paysItselfUsd: number
}

export function buildCollectSheet(cut: CollectPayerCut, moveFor: (p: CollectPayer) => CollectMove): CollectSheet {
  const rows = cut.cut.map((payer) => ({ payer, move: moveFor(payer) }))
  const on = rows.filter((r) => r.move.onSheet)
  const calls = on.filter((r) => r.move.isCall).length
  const askUsd = on.reduce((s, r) => s + r.move.askUsd, 0)
  const paysItselfUsd = cut.cut.reduce((s, p) => s + (p.byState.late + p.byState.broken === 0 ? p.byState.notdue : 0), 0)
  return { rows, moves: on.length, waiting: rows.length - on.length, calls, statements: on.length - calls, askUsd, paysItselfUsd }
}

/** The moves as the Bridge's call records them: one per row, dollars under `chase`, the owner as typed. */
export function collectSheetAsCallMoves(sheet: CollectSheet, owners: ReadonlyMap<string, string>): CallMove[] {
  return sheet.rows.filter((r) => r.move.onSheet).map((r) => ({ key: 'chase', title: `${r.payer.payerName}: ${r.move.title}`, who: owners.get(r.payer.payerId ?? r.payer.payerName) ?? r.move.owner, then: r.move.askUsd }))
}

/** The call sheet as text, for the clipboard. */
export function collectSheetText(sheet: CollectSheet, header: string): string {
  const lines = [header, '']
  for (const r of sheet.rows) {
    if (!r.move.onSheet) continue
    lines.push(`${r.payer.payerName} · ${stageUsd(r.payer.usd)} · ${r.move.title}${r.move.owner ? ` · ${r.move.owner}` : ''}`)
    if (r.move.opener) lines.push(`  ${r.move.opener}`)
    if (r.move.paper) lines.push(`  ${r.move.paper.label}`)
  }
  lines.push('', `${sheet.moves} moves, ${stageUsd(sheet.askUsd)} asked for.${sheet.waiting > 0 ? ` ${collectWaitingWords(sheet.waiting)}` : ''}`)
  return lines.join('\n')
}

/** The payers off the sheet, in one sentence. */
export function collectWaitingWords(waiting: number): string {
  return waiting === 1 ? '1 more payer waits off the sheet.' : `${waiting} more payers wait off the sheet.`
}
