/**
 * The Collect desk, PR C (v2.5854): the one move on each payer, the words to
 * say, and the lien paper beside it. The move is the first rule that matches,
 * top to bottom; the opener is built only from facts the kernel holds and
 * asks for what it does not. A statement is a move, not a call: Friday's
 * "calls that ended with a date" counts only the calls. The owner and the day
 * come from the recorded plan, never from here. Pure.
 */
import type { LienArChip } from '../../jobs/lienArChip'
import type { CallMove } from '../calls'
import { stageUsd } from '../stageFlow'
import type { CollectBillRead } from './collectPile'
import type { CollectPayer, CollectPayerCut } from './collectPayers'

export type CollectMoveKind = 'call_promise' | 'call_payapp' | 'call_date' | 'statement_call' | 'ask_one' | 'statement' | 'call_which'

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
  const done = (kind: CollectMoveKind, title: string, opener: string | null, isCall: boolean, askUsd: number): CollectMove => ({ kind, title, opener, isCall, paper, owner: owner(title), askUsd })

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
  calls: number
  statements: number
  /** What the moves ask for together. */
  askUsd: number
  /** The money on the cut that pays itself: not yet due, on accounts with nothing late. */
  paysItselfUsd: number
}

export function buildCollectSheet(cut: CollectPayerCut, moveFor: (p: CollectPayer) => CollectMove): CollectSheet {
  const rows = cut.cut.map((payer) => ({ payer, move: moveFor(payer) }))
  const calls = rows.filter((r) => r.move.isCall).length
  const askUsd = rows.reduce((s, r) => s + r.move.askUsd, 0)
  const paysItselfUsd = cut.cut.reduce((s, p) => s + (p.byState.late + p.byState.broken === 0 ? p.byState.notdue : 0), 0)
  return { rows, calls, statements: rows.length - calls, askUsd, paysItselfUsd }
}

/** The moves as the Bridge's call records them: one per row, dollars under `chase`, the owner as typed. */
export function collectSheetAsCallMoves(sheet: CollectSheet, owners: ReadonlyMap<string, string>): CallMove[] {
  return sheet.rows.map((r) => ({ key: 'chase', title: `${r.payer.payerName}: ${r.move.title}`, who: owners.get(r.payer.payerId ?? r.payer.payerName) ?? r.move.owner, then: r.move.askUsd }))
}

/** The call sheet as text, for the clipboard. */
export function collectSheetText(sheet: CollectSheet, header: string): string {
  const lines = [header, '']
  for (const r of sheet.rows) {
    lines.push(`${r.payer.payerName} · ${stageUsd(r.payer.usd)} · ${r.move.title}${r.move.owner ? ` · ${r.move.owner}` : ''}`)
    if (r.move.opener) lines.push(`  ${r.move.opener}`)
    if (r.move.paper) lines.push(`  ${r.move.paper.label}`)
  }
  lines.push('', `${sheet.rows.length} moves, ${stageUsd(sheet.askUsd)} asked for.`)
  return lines.join('\n')
}
