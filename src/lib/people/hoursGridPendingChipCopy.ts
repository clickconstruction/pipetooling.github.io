/**
 * People → Hours grid: the amber pending chip's copy (journey-map J7-N1).
 *
 * The chip used to say "click to approve" but a click opens
 * `PeopleHoursPendingCellPopover`, whose Approve is a separate button — two clicks. The
 * only genuine one-click approve is the clock-strip pill (which now confirms first,
 * v2.2858). The copy is kept here so the tooltip and the screen-reader label agree with
 * each other and with the behaviour: a click reviews, the popover approves.
 */
export type PendingChipCopyInput = {
  personName: string
  workDate: string
  /** Closed pending sessions on this person+day. */
  count: number
  /** Hours payroll is currently missing for the cell (always > 0 when the chip shows). */
  diffHours: number
}

export function pendingCellChipTitle(entry: Pick<PendingChipCopyInput, 'diffHours'>): string {
  return `+${entry.diffHours.toFixed(2)} h pending — click to review`
}

export function pendingCellChipAriaLabel(entry: PendingChipCopyInput): string {
  const sessions = `${entry.count} pending session${entry.count === 1 ? '' : 's'}`
  return `${sessions} for ${entry.personName} on ${entry.workDate} — adds ${entry.diffHours.toFixed(2)} hours to payroll. Click to review; approve from the popover.`
}
