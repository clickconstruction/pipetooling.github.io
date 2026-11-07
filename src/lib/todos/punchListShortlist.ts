import { GROUP_LABELS, GROUP_ORDER, type BoardData, type BoardGroup, type BoardItem } from './todoBoard'
import { isOpenItem } from './punchListView'

/**
 * The Shortlist (v2.6618): every open row by group, smallest first, read from each to-do's own
 * `size` words. On 2026-11-06 Taunya asked for the sorted list she had been handed in chat to
 * live at the top of the board, so a reader sees what is cheap in each group without reading
 * eighty-eight size lines. Nothing is declared for it: the bucket is parsed from the free-text
 * `size` the card already carries, so the list is as fresh as the folder and cannot drift from it.
 * `npm run shortlist` prints the same list as markdown for a chat.
 *
 * The bucket is the card's own letter for what is left:
 * 1. a *left:* / *leftover* clause wins — `…, eight built; left: PR 7 (S)` reads S;
 * 2. else the biggest letter outside parentheses, a conditional clause skipped —
 *    `L as a train of six (M · M · S)` reads L, `S (PR 1) + M (PR 2)` reads M,
 *    `S (A) + M (B); C would be L` reads M, `S (PR 2, if wanted)` reads S;
 * 3. a letter only inside parentheses still counts when nothing stands outside them;
 * 4. a size with no letter at all is unsized and sorts last in its group.
 */
export const SIZE_BUCKETS = ['XS', 'S', 'M', 'L', 'XL'] as const
export type SizeBucket = (typeof SIZE_BUCKETS)[number]

/** The footer's working estimate for each letter, the words a chip's title carries. */
export const BUCKET_WORDS: Record<SizeBucket, string> = {
  XS: 'under an hour',
  S: 'a sitting',
  M: 'a day of PRs',
  L: 'a multi-day train',
  XL: 'a program of trains',
}

const LETTER = /\b(XS|XL|S|M|L)\b/g
const LEFT_CLAUSE = /\b(?:left|leftovers?|remaining)\b[^.;]*?\b(XS|XL|S|M|L)\b/
const CONDITIONAL = /\b(?:would|if wanted|only if)\b/i

function biggest(text: string, from: SizeBucket | null): SizeBucket | null {
  let best = from
  for (const m of text.matchAll(LETTER)) {
    const b = m[1] as SizeBucket
    if (best === null || SIZE_BUCKETS.indexOf(b) > SIZE_BUCKETS.indexOf(best)) best = b
  }
  return best
}

/** One level of parentheses removed, so a train's parts do not outrank the train's own letter. */
export function stripParens(text: string): string {
  let out = text
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/\([^()]*\)/g, ' ')
    if (next === out) break
    out = next
  }
  return out
}

export function sizeBucket(size: string | null | undefined): SizeBucket | null {
  const text = (size ?? '').trim()
  if (!text) return null
  const left = LEFT_CLAUSE.exec(text)
  if (left?.[1]) return left[1] as SizeBucket
  const outer = stripParens(text)
  let best: SizeBucket | null = null
  for (const clause of outer.split(/[;,]/)) {
    if (CONDITIONAL.test(clause)) continue
    best = biggest(clause, best)
  }
  if (best !== null) return best
  // Only a parenthetical names a letter: take it rather than call the card unsized.
  for (const clause of text.split(/[;,]/)) {
    if (CONDITIONAL.test(clause)) continue
    best = biggest(clause, best)
  }
  return best
}

export interface ShortlistRow {
  item: BoardItem
  bucket: SizeBucket | null
}

export interface ShortlistGroup {
  group: BoardGroup
  label: string
  rows: ShortlistRow[]
}

export interface Shortlist {
  /** Open rows per bucket, the whole board. */
  counts: Record<SizeBucket, number>
  /** Open rows whose size names no letter. */
  unsized: number
  /** Open rows in all (the pointer cards left out). */
  open: number
  /** Groups in the board's order, each sorted smallest first then by number; empty groups left out. */
  groups: ShortlistGroup[]
}

/** Smallest first, an unsized row last, then by number so two rows of one size keep a fixed order. */
export function compareShortlistRows(a: ShortlistRow, b: ShortlistRow): number {
  const ra = a.bucket ? SIZE_BUCKETS.indexOf(a.bucket) : SIZE_BUCKETS.length
  const rb = b.bucket ? SIZE_BUCKETS.indexOf(b.bucket) : SIZE_BUCKETS.length
  return ra !== rb ? ra - rb : a.item.number - b.item.number
}

export function shortlistFrom(items: readonly BoardItem[]): Shortlist {
  const rows = items.filter(isOpenItem).map((item) => ({ item, bucket: sizeBucket(item.size) }))
  const counts: Record<SizeBucket, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0 }
  let unsized = 0
  for (const r of rows) {
    if (r.bucket) counts[r.bucket]++
    else unsized++
  }
  const groups = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    rows: rows.filter((r) => r.item.group === group).sort(compareShortlistRows),
  })).filter((g) => g.rows.length > 0)
  return { counts, unsized, open: rows.length, groups }
}

/** `5 XS · 16 S · 43 M · 20 L · 3 XL · 1 unsized` — the buckets that have a row, in size order. */
export function countsLine(list: Pick<Shortlist, 'counts' | 'unsized'>): string {
  const parts = SIZE_BUCKETS.filter((b) => list.counts[b] > 0).map((b) => `${list.counts[b]} ${b}`)
  if (list.unsized > 0) parts.push(`${list.unsized} unsized`)
  return parts.join(' · ')
}

/** The chip's letter; an unsized row shows a dash. */
export function bucketLabel(bucket: SizeBucket | null): string {
  return bucket ?? '—'
}

/** The chip's title: the letter's working estimate, or why there is none. */
export function bucketTitle(bucket: SizeBucket | null, size: string): string {
  if (!bucket) return `Unsized — the card's size names no letter: ${size || 'empty'}`
  return `${bucket} — ${BUCKET_WORDS[bucket]} · the card says: ${size}`
}

export const SHORTLIST_BLURB =
  'Every open row by group, smallest first, from each card’s own size words: a train’s whole letter, else its biggest part, and a left clause wins. Press a number to jump to its row.'

/** The Shortlist as markdown — the counts, then one table per group — what `npm run shortlist` prints for a chat. */
export function renderShortlistMarkdown(list: Shortlist, validated: BoardData['validated']): string {
  const lines: string[] = []
  lines.push(`# Punch list shortlist — ${validated.date} at ${validated.version}`)
  lines.push('')
  lines.push(`${list.open} open items, smallest first in each group. ${countsLine(list)}.`)
  lines.push('')
  lines.push('| Size | Open items |')
  lines.push('|---|---|')
  for (const b of SIZE_BUCKETS) if (list.counts[b] > 0) lines.push(`| ${b} | ${list.counts[b]} |`)
  if (list.unsized > 0) lines.push(`| unsized | ${list.unsized} |`)
  for (const g of list.groups) {
    lines.push('')
    lines.push(`**${g.label} (${g.rows.length})**`)
    lines.push('')
    lines.push('| # | Size | Item |')
    lines.push('|---|---|---|')
    for (const r of g.rows) lines.push(`| ${r.item.number} | ${bucketLabel(r.bucket)} | ${r.item.name.replace(/\|/g, '\\|')} |`)
  }
  lines.push('')
  return lines.join('\n')
}
