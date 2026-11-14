/**
 * The Lien desk's step rails on a phone (punch list #352, PR 2): sixteen tiles, four to a kind of paper, stood
 * between the find box and the first row of work, about 640 px of them. On a phone they are one row a thumb tall
 * that unfolds in place. A pressed step keeps them open, since the pressed tile is how the list says what it is
 * narrowed to.
 */

/** *Notices, Reminders, Affidavits and Retainage*: the kinds of paper as a sentence would list them. */
export function lienStepFoldList(labels: ReadonlyArray<string>): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function lienStepFoldWords(labels: ReadonlyArray<string>, open: boolean): { label: string; hint: string } {
  if (open) return { label: 'Hide the steps', hint: '' }
  return { label: 'Steps of each paper', hint: lienStepFoldList(labels) }
}

/** Whether the rails are drawn: always on a computer; on a phone once unfolded, or while a step is pressed. */
export function lienStepRailsShown(input: { isMobile: boolean; unfolded: boolean; stepPressed: boolean }): boolean {
  return !input.isMobile || input.unfolded || input.stepPressed
}
