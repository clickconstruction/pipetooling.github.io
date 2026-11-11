import type { MaterialsGroupKey } from './materialsGroups'

/**
 * Which groups of the Materials strip stay open when the whole strip does not fit one row (punch list #304, the
 * owner's idea of 2026-11-10: fold what does not fit behind its name, where the last group used to wrap under the
 * others). Pure: the widths as measured in, the shape out. `MaterialsGroupStrip` measures and draws.
 *
 * The rules. Everything that fits stays open. When the strip is short, the group that was just pressed open comes
 * first, then the group holding the open tab, then the others in the strip's order: each stays open while the row
 * still fits, and the rest fold to their name. So only what has to fold does, and the tab that is open stays on
 * screen wherever there is room for it. When even one open group beside the folded names is too wide (a phone), the
 * names take a row of their own and the open group's tabs sit under them.
 */

export type StripFitInput = {
  /** The groups a role sees, in the strip's order. */
  groups: ReadonlyArray<MaterialsGroupKey>
  /** The group that holds the open tab. */
  here: MaterialsGroupKey
  /** A folded group the person pressed open, or null. It does not change the page. */
  opened: MaterialsGroupKey | null
  /** Each group's width drawn open, and drawn folded to its name, in pixels. */
  openWidths: Readonly<Partial<Record<MaterialsGroupKey, number>>>
  foldWidths: Readonly<Partial<Record<MaterialsGroupKey, number>>>
  /** The space between two groups: the hairline and its room. */
  gap: number
  /** The row's width. Zero means not measured yet, which reads as everything fits. */
  available: number
}

export type StripFit = {
  /** `row`: one row, some groups folded. `rows`: the names in a row, the open group's tabs under them. */
  shape: 'row' | 'rows'
  /** The groups drawn open, in the strip's order. In `rows` it is the one group whose tabs show. */
  open: MaterialsGroupKey[]
}

function rowWidth(input: StripFitInput, open: ReadonlySet<MaterialsGroupKey>): number {
  const gaps = Math.max(0, input.groups.length - 1) * input.gap
  return input.groups.reduce((sum, g) => sum + ((open.has(g) ? input.openWidths[g] : input.foldWidths[g]) ?? 0), gaps)
}

export function stripFit(input: StripFitInput): StripFit {
  const { groups, available } = input
  const all = new Set(groups)
  if (groups.length === 0) return { shape: 'row', open: [] }
  if (available <= 0 || rowWidth(input, all) <= available) return { shape: 'row', open: [...groups] }
  const first = input.opened && all.has(input.opened) ? input.opened : all.has(input.here) ? input.here : groups[0]!
  const open = new Set<MaterialsGroupKey>([first])
  if (rowWidth(input, open) > available) return { shape: 'rows', open: [first] }
  for (const g of [input.here, ...groups]) {
    if (open.has(g) || !all.has(g)) continue
    open.add(g)
    if (rowWidth(input, open) > available) open.delete(g)
  }
  return { shape: 'row', open: groups.filter((g) => open.has(g)) }
}

/**
 * What a group's name says to a screen reader when it is a press: its name, where the open tab is, and what needs a
 * hand. A folded one ends with what the press does. An open one (the phone's row of names) is its name and its badges.
 */
export function foldedGroupLabel(word: string, hereTab: string | null, badges: ReadonlyArray<string>, folded = true): string {
  const parts = [hereTab ? `${word}, on ${hereTab}` : word, ...badges]
  return folded ? `${parts.join(', ')}. Show its tabs.` : parts.join(', ')
}
