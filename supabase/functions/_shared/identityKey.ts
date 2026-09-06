/**
 * One join key for free-text identities (journey map Tier 5 X7, cluster C34).
 *
 * The same person, builder, site or manufacturer spelled two ways split one history into two
 * rows: "H & I" / "H&I" on the Why-we-lost cards, "WATTS" / "watts" in the manufacturer facet,
 * "José García." / "jose garcia" on Crew P&L, "415 Springtown Way" / "Hospital-415 …" in the
 * portal picker. Each surface grew its own normaliser; this is the shared one. Pure, shared by
 * the client and the Deno functions — no imports from either side.
 *
 * `normalizeIdentityKey` is exactly the Crew P&L loose form (B8) plus "&" → "and", so every
 * surface that adopts it keeps its previous matches and gains the ampersand case.
 */

export function normalizeIdentityKey(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/&/g, ' and ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function identityTokens(key: string): string[] {
  return key ? key.split(' ') : []
}

/** "j" covers "jose" (an initial), otherwise tokens must be equal. */
function tokenCovers(needle: string, hay: string): boolean {
  return needle === hay || (needle.length === 1 && hay.startsWith(needle))
}

/** Every `needle` token is covered by a distinct `haystack` token (order-free: "Garcia, Jose" ⊆ "Jose Luis Garcia"). */
export function identityTokensCovered(needle: string[], haystack: string[]): boolean {
  const used = new Set<number>()
  for (const n of needle) {
    const idx = haystack.findIndex((h, i) => !used.has(i) && tokenCovers(n, h))
    if (idx < 0) return false
    used.add(idx)
  }
  return true
}

/**
 * Two spellings that can only mean the same identity: equal keys, or token containment with at
 * least two tokens on BOTH sides ("Jose Garcia" ⊆ "Jose Luis Garcia"; "Summit" ⊄ anything —
 * single tokens never merge on their own; that is what the alias table is for).
 */
export function identityKeysLooselyEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const ta = identityTokens(a)
  const tb = identityTokens(b)
  if (ta.length < 2 || tb.length < 2) return false
  return identityTokensCovered(ta, tb) || identityTokensCovered(tb, ta)
}

export type IdentityCluster = { keys: string[]; names: string[] }

/**
 * Among distinct keys, the pairs the loose rule would merge — the candidates a person should
 * confirm. Keys already equal are not "candidates": the key merged them.
 */
export function findLooseIdentityPairs(items: ReadonlyArray<{ key: string; name: string }>): Array<[{ key: string; name: string }, { key: string; name: string }]> {
  const byKey = new Map<string, { key: string; name: string }>()
  for (const it of items) if (it.key && !byKey.has(it.key)) byKey.set(it.key, it)
  const list = [...byKey.values()]
  const out: Array<[{ key: string; name: string }, { key: string; name: string }]> = []
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!
      const b = list[j]!
      if (identityKeysLooselyEqual(a.key, b.key)) out.push([a, b])
    }
  }
  return out
}
