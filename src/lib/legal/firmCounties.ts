/**
 * Legal firms by county (punch list #144, PR 1, v2.5756): the rules behind the county
 * picker on Settings → Jobs & billing → Collections law firms, and the shared reads the
 * desk's Map lens (PR 3) and the portal's Who covers what (PR 4) use.
 *
 * Since v2.6227 (punch list #222, PR 3) several firms may cover one county, and one of them is
 * its **first call**: the firm the desk picks for a release there unless the office switches.
 * `legal_firm_counties` holds one live row per firm per county (`until IS NULL`) with a
 * `first_call` flag, at most one per county. The picker edits a draft `Coverage` (county →
 * first call and the firms that also cover it) and saves the difference through one database
 * call. Everything that only needs the firm the desk picks still reads `CountyAssignments`,
 * county → first-call firm (`firstCalls`). A county nobody covers is absent: no default firm,
 * ever. A press on a county another firm covers never takes it over silently — the kernel
 * answers `held` and the screen asks whether to share it, take first call, or move it.
 */

export type LegalFirmCountyRow = {
  id: string
  firm_id: string
  county: string
  since: string
  until: string | null
  set_by: string | null
  /** v2.6227: this firm is the county's first call. Absent before the migration, when each county had one row: read as true. */
  first_call?: boolean | null
}

/** county → the firm the desk picks there (the first call). Counties with no firm are absent. */
export type CountyAssignments = ReadonlyMap<string, string>

/** One county's firms: the first call, and the firms that also cover it, longest-standing first. */
export type CountyCover = { first: string; also: readonly string[] }

/** county → its cover. Counties with no firm are absent. */
export type Coverage = ReadonlyMap<string, CountyCover>

type FirmLike = { id: string; name: string; active: boolean; created_at?: string | null }

/** The rows that stand today, for the firms that stand today (a retired firm's counties count as uncovered). */
export function liveFirmCountyRows<R extends Pick<LegalFirmCountyRow, 'firm_id' | 'until'>>(rows: ReadonlyArray<R>, activeFirmIds?: ReadonlySet<string>): R[] {
  return rows.filter((r) => r.until == null && (!activeFirmIds || activeFirmIds.has(r.firm_id)))
}

type CoverRow = Pick<LegalFirmCountyRow, 'firm_id' | 'county' | 'until'> & { since?: string | null; id?: string; first_call?: boolean | null }

/**
 * The saved coverage from the live rows of the firms that stand. The first call is the row flagged
 * `first_call` (absent reads as true: before v2.6227 each county had one row); with none flagged, as
 * when the first call's firm was retired, the longest-standing firm leads. The rest also cover it.
 */
export function savedCoverage(rows: ReadonlyArray<CoverRow>, activeFirmIds?: ReadonlySet<string>): Map<string, CountyCover> {
  const byCounty = new Map<string, CoverRow[]>()
  for (const r of liveFirmCountyRows(rows, activeFirmIds)) byCounty.set(r.county, [...(byCounty.get(r.county) ?? []), r])
  const out = new Map<string, CountyCover>()
  for (const [county, list] of byCounty) {
    const sorted = [...list].sort((a, b) => (a.since ?? '').localeCompare(b.since ?? '') || (a.id ?? a.firm_id).localeCompare(b.id ?? b.firm_id))
    const first = sorted.find((r) => r.first_call !== false) ?? sorted[0]!
    const also = sorted.filter((r) => r !== first).map((r) => r.firm_id).filter((id, i, all) => id !== first.firm_id && all.indexOf(id) === i)
    out.set(county, { first: first.firm_id, also })
  }
  return out
}

/** county → first-call firm: what the venue rule, the map's colors and the legend's counts read. */
export function firstCalls(coverage: Coverage): Map<string, string> {
  const out = new Map<string, string>()
  for (const [county, cover] of coverage) out.set(county, cover.first)
  return out
}

/** county → the firms that also cover it, for the counties more than one firm covers. */
export function alsoCovers(coverage: Coverage): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>()
  for (const [county, cover] of coverage) if (cover.also.length) out.set(county, cover.also)
  return out
}

/** The cover's firms, first call first. */
export function firmsOfCover(cover: CountyCover | null | undefined): string[] {
  return cover ? [cover.first, ...cover.also] : []
}

/** A coverage where each county has one firm, from a first-call map (a draft or a fixture written the old way). */
export function coverageOf(assignments: CountyAssignments): Map<string, CountyCover> {
  const out = new Map<string, CountyCover>()
  for (const [county, firmId] of assignments) out.set(county, { first: firmId, also: [] })
  return out
}

/**
 * Coverage from each firm's counties when no first call is known (the portal's counts-only payload): the
 * firm earliest in `order` (the hue order, oldest first) leads a shared county; the rest also cover it.
 */
export function coverageFromCountiesByFirm(byFirm: ReadonlyMap<string, ReadonlyArray<string>>, order: ReadonlyArray<string> = [...byFirm.keys()]): Map<string, CountyCover> {
  const rank = (id: string) => {
    const i = order.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const firmsByCounty = new Map<string, string[]>()
  for (const [firmId, counties] of byFirm) for (const county of counties) firmsByCounty.set(county, [...(firmsByCounty.get(county) ?? []), firmId])
  const out = new Map<string, CountyCover>()
  for (const [county, firms] of firmsByCounty) {
    const sorted = [...firms].sort((a, b) => rank(a) - rank(b))
    out.set(county, { first: sorted[0]!, also: sorted.slice(1) })
  }
  return out
}

/** The saved map, county → first-call firm, from the live rows. */
export function savedAssignments(rows: ReadonlyArray<CoverRow>, activeFirmIds?: ReadonlySet<string>): Map<string, string> {
  return firstCalls(savedCoverage(rows, activeFirmIds))
}

/** Each firm's counties from a coverage, first call or not, sorted; `ids` seeds an empty list for a firm with none. */
export function countiesByFirmOfCoverage(coverage: Coverage, ids: ReadonlyArray<string> = []): Map<string, string[]> {
  const out = new Map<string, string[]>(ids.map((id) => [id, [] as string[]]))
  for (const [county, cover] of coverage) for (const firmId of firmsOfCover(cover)) out.set(firmId, [...(out.get(firmId) ?? []), county])
  for (const list of out.values()) list.sort((a, b) => a.localeCompare(b))
  return out
}

/** Each active firm's counties, first call or not, sorted; a firm with none gets an empty list. */
export function countiesByFirm(rows: ReadonlyArray<CoverRow>, firms: ReadonlyArray<FirmLike>): Map<string, string[]> {
  const active = firms.filter((f) => f.active)
  const ids = active.map((f) => f.id)
  return countiesByFirmOfCoverage(savedCoverage(rows, new Set(ids)), ids)
}

/** The counties a firm covers without being first call there, in a coverage. */
export function alsoCountiesOf(coverage: Coverage, firmId: string): Set<string> {
  const out = new Set<string>()
  for (const [county, cover] of coverage) if (cover.also.includes(firmId)) out.add(county)
  return out
}

/** The counties a firm is first call for in a draft, sorted. */
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
 * One press on a county with a firm picked. A free county colors for it, first call. A county it
 * covers, first call or not, clears for it; when it was first call and another firm also covers
 * the county, the longest-standing of those becomes first call. A county only other firms cover
 * is left as it was and answered `held` (with its first call), for the screen to ask.
 */
export function pressCounty(draft: Coverage, county: string, firmId: string): { next: Map<string, CountyCover>; press: CountyPress } {
  const next = new Map(draft)
  const cover = draft.get(county) ?? null
  if (!cover) {
    next.set(county, { first: firmId, also: [] })
    return { next, press: { kind: 'colored' } }
  }
  if (cover.first === firmId) {
    if (cover.also.length) next.set(county, { first: cover.also[0]!, also: cover.also.slice(1) })
    else next.delete(county)
    return { next, press: { kind: 'cleared' } }
  }
  if (cover.also.includes(firmId)) {
    next.set(county, { first: cover.first, also: cover.also.filter((id) => id !== firmId) })
    return { next, press: { kind: 'cleared' } }
  }
  return { next, press: { kind: 'held', byFirmId: cover.first } }
}

/** The three answers to a held county: cover it too, take first call there, or take it over. */
export type HeldAnswer = 'share' | 'first_call' | 'move'

/** After the person picked: the picked firm covers the county as they said. A county nobody covers colors for it. */
export function answerHeld(draft: Coverage, county: string, firmId: string, answer: HeldAnswer): Map<string, CountyCover> {
  const next = new Map(draft)
  const cover = draft.get(county) ?? null
  if (!cover || answer === 'move') {
    next.set(county, { first: firmId, also: [] })
    return next
  }
  const others = firmsOfCover(cover).filter((id) => id !== firmId)
  if (answer === 'share') next.set(county, cover.first === firmId ? cover : { first: cover.first, also: [...cover.also.filter((id) => id !== firmId), firmId] })
  else next.set(county, { first: firmId, also: others })
  return next
}

/** A firm that also covers a county takes first call there; the old first call keeps covering it. No-op otherwise. */
export function makeFirstCall(draft: Coverage, county: string, firmId: string): Map<string, CountyCover> {
  const cover = draft.get(county) ?? null
  if (!cover || cover.first === firmId || !cover.also.includes(firmId)) return new Map(draft)
  return answerHeld(draft, county, firmId, 'first_call')
}

/** `move` for the old two-way question (kept for callers that never share). */
export function moveCounty(draft: Coverage, county: string, firmId: string): Map<string, CountyCover> {
  return answerHeld(draft, county, firmId, 'move')
}

export type CountyChange = { county: string; from: CountyCover | null; to: CountyCover | null }

function sameCover(a: CountyCover | null, b: CountyCover | null): boolean {
  if (!a || !b) return a === b
  if (a.first !== b.first) return false
  const x = [...a.also].sort()
  const y = [...b.also].sort()
  return x.length === y.length && x.every((id, i) => id === y[i])
}

/** What differs between the saved coverage and the draft, by county: a firm added or gone, or the first call moved. Empty means nothing to save. */
export function countyChanges(saved: Coverage, draft: Coverage): CountyChange[] {
  const counties = new Set<string>([...saved.keys(), ...draft.keys()])
  const out: CountyChange[] = []
  for (const county of counties) {
    const from = saved.get(county) ?? null
    const to = draft.get(county) ?? null
    if (!sameCover(from, to)) out.push({ county, from, to })
  }
  return out.sort((a, b) => a.county.localeCompare(b.county))
}

/** One county as `legal_save_county_coverage` takes it: the firms that should cover it, its first call, and the firms the picker read. */
export type CountySave = { county: string; firms: string[]; first_call: string | null; was: string[] }

/**
 * The save's payload. `was` lets the database refuse a county another tab changed since this picker
 * read it (the save then changes nothing); an empty `firms` clears the county.
 */
export function countySavePayload(changes: ReadonlyArray<CountyChange>): CountySave[] {
  return changes.map((c) => ({ county: c.county, firms: firmsOfCover(c.to), first_call: c.to?.first ?? null, was: firmsOfCover(c.from).sort() }))
}

function countyCount(n: number): string {
  return `${n} ${n === 1 ? 'county' : 'counties'}`
}

/** Under the Save button: `Nothing to save.` or `2 counties changed. Save to make it so.` */
export function changedWords(changed: number): string {
  return changed === 0 ? 'Nothing to save.' : `${countyCount(changed)} changed. Save to make it so.`
}

/**
 * A firm card's county line: `3 counties · Bexar, Comal, Guadalupe`, or `No counties yet`. A county the firm
 * covers without being first call there reads `Comal (also)` (v2.6227).
 */
export function countiesLine(counties: ReadonlyArray<string>, alsoIn: ReadonlySet<string> = new Set()): string {
  if (counties.length === 0) return 'No counties yet'
  return `${countyCount(counties.length)} · ${counties.map((c) => (alsoIn.has(c) ? `${c} (also)` : c)).join(', ')}`
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

/** The held county's three answers, each a label and one plain line under it (v2.6227). */
export function heldChoices(county: string, holderName: string, firmName: string): Array<{ answer: HeldAnswer; label: string; detail: string }> {
  return [
    { answer: 'share', label: 'Share it', detail: `Both cover ${county}. ${holderName} stays first call, and the office can switch a release to ${firmName}.` },
    { answer: 'first_call', label: `Make ${firmName} first call`, detail: `Both cover ${county}. New releases there go to ${firmName} unless the office switches.` },
    { answer: 'move', label: `Move it to ${firmName}`, detail: `${holderName} stops covering ${county}.` },
  ]
}

/** Over the three answers: whose county it is and what never moves. */
export function heldQuestion(county: string, holderName: string, firmName: string): string {
  return `${county} is ${holderName}’s. How should ${firmName} cover it? Matters already with ${holderName} stay there.`
}

/** The toast after an answer. */
export function heldDoneWords(answer: HeldAnswer, county: string, firmName: string, holderName: string): string {
  if (answer === 'share') return `${firmName} covers ${county} too once you save. ${holderName} stays first call.`
  if (answer === 'first_call') return `${firmName} is first call in ${county} once you save. ${holderName} still covers it.`
  return movedWords(county, firmName)
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
