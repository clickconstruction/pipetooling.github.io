// What the sorter has picked on the team queue's day cards (punch list #72, PR 2a). Nothing is
// picked until they tap: a day chip picks for every line without a likely suggestion of its own
// (a second tap clears them), a line's own chip or menu picks for that line alone, and a split
// line can swap to by hours. Pure.

import type { SortModeSplitLine } from './sortModeSplit'
import { tallyRowsForChoice, type TallyChoice, type TallyLineSuggestion, type TallySuggestion } from './tallySortSuggestion'
import type { TallyQueueCard } from './tallyTeamQueue'

export type TallyLineSelection = { choice: TallyChoice; byHours: boolean }
export type TallySelections = ReadonlyMap<string, TallyLineSelection>

export function choiceKey(choice: TallyChoice): string {
  return choice.kind === 'job' ? `job:${choice.jobId}` : `split:${choice.how}`
}

/** The lines a day chip picks for: those with no likely suggestion of their own. */
export function dayChipTargets(card: TallyQueueCard): string[] {
  return card.suggestion.lines.filter((l) => !l.own.some((o) => o.confidence !== 'none')).map((l) => l.chargeId)
}

/** The chip shows pressed when every line it picks for has it. */
export function dayChipPressed(selections: TallySelections, card: TallyQueueCard, chip: TallySuggestion): boolean {
  const targets = dayChipTargets(card)
  return (
    targets.length > 0 &&
    targets.every((id) => {
      const sel = selections.get(id)
      return sel != null && choiceKey(sel.choice) === choiceKey(chip.choice)
    })
  )
}

/** Tap a day chip: pick it for the lines it covers, or clear them when it is already pressed. */
export function pickDayChip(selections: TallySelections, card: TallyQueueCard, chip: TallySuggestion): Map<string, TallyLineSelection> {
  const pressed = dayChipPressed(selections, card, chip)
  const next = new Map(selections)
  for (const id of dayChipTargets(card)) {
    if (pressed) next.delete(id)
    else next.set(id, { choice: chip.choice, byHours: false })
  }
  return next
}

/** Pick for one line; picking what it already has, or nothing, clears it. */
export function pickLineChoice(selections: TallySelections, chargeId: string, choice: TallyChoice | null): Map<string, TallyLineSelection> {
  const next = new Map(selections)
  const cur = selections.get(chargeId)
  if (!choice || (cur && choiceKey(cur.choice) === choiceKey(choice))) next.delete(chargeId)
  else next.set(chargeId, { choice, byHours: false })
  return next
}

/** Swap a split line between even and by hours. */
export function toggleLineByHours(selections: TallySelections, chargeId: string): Map<string, TallyLineSelection> {
  const cur = selections.get(chargeId)
  const next = new Map(selections)
  if (cur && cur.choice.kind === 'split') next.set(chargeId, { ...cur, byHours: !cur.byHours })
  return next
}

/** The rows *Sort the day* writes for a picked line; null when the pick cannot be made. */
export function rowsForSelection(line: TallyLineSuggestion, sel: TallyLineSelection): SortModeSplitLine[] | null {
  const choice: TallyChoice = sel.choice.kind === 'split' && sel.byHours ? { ...sel.choice, how: 'hours' } : sel.choice
  const rows = tallyRowsForChoice(line, choice)
  return rows && rows.length > 0 ? rows : null
}
