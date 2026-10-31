/**
 * Extend a firm's coverage by area (punch list #222, PR 2, v2.6221). A firm in Austin covers the metro, not one
 * county at a time, and eight clicks and a save for San Antonio is how a map stops getting colored. A preset is one
 * press of the same clicks the picker makes: a county already the firm's stays, a free county colors, and another
 * firm's county is left as it is and named, for the person to press on the map, where the picker asks first.
 *
 * The metros are the Census metropolitan areas, spelled as `public/geo/tx-counties.json` spells them. Pure.
 */
import { countyWords, firmsOfCover, type CountyChange, type CountyCover, type Coverage } from './firmCounties'

export type AreaPreset = { key: string; label: string; counties: readonly string[] }

export const AREA_PRESETS: readonly AreaPreset[] = [
  { key: 'austin', label: 'Austin area', counties: ['Bastrop', 'Caldwell', 'Hays', 'Travis', 'Williamson'] },
  { key: 'san_antonio', label: 'San Antonio area', counties: ['Atascosa', 'Bandera', 'Bexar', 'Comal', 'Guadalupe', 'Kendall', 'Medina', 'Wilson'] },
]

export type AreaApplied = {
  next: Map<string, CountyCover>
  /** Free counties colored for the firm by this press. */
  colored: string[]
  /** Counties the firm already covered, first call or not. */
  kept: string[]
  /** Counties only other firms cover, left as they are, with their first call. */
  held: Array<{ county: string; byFirmId: string }>
}

/** One press of an area: every free county colors for the firm; the firm's own stay; another firm's are left and named. */
export function applyArea(draft: Coverage, counties: ReadonlyArray<string>, firmId: string): AreaApplied {
  const next = new Map(draft)
  const colored: string[] = []
  const kept: string[] = []
  const held: AreaApplied['held'] = []
  for (const county of counties) {
    const cover = draft.get(county) ?? null
    if (firmsOfCover(cover).includes(firmId)) kept.push(county)
    else if (cover) held.push({ county, byFirmId: cover.first })
    else {
      next.set(county, { first: firmId, also: [] })
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
 * `Takes off Bell County.`, `Moves Comal County from Alamo Collections Law.`, and since v2.6227 `Shares Comal
 * County with Alamo Collections Law.`, `Takes first call in Comal County from Alamo Collections Law.` and
 * `Gives first call in Comal County to Alamo Collections Law.` Empty when nothing changed for the firm.
 */
export function extendChangeWords(changes: ReadonlyArray<CountyChange>, firmId: string, holderName: (firmId: string) => string): string[] {
  const adds: string[] = []
  const offs: string[] = []
  const singles: string[] = []
  for (const c of changes) {
    const name = countyWords(c.county)
    const wasIn = firmsOfCover(c.from).includes(firmId)
    const isIn = firmsOfCover(c.to).includes(firmId)
    if (!wasIn && isIn) {
      if (!c.from) adds.push(name)
      else if (c.to!.first === firmId && c.to!.also.length === 0) singles.push(`Moves ${name} from ${holderName(c.from.first)}.`)
      else if (c.to!.first === firmId) singles.push(`Shares ${name} and takes first call from ${holderName(c.from.first)}.`)
      else singles.push(`Shares ${name} with ${holderName(c.to!.first)}.`)
    } else if (wasIn && !isIn) offs.push(name)
    else if (wasIn && isIn && c.from!.first !== firmId && c.to!.first === firmId) singles.push(`Takes first call in ${name} from ${holderName(c.from!.first)}.`)
    else if (wasIn && isIn && c.from!.first === firmId && c.to!.first !== firmId) singles.push(`Gives first call in ${name} to ${holderName(c.to!.first)}.`)
  }
  const out: string[] = []
  if (adds.length) out.push(`Adds ${andList(adds)}.`)
  if (offs.length) out.push(`Takes off ${andList(offs)}.`)
  return [...out, ...singles]
}
