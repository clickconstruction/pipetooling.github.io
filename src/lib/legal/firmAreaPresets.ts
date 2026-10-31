/**
 * Extend a firm's coverage by area (punch list #222, PR 2, v2.6221). A firm in Austin covers the metro, not one
 * county at a time, and eight clicks and a save for San Antonio is how a map stops getting colored. A preset is one
 * press of the same clicks the picker makes: a county already the firm's stays, a free county colors, and another
 * firm's county is left as it is and named, for the person to press on the map, where the picker asks first.
 *
 * The metros are the Census metropolitan areas, spelled as `public/geo/tx-counties.json` spells them. Pure.
 */
import { countyWords, type CountyAssignments, type CountyChange } from './firmCounties'

export type AreaPreset = { key: string; label: string; counties: readonly string[] }

export const AREA_PRESETS: readonly AreaPreset[] = [
  { key: 'austin', label: 'Austin area', counties: ['Bastrop', 'Caldwell', 'Hays', 'Travis', 'Williamson'] },
  { key: 'san_antonio', label: 'San Antonio area', counties: ['Atascosa', 'Bandera', 'Bexar', 'Comal', 'Guadalupe', 'Kendall', 'Medina', 'Wilson'] },
]

export type AreaApplied = {
  next: Map<string, string>
  /** Free counties colored for the firm by this press. */
  colored: string[]
  /** Counties the firm already covered. */
  kept: string[]
  /** Counties another firm covers, left as they are. */
  held: Array<{ county: string; byFirmId: string }>
}

/** One press of an area: every free county colors for the firm; the firm's own stay; another firm's are left and named. */
export function applyArea(draft: CountyAssignments, counties: ReadonlyArray<string>, firmId: string): AreaApplied {
  const next = new Map(draft)
  const colored: string[] = []
  const kept: string[] = []
  const held: AreaApplied['held'] = []
  for (const county of counties) {
    const holder = draft.get(county) ?? null
    if (holder === firmId) kept.push(county)
    else if (holder) held.push({ county, byFirmId: holder })
    else {
      next.set(county, firmId)
      colored.push(county)
    }
  }
  return { next, colored, kept, held }
}

/** `Bastrop`, `Bastrop and Hays`, `Bastrop, Caldwell and Hays`. */
export function andList(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The toast after an area press, one idea per sentence. */
export function areaWords(label: string, applied: Pick<AreaApplied, 'colored' | 'kept' | 'held'>, firmName: string, holderName: (firmId: string) => string): string {
  const parts: string[] = []
  const n = applied.colored.length
  parts.push(n === 0 ? `${label}: nothing new to add for ${firmName}.` : `${label}: ${n} ${n === 1 ? 'county' : 'counties'} added for ${firmName} once you save.`)
  if (applied.kept.length) parts.push(`${andList(applied.kept)} ${applied.kept.length === 1 ? 'was' : 'were'} already ${firmName}’s.`)
  for (const h of applied.held) parts.push(`${h.county} is ${holderName(h.byFirmId)}’s. Press it on the map to move it.`)
  return parts.join(' ')
}

/** The chip's words: `Austin area · 5`. */
export function areaChipWords(preset: Pick<AreaPreset, 'label' | 'counties'>): string {
  return `${preset.label} · ${preset.counties.length}`
}

/** The gap chip: `Counties with a case and no firm · 2`, or null when every case's county has a firm. */
export function gapChipWords(gapCounties: ReadonlyArray<string>): string | null {
  return gapCounties.length ? `Counties with a case and no firm · ${gapCounties.length}` : null
}

/**
 * What a save will change, from the firm's side, in sentences: `Adds Bastrop County and Hays County.`,
 * `Takes off Bell County.`, `Moves Comal County from Alamo Collections Law.` Empty when nothing changed.
 */
export function extendChangeWords(changes: ReadonlyArray<CountyChange>, firmId: string, holderName: (firmId: string) => string): string[] {
  const adds = changes.filter((c) => c.to === firmId && c.from === null).map((c) => countyWords(c.county))
  const offs = changes.filter((c) => c.from === firmId && c.to !== firmId).map((c) => countyWords(c.county))
  const moves = changes.filter((c) => c.to === firmId && c.from !== null && c.from !== firmId)
  const out: string[] = []
  if (adds.length) out.push(`Adds ${andList(adds)}.`)
  if (offs.length) out.push(`Takes off ${andList(offs)}.`)
  for (const m of moves) out.push(`Moves ${countyWords(m.county)} from ${holderName(m.from!)}.`)
  return out
}
