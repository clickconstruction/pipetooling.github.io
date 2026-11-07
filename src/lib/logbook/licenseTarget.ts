/**
 * The office's target for a teammate and a trade (punch list #255, v2.6626): the license worked toward and the
 * number the board asks for, or the ladder's seeded rule; and the hours (HVAC: months) worked before the clock
 * started, with where they came from. The window's options and words, and the Licenses tab's one-line summary.
 *
 * Pure.
 */
import { CLASS_RANK, REQUIREMENTS, fmtNum, goalName, goalsFor, unitOfTrade, type LicenseClass, type LicenseTarget, type ParsedLicense, type Trade } from './logbook'
import { LICENSE_LEVELS } from './licenseText'

export type LicenseTargetDraft = {
  /** '' for the ladder's seeded rule. */
  targetClass: LicenseClass | ''
  /** The number the board asks for, as typed. */
  targetAmount: string
  /** Hours (or months) before the clock, as typed. '' reads as none. */
  openingAmount: string
  openingSource: string
}

export function draftFrom(target: LicenseTarget | null): LicenseTargetDraft {
  return {
    targetClass: target?.targetClass ?? '',
    targetAmount: target?.targetAmount != null ? String(target.targetAmount) : '',
    openingAmount: target && target.openingAmount > 0 ? String(target.openingAmount) : '',
    openingSource: target?.openingSource ?? '',
  }
}

/** The classes above the one held in the trade (every class when none is held), as the Licenses tab names them. */
export function targetOptions(trade: Trade, holds: ParsedLicense | null): Array<{ level: LicenseClass; name: string }> {
  const floor = holds?.cls ? CLASS_RANK[holds.cls] : -1
  return LICENSE_LEVELS[trade].filter((l) => CLASS_RANK[l.level] > floor).map((l) => ({ level: l.level, name: goalName(trade, l.level) }))
}

/** The option for '' : the seeded rule from the rung held, or a plain ask when the ladder has none. */
export function ladderOptionWords(trade: Trade, holds: ParsedLicense | null): string {
  const seeded = holds?.cls ? REQUIREMENTS.find((r) => r.trade === trade && r.from === holds.cls) : null
  return seeded ? `The ladder’s rule: ${seeded.toName.toLowerCase()}, ${fmtNum(seeded.need)} ${seeded.unit}` : 'Pick the license'
}

/** The seeded number toward a class, to prefill the amount when the office picks it. */
export function seededAmountToward(trade: Trade, cls: LicenseClass): number | null {
  return REQUIREMENTS.find((r) => r.trade === trade && r.to === cls)?.need ?? null
}

const num = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** What stops the save, in the footer's words; null when the draft is whole. */
export function targetMissing(trade: Trade, draft: LicenseTargetDraft): string | null {
  const unit = unitOfTrade(trade)
  const amount = num(draft.targetAmount)
  const opening = num(draft.openingAmount)
  if (draft.targetClass && (amount == null || Number.isNaN(amount) || amount <= 0)) return `Type the ${unit} the board asks for.`
  if (opening != null && (Number.isNaN(opening) || opening < 0)) return `Type the ${unit} before the clock as a number.`
  if (opening != null && opening > 0 && !draft.openingSource.trim()) return `Say where the ${unit} before the clock came from.`
  return null
}

/** The row to save, once `targetMissing` is null. */
export function targetFromDraft(trade: Trade, draft: LicenseTargetDraft): LicenseTarget {
  const amount = num(draft.targetAmount)
  const opening = num(draft.openingAmount)
  return {
    trade,
    targetClass: draft.targetClass || null,
    targetAmount: draft.targetClass && amount != null && amount > 0 ? amount : null,
    openingAmount: opening != null && opening > 0 ? opening : 0,
    openingSource: opening != null && opening > 0 ? draft.openingSource.trim() : '',
  }
}

/** "Saves as working toward journeyman plumber, 7,000 hours, with 1,200 hours before the clock." */
export function targetSummary(trade: Trade, draft: LicenseTargetDraft): string {
  const unit = unitOfTrade(trade)
  const t = targetFromDraft(trade, draft)
  const toward = t.targetClass && t.targetAmount != null ? `working toward ${goalName(trade, t.targetClass).toLowerCase()}, ${fmtNum(t.targetAmount)} ${unit}` : 'the ladder’s rule'
  const before = t.openingAmount > 0 ? `with ${fmtNum(t.openingAmount)} ${unit} before the clock` : `no ${unit} before the clock`
  return `Saves as ${toward}, ${before}.`
}

export type TargetLine = {
  trade: Trade
  /** "Working toward journeyman plumber, 8,000 hours, the ladder’s rule" */
  toward: string
  /** "1,200 hours before the clock: Hours at Rio Plumbing, signed form on file" or "No hours before the clock" */
  before: string
  /** Set the goal, or Edit the goal once a row exists. */
  button: string
}

/** The Licenses tab's line under a person's licenses, one a trade they hold a license in. */
export function targetLines(held: readonly ParsedLicense[], targets: readonly LicenseTarget[]): TargetLine[] {
  const { goals, topOfLadder, noRuleYet } = goalsFor(held, targets)
  const trades = [...new Set(held.filter((l) => l.trade && l.cls).map((l) => l.trade!))]
  return trades.map((trade) => {
    const unit = unitOfTrade(trade)
    const target = targets.find((t) => t.trade === trade) ?? null
    const goal = goals.find((g) => g.requirement.trade === trade)
    const toward = goal
      ? `Working toward ${goal.requirement.toName.toLowerCase()}, ${fmtNum(goal.requirement.need)} ${goal.requirement.unit}, ${goal.fromOffice ? 'set by the office' : 'the ladder’s rule'}`
      : topOfLadder.some((l) => l.trade === trade)
        ? 'At the top rung'
        : noRuleYet.some((n) => n.holds.trade === trade)
          ? 'The next license has no rule seeded yet. Set the goal to name it and the board’s number.'
          : 'No goal yet'
    const before = target && target.openingAmount > 0 ? `${fmtNum(target.openingAmount)} ${unit} before the clock${target.openingSource ? `: ${target.openingSource}` : ''}` : `No ${unit} before the clock`
    return { trade, toward, before, button: target ? 'Edit the goal' : 'Set the goal' }
  })
}
