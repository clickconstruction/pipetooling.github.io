/**
 * Duplicate-part grouping for `/duplicates` (v2.2903, journey-map B14 / J29-F2).
 *
 * Two modes:
 * - **exact** (the default): parts whose names match after trim + case-fold +
 *   whitespace collapse. This is what a parts person means by "duplicate".
 * - **near**: 80%+ Levenshtein similarity, gated so that two names must agree
 *   on every number they carry (sizes, lengths, model numbers) before they can
 *   be grouped — a 1/2" fitting is never a near-duplicate of the 3/4" one, and
 *   "1-1/2 X 1-1/4" never pairs with "1-1/4 X 3/4" even though the strings are
 *   a few characters apart.
 *
 * Groups are union-find transitive closures within each numeric bucket, so a
 * chain of typos still lands in one group, but the chain can no longer walk
 * across a whole size family.
 */
import { nameSimilarity } from '../../utils/nameSimilarity'

export type DuplicateCandidate = { id: string; name: string }

export const NEAR_MATCH_THRESHOLD = 0.8

/** trim + lowercase + collapse internal whitespace. */
export function normalizePartName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Every number-bearing token in a part name, in order of appearance, with
 * surrounding punctuation trimmed: `1/2`, `1-1/2`, `0.75`, `20`, `007`.
 * Leading zeros are kept — "007" and "7" are different model numbers.
 */
export function numericTokens(name: string): string[] {
  const matches = name.match(/\d[\d.,/-]*/g) ?? []
  return matches
    .map((t) => t.replace(/^[-.,/]+|[-.,/]+$/g, ''))
    .filter((t) => t.length > 0)
}

/** Order-independent signature of the numeric tokens — the near-match bucket key. */
export function numericSignature(name: string): string {
  return [...numericTokens(name)].sort().join('|')
}

function find(parent: Map<string, string>, x: string): string {
  if (!parent.has(x)) parent.set(x, x)
  let root = x
  while (parent.get(root) !== root) root = parent.get(root)!
  // path compression
  let cur = x
  while (parent.get(cur) !== root) {
    const next = parent.get(cur)!
    parent.set(cur, root)
    cur = next
  }
  return root
}

function union(parent: Map<string, string>, x: string, y: string) {
  const px = find(parent, x)
  const py = find(parent, y)
  if (px !== py) parent.set(px, py)
}

function sortGroups<T extends DuplicateCandidate>(groups: T[][]): T[][] {
  for (const g of groups) g.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  return groups.sort((a, b) => a[0]!.name.localeCompare(b[0]!.name))
}

/** Groups of 2+ parts whose normalized names are identical. */
export function exactDuplicateGroups<T extends DuplicateCandidate>(parts: T[]): T[][] {
  const byName = new Map<string, T[]>()
  for (const p of parts) {
    const key = normalizePartName(p.name)
    if (!key) continue
    const bucket = byName.get(key)
    if (bucket) bucket.push(p)
    else byName.set(key, [p])
  }
  return sortGroups(Array.from(byName.values()).filter((g) => g.length >= 2))
}

/**
 * Groups of 2+ parts that are exact matches OR near matches (similarity ≥
 * `threshold` AND identical numeric signature). Exact groups are a subset of
 * these groups.
 */
export function nearDuplicateGroups<T extends DuplicateCandidate>(
  parts: T[],
  threshold: number = NEAR_MATCH_THRESHOLD,
): T[][] {
  const buckets = new Map<string, T[]>()
  for (const p of parts) {
    if (!normalizePartName(p.name)) continue
    const key = numericSignature(p.name)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(p)
    else buckets.set(key, [p])
  }
  const groups: T[][] = []
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue
    const parent = new Map<string, string>()
    const normalized = bucket.map((p) => normalizePartName(p.name))
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = normalized[i]!
        const b = normalized[j]!
        if (a === b || nameSimilarity(a, b) >= threshold) {
          union(parent, bucket[i]!.id, bucket[j]!.id)
        }
      }
    }
    const byRoot = new Map<string, T[]>()
    for (const p of bucket) {
      const root = find(parent, p.id)
      const g = byRoot.get(root)
      if (g) g.push(p)
      else byRoot.set(root, [p])
    }
    for (const g of byRoot.values()) if (g.length >= 2) groups.push(g)
  }
  return sortGroups(groups)
}

/** True when every part in the group shares one normalized name. */
export function isExactGroup<T extends DuplicateCandidate>(group: T[]): boolean {
  if (group.length < 2) return false
  const first = normalizePartName(group[0]!.name)
  return group.every((p) => normalizePartName(p.name) === first)
}

export type DuplicateMode = 'exact' | 'near'

/** One entry point for the page: exact groups by default, near groups on request. */
export function buildDuplicateGroups<T extends DuplicateCandidate>(parts: T[], mode: DuplicateMode): T[][] {
  return mode === 'near' ? nearDuplicateGroups(parts) : exactDuplicateGroups(parts)
}
