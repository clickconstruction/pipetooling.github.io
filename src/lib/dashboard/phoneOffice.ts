import type { NeedsYouMode } from '../dashboardNeedsYou'

/**
 * The office person's phone (punch list #30, PR 4a): what Needs You opens as,
 * the order the deck walks in, and the trail of what was handled this visit.
 * Pure — the card holds the state, this says what it means.
 */

/** The roles whose morning is the list, not the clock: they dispatch and bill, and carry no blocks of their own. */
export function isPhoneOfficeRole(role: string | null | undefined): boolean {
  return role === 'assistant' || role === 'controller' || role === 'primary' || role === 'estimator'
}

/**
 * Cards or Walk when the card opens. A choice the person made on this device
 * always wins; with none, an office role on a phone gets Walk (one card at a
 * time — the deck), everyone else Cards as before.
 */
export function needsYouInitialMode(input: { stored: NeedsYouMode | null; isPhone: boolean; role: string | null | undefined }): NeedsYouMode {
  if (input.stored) return input.stored
  return input.isPhone && isPhoneOfficeRole(input.role) ? 'walk' : 'cards'
}

/**
 * The deck's order: the list as it came, with the skipped items moved to the
 * back in the order they were skipped — skipped is later, never gone. A
 * skipped key that left the list is ignored; once every item has been skipped
 * the round starts over from the top.
 */
export function needsYouWalkOrder<T extends { key: string }>(items: ReadonlyArray<T>, skippedKeys: ReadonlyArray<string>): T[] {
  const byKey = new Map(items.map((it) => [it.key, it]))
  const skipped = [...new Set(skippedKeys)].filter((k) => byKey.has(k))
  if (skipped.length >= items.length) return [...items]
  const back = new Set(skipped)
  return [...items.filter((it) => !back.has(it.key)), ...skipped.map((k) => byKey.get(k)!)]
}

export type NeedsYouHandledHow = 'acted' | 'skipped'

export interface NeedsYouHandled {
  key: string
  /** The item's title when it was handled — the list may have dropped it since. */
  title: string
  how: NeedsYouHandledHow
}

/** Newest first, one entry per item; acting on an item after skipping it reads as acted. */
export function pushNeedsYouHandled(trail: ReadonlyArray<NeedsYouHandled>, item: { key: string; title: string }, how: NeedsYouHandledHow): NeedsYouHandled[] {
  const prev = trail.find((t) => t.key === item.key)
  const kept = prev?.how === 'acted' ? 'acted' : how
  return [{ key: item.key, title: item.title, how: kept }, ...trail.filter((t) => t.key !== item.key)]
}

export interface NeedsYouTrailChip extends NeedsYouHandled {
  /** Still on the list — a tap brings its card back. False once the work cleared it. */
  open: boolean
}

/** The trail as the card draws it: each handled item, and whether it is still on the list. */
export function needsYouTrailChips(trail: ReadonlyArray<NeedsYouHandled>, items: ReadonlyArray<{ key: string }>): NeedsYouTrailChip[] {
  const open = new Set(items.map((it) => it.key))
  return trail.map((t) => ({ ...t, open: open.has(t.key) }))
}
