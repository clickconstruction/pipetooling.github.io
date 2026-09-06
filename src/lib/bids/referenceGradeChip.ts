/**
 * Reference-grade chip (v2.2943, LEARNING_PLAN item 12): the Counts tab wears
 * the bid's A/B/C/D/X grade once a bid is sent or decided, with a muted
 * one-liner of what's missing when it grades below A — today's bids are
 * tomorrow's training corpus, so the nudge belongs where estimators work, not
 * just on the robot lenses.
 *
 * Thin presentation kernel over {@link referenceGrade} — the grading logic
 * itself is never forked, only re-read here to name the gap.
 *
 * Pure module — no React, no Supabase.
 */

import { referenceGrade, type ReferenceGradeLetter, type ReferencePresence } from './referenceGrade'

export interface ReferenceGradeChip {
  grade: ReferenceGradeLetter
  /** One muted line naming what's missing; null when the record grades A. */
  missingLine: string | null
}

/** Chip applies once the record is history-in-the-making: sent, or decided. */
export function referenceGradeChipApplies(bid: { bid_date_sent: string | null; outcome: string | null }): boolean {
  return bid.bid_date_sent != null || bid.outcome != null
}

export function referenceGradeChip(p: ReferencePresence): ReferenceGradeChip {
  const grade = referenceGrade(p)
  return { grade, missingLine: missingLineFor(grade, p) }
}

function missingLineFor(grade: ReferenceGradeLetter, p: ReferencePresence): string | null {
  switch (grade) {
    case 'A':
      return null
    case 'X':
      return 'no plans link — robots can’t rebuild this bid at all'
    case 'B':
      // B = plans + value. Counts may exist unpriced, or be missing entirely.
      return p.hasCounts
        ? 'no priced rows — robots can’t learn pricing from this bid'
        : 'no takeoff rows — robots can’t learn counts from this bid'
    case 'C':
      return 'no final value recorded — robots can’t check their dollars against this bid'
    case 'D':
      return 'no value or counts recorded — plans-only census reference'
  }
}
