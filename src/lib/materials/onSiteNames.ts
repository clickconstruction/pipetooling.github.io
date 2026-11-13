/**
 * Names at the source (punch list #330, PR 2): the part names a job already holds, offered while a
 * person types a new one, so the same part is not typed a second way. The first site read had about
 * a hundred typed names for its boxes and the same fitting under four spellings; the cheapest fold
 * is the spelling that is never typed.
 *
 * Pure. A name is offered when every word typed is in it, read through the same-words fold
 * (`sameWordsKey`), so `2 inch 90` finds `2" 90 pvc`. Picking one adds to that exact line.
 */
import { compareLabels, type Container, type ContainerLine } from './onSite'
import { rollKey, sameWordsKey } from './siteRollup'

/** A name a job already holds, as a row to pick. */
export type OnHandName = {
  key: string
  partId: string | null
  /** The spelling with the most pieces: what a pick writes. */
  partName: string
  manufacturer: string | null
  pieces: number
  /** The live boxes that hold it, most pieces first. */
  boxes: string[]
}

/** The names on hand in a job's live boxes, one per same-words key, most pieces first. */
export function onHandNames(lines: ReadonlyArray<ContainerLine>, containers: ReadonlyArray<Container>): OnHandName[] {
  const live = new Map(containers.filter((c) => !c.retiredAt).map((c) => [c.id, c] as const))
  const acc = new Map<string, { name: OnHandName; spellings: Map<string, number>; boxes: Map<string, number> }>()
  for (const l of lines) {
    const c = live.get(l.containerId)
    if (!c || l.onHand <= 0) continue
    const key = rollKey(l)
    let a = acc.get(key)
    if (!a) {
      a = { name: { key, partId: l.partId, partName: l.partName, manufacturer: l.manufacturer, pieces: 0, boxes: [] }, spellings: new Map(), boxes: new Map() }
      acc.set(key, a)
    }
    a.name.pieces += l.onHand
    a.spellings.set(l.partName, (a.spellings.get(l.partName) ?? 0) + l.onHand)
    a.boxes.set(c.label, (a.boxes.get(c.label) ?? 0) + l.onHand)
    if (!a.name.manufacturer && l.manufacturer) a.name.manufacturer = l.manufacturer
  }
  const out: OnHandName[] = []
  for (const a of acc.values()) {
    const top = [...a.spellings.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]
    if (top) a.name.partName = top[0]
    a.name.boxes = [...a.boxes.entries()].sort((x, y) => y[1] - x[1] || compareLabels(x[0], y[0])).map(([label]) => label)
    out.push(a.name)
  }
  return out.sort((x, y) => y.pieces - x.pieces || compareLabels(x.partName, y.partName))
}

export const ON_HAND_NAMES_MAX = 6

/**
 * The names to offer for what was typed: every folded word typed sits inside a word of the name.
 * A name with exactly the same words comes first, then the names with more whole-word hits, then
 * the most pieces. Nothing for nothing typed.
 */
export function matchOnHandNames(names: ReadonlyArray<OnHandName>, typed: string, max = ON_HAND_NAMES_MAX): OnHandName[] {
  const typedKey = sameWordsKey(typed)
  const words = typedKey.split(' ').filter(Boolean)
  if (words.length === 0) return []
  const scored: Array<{ name: OnHandName; exact: boolean; whole: number }> = []
  for (const name of names) {
    const nameKey = sameWordsKey(`${name.partName} ${name.manufacturer ?? ''}`)
    const nameWords = nameKey.split(' ').filter(Boolean)
    if (!words.every((w) => nameWords.some((nw) => nw.includes(w)))) continue
    scored.push({ name, exact: sameWordsKey(name.partName) === typedKey, whole: words.filter((w) => nameWords.includes(w)).length })
  }
  scored.sort((a, b) => Number(b.exact) - Number(a.exact) || b.whole - a.whole || b.name.pieces - a.name.pieces || compareLabels(a.name.partName, b.name.partName))
  return scored.slice(0, max).map((s) => s.name)
}

/** "94 in R12" · "164 in R12, R31 and 1 more": where a name already is, beside it. */
export function onHandNameWords(name: Pick<OnHandName, 'pieces' | 'boxes'>): string {
  const shown = name.boxes.slice(0, 2).join(', ')
  const more = name.boxes.length - 2
  return `${name.pieces.toLocaleString('en-US')} in ${shown}${more > 0 ? ` and ${more} more` : ''}`
}
