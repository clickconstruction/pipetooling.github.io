/**
 * The one fixture-name normalizer for the Takeoffs refresh
 * (docs/TAKEOFFS_REFRESH_PLAN.md, decision 4). Book matching, fixture
 * history, and copy-from-a-previous-bid all key on this.
 *
 * Count rows arrive as plan tags ("WC-12", "fd-2", "lav-1", "S 2"), while a
 * book entry or a previous bid holds the bare fixture ("wc", "fd", "lav",
 * "s"). The key strips one trailing tag so those meet — but never bites into
 * a size: "2in 90 waste" and "1/2in 90" keep their numbers, and `ft of …`
 * line-feet rows keep the prefix the labor / price books match on.
 */

/** Lowercase, trimmed, single-spaced — no tag stripping. The exact-match form. */
export function normalizeFixtureName(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Strip one trailing plan tag: `-12`, `_3a`, or ` 2` — the space form only
 * when the rest of the name holds no digit (so "lav 1" → "lav" but
 * "2in 90" stays). A name that is nothing but a tag is returned unchanged.
 */
export function stripPlanTag(normalized: string): string {
  const dashed = normalized.replace(/[-_]\d+[a-z]?$/, '')
  if (dashed !== normalized) return dashed.trim() || normalized
  const spaced = normalized.replace(/ \d+[a-z]?$/, '')
  if (spaced !== normalized && !/\d/.test(spaced)) return spaced.trim() || normalized
  return normalized
}

/** The matching key: normalized, then one plan tag stripped (never for `ft of …` rows). */
export function fixtureKey(raw: string | null | undefined): string {
  const n = normalizeFixtureName(raw)
  if (n.startsWith('ft of ') || n.startsWith('px of ')) return n
  return stripPlanTag(n)
}

/** True when two raw fixture names share a key. */
export function fixtureKeysEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = fixtureKey(a)
  return ka !== '' && ka === fixtureKey(b)
}
