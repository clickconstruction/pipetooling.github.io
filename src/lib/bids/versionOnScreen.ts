/**
 * The version the Workbench's prices land on (v2.6003, Wendi's hose bibs of 2026-10-27).
 *
 * A bid with versions prices one of them at a time, and every price typed on the Workbench
 * lands on that version's own copies. The chip on the Send to strip is the one thing that said
 * which, and it scrolls away with the cards. Wendi priced the hose bibs on the alternate, which
 * the card she had clicked had moved her onto (v2.6000), and the change showed on the letter's
 * alternate line instead of the base's. These are the words the sticky strip and the saved tick
 * now carry, so the landing place is in view while she types and named the moment a price lands.
 */

export type VersionOnScreenInput = { id: string; name: string; is_alternate?: boolean | null }

export type VersionOnScreen = {
  name: string
  /** `alternate` for a version flagged `is_alternate` (an alternate with its own takeoff), else `base`. */
  kind: 'base' | 'alternate'
}

/** The version on screen by name and kind; null on an unsplit bid, or when the id names no version. */
export function versionOnScreen(versions: ReadonlyArray<VersionOnScreenInput>, activeVersionId: string | null): VersionOnScreen | null {
  if (!activeVersionId) return null
  const v = versions.find((x) => x.id === activeVersionId)
  if (!v) return null
  return { name: v.name, kind: (v.is_alternate ?? false) === true ? 'alternate' : 'base' }
}

/** The tick after a typed price saves: on a bid with versions it names the one the price landed on. */
export function savedTickWords(version: VersionOnScreen | null): string {
  return version ? `saved ✓ on ${version.name}` : 'saved ✓'
}
