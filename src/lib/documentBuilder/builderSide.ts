/**
 * The two sides of a walked builder's left column (punch list #416, part 3, against #404's mock-up): **Edit** holds
 * the map and the pages that changed, **Share** holds the builder's link and the send. What a GC sees stays on the
 * right under both. Before this the link's card and the send sat under the map, so the left column ran four cards long.
 *
 * The side is in the address (`?tab=builder&builder=sub-nda&side=share`), so a reload and the browser's Back land on
 * the side the person was on, and a guide can link straight to the send. Edit is where a builder opens, and its
 * address carries no key.
 *
 * Pure: no React, no supabase.
 */

export type BuilderSide = 'edit' | 'share'

/** The address's name for the side. */
export const BUILDER_SIDE_PARAM = 'side'

/** The two presses of the switch, in the order they sit, each with what its side holds. */
export const BUILDER_SIDES: ReadonlyArray<{ id: BuilderSide; label: string; holds: string }> = [
  { id: 'edit', label: 'Edit', holds: 'The map and the pages that changed.' },
  { id: 'share', label: 'Share', holds: 'The link and the send.' },
]

/** What the switch is, for a screen reader. */
export const BUILDER_SIDE_SWITCH = 'What the left side shows'

const params = (search: string | URLSearchParams): URLSearchParams => (typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : new URLSearchParams(search))

/** The side the address asks for. Anything but `share` is Edit, where a builder opens. */
export function builderSideFromSearch(search: string | URLSearchParams): BuilderSide {
  return params(search).get(BUILDER_SIDE_PARAM) === 'share' ? 'share' : 'edit'
}

/** The address with a side on it. Edit drops the key, so the address a builder opens on has one form. Every other key is kept. */
export function withBuilderSide(search: string | URLSearchParams, side: BuilderSide): URLSearchParams {
  const next = params(search)
  if (side === 'share') next.set(BUILDER_SIDE_PARAM, 'share')
  else next.delete(BUILDER_SIDE_PARAM)
  return next
}

/** The line under the switch: what the side on show holds. */
export function builderSideHolds(side: BuilderSide): string {
  return BUILDER_SIDES.find((s) => s.id === side)?.holds ?? ''
}
