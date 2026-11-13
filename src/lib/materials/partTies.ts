/**
 * Same part? (punch list #330, PR 3): two names on a site that a person says are one part, and the
 * pairs the screen asks about.
 *
 * The site's screen folds two typed names by itself only when their words are the same
 * (`sameWordsKey`). Two names that are NEARLY the same are a person's call, asked once: the answer
 * is a row of `on_site_part_ties`, `same` or `different`, kept for that site so the question is
 * never asked twice. A tie is a reading of the finished rows: it changes which lines one row adds
 * up and nothing else, so each spelling keeps its own line and count in its box.
 *
 * What is offered never guesses. A pair is asked about only when the numbers in the two names are
 * the same and the words differ by one word more, or by one word a letter or two apart. Two names
 * whose numbers differ are never offered: on the first site read, dozens of pairs two letters
 * apart were a 2 inch fitting and its 3 inch twin.
 *
 * Pure rules only. The io is `partTiesIo.ts`, the screen `components/materials/SiteMaterialsView.tsx`.
 */
import type { SitePartRow } from './siteRollup'

export type TieVerdict = 'same' | 'different'

/** One answer: two row keys on one site, and what a person said about them. */
export type PartTie = {
  id: string
  aKey: string
  bKey: string
  /** The names as they read when the answer was given. */
  aName: string
  bName: string
  verdict: TieVerdict
  byName: string
  at: string
}

/** The two keys of a pair in one order, so a pair is the same pair whichever way round it was pressed. */
export function orderedPair(x: string, y: string): [string, string] {
  return x <= y ? [x, y] : [y, x]
}

function pairId(x: string, y: string): string {
  return orderedPair(x, y).join('\u0000')
}

/**
 * The row each key belongs to once the `same` answers are read: names joined to names joined to
 * names are one group. The group's key is its parts-book key when it holds one (so a tied name
 * reads as the book's part), else the smallest key, so it never moves as ties are added.
 */
export function tieCanon(ties: ReadonlyArray<PartTie>): (key: string) => string {
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let root = k
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!
    return root
  }
  const better = (a: string, b: string): string => {
    const aBook = a.startsWith('id:')
    const bBook = b.startsWith('id:')
    if (aBook !== bBook) return aBook ? a : b
    return a <= b ? a : b
  }
  for (const t of ties) {
    if (t.verdict !== 'same') continue
    const a = find(t.aKey)
    const b = find(t.bKey)
    if (a === b) continue
    const root = better(a, b)
    parent.set(a, root)
    parent.set(b, root)
    parent.set(root, root)
  }
  return (key) => find(key)
}

/**
 * The `same` answers behind one row, oldest first: what *Names joined here* lists, each with its
 * Undo. Read through `canon`, since a typed name tied to a parts-book part that has no line of its
 * own on the site is still one of the row's ties.
 */
export function joinedTies(row: Pick<SitePartRow, 'key'>, ties: ReadonlyArray<PartTie>, canon: (key: string) => string = tieCanon(ties)): PartTie[] {
  return ties.filter((t) => t.verdict === 'same' && canon(t.aKey) === row.key && canon(t.bKey) === row.key).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
}

/** A typed name's words and numbers, from its same-words key. A parts-book row is read from its name the same way. */
function tokens(key: string): { numbers: string[]; words: string[] } {
  const all = key.split(' ').filter(Boolean)
  return { numbers: all.filter((t) => /\d/.test(t)).sort(), words: all.filter((t) => !/\d/.test(t)).sort() }
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]!
}

/** Why a pair is asked about: one name has one word more, or one word is spelled a letter or two apart. */
export type NearReason = 'one-more-word' | 'spelled-apart'

/**
 * Two same-words keys that are nearly the same, or null. The numbers must be exactly the same,
 * and at least one word must be shared or the names are just two parts of one size.
 */
export function nearlySame(aKey: string, bKey: string): NearReason | null {
  if (aKey === bKey) return null
  const a = tokens(aKey)
  const b = tokens(bKey)
  if (a.numbers.join(' ') !== b.numbers.join(' ')) return null
  const onlyA = a.words.filter((w) => !b.words.includes(w))
  const onlyB = b.words.filter((w) => !a.words.includes(w))
  const shared = a.words.length - onlyA.length
  const anchored = shared > 0 || a.numbers.length > 0
  if (!anchored) return null
  if ((onlyA.length === 1 && onlyB.length === 0) || (onlyA.length === 0 && onlyB.length === 1)) return 'one-more-word'
  if (onlyA.length === 1 && onlyB.length === 1) {
    const x = onlyA[0]!
    const y = onlyB[0]!
    if (Math.min(x.length, y.length) >= 3 && editDistance(x, y) <= 2) return 'spelled-apart'
  }
  return null
}

/** A pair the screen asks about, on the row it is drawn under. */
export type SamePartAsk = { row: SitePartRow; other: SitePartRow; reason: NearReason }

/** The words of a row's own name as the same-words fold reads them: a typed row's key, a book row's name folded. */
function wordsKeyOf(row: SitePartRow, fold: (name: string) => string): string {
  return row.key.startsWith('words:') && row.memberKeys.length === 1 ? row.key.slice('words:'.length) : fold(row.name)
}

/**
 * The pairs to ask about, at most one per row, each pair once (under its smaller row). A pair is
 * skipped when it was answered either way, when the two rows are already one, or when any name of
 * one row was said to be different from any name of the other. One name with one more word is
 * offered before a spelling; among those, the pair with the most pieces first.
 */
export function samePartAsks(rows: ReadonlyArray<SitePartRow>, ties: ReadonlyArray<PartTie>, fold: (name: string) => string): SamePartAsk[] {
  const answered = new Set(ties.map((t) => pairId(t.aKey, t.bKey)))
  const blocked = (x: SitePartRow, y: SitePartRow) => x.memberKeys.some((a) => y.memberKeys.some((b) => answered.has(pairId(a, b))))
  const keys = rows.map((r) => wordsKeyOf(r, fold))
  const found: Array<SamePartAsk & { weight: number }> = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!
      const b = rows[j]!
      // Two parts-book parts are the parts book's own business (its Duplicates page), never this ask.
      if (a.partId && b.partId) continue
      const reason = nearlySame(keys[i]!, keys[j]!)
      if (!reason || blocked(a, b)) continue
      const [row, other] = a.total <= b.total ? [a, b] : [b, a]
      found.push({ row, other, reason, weight: (reason === 'one-more-word' ? 1_000_000_000 : 0) + a.total + b.total })
    }
  }
  found.sort((x, y) => y.weight - x.weight)
  const used = new Set<string>()
  const out: SamePartAsk[] = []
  for (const f of found) {
    if (used.has(f.row.key) || used.has(f.other.key)) continue
    used.add(f.row.key)
    used.add(f.other.key)
    out.push({ row: f.row, other: f.other, reason: f.reason })
  }
  return out
}

/** The sentence under the ask: why these two were offered. */
export function askReasonWords(ask: Pick<SamePartAsk, 'reason'>): string {
  return ask.reason === 'one-more-word' ? 'The sizes are the same. One name has one more word.' : 'The sizes are the same. One word is spelled a little apart.'
}

/**
 * The rows an answer writes: one tie for each pair of one row's names with the other's first
 * name is enough to join them, since joined names are one group. The pair is the two rows' first
 * member keys, in order, with the names as they read now.
 */
export function tieFor(row: Pick<SitePartRow, 'memberKeys' | 'name' | 'key'>, other: Pick<SitePartRow, 'memberKeys' | 'name' | 'key'>, verdict: TieVerdict): { aKey: string; bKey: string; aName: string; bName: string; verdict: TieVerdict } {
  const x = row.memberKeys[0] ?? row.key
  const y = other.memberKeys[0] ?? other.key
  const [aKey, bKey] = orderedPair(x, y)
  const aIsRow = aKey === x
  return { aKey, bKey, aName: aIsRow ? row.name : other.name, bName: aIsRow ? other.name : row.name, verdict }
}

/** "2" 90 and 2" 90 pvc were joined by Dana on Nov 12." is the screen's; this is the pair's own words. */
export function tieNamesWords(tie: Pick<PartTie, 'aName' | 'bName'>): string {
  return `${tie.aName} and ${tie.bName}`
}
