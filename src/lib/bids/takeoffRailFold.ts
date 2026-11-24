/**
 * The Sheet's rail, folded (v2.8480). The rail headed *What Pricing sees* folds to a
 * strip across the top of the sheet. The strip keeps the rail's headline and one press
 * that opens the rest. Nothing of the rail is removed: every panel is behind that press.
 *
 * Two rules, both pure and both here:
 * - A window too narrow for the list and the rail side by side (`railFitsBeside`) always
 *   starts folded. There the open rail is a panel over the list, and opening it is never
 *   remembered, so it cannot come back by itself over the rows.
 * - A window wide enough keeps the rail beside the list unless the person folded it. That
 *   choice is kept on this browser.
 */

/** What the person last chose in a wide window. */
export type RailChoice = 'open' | 'folded'

/** How the rail is drawn: in its column, folded to the strip, or the strip with the rail over the list. */
export type RailMode = 'beside' | 'folded' | 'over'

export const RAIL_FOLD_STORAGE_KEY = 'bids_takeoff_rail_fold_v1'
/** Set once the person has opened the folded rail in a narrow window: the line that says where it went is done. */
export const RAIL_FOLD_HINT_KEY = 'bids_takeoff_rail_fold_hint_v1'

/** The strip's words. The press says what it will do, in the same place both ways. */
export const RAIL_FOLD_WORDS = {
  name: 'What Pricing sees',
  show: 'Show',
  hide: 'Hide',
  showName: 'Show What Pricing sees',
  hideName: 'Hide What Pricing sees',
  materials: 'Materials',
  costed: 'Costed',
  /** Said on the strip until the person first opens the rail in a narrow window. */
  foldedByItself: 'Folded to fit this window. Show opens it.',
} as const

/** This browser's store, or null where reaching for it is refused. */
export function railStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function parseRailChoice(raw: string | null | undefined): RailChoice | null {
  return raw === 'open' || raw === 'folded' ? raw : null
}

/** The kept choice, or null when there is none or the browser will not say. The page draws right either way. */
export function readStoredRailChoice(storage: Pick<Storage, 'getItem'> | null | undefined): RailChoice | null {
  try {
    return parseRailChoice(storage?.getItem(RAIL_FOLD_STORAGE_KEY))
  } catch {
    return null
  }
}

/** Keeps the choice. A browser that refuses is not an error: the choice then lasts until the page is left. */
export function writeStoredRailChoice(storage: Pick<Storage, 'setItem'> | null | undefined, choice: RailChoice): void {
  try {
    storage?.setItem(RAIL_FOLD_STORAGE_KEY, choice)
  } catch {
    /* a private window or a full store: nothing to do */
  }
}

/**
 * How the rail is drawn. `fits` is `railFitsBeside` of the sheet's measured width, `choice` the kept
 * choice, and `panelOpen` whether the person opened the rail over the list in a narrow window.
 */
export function railMode(input: { fits: boolean; choice: RailChoice | null; panelOpen: boolean }): RailMode {
  if (input.fits) return input.choice === 'folded' ? 'folded' : 'beside'
  return input.panelOpen ? 'over' : 'folded'
}

/** Does the sheet open with the rail folded? */
export function railStartsFolded(input: { fits: boolean; choice: RailChoice | null }): boolean {
  return railMode({ ...input, panelOpen: false }) === 'folded'
}

/** What a press on the strip's Show or the rail's Hide does, given where the rail is. */
export function railPressOutcome(
  press: 'show' | 'hide',
  fits: boolean,
): { panelOpen: boolean; choice: RailChoice | null } {
  // Wide: the press is a choice, and it is kept. Narrow: it only opens or shuts the panel.
  if (fits) return { panelOpen: false, choice: press === 'show' ? 'open' : 'folded' }
  return { panelOpen: press === 'show', choice: null }
}

export type RailStripFacts = {
  /** "4 of 10". */
  costed: string
  /** No fixture is without lines: the count reads green, else amber, as on the rail. */
  allCosted: boolean
  /** Fixtures Pricing will show as "no cost". 0 draws nothing. */
  noCost: number
  /** The chip's words after its count: "no cost". */
  noCostWords: string
  /** The chip's whole sentence, for its hover and for a screen reader. */
  noCostSentence: string
}

/** What the strip says. The materials amount is a number the strip draws through `Money`. */
export function railStripFacts(input: { costed: number; fixtures: number; uncosted: number; noCost: number }): RailStripFacts {
  const n = Math.max(0, input.noCost)
  return {
    costed: `${input.costed} of ${input.fixtures}`,
    // The rail's own rule, an empty bid included: no fixture without lines reads green.
    allCosted: input.uncosted === 0,
    noCost: n,
    noCostWords: 'no cost',
    noCostSentence: n === 0 ? '' : n === 1 ? '1 fixture carries no material cost. Pricing shows it as no cost.' : `${n} fixtures carry no material cost. Pricing shows them as no cost.`,
  }
}

/**
 * The line that tells a person where the rail went, the first times it folds by itself: a rail that
 * was beside the list yesterday is a strip today, and nothing else says why. It is said only where
 * the window folded the rail, never where the person did, and it stops once they have opened it.
 */
export function railFoldHint(input: { mode: RailMode; fits: boolean; hintDone: boolean }): string | null {
  return input.mode === 'folded' && !input.fits && !input.hintDone ? RAIL_FOLD_WORDS.foldedByItself : null
}

export function readRailHintDone(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return storage?.getItem(RAIL_FOLD_HINT_KEY) === 'seen'
  } catch {
    return false
  }
}

export function writeRailHintDone(storage: Pick<Storage, 'setItem'> | null | undefined): void {
  try {
    storage?.setItem(RAIL_FOLD_HINT_KEY, 'seen')
  } catch {
    /* a private window or a full store: the line is said again next visit */
  }
}
