import { classifyCourtPoint, type CourtArea, type CourtAreaPolygon } from './courtAreas'

/**
 * The Map page's Court areas mode (v2.4769, step 3 of the justice-court plan):
 * what a drawn shape becomes, what a new area needs before it is saved, and the
 * coverage line that says how much of the company's map the layer places.
 */

/** The polygon of a drawn shape — a GeoJSON Feature or bare geometry; null for anything else (a line, a point). */
export function polygonFromDrawn(gj: unknown): CourtAreaPolygon | null {
  if (!gj || typeof gj !== 'object') return null
  const f = gj as { type?: unknown; geometry?: unknown; coordinates?: unknown }
  const g = (f.type === 'Feature' ? f.geometry : gj) as { type?: unknown; coordinates?: unknown } | null
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return null
  if (g.type === 'Polygon' && (!Array.isArray(g.coordinates[0]) || (g.coordinates[0] as unknown[]).length < 4)) return null
  return g as CourtAreaPolygon
}

export type CourtAreaDraft = { county: string; precinct: string; label: string; sourceNote: string }

/** Null when the draft may be saved; else the one thing it still needs. */
export function courtAreaDraftProblem(d: CourtAreaDraft, existing: ReadonlyArray<Pick<CourtArea, 'county' | 'precinct' | 'active'>>, editingId?: string | null, existingIds?: ReadonlyArray<string>): string | null {
  if (!d.county.trim()) return 'Name the county.'
  if (!d.precinct.trim()) return 'Name the precinct as the county writes it: 2, 1-2, 3.'
  const dup = existing.findIndex((a) => a.active && a.county.trim().toLowerCase() === d.county.trim().toLowerCase() && a.precinct.trim().toLowerCase() === d.precinct.trim().toLowerCase())
  if (dup >= 0 && (!editingId || existingIds?.[dup] !== editingId)) return `${existing[dup]!.county.trim()} precinct ${existing[dup]!.precinct.trim()} is already drawn. A precinct in two pieces is one area drawn as one shape, or the first piece renamed.`
  return null
}

export type CourtCoverage = {
  placed: number
  outside: number
  onLine: number
  /** The pins no area holds, for the office to draw around next. */
  outsideLabels: string[]
  /** The pins on a line, with their note. */
  onLineLabels: string[]
}

/** How much of the map the layer places: every pin with a point, against the active areas. */
export function courtCoverage(pins: ReadonlyArray<{ label: string; lat: number | null; lng: number | null }>, areas: ReadonlyArray<CourtArea>): CourtCoverage {
  const out: CourtCoverage = { placed: 0, outside: 0, onLine: 0, outsideLabels: [], onLineLabels: [] }
  for (const p of pins) {
    if (p.lat == null || p.lng == null) continue
    const c = classifyCourtPoint({ lat: p.lat, lng: p.lng }, areas)
    if (!c.precinct) {
      out.outside += 1
      out.outsideLabels.push(p.label)
      continue
    }
    out.placed += 1
    if (c.onLine) {
      out.onLine += 1
      out.onLineLabels.push(`${p.label} · ${c.note}`)
    }
  }
  return out
}

/** `drawn by the office · 2026-10-07` · `imported · Bexar County GIS, 2026-10-07`. */
export function courtAreaSourceWords(a: Pick<CourtArea, 'source' | 'sourceNote'>, createdYmd: string): string {
  const who = a.source === 'imported' ? 'imported' : 'drawn by the office'
  return [who, a.sourceNote, createdYmd].filter(Boolean).join(' · ')
}

/** The areas grouped by county, counties by name, precincts by their label. */
export function courtAreasByCounty(areas: ReadonlyArray<CourtArea>): Array<{ county: string; areas: CourtArea[] }> {
  const by = new Map<string, CourtArea[]>()
  for (const a of areas) {
    const k = a.county.trim()
    by.set(k, [...(by.get(k) ?? []), a])
  }
  return [...by.entries()]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([county, list]) => ({ county, areas: [...list].sort((x, y) => x.precinct.localeCompare(y.precinct, undefined, { numeric: true })) }))
}
