/**
 * Copy for the Schedule Dispatch "Not coming in" confirm + undo modals
 * (journey map J18-F3).
 *
 * Three doors write the mark, and only one of them can be undone completely:
 *  - the empty-cell `off` button — renders only when the cell has zero blocks,
 *    so it writes a time-off row and removes nothing;
 *  - the assign picker's "Not coming in today" — also deletes the day's blocks
 *    (it confirms with the count first);
 *  - NCNS — clears the blocks AND files an attendance incident.
 * The undo RPC (`pay_staff_remove_not_coming_in_for_user_day`) deletes the
 * time-off row only. It never re-creates blocks, and the undo modal cannot
 * tell which door wrote the mark, so the body says so unconditionally.
 */

export interface NotComingInCopyTarget {
  personLabel: string
  workDateLabel: string
}

export interface UndoNotComingInCopy {
  title: string
  /** "<person> on <day> — they'll be schedulable again." */
  lead: string
  /** Unconditional honesty line: removed blocks don't come back. */
  blocksNote: string
  /** NCNS only: the attendance incident is a separate payroll-side record. */
  ncnsNote: string | null
  confirmLabel: string
}

/**
 * False for every path today — the undo RPC only deletes the `user_time_off`
 * row. Kept as a named predicate so the modal copy and any future "restore the
 * blocks too" work move together (flip this, drop the note).
 */
export function undoNotComingInRestoresBlocks(): boolean {
  return false
}

export function undoNotComingInCopy(target: NotComingInCopyTarget & { isNcns: boolean }): UndoNotComingInCopy {
  const restores = undoNotComingInRestoresBlocks()
  return {
    title: target.isNcns ? 'Clear the NCNS mark from the schedule?' : 'Remove the Not coming in mark?',
    lead: `${target.personLabel} on ${target.workDateLabel} — they’ll be schedulable again.`,
    blocksNote: restores
      ? ''
      : 'This only clears the mark. Any schedule blocks removed when the day was marked off don’t come back — add them again from the cell.',
    ncnsNote: target.isNcns
      ? 'The attendance incident stays on record (write-ups & review); removing it is a separate payroll-side action.'
      : null,
    confirmLabel: 'Mark as coming in',
  }
}

export interface MarkOffConfirmCopy {
  title: string
  body: string
  confirmLabel: string
}

/**
 * Confirm shown before the empty-cell `off` write. The button sits 20px from
 * `+` on the board's densest row; the write is a time-off row only (the cell
 * has no blocks, by construction), so the copy promises exactly that and
 * names the way back.
 */
export function markOffConfirmCopy(target: NotComingInCopyTarget): MarkOffConfirmCopy {
  return {
    title: `Mark ${target.personLabel} as not coming in?`,
    body: `${target.workDateLabel} — records unpaid time off for the day. Nothing is scheduled for them that day, so no blocks are removed. Undo any time from the cell’s chip.`,
    confirmLabel: 'Mark not coming in',
  }
}
