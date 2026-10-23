/**
 * Legal firms by county (punch list #144, PR 1, v2.5756): the rules behind the county
 * picker on Settings → Jobs & billing → Collections law firms, and the shared reads the
 * desk's Map lens (PR 3) and the portal's Who covers what (PR 4) use.
 *
 * The state is one map, county → firm id. `legal_firm_counties` holds it as one live row per
 * county (`until IS NULL`); the picker edits a draft of that map and saves the difference.
 * A county nobody covers is absent from the map: no default firm, ever. A click on a county
 * another firm holds never takes it over silently — the kernel answers `held` and the screen
 * asks before `moveCounty` applies it.
 */

export type LegalFirmCountyRow = {
  id: string
  firm_id: string
  county: string
  since: string
  until: string | null
  set_by: string | null
}

/** county → firm id. Counties with no firm are absent. */
export type CountyAssignments = ReadonlyMap<string, string>

type FirmLike = { id: string; name: string; active: boolean; created_at?: string | null }

/** The rows that stand today, for the firms that stand today (a retired firm's counties count as uncovered). */
export function liveFirmCountyRows<R extends Pick<LegalFirmCountyRow, 'firm_id' | 'until'>>(rows: ReadonlyArray<R>, activeFirmIds?: ReadonlySet<string>): R[] {
  return rows.filter((r) => r.until == null && (!activeFirmIds || activeFirmIds.has(r.firm_id)))
}

/** The saved map, county → firm id, from the live rows. */
export function savedAssignments(rows: ReadonlyArray<Pick<LegalFirmCountyRow, 'firm_id' | 'county' | 'until'>>, activeFirmIds?: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>()
  for (const r of liveFirmCountyRows(rows, activeFirmIds)) out.set(r.county, r.firm_id)
  return out
}

/** Each active firm's counties, sorted; a firm with none gets an empty list. */
export function countiesByFirm(rows: ReadonlyArray<Pick<LegalFirmCountyRow, 'firm_id' | 'county' | 'until'>>, firms: ReadonlyArray<FirmLike>): Map<string, string[]> {
  const active = firms.filter((f) => f.active)
  const out = new Map<string, string[]>(active.map((f) => [f.id, [] as string[]]))
  for (const [county, firmId] of savedAssignments(rows, new Set(active.map((f) => f.id)))) out.get(firmId)?.push(county)
  for (const list of out.values()) list.sort((a, b) => a.localeCompare(b))
  return out
}

/** The counties a firm holds in a draft, sorted. */
export function countiesOf(assignments: CountyAssignments, firmId: string): string[] {
  const out: string[] = []
  for (const [county, id] of assignments) if (id === firmId) out.push(county)
  return out.sort((a, b) => a.localeCompare(b))
}

export type CountyPress =
  | { kind: 'cleared' }
  | { kind: 'colored' }
  | { kind: 'held'; byFirmId: string }

/**
 * One click on a county with a firm picked. Its own county clears; a free county colors;
 * another firm's county is left as it was and answered `held`, for the screen to ask.
 */
export function pressCounty(draft: CountyAssignments, county: string, firmId: string): { next: Map<string, string>; press: CountyPress } {
  const next = new Map(draft)
  const holder = draft.get(county) ?? null
  if (holder === firmId) {
    next.delete(county)
    return { next, press: { kind: 'cleared' } }
  }
  if (holder) return { next, press: { kind: 'held', byFirmId: holder } }
  next.set(county, firmId)
  return { next, press: { kind: 'colored' } }
}

/** After the person said yes: the county moves to the picked firm. */
export function moveCounty(draft: CountyAssignments, county: string, firmId: string): Map<string, string> {
  const next = new Map(draft)
  next.set(county, firmId)
  return next
}

export type CountyChange = { county: string; from: string | null; to: string | null }

/** What differs between the saved map and the draft, by county. Empty means nothing to save. */
export function countyChanges(saved: CountyAssignments, draft: CountyAssignments): CountyChange[] {
  const counties = new Set<string>([...saved.keys(), ...draft.keys()])
  const out: CountyChange[] = []
  for (const county of counties) {
    const from = saved.get(county) ?? null
    const to = draft.get(county) ?? null
    if (from !== to) out.push({ county, from, to })
  }
  return out.sort((a, b) => a.county.localeCompare(b.county))
}

/**
 * The writes a save makes, in order: close the live row of every county that changes hands
 * or clears, then insert the new live rows. Closes go first so the one-firm-per-county index
 * never sees two live rows for a county.
 */
export function countyWritePlan(changes: ReadonlyArray<CountyChange>, setBy: string | null): { close: string[]; insert: Array<{ firm_id: string; county: string; set_by: string | null }> } {
  const close = changes.filter((c) => c.from !== null).map((c) => c.county)
  const insert = changes.filter((c): c is CountyChange & { to: string } => c.to !== null).map((c) => ({ firm_id: c.to, county: c.county, set_by: setBy }))
  return { close, insert }
}

function countyCount(n: number): string {
  return `${n} ${n === 1 ? 'county' : 'counties'}`
}

/** Under the Save button: `Nothing to save.` or `2 counties changed. Save to make it so.` */
export function changedWords(changed: number): string {
  return changed === 0 ? 'Nothing to save.' : `${countyCount(changed)} changed. Save to make it so.`
}

/** A firm card's county line: `3 counties · Bexar, Comal, Guadalupe`, or `No counties yet`. */
export function countiesLine(counties: ReadonlyArray<string>): string {
  if (counties.length === 0) return 'No counties yet'
  return `${countyCount(counties.length)} · ${counties.join(', ')}`
}

/** `Bexar County` — the county as the desk names it. */
export function countyWords(county: string): string {
  return /county$/i.test(county.trim()) ? county.trim() : `${county.trim()} County`
}

/** The toast after a press, in the mock-up's words. */
export function pressWords(press: CountyPress, county: string, firmName: string, holderName?: string): string {
  if (press.kind === 'cleared') return `${county} cleared. No firm covers it until you pick one.`
  if (press.kind === 'colored') return `${county} is ${firmName}’s once you save.`
  return `${county} is ${holderName ?? 'another firm'}’s. Open that firm to clear it, or move it.`
}

/** The question before a county moves between firms. */
export function moveQuestion(county: string, holderName: string, firmName: string): string {
  return `${county} is ${holderName}’s. Move it to ${firmName}? Matters already with ${holderName} stay there.`
}

/** The toast after a move. */
export function movedWords(county: string, firmName: string): string {
  return `${county} moved to ${firmName}. New releases there go to them.`
}

/** The words after a save: `3 counties saved. The Legal desk reads them now.` */
export function savedWords(changed: number): string {
  return `${countyCount(changed)} saved. The Legal desk reads them now.`
}

/** A firm's colors on the map and its card: theme tokens, so light and dark both read. */
export type FirmHue = { fill: string; ink: string; border: string }

export const FIRM_HUES: ReadonlyArray<FirmHue> = [
  { fill: 'var(--bg-blue-200)', ink: 'var(--text-blue-800)', border: 'var(--border-blue)' },
  { fill: 'var(--bg-indigo-200)', ink: 'var(--text-indigo-800)', border: 'var(--bg-indigo-200)' },
  { fill: 'var(--bg-green-200)', ink: 'var(--text-green-800)', border: 'var(--border-green)' },
  { fill: 'var(--bg-amber-200)', ink: 'var(--text-amber-800)', border: 'var(--border-amber)' },
  { fill: 'var(--bg-orange-100)', ink: 'var(--text-orange-800)', border: 'var(--border-orange)' },
  { fill: 'var(--bg-red-200)', ink: 'var(--text-red-800)', border: 'var(--border-red)' },
]

/** The uncovered county. */
export const NO_FIRM_HUE: FirmHue = { fill: 'var(--bg-muted)', ink: 'var(--text-muted)', border: 'var(--border)' }

/**
 * Each firm's hue, by its place among the active firms oldest first, so the picker, the lens
 * and the portal agree. Past six firms the hues repeat.
 */
export function firmHues(firms: ReadonlyArray<FirmLike>): Map<string, FirmHue> {
  const ordered = firms
    .filter((f) => f.active)
    .slice()
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
  return new Map(ordered.map((f, i) => [f.id, FIRM_HUES[i % FIRM_HUES.length] ?? NO_FIRM_HUE]))
}

export type FirmLegendRow = { firmId: string | null; name: string; hue: FirmHue; counties: string[] }

/** The legend under the map: one row per active firm with its counties, then `No firm yet`. */
export function firmLegend(firms: ReadonlyArray<FirmLike>, assignments: CountyAssignments): FirmLegendRow[] {
  const hues = firmHues(firms)
  const rows: FirmLegendRow[] = []
  for (const [firmId, hue] of hues) {
    const firm = firms.find((f) => f.id === firmId)
    rows.push({ firmId, name: firm?.name ?? '', hue, counties: countiesOf(assignments, firmId) })
  }
  rows.push({ firmId: null, name: 'No firm yet', hue: NO_FIRM_HUE, counties: [] })
  return rows
}
