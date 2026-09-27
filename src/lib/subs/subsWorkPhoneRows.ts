import type { SubsRow } from './subsTabRows'
import type { StandingMove } from './standingMove'

/**
 * The Work view on a phone (punch list #30, the owner's pick 2026-09-27): a
 * row is two lines and one number, and its moves are in one bottom sheet.
 * Pure — what the row says, and which of its moves are buttons.
 */

export interface SubsWorkPhoneRow {
  /** `Rough-in · Sub A` for a sheet with a stage, `Sub A` without, the stage's name for a stage row. */
  title: string
  /** Where it stands, then the window: `nothing in writing · Mon Sep 28–Wed Sep 30`. */
  sub: string
  /** `$4,200` open · `unpriced` · `paid` · `—`. */
  amount: string
  tone: 'due' | 'paid' | 'quiet'
  /** The office owes this row a move — nothing in writing, or a window with no order. */
  attention: boolean
}

const COVERAGE_WORDS: Record<string, string> = { none: 'nothing in writing', draft: 'drafted, not sent', sent: 'offer out', signed: 'signed', declined: 'declined' }

export function subsWorkPhoneRow(r: SubsRow, opts: { windowLabel: string | null; formatMoney: (n: number) => string }): SubsWorkPhoneRow {
  const window = opts.windowLabel ? opts.windowLabel : 'no window'
  if (r.kind === 'stage') {
    return {
      title: r.stage.name.trim() || 'Stage',
      sub: `no order yet · ${window}`,
      amount: r.stage.amount > 0 ? opts.formatMoney(r.stage.amount) : 'unpriced',
      tone: 'quiet',
      attention: true,
    }
  }
  const b = r.board
  const who = b.subName.trim() || 'No sub named'
  const stage = r.stage?.name.trim() ?? ''
  const standing = COVERAGE_WORDS[b.coverage.kind] ?? b.coverage.kind
  const expired = b.coverage.kind === 'sent' && b.coverage.expired ? ' · expired' : ''
  let amount = '—'
  let tone: SubsWorkPhoneRow['tone'] = 'quiet'
  if (b.unpriced) amount = 'unpriced'
  else if (b.open > 0) {
    amount = opts.formatMoney(b.open)
    tone = 'due'
  } else if (b.agreed > 0) {
    amount = 'paid'
    tone = 'paid'
  }
  return { title: stage ? `${stage} · ${who}` : who, sub: `${standing}${expired} · ${window}`, amount, tone, attention: b.coverage.kind === 'none' }
}

/** A move is a button when pressing it does something: the sub's own steps and a finished row are words, not buttons. */
export function subsWorkMoveIsButton(m: StandingMove | null | undefined): boolean {
  return m != null && m.kind !== 'wait_sub' && m.kind !== 'done'
}
