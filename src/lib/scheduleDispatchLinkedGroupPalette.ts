/** Visual pairing for hub People “highlight linked” (border + card tint). */
export type LinkedGroupCardAccent = {
  borderColor: string
  background: string
}

/**
 * Every card tint is a theme token, so a highlighted crew's card turns dark in dark mode under its words, which
 * turn light. Five were light literals until v2.6203 (punch list #194): in dark their words read 1.27 to 1.64:1.
 * `src/lib/readablePairs.test.ts` holds the card's words and presses on every tint in both themes.
 */
export const LINKED_GROUP_ACCENT_PALETTE: readonly LinkedGroupCardAccent[] = [
  { borderColor: '#1d4ed8', background: 'var(--bg-indigo-tint)' },
  { borderColor: '#047857', background: 'var(--bg-emerald-tint)' },
  { borderColor: '#b45309', background: 'var(--bg-amber-tint)' },
  { borderColor: '#6d28d9', background: 'var(--bg-violet-tint)' },
  { borderColor: '#b91c1c', background: 'var(--bg-red-tint)' },
  { borderColor: '#0e7490', background: 'var(--bg-cyan-tint)' },
  { borderColor: '#a21caf', background: 'var(--bg-fuchsia-tint)' },
  { borderColor: '#4d7c0f', background: 'var(--bg-lime-tint)' },
  { borderColor: '#c2410c', background: 'var(--bg-orange-tint)' },
  { borderColor: '#3730a3', background: 'var(--bg-indigo-tint)' },
]

function hashGroupIdToIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0
  }
  const u = h >>> 0
  return u % LINKED_GROUP_ACCENT_PALETTE.length
}

export function buildLinkedGroupAccentMap(
  groupIds: Iterable<string>,
): ReadonlyMap<string, LinkedGroupCardAccent> {
  const m = new Map<string, LinkedGroupCardAccent>()
  for (const id of groupIds) {
    if (id == null || id === '') continue
    const idx = hashGroupIdToIndex(id)
    const pair = LINKED_GROUP_ACCENT_PALETTE[idx]
    if (pair) m.set(id, pair)
  }
  return m
}
