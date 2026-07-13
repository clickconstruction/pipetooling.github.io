/** Visual pairing for hub People “highlight linked” (border + card tint). */
export type LinkedGroupCardAccent = {
  borderColor: string
  background: string
}

const LINKED_GROUP_ACCENT_PALETTE: readonly LinkedGroupCardAccent[] = [
  { borderColor: '#1d4ed8', background: '#eef2ff' },
  { borderColor: '#047857', background: 'var(--bg-emerald-tint)' },
  { borderColor: '#b45309', background: 'var(--bg-amber-tint)' },
  { borderColor: '#6d28d9', background: '#f5f3ff' },
  { borderColor: '#b91c1c', background: 'var(--bg-red-tint)' },
  { borderColor: '#0e7490', background: '#ecfeff' },
  { borderColor: '#a21caf', background: '#fdf4ff' },
  { borderColor: '#4d7c0f', background: '#f7fee7' },
  { borderColor: '#c2410c', background: 'var(--bg-orange-tint)' },
  { borderColor: '#3730a3', background: '#eef2ff' },
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
